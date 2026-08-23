"""Automations (IA S28/S29, condensed for MVP): Trigger -> Action recipes.
Enable/disable + full CRUD are real; actual background trigger evaluation
(geofencing, cron, calendar webhooks) is mocked/out of scope for this build
— `last_run_at`/`last_run_status` are set by the mock "Test run" action only.
"""
from datetime import datetime
from typing import Dict, Literal, Optional

from pydantic import BaseModel

from models.base import SyncableModel

TriggerType = Literal["time", "location", "calendar", "task", "health_threshold"]
ActionType = Literal["notification", "focus_mode", "open_feature"]


class AutomationTrigger(BaseModel):
    type: TriggerType
    params: Dict = {}


class AutomationAction(BaseModel):
    type: ActionType
    params: Dict = {}


class Automation(SyncableModel):
    name: str
    trigger: AutomationTrigger
    action: AutomationAction
    enabled: bool = True
    is_preset: bool = False
    last_run_at: Optional[datetime] = None
    last_run_status: Optional[Literal["success", "failed"]] = None
