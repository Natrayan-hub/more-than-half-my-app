"""Gym / strength-training log routes — manual sets only (exercise name +
weight + reps), same shape/pattern as health.py's manual entries. No
integration/ingestion path here by design — this is the user's own log."""
from datetime import datetime, timedelta
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from core import db as database
from models import GymSet, utcnow
from routes.deps import get_current_user_id

router = APIRouter(prefix="/gym", tags=["gym"])


class GymSetCreate(BaseModel):
    id: Optional[str] = None
    exercise_name: str
    weight: float
    weight_unit: str = "kg"  # kg | lb
    reps: int
    note: Optional[str] = None
    logged_at: Optional[datetime] = None


class GymSetListResponse(BaseModel):
    items: List[GymSet]


@router.get("/sets", response_model=GymSetListResponse)
async def list_sets(
    from_: Optional[datetime] = None,
    to: Optional[datetime] = None,
    exercise_name: Optional[str] = None,
    limit: int = 200,
    user_id: str = Depends(get_current_user_id),
):
    query: dict = {"user_id": user_id, "deleted_at": None}
    if exercise_name:
        query["exercise_name"] = exercise_name
    logged_range = {}
    if from_:
        logged_range["$gte"] = from_
    if to:
        logged_range["$lt"] = to
    if logged_range:
        query["logged_at"] = logged_range
    docs = (
        await database.gym_sets.find(query, {"_id": 0})
        .sort("logged_at", -1)
        .to_list(min(limit, 500))
    )
    return {"items": [GymSet(**doc) for doc in docs]}


@router.post("/sets", response_model=GymSet, status_code=201)
async def create_set(body: GymSetCreate, user_id: str = Depends(get_current_user_id)):
    fields = body.model_dump(exclude_none=True)
    name = fields.get("exercise_name", "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="EXERCISE_NAME_REQUIRED")
    if fields.get("reps", 0) <= 0:
        raise HTTPException(status_code=400, detail="REPS_MUST_BE_POSITIVE")
    if fields.get("weight", 0) < 0:
        raise HTTPException(status_code=400, detail="WEIGHT_MUST_BE_NON_NEGATIVE")
    fields["exercise_name"] = name
    fields.setdefault("logged_at", datetime.utcnow())
    entry = GymSet(user_id=user_id, **fields)
    await database.gym_sets.insert_one(entry.model_dump())
    return entry


class GymSetPatch(BaseModel):
    exercise_name: Optional[str] = None
    weight: Optional[float] = None
    weight_unit: Optional[str] = None
    reps: Optional[int] = None
    note: Optional[str] = None
    logged_at: Optional[datetime] = None


@router.patch("/sets/{set_id}", response_model=GymSet)
async def patch_set(set_id: str, body: GymSetPatch, user_id: str = Depends(get_current_user_id)):
    updates = body.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="NO_FIELDS")
    if "exercise_name" in updates:
        updates["exercise_name"] = updates["exercise_name"].strip()
        if not updates["exercise_name"]:
            raise HTTPException(status_code=400, detail="EXERCISE_NAME_REQUIRED")
    updates["updated_at"] = utcnow()
    doc = await database.gym_sets.find_one_and_update(
        {"id": set_id, "user_id": user_id, "deleted_at": None},
        {"$set": updates, "$inc": {"version": 1}},
        projection={"_id": 0},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status_code=404, detail="GYM_SET_NOT_FOUND")
    return GymSet(**doc)


@router.delete("/sets/{set_id}", status_code=204)
async def delete_set(set_id: str, user_id: str = Depends(get_current_user_id)):
    result = await database.gym_sets.update_one(
        {"id": set_id, "user_id": user_id, "deleted_at": None},
        {"$set": {"deleted_at": utcnow(), "updated_at": utcnow()}, "$inc": {"version": 1}},
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="GYM_SET_NOT_FOUND")


@router.get("/exercises")
async def list_exercise_names(user_id: str = Depends(get_current_user_id)):
    """Distinct exercise names the user has logged before, most-recently-used
    first — powers the autocomplete chips in the log sheet."""
    docs = (
        await database.gym_sets.find(
            {"user_id": user_id, "deleted_at": None},
            {"_id": 0, "exercise_name": 1, "logged_at": 1},
        )
        .sort("logged_at", -1)
        .to_list(500)
    )
    seen: dict = {}
    for d in docs:
        seen.setdefault(d["exercise_name"], None)
    return {"items": list(seen.keys())[:30]}


@router.get("/summary")
async def gym_summary(user_id: str = Depends(get_current_user_id)):
    """Lightweight weekly rollup — powers the Gym card on the Health tab."""
    week_ago = datetime.utcnow() - timedelta(days=7)
    docs = (
        await database.gym_sets.find(
            {"user_id": user_id, "deleted_at": None, "logged_at": {"$gte": week_ago}},
            {"_id": 0, "logged_at": 1},
        )
        .to_list(1000)
    )
    session_days = {d["logged_at"].date().isoformat() for d in docs}
    return {"sets_this_week": len(docs), "sessions_this_week": len(session_days)}
