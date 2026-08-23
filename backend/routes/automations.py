"""Automations (IA S28/S29, condensed): list/create/edit/delete + preset
recipes (Gym Reminder, Meeting Focus Mode, Bedtime Routine), seeded once per
user, disabled by default (never auto-enabled, per the automation trust
guardrail — users always flip the switch themselves)."""
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core import db as database
from models import Automation, utcnow
from models.automation import AutomationAction, AutomationTrigger
from routes.deps import get_current_user_id

router = APIRouter(prefix="/automations", tags=["automations"])

PRESETS = [
    {
        "name": "Gym Reminder",
        "trigger": {"type": "time", "params": {"time": "17:30", "days": ["mon", "wed", "fri"]}},
        "action": {"type": "notification", "params": {"message": "Time for the gym — let's go!"}},
    },
    {
        "name": "Meeting Focus Mode",
        "trigger": {"type": "calendar", "params": {"event_keyword": "meeting"}},
        "action": {"type": "focus_mode", "params": {"mode": "silence_notifications"}},
    },
    {
        "name": "Bedtime Routine",
        "trigger": {"type": "time", "params": {"time": "22:00"}},
        "action": {"type": "notification", "params": {"message": "Wind down — bedtime in 30 minutes."}},
    },
]


async def _seed_presets_if_empty(user_id: str) -> None:
    count = await database.automations.count_documents({"user_id": user_id, "deleted_at": None})
    if count > 0:
        return
    for preset in PRESETS:
        automation = Automation(
            user_id=user_id,
            name=preset["name"],
            trigger=AutomationTrigger(**preset["trigger"]),
            action=AutomationAction(**preset["action"]),
            enabled=False,
            is_preset=True,
        )
        await database.automations.insert_one(automation.model_dump())


class AutomationListResponse(BaseModel):
    items: List[Automation]


@router.get("", response_model=AutomationListResponse)
async def list_automations(user_id: str = Depends(get_current_user_id)):
    await _seed_presets_if_empty(user_id)
    docs = (
        await database.automations.find({"user_id": user_id, "deleted_at": None}, {"_id": 0})
        .sort("created_at", 1)
        .to_list(100)
    )
    return {"items": [Automation(**d) for d in docs]}


class AutomationCreate(BaseModel):
    name: str
    trigger: AutomationTrigger
    action: AutomationAction
    enabled: bool = False


@router.post("", response_model=Automation, status_code=201)
async def create_automation(body: AutomationCreate, user_id: str = Depends(get_current_user_id)):
    automation = Automation(user_id=user_id, **body.model_dump())
    await database.automations.insert_one(automation.model_dump())
    return automation


class AutomationPatch(BaseModel):
    name: Optional[str] = None
    trigger: Optional[AutomationTrigger] = None
    action: Optional[AutomationAction] = None
    enabled: Optional[bool] = None


@router.patch("/{automation_id}", response_model=Automation)
async def patch_automation(
    automation_id: str, body: AutomationPatch, user_id: str = Depends(get_current_user_id),
):
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="NO_FIELDS")
    updates["updated_at"] = utcnow()
    doc = await database.automations.find_one_and_update(
        {"id": automation_id, "user_id": user_id, "deleted_at": None},
        {"$set": updates, "$inc": {"version": 1}},
        projection={"_id": 0},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status_code=404, detail="AUTOMATION_NOT_FOUND")
    return Automation(**doc)


@router.post("/{automation_id}/test-run", response_model=Automation)
async def test_run_automation(automation_id: str, user_id: str = Depends(get_current_user_id)):
    """Dry-run per IA S29 — mock evaluation (always 'succeeds'); records
    last_run_at/status so the list row's status reflects a real action."""
    doc = await database.automations.find_one_and_update(
        {"id": automation_id, "user_id": user_id, "deleted_at": None},
        {"$set": {"last_run_at": utcnow(), "last_run_status": "success"}},
        projection={"_id": 0},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status_code=404, detail="AUTOMATION_NOT_FOUND")
    return Automation(**doc)


@router.delete("/{automation_id}", status_code=204)
async def delete_automation(automation_id: str, user_id: str = Depends(get_current_user_id)):
    result = await database.automations.update_one(
        {"id": automation_id, "user_id": user_id, "deleted_at": None},
        {"$set": {"deleted_at": utcnow(), "updated_at": utcnow()}, "$inc": {"version": 1}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="AUTOMATION_NOT_FOUND")
