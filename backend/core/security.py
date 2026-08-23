"""Auth security core (per auth integration playbook, Security spec D.1):
bcrypt password hashing, short-lived access JWTs (15 min), rotating refresh
JWTs (30 days) with single-use enforcement + family-reuse revocation."""
from datetime import datetime, timedelta, timezone
from hashlib import sha256
from typing import Optional
from uuid import uuid4

import bcrypt
from jose import JWTError, jwt

from core import db as database
from core.config import settings

ACCESS_MINUTES = 15
REFRESH_DAYS = 30
ALGORITHM = "HS256"

# Constant dummy hash — verified against for nonexistent users to reduce
# timing-based account enumeration (FastAPI recommendation).
_DUMMY_HASH = bcrypt.hashpw(b"lifeos-dummy-password", bcrypt.gensalt(rounds=12)).decode()

sessions = database.db.refresh_sessions


def now() -> datetime:
    return datetime.now(timezone.utc)


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt(rounds=12)).decode()


def verify_password(password: str, hashed: Optional[str]) -> bool:
    try:
        return bcrypt.checkpw(password.encode(), (hashed or _DUMMY_HASH).encode())
    except (ValueError, TypeError):
        return False


def token_hash(token: str) -> str:
    return sha256(token.encode()).hexdigest()


def make_jwt(subject: str, kind: str, expires: timedelta, family: Optional[str] = None) -> str:
    issued = now()
    claims = {
        "sub": subject,
        "typ": kind,
        "iat": issued,
        "exp": issued + expires,
        "jti": str(uuid4()),
    }
    if family:
        claims["family"] = family
    return jwt.encode(claims, settings.JWT_SECRET, algorithm=ALGORITHM)


def decode_jwt(token: str) -> dict:
    """Raises JWTError on invalid/expired tokens. Explicit algorithm allow-list."""
    return jwt.decode(token, settings.JWT_SECRET, algorithms=[ALGORITHM])


async def issue_pair(user_id: str, family: Optional[str] = None) -> dict:
    family = family or str(uuid4())
    refresh = make_jwt(user_id, "refresh", timedelta(days=REFRESH_DAYS), family=family)
    decoded = decode_jwt(refresh)
    await sessions.insert_one({
        "jti": decoded["jti"],
        "family": family,
        "user_id": user_id,
        "token_hash": token_hash(refresh),
        "revoked": False,
        "expires_at": datetime.fromtimestamp(decoded["exp"], timezone.utc),
        "created_at": now(),
    })
    access = make_jwt(user_id, "access", timedelta(minutes=ACCESS_MINUTES))
    return {"access_token": access, "refresh_token": refresh, "token_type": "bearer"}


async def consume_refresh(token: str) -> tuple[str, str]:
    """Validate + atomically rotate a refresh token. Returns (user_id, family)
    — callers MUST pass family through to issue_pair() so the whole rotation
    chain shares one family; otherwise reuse-detection can't cascade past the
    first rotation. Raises ValueError('...code...') for the route to map to 401."""
    try:
        data = decode_jwt(token)
        if data.get("typ") != "refresh":
            raise JWTError()
    except JWTError:
        raise ValueError("TOKEN_INVALID")

    record = await sessions.find_one({"jti": data["jti"]})
    if not record or record["token_hash"] != token_hash(token):
        raise ValueError("TOKEN_INVALID")
    if record["revoked"]:
        # Replay detected → revoke the entire family, force re-auth.
        await sessions.update_many({"family": record["family"]}, {"$set": {"revoked": True}})
        raise ValueError("TOKEN_REUSE")

    consumed = await sessions.find_one_and_update(
        {"jti": data["jti"], "revoked": False},
        {"$set": {"revoked": True, "revoked_at": now()}},
    )
    if not consumed:
        raise ValueError("TOKEN_INVALID")
    return data["sub"], record["family"]


async def revoke_refresh(token: str) -> None:
    """Idempotent logout revocation."""
    try:
        data = jwt.decode(
            token, settings.JWT_SECRET, algorithms=[ALGORITHM],
            options={"verify_exp": False},
        )
    except JWTError:
        return
    await sessions.update_one(
        {"jti": data.get("jti"), "token_hash": token_hash(token)},
        {"$set": {"revoked": True, "revoked_at": now()}},
    )


async def ensure_session_indexes() -> None:
    await sessions.create_index("jti", unique=True)
    await sessions.create_index("expires_at", expireAfterSeconds=0)
    await sessions.create_index("family")
