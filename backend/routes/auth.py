"""Auth routes (API design B.1): register, login, refresh (rotating), logout,
Google session exchange (Emergent-managed OAuth)."""
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

from core import db as database
from core import security
from core.seed import seed_starter_tasks
from models import Preference, Profile, User
from routes.deps import get_current_user_id

router = APIRouter(prefix="/auth", tags=["auth"])

EMERGENT_SESSION_DATA_URL = "https://demobackend.emergentagent.com/auth/v1/env/oauth/session-data"


class Credentials(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str


class AuthResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"
    user: dict


class GoogleSessionRequest(BaseModel):
    session_id: str = Field(min_length=1)


class GoogleAuthResponse(AuthResponse):
    is_new_user: bool


def _public_user(user: User) -> dict:
    return {
        "id": user.id, "email": user.email, "plan": user.plan,
        "auth_provider": user.auth_provider, "email_verified": user.email_verified,
    }


@router.post("/register", response_model=AuthResponse, status_code=201)
async def register(body: Credentials):
    email = body.email.lower()
    if await database.users.find_one({"email": email}, {"_id": 1}):
        raise HTTPException(status_code=409, detail="EMAIL_TAKEN")

    user = User(email=email, auth_provider="password",
                password_hash=security.hash_password(body.password))
    profile = Profile(id=user.id, user_id=user.id,
                      display_name=email.split("@")[0].capitalize())
    preference = Preference(id=user.id, user_id=user.id)

    # password_hash has exclude=True on the model — dump explicitly for storage.
    doc = user.model_dump()
    doc["password_hash"] = user.password_hash
    await database.users.insert_one(doc)
    await database.profiles.insert_one(profile.model_dump())
    await database.preferences.insert_one(preference.model_dump())
    await seed_starter_tasks(user.id)

    pair = await security.issue_pair(user.id)
    return {**pair, "user": _public_user(user)}


@router.post("/login", response_model=AuthResponse)
async def login(body: Credentials):
    doc = await database.users.find_one({"email": body.email.lower()}, {"_id": 0})
    valid = security.verify_password(body.password, (doc or {}).get("password_hash"))
    if not doc or not valid or doc.get("status") == "deleted":
        # Generic message — no account-existence leak.
        raise HTTPException(status_code=401, detail="AUTH_INVALID_CREDENTIALS")
    user = User(**doc)
    pair = await security.issue_pair(user.id)
    return {**pair, "user": _public_user(user)}


@router.post("/refresh")
async def refresh(body: RefreshRequest):
    try:
        user_id, family = await security.consume_refresh(body.refresh_token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    return await security.issue_pair(user_id, family=family)


@router.post("/logout", status_code=204)
async def logout(body: RefreshRequest):
    await security.revoke_refresh(body.refresh_token)


@router.post("/session", response_model=GoogleAuthResponse)
async def google_session(body: GoogleSessionRequest):
    """Exchange a one-time Emergent `session_id` for this app's own JWT pair.

    The frontend never talks to Emergent directly — it POSTs the session_id
    here exactly once, we call Emergent's session-data endpoint with it, then
    mint our normal access/refresh tokens so Google-authenticated users flow
    through the same token lifecycle (rotation, revocation) as password users.
    """
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.get(
                EMERGENT_SESSION_DATA_URL,
                headers={"X-Session-ID": body.session_id},
            )
        except httpx.HTTPError:
            raise HTTPException(status_code=401, detail="GOOGLE_AUTH_FAILED")

    if resp.status_code != 200:
        raise HTTPException(status_code=401, detail="GOOGLE_AUTH_FAILED")

    data = resp.json()
    email = (data.get("email") or "").strip().lower()
    if not email:
        raise HTTPException(status_code=401, detail="GOOGLE_AUTH_FAILED")
    name = data.get("name") or email.split("@")[0].capitalize()
    picture = data.get("picture")

    existing = await database.users.find_one({"email": email}, {"_id": 0})
    is_new_user = existing is None

    if existing:
        user = User(**existing)
    else:
        user = User(email=email, auth_provider="google", email_verified=True)
        await database.users.insert_one(user.model_dump())
        profile = Profile(id=user.id, user_id=user.id, display_name=name, avatar_url=picture)
        preference = Preference(id=user.id, user_id=user.id)
        await database.profiles.insert_one(profile.model_dump())
        await database.preferences.insert_one(preference.model_dump())
        await seed_starter_tasks(user.id)

    pair = await security.issue_pair(user.id)
    return {**pair, "user": _public_user(user), "is_new_user": is_new_user}


class ChangePasswordRequest(BaseModel):
    current_password: Optional[str] = None
    new_password: str = Field(min_length=8, max_length=128)


@router.post("/change-password", status_code=204)
async def change_password(
    body: ChangePasswordRequest, user_id: str = Depends(get_current_user_id),
):
    """Settings (S24) password change. Google-only accounts (no
    password_hash yet) can SET a first password without a current one;
    accounts that already have one must prove it first."""
    user_doc = await database.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 1})
    if not user_doc:
        raise HTTPException(status_code=404, detail="USER_NOT_FOUND")
    existing_hash = user_doc.get("password_hash")
    if existing_hash:
        if not body.current_password or not security.verify_password(body.current_password, existing_hash):
            raise HTTPException(status_code=401, detail="AUTH_INVALID_CREDENTIALS")
    new_hash = security.hash_password(body.new_password)
    await database.users.update_one({"id": user_id}, {"$set": {"password_hash": new_hash}})
