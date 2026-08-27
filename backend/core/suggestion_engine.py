"""Server-side suggestion generation (PRD §6.2 Smart Suggestions, Technical
Foundation B.10). LLM usage is SERVER-SIDE ONLY via the Emergent-managed
universal key — the client never talks to the model directly.

PII minimization (§6.4 guardrail): we never send email, display name, or
device/location identifiers. Task titles ARE sent because they're the app's
own substantive content the feature reasons about (no task-aware suggestion
is possible without them) — this mirrors how a calendar assistant needs
event titles. Health inputs sent are aggregate values only (a total, a
single mood score, a weight delta), never raw log history.

Each call is a fresh, single-turn, stateless LlmChat — this is one-shot
structured generation (parsed as JSON, never streamed to a UI), not a
conversation a user continues, so no chat-history persistence is needed.
"""
import json
import logging
import os
import re
from datetime import datetime, timedelta
from typing import Optional

from emergentintegrations.llm.chat import LlmChat, UserMessage

from core import db as database
from core.ai_models import resolve_model

logger = logging.getLogger("lifeos")

SYSTEM_PROMPT = (
    "You are Nannu's quiet, explainable suggestion engine. You receive a compact JSON "
    "snapshot of ONE user's current tasks, manual health logs, and known preferences. "
    "Produce at most ONE short, genuinely useful, actionable suggestion for right now.\n"
    "Rules:\n"
    "1. Only reference facts present in the JSON — never invent data, numbers, or ids.\n"
    "2. If nothing in the JSON is genuinely worth surfacing, set kind to \"none\".\n"
    "3. \"text\" must be under 140 characters, warm, concise, second person — end with a "
    "question if it proposes an action.\n"
    "4. \"reason\" must start with \"Based on\" and cite the specific input that justified it.\n"
    "5. If kind is \"reschedule_task\", \"task_id\" MUST be exactly one id copied from "
    "candidate_tasks — never invent one. Otherwise task_id must be null.\n"
    "6. Respond with ONLY minified JSON, no markdown fences, matching exactly this shape:\n"
    "{\"kind\":\"reschedule_task|reminder|insight|none\",\"text\":\"...\",\"reason\":\"...\","
    "\"task_id\":null,\"new_bucket\":null}"
)

_JSON_RE = re.compile(r"\{.*\}", re.DOTALL)
_VALID_KINDS = {"reschedule_task", "reminder", "insight"}


async def _build_context(user_id: str) -> dict:
    now = datetime.utcnow()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    profile = await database.profiles.find_one({"id": user_id}, {"_id": 0}) or {}

    open_tasks = await database.tasks.find(
        {"user_id": user_id, "deleted_at": None, "completed_at": None},
        {"_id": 0, "id": 1, "title": 1, "due_at": 1},
    ).sort("due_at", 1).to_list(50)

    overdue = [t for t in open_tasks if t.get("due_at") and t["due_at"] < now]
    due_today = [
        t for t in open_tasks
        if t.get("due_at") and today_start <= t["due_at"] < today_start + timedelta(days=1)
    ]
    seen: set = set()
    candidates = []
    for t in overdue + due_today:
        if t["id"] not in seen:
            seen.add(t["id"])
            candidates.append(t)
    candidates = candidates[:5]

    water_today = await database.health_entries.find(
        {"user_id": user_id, "type": "water", "deleted_at": None, "logged_at": {"$gte": today_start}},
        {"_id": 0, "value": 1},
    ).to_list(50)
    water_ml_today = sum(e["value"] for e in water_today)

    mood_recent = await database.health_entries.find(
        {"user_id": user_id, "type": "mood", "deleted_at": None},
        {"_id": 0, "value": 1},
    ).sort("logged_at", -1).to_list(1)

    weight_recent = await database.health_entries.find(
        {"user_id": user_id, "type": "weight", "deleted_at": None},
        {"_id": 0, "value": 1},
    ).sort("logged_at", -1).to_list(2)
    weight_trend_kg = (
        round(weight_recent[0]["value"] - weight_recent[1]["value"], 1)
        if len(weight_recent) == 2 else None
    )

    memory_docs = await database.ai_memory.find(
        {"user_id": user_id, "deleted_at": None, "domain": {"$in": ["routine", "preference"]}},
        {"_id": 0, "statement": 1},
    ).sort("created_at", -1).to_list(5)

    hour = now.hour
    time_of_day = "morning" if hour < 12 else "afternoon" if hour < 18 else "evening"

    return {
        "time_of_day": time_of_day,
        "focus_areas": profile.get("focus_areas", []),
        "known_preferences": [m["statement"] for m in memory_docs],
        "open_task_count": len(open_tasks),
        "overdue_count": len(overdue),
        "due_today_count": len(due_today),
        "candidate_tasks": [
            {"id": t["id"], "title": t["title"], "due_at": t["due_at"].isoformat() if t.get("due_at") else None}
            for t in candidates
        ],
        "water_ml_today": water_ml_today,
        "water_goal_ml": 2000,
        "latest_mood_1to5": mood_recent[0]["value"] if mood_recent else None,
        "weight_trend_kg": weight_trend_kg,
    }


