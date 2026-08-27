"""AI model catalog — single source of truth for which (provider, model)
pairs a user can select for AI-powered features. Currently backs one
feature (the Suggestion engine, core/suggestion_engine.py); adding a new
selectable model later is a one-line change here, not a hunt through every
LLM call site. Mirrored (labels/order) on the frontend in
src/features/preferences/aiModels.ts — keep the two in sync if this list
changes.
"""
from typing import NamedTuple


class AiModelOption(NamedTuple):
    key: str       # stored in Preference.ai_prefs.model
    provider: str  # emergentintegrations provider id
    model: str     # emergentintegrations model id
    label: str


AI_MODEL_CATALOG: list[AiModelOption] = [
    AiModelOption("gpt-5.4", "openai", "gpt-5.4", "GPT-5.4"),
    AiModelOption("claude-sonnet-5", "anthropic", "claude-sonnet-5", "Claude Sonnet 5"),
    AiModelOption("claude-sonnet-4-6", "anthropic", "claude-sonnet-4-6", "Claude Sonnet 4.6"),
    AiModelOption("claude-haiku-4-5", "anthropic", "claude-haiku-4-5-20251001", "Claude Haiku 4.5"),
]

_BY_KEY = {opt.key: opt for opt in AI_MODEL_CATALOG}
DEFAULT_MODEL_KEY = "gpt-5.4"


def resolve_model(key: str | None) -> AiModelOption:
    """Never raises — unknown/missing keys fall back to the default model
    so a bad/legacy preference doc can't take the suggestion engine down."""
    return _BY_KEY.get(key or "", _BY_KEY[DEFAULT_MODEL_KEY])
