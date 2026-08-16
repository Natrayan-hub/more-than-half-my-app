"""Health routes (API design B.4) — manual logs only. Integration-derived
metrics stay ON-DEVICE (HealthCache is local-only by default per S34);
there is deliberately no ingestion endpoint here."""
from datetime import datetime
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core import db as database
from models import HealthEntry, utcnow
from routes.deps import get_current_user_id

router = APIRouter(prefix="/health", tags=["health"])


class HealthEntryCreate(BaseModel):
    id: Optional[str] = None
    type: str  # water | mood | weight
    value: float
    note: Optional[str] = None
    logged_at: Optional[datetime] = None


class HealthEntryListResponse(BaseModel):
    items: List[HealthEntry]


@router.get("/entries", response_model=HealthEntryListResponse)
async def list_entries(
    type: Optional[str] = None,
    from_: Optional[datetime] = None,
    to: Optional[datetime] = None,
    limit: int = 200,
    user_id: str = Depends(get_current_user_id),
):
    query: dict = {"user_id": user_id, "deleted_at": None}
    if type:
        query["type"] = type
    logged_range = {}
    if from_:
        logged_range["$gte"] = from_
    if to:
        logged_range["$lt"] = to
    if logged_range:
        query["logged_at"] = logged_range
    docs = (
        await database.health_entries.find(query, {"_id": 0})
        .sort("logged_at", -1)
        .to_list(min(limit, 500))
    )
    return {"items": [HealthEntry(**doc) for doc in docs]}


@router.post("/entries", response_model=HealthEntry, status_code=201)
async def create_entry(body: HealthEntryCreate, user_id: str = Depends(get_current_user_id)):
    fields = body.model_dump(exclude_none=True)
    fields.setdefault("logged_at", datetime.utcnow())
    entry = HealthEntry(user_id=user_id, **fields)
    await database.health_entries.insert_one(entry.model_dump())
    return entry


class HealthEntryPatch(BaseModel):
    value: Optional[float] = None
    note: Optional[str] = None
    logged_at: Optional[datetime] = None


@router.patch("/entries/{entry_id}", response_model=HealthEntry)
async def patch_entry(
    entry_id: str, body: HealthEntryPatch, user_id: str = Depends(get_current_user_id),
):
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="NO_FIELDS")
    updates["updated_at"] = utcnow()
    doc = await database.health_entries.find_one_and_update(
        {"id": entry_id, "user_id": user_id, "deleted_at": None},
        {"$set": updates, "$inc": {"version": 1}},
        projection={"_id": 0},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status_code=404, detail="HEALTH_ENTRY_NOT_FOUND")
    return HealthEntry(**doc)


@router.delete("/entries/{entry_id}", status_code=204)
async def delete_entry(entry_id: str, user_id: str = Depends(get_current_user_id)):
    result = await database.health_entries.update_one(
        {"id": entry_id, "user_id": user_id, "deleted_at": None},
        {"$set": {"deleted_at": utcnow(), "updated_at": utcnow()}, "$inc": {"version": 1}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="HEALTH_ENTRY_NOT_FOUND")
