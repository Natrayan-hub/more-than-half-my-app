"""Auth dependency: extracts the user id from a Bearer access JWT.
All data routes are scoped through this single seam (Security spec D.1)."""
from typing import Optional

from fastapi import Depends, HTTPException, Query
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError

from core.security import decode_jwt

_bearer = HTTPBearer(auto_error=False)


async def get_current_user_id(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
) -> str:
    if not credentials:
        raise HTTPException(status_code=401, detail="TOKEN_INVALID")
    try:
        data = decode_jwt(credentials.credentials)
        if data.get("typ") != "access" or not data.get("sub"):
            raise JWTError()
    except JWTError:
        raise HTTPException(status_code=401, detail="TOKEN_EXPIRED")
    return data["sub"]


async def get_current_user_id_flexible(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer),
    token: Optional[str] = Query(default=None),
) -> str:
    """Same as get_current_user_id, but also accepts ?token= — needed for
    <img>/web reads that can't attach an Authorization header (avatar
    display)."""
    raw = credentials.credentials if credentials else token
    if not raw:
        raise HTTPException(status_code=401, detail="TOKEN_INVALID")
    try:
        data = decode_jwt(raw)
        if data.get("typ") != "access" or not data.get("sub"):
            raise JWTError()
    except JWTError:
        raise HTTPException(status_code=401, detail="TOKEN_EXPIRED")
    return data["sub"]
