from datetime import datetime
from typing import Dict, List, Literal, Optional

from pydantic import BaseModel


class DataControls(BaseModel):
    """S34 per-domain privacy policy — the source of truth enforced by the
    sync dual-gate (client outbox filter + server policy re-check, §C.4)."""
    tasks: Literal["cloud", "local"] = "cloud"
    documents: Literal["cloud", "local"] = "cloud"
    health_cache: Literal["cloud", "local"] = "local"  # local-only unless opted in
    ai_memory: Literal["cloud", "local", "off"] = "cloud"
    photos: Literal["cloud", "off"] = "off"


class DisplayPrefs(BaseModel):
    """S25 Appearance — theme itself lives on Profile; these are the
    remaining display knobs (font size follows a scale factor since OS text
    size isn't directly readable cross-platform; reduce motion is honored by
    disabling non-essential Reanimated transitions)."""
    font_scale: float = 1.0  # 0.85 - 1.3, applied as a multiplier over base type sizes
    reduce_motion: bool = False


class BackupPrefs(BaseModel):
    """S32 Cloud Sync & Backup — frequency is illustrative (no real
    scheduler yet); last_backup_at is real, set by POST /documents/backup."""
    frequency: Literal["manual", "daily", "weekly"] = "manual"
    last_backup_at: Optional[datetime] = None


class AiPrefs(BaseModel):
    """Which model powers AI-generated features (currently: the Today
    Suggestion engine). Keys must match core/ai_models.py AI_MODEL_CATALOG —
    resolve_model() falls back to the default for any unknown/legacy value,
    so this field is intentionally a plain str rather than a Literal (avoids
    a breaking schema change if the catalog grows)."""
    model: str = "gpt-5.4"


class Preference(BaseModel):
    id: str  # == user_id
    user_id: str
    notif_prefs: Dict = {
        "task_reminders": True,
        "ai_suggestions": True,
        "suggestions_per_day": 3,
        "health_nudges": True,
        "backup_alerts": "failures_only",
        "weekly_recap": "in_app",
        "quiet_hours": {"start": "22:00", "end": "07:00"},
        "automation_alerts": True,
        "email_digests": False,
    }
    sync_prefs: Dict = {"wifi_only": False, "background": True}
    data_controls: DataControls = DataControls()
    display_prefs: DisplayPrefs = DisplayPrefs()
    backup_prefs: BackupPrefs = BackupPrefs()
    ai_prefs: AiPrefs = AiPrefs()
    app_lock: Dict = {"enabled": False, "scope": "vault", "auto_lock_min": 5}
    today_cards: List[Dict] = []  # card visibility + pin order (S25)
