"""Users & preferences routes (API design B.2): /me, profile, preferences."""
import time
import uuid
from typing import List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Response, UploadFile
from fastapi.concurrency import run_in_threadpool
from pydantic import BaseModel

from core import db as database
from core.storage import APP_NAME, get_object, put_object
from models import Preference, Profile
from routes.deps import get_current_user_id, get_current_user_id_flexible

router = APIRouter(prefix="/me", tags=["users"])

MAX_AVATAR_BYTES = 5 * 1024 * 1024  # 5MB cap
ALLOWED_AVATAR_TYPES = {"image/jpeg": "jpg", "image/png": "png", "image/webp": "webp"}


class ProfilePatch(BaseModel):
    display_name: Optional[str] = None
    wake_time: Optional[str] = None
    focus_areas: Optional[List[str]] = None
    units: Optional[str] = None
    theme: Optional[str] = None
    ai_enabled: Optional[bool] = None
    timezone: Optional[str] = None


@router.get("")
async def me(user_id: str = Depends(get_current_user_id)):
    user = await database.users.find_one(
        {"id": user_id}, {"_id": 0, "password_hash": 0},
    )
    if not user:
        raise HTTPException(status_code=404, detail="USER_NOT_FOUND")
    profile = await database.profiles.find_one({"id": user_id}, {"_id": 0})
    return {"user": user, "profile": profile}


@router.patch("/profile", response_model=Profile)
async def patch_profile(body: ProfilePatch, user_id: str = Depends(get_current_user_id)):
    updates = body.model_dump(exclude_none=True)
    doc = await database.profiles.find_one_and_update(
        {"id": user_id},
        {"$set": updates},
        projection={"_id": 0},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status_code=404, detail="PROFILE_NOT_FOUND")
    return Profile(**doc)


@router.post("/avatar", response_model=Profile)
async def upload_avatar(user_id: str = Depends(get_current_user_id), file: UploadFile = File(...)):
    """Avatar upload — Emergent Object Storage (see core/storage.py). The
    object path is internal; clients always read back through GET /me/avatar."""
    content_type = (file.content_type or "").lower()
    ext = ALLOWED_AVATAR_TYPES.get(content_type)
    if not ext:
        raise HTTPException(status_code=400, detail="UNSUPPORTED_IMAGE_TYPE")

    data = await file.read()
    if len(data) > MAX_AVATAR_BYTES:
        raise HTTPException(status_code=400, detail="AVATAR_TOO_LARGE")

    object_path = f"{APP_NAME}/uploads/{user_id}/{uuid.uuid4()}.{ext}"
    try:
        await run_in_threadpool(put_object, object_path, data, content_type)
    except Exception:
        raise HTTPException(status_code=502, detail="AVATAR_UPLOAD_FAILED")

    cache_bust = int(time.time())
    doc = await database.profiles.find_one_and_update(
        {"id": user_id},
        {"$set": {"avatar_object_path": object_path, "avatar_url": f"/me/avatar?v={cache_bust}"}},
        projection={"_id": 0},
        return_document=True,
    )
    if not doc:
        raise HTTPException(status_code=404, detail="PROFILE_NOT_FOUND")
    return Profile(**doc)


@router.get("/avatar")
async def get_avatar(user_id: str = Depends(get_current_user_id_flexible)):
    profile = await database.profiles.find_one({"id": user_id}, {"_id": 0, "avatar_object_path": 1})
    object_path = (profile or {}).get("avatar_object_path")
    if not object_path:
        raise HTTPException(status_code=404, detail="AVATAR_NOT_FOUND")
    try:
        content, content_type = await run_in_threadpool(get_object, object_path)
    except Exception:
        raise HTTPException(status_code=502, detail="AVATAR_FETCH_FAILED")
    return Response(content=content, media_type=content_type)


@router.get("/preferences", response_model=Preference)
async def get_preferences(user_id: str = Depends(get_current_user_id)):
    doc = await database.preferences.find_one({"id": user_id}, {"_id": 0})
    if not doc:
        raise HTTPException(status_code=404, detail="PREFERENCES_NOT_FOUND")
    return Preference(**doc)


@router.put("/preferences", response_model=Preference)
async def put_preferences(body: Preference, user_id: str = Depends(get_current_user_id)):
    pref = body.model_copy(update={"id": user_id, "user_id": user_id})
    await database.preferences.replace_one(
        {"id": user_id}, pref.model_dump(), upsert=True,
    )
    return pref


class EraseRequest(BaseModel):
    scope: str = "cloud"  # "cloud" is the only scope with server-side work to do


@router.post("/erase")
async def erase_data(body: EraseRequest, user_id: str = Depends(get_current_user_id)):
    """Settings (S34) 'Delete cloud data' — wipes this user's CONTENT across
    collections (tasks, documents, health logs, AI memory/suggestions,
    automations) but keeps the account itself intact. 'local' scope is a
    no-op here — there's nothing server-side to erase; the client clears its
    own on-device caches."""
    if body.scope != "cloud":
        return {"status": "ok", "scope": body.scope}

    for collection in (
        database.tasks, database.documents, database.health_entries,
        database.ai_memory, database.suggestions, database.automations,
    ):
        await collection.delete_many({"user_id": user_id})

    return {"status": "ok", "scope": "cloud"}
