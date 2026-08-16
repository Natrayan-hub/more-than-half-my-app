"""AI memory + suggestions routes (API design B.10). Suggestion generation
is server-side only via the Emergent-managed LLM key — see
core/suggestion_engine.py for the PII-minimized context + model call."""
from datetime import datetime, timedelta
from typing import Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core import db as database
from core.suggestion_engine import generate_suggestion_payload
from models import AIMemoryEntry, Suggestion, utcnow
from routes.deps import get_current_user_id

router = APIRouter(prefix="/ai", tags=["ai"])


async def _require_ai_enabled(user_id: str) -> None:
    """B.10 header: all /ai/* routes 403 SCOPE_DENIED if ai_enabled=false."""
    profile = await database.profiles.find_one({"id": user_id}, {"_id": 0, "ai_enabled": 1})
    if not profile or not profile.get("ai_enabled"):
        raise HTTPException(status_code=403, detail="SCOPE_DENIED")


class MemoryCreate(BaseModel):
    domain: str  # routine | preference | dismissal
    statement: str
    structured: Dict = {}
    provenance: Dict = {}
    author: str = "user"


class MemoryListResponse(BaseModel):
    items: List[AIMemoryEntry]


@router.get("/memory", response_model=MemoryListResponse)
async def list_memory(
    domain: Optional[str] = None,
    user_id: str = Depends(get_current_user_id),
):
    await _require_ai_enabled(user_id)
    query: dict = {"user_id": user_id, "deleted_at": None}
    if domain:
        query["domain"] = domain
    docs = (
        await database.ai_memory.find(query, {"_id": 0})
        .sort("created_at", -1)
        .to_list(200)
    )
    return {"items": [AIMemoryEntry(**doc) for doc in docs]}


@router.post("/memory", response_model=AIMemoryEntry, status_code=201)
async def create_memory(body: MemoryCreate, user_id: str = Depends(get_current_user_id)):
    await _require_ai_enabled(user_id)
    entry = AIMemoryEntry(user_id=user_id, **body.model_dump())
    # Idempotent per structured key when provided (onboarding re-saves overwrite).
    key = body.structured.get("key")
    if key:
        await database.ai_memory.delete_many(
            {"user_id": user_id, "structured.key": key},
        )
    await database.ai_memory.insert_one(entry.model_dump())
    return entry


# ---- Suggestions (B.10 #1-3) -----------------------------------------------

class SuggestionListResponse(BaseModel):
    items: List[Suggestion]


async def _maybe_generate_suggestion(user_id: str) -> Optional[dict]:
    """Lazily generates at most one suggestion per call, respecting the
    per-day cap from Preference.notif_prefs.suggestions_per_day. No
    background jobs in this MVP — generation happens on the read path."""
    pref = await database.preferences.find_one({"id": user_id}, {"_id": 0, "notif_prefs": 1})
    notif_prefs = (pref or {}).get("notif_prefs", {})
    if notif_prefs.get("ai_suggestions") is False:
        return None

    cap = notif_prefs.get("suggestions_per_day", 3)
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_count = await database.suggestions.count_documents(
        {"user_id": user_id, "created_at": {"$gte": today_start}},
    )
    if today_count >= cap:
        return None

    payload = await generate_suggestion_payload(user_id)
    if not payload:
        return None

    suggestion = Suggestion(
        user_id=user_id,
        expires_at=today_start + timedelta(days=1),
        **payload,
    )
    doc = suggestion.model_dump()
    await database.suggestions.insert_one(doc)
    return doc


@router.get("/suggestions", response_model=SuggestionListResponse)
async def list_suggestions(
    status: str = "pending",
    user_id: str = Depends(get_current_user_id),
):
    await _require_ai_enabled(user_id)
    now = utcnow()

    if status == "pending":
        await database.suggestions.update_many(
            {"user_id": user_id, "status": "pending", "expires_at": {"$lt": now}},
            {"$set": {"status": "expired"}},
        )
        doc = await database.suggestions.find_one(
            {"user_id": user_id, "status": "pending"}, {"_id": 0},
        )
        if not doc:
            doc = await _maybe_generate_suggestion(user_id)
        items = [Suggestion(**doc)] if doc else []
    else:
        docs = (
            await database.suggestions.find({"user_id": user_id, "status": status}, {"_id": 0})
            .sort("created_at", -1)
            .to_list(50)
        )
        items = [Suggestion(**d) for d in docs]

    return {"items": items}


@router.post("/suggestions/{suggestion_id}/accept")
async def accept_suggestion(suggestion_id: str, user_id: str = Depends(get_current_user_id)):
    await _require_ai_enabled(user_id)
    doc = await database.suggestions.find_one({"id": suggestion_id, "user_id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="SUGGESTION_NOT_FOUND")
    if doc["status"] != "pending":
        raise HTTPException(status_code=400, detail="SUGGESTION_NOT_PENDING")

    changed: Dict[str, dict] = {}
    action = doc.get("proposed_action")
    if action and action.get("type") == "reschedule_task":
        task_doc = await database.tasks.find_one_and_update(
            {"id": action["task_id"], "user_id": user_id, "deleted_at": None},
            {"$set": {"bucket": action.get("new_bucket") or "today"}, "$inc": {"version": 1}},
            projection={"_id": 0},
            return_document=True,
        )
        if task_doc:
            changed["task"] = task_doc

    await database.suggestions.update_one(
        {"id": suggestion_id}, {"$set": {"status": "accepted"}},
    )
    return {"status": "accepted", "changed": changed}


class DismissBody(BaseModel):
    never_again: bool = False


@router.post("/suggestions/{suggestion_id}/dismiss")
async def dismiss_suggestion(
    suggestion_id: str, body: DismissBody = DismissBody(),
    user_id: str = Depends(get_current_user_id),
):
    await _require_ai_enabled(user_id)
    doc = await database.suggestions.find_one({"id": suggestion_id, "user_id": user_id})
    if not doc:
        raise HTTPException(status_code=404, detail="SUGGESTION_NOT_FOUND")

    await database.suggestions.update_one(
        {"id": suggestion_id}, {"$set": {"status": "dismissed"}},
    )

    if body.never_again:
        entry = AIMemoryEntry(
            user_id=user_id,
            domain="dismissal",
            statement=f"Doesn't want suggestions like: {doc['text']}",
            structured={"kind": doc.get("kind")},
            provenance={"source": "learned", "evidence": doc["id"]},
            author="system",
        )
        await database.ai_memory.insert_one(entry.model_dump())

    return {"status": "dismissed"}
