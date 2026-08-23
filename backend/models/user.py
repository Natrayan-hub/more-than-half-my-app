from datetime import datetime
from typing import List, Literal, Optional

from pydantic import BaseModel, Field

from models.base import new_id, utcnow


class User(BaseModel):
    id: str = Field(default_factory=new_id)
    email: str
    auth_provider: Literal["password", "google"] = "password"
    # password_hash is 🔴 sensitive: stored, never serialized in API responses.
    password_hash: Optional[str] = Field(default=None, exclude=True)
    email_verified: bool = False
    plan: Literal["free", "plus"] = "free"
    plan_renews_at: Optional[datetime] = None
    status: Literal["active", "deletion_pending", "deleted"] = "active"
    mfa_enabled: bool = False
    created_at: datetime = Field(default_factory=utcnow)
    updated_at: datetime = Field(default_factory=utcnow)


class Profile(BaseModel):
    id: str  # == user_id
    user_id: str
    display_name: str
    avatar_url: Optional[str] = None
    # 🔴 Internal object-storage path — never a public URL. Excluded from API
    # responses; clients always fetch the image through GET /me/avatar.
    avatar_object_path: Optional[str] = Field(default=None, exclude=True)
    wake_time: str = "06:30"
    focus_areas: List[str] = []  # fitness | tasks | documents | family | creator
    units: Literal["metric", "imperial"] = "metric"
    theme: Literal["system", "light", "dark"] = "system"
    ai_enabled: bool = False
    timezone: str = "UTC"


class Device(BaseModel):
    id: str = Field(default_factory=new_id)
    user_id: str
    platform: Literal["ios", "android"]
    app_version: str
    push_token: Optional[str] = None
    last_seen_at: datetime = Field(default_factory=utcnow)
    revoked: bool = False
