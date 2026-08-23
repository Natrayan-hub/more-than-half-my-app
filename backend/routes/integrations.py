"""Integrations & Connected Accounts (IA S26) — mock connect/disconnect (no
real OAuth yet; wired so a real integration_playbook swap-in later needs no
UI change). The Social Stats screen reuses this SAME connection record for
the Instagram provider, so there's one source of truth for "connected" state."""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core import db as database
from models.base import new_id, utcnow
from routes.deps import get_current_user_id

router = APIRouter(prefix="/integrations", tags=["integrations"])

CATALOG: dict = {
    "apple_health": {"label": "Apple Health", "direction": "read", "blurb": "Steps, sleep, heart rate"},
    "health_connect": {"label": "Google Health", "direction": "read", "blurb": "Steps, sleep, heart rate"},
    "garmin": {"label": "Garmin", "direction": "read", "blurb": "Workouts & recovery"},
    "google_calendar": {"label": "Calendar", "direction": "two_way", "blurb": "Events & free time"},
    "notion": {"label": "Notion", "direction": "two_way", "blurb": "Notes & docs"},
    "alexa": {"label": "Alexa", "direction": "read", "blurb": "Voice routines"},
    "instagram": {"label": "Instagram", "direction": "read", "blurb": "Follower & engagement stats"},
}


class IntegrationOut(BaseModel):
    provider: str
    label: str
    direction: str
    blurb: str
    status: str
    external_account: Optional[str] = None
    last_sync_at: Optional[datetime] = None


class IntegrationListResponse(BaseModel):
    items: List[IntegrationOut]


def _to_out(provider: str, record: Optional[dict]) -> dict:
    meta = CATALOG[provider]
    return {
        "provider": provider,
        "label": meta["label"],
        "direction": meta["direction"],
        "blurb": meta["blurb"],
        "status": record["status"] if record else "not_connected",
        "external_account": record.get("external_account") if record else None,
        "last_sync_at": record.get("last_sync_at") if record else None,
    }


@router.get("", response_model=IntegrationListResponse)
async def list_integrations(user_id: str = Depends(get_current_user_id)):
    docs = await database.integrations.find({"user_id": user_id}, {"_id": 0}).to_list(50)
    by_provider = {d["provider"]: d for d in docs}
    items = [_to_out(provider, by_provider.get(provider)) for provider in CATALOG]
    return {"items": items}


class ConnectBody(BaseModel):
    external_account: Optional[str] = None


@router.post("/{provider}/connect", response_model=IntegrationOut)
async def connect_integration(
    provider: str, body: ConnectBody = ConnectBody(), user_id: str = Depends(get_current_user_id),
):
    if provider not in CATALOG:
        raise HTTPException(status_code=404, detail="PROVIDER_NOT_FOUND")
    meta = CATALOG[provider]
    external_account = body.external_account or f"@{provider}_demo"
    now = utcnow()
    await database.integrations.update_one(
        {"user_id": user_id, "provider": provider},
        {
            "$set": {
                "status": "connected", "external_account": external_account,
                "last_sync_at": now, "direction": meta["direction"],
            },
            "$setOnInsert": {
                "id": new_id(), "user_id": user_id, "provider": provider,
                "created_at": now, "scopes": [],
            },
        },
        upsert=True,
    )
    doc = await database.integrations.find_one({"user_id": user_id, "provider": provider}, {"_id": 0})
    return _to_out(provider, doc)


@router.post("/{provider}/disconnect", status_code=204)
async def disconnect_integration(provider: str, user_id: str = Depends(get_current_user_id)):
    if provider not in CATALOG:
        raise HTTPException(status_code=404, detail="PROVIDER_NOT_FOUND")
    await database.integrations.update_one(
        {"user_id": user_id, "provider": provider},
        {"$set": {"status": "not_connected"}},
    )