def _has_anything_worth_reasoning_about(context: dict) -> bool:
    return bool(
        context["open_task_count"] or context["water_ml_today"]
        or context["latest_mood_1to5"] or context["weight_trend_kg"]
        or context["known_preferences"]
    )


async def generate_suggestion_payload(user_id: str) -> Optional[dict]:
    """Returns a dict ready to build a `Suggestion`, or None if there's
    nothing worth surfacing (including: no data yet, model declined, or
    the model's response failed validation)."""
    context = await _build_context(user_id)
    if not _has_anything_worth_reasoning_about(context):
        return None

    api_key = os.environ.get("EMERGENT_LLM_KEY")
    if not api_key:
        logger.warning("EMERGENT_LLM_KEY not configured — skipping suggestion generation")
        return None

    pref = await database.preferences.find_one({"id": user_id}, {"_id": 0, "ai_prefs": 1})
    model_key = ((pref or {}).get("ai_prefs") or {}).get("model")
    model_option = resolve_model(model_key)

    chat = LlmChat(
        api_key=api_key,
        session_id=f"suggestion-{user_id}-{now_token()}",
        system_message=SYSTEM_PROMPT,
    ).with_model(model_option.provider, model_option.model)

    try:
        raw_text = await chat.send_message(UserMessage(text=json.dumps(context, default=str)))
    except Exception:
        logger.exception("Suggestion LLM call failed for user %s", user_id)
        return None

    match = _JSON_RE.search(raw_text or "")
    if not match:
        return None
    try:
        payload = json.loads(match.group(0))
    except json.JSONDecodeError:
        logger.warning("Suggestion LLM returned non-JSON payload: %r", raw_text[:200])
        return None

    kind = payload.get("kind")
    if kind not in _VALID_KINDS:
        return None
    text = (payload.get("text") or "").strip()
    reason = (payload.get("reason") or "").strip()
    if not text or not reason:
        return None

    proposed_action = None
    if kind == "reschedule_task":
        valid_ids = {t["id"] for t in context["candidate_tasks"]}
        task_id = payload.get("task_id")
        if task_id not in valid_ids:
            return None  # model hallucinated an id — discard rather than risk a bad write
        proposed_action = {
            "type": "reschedule_task",
            "task_id": task_id,
            "new_bucket": payload.get("new_bucket") if payload.get("new_bucket") in ("today", "upcoming") else "today",
        }

    sources = [
        {"type": k, "value": context[k]}
        for k in ("overdue_count", "due_today_count", "water_ml_today", "latest_mood_1to5", "weight_trend_kg")
        if context.get(k) not in (None, 0, [])
    ]

    return {
        "kind": kind,
        "text": text[:280],
        "reason": reason[:200],
        "sources": sources,
        "proposed_action": proposed_action,
    }


def now_token() -> str:
    """Unique-enough per-call session id suffix (no persistence needed)."""
    return datetime.utcnow().strftime("%Y%m%d%H%M%S%f")
