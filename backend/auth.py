"""Auth dependency — supports AWS Cognito tokens via Authorization header OR httpOnly cookie."""
import os
import time
import uuid
from typing import Optional

import jwt as pyjwt
import bcrypt
from fastapi import Cookie, Depends, HTTPException, Request, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field

from aws_clients import verify_cognito_token, COGNITO_USER_POOL_ID

LOCAL_JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret")
JWT_ALGO = "HS256"
JWT_TTL_SECONDS = 60 * 60 * 24 * 30

# Cookie name where the ID token lives (httpOnly, Secure, SameSite=Lax).
SESSION_COOKIE = "ss_session"

bearer = HTTPBearer(auto_error=False)


class SignupReq(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    name: Optional[str] = None


class LoginReq(BaseModel):
    email: EmailStr
    password: str


def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except Exception:
        return False


def make_local_token(user_id: str, email: str) -> str:
    payload = {
        "sub": user_id,
        "email": email,
        "iss": "studyspark-local",
        "iat": int(time.time()),
        "exp": int(time.time()) + JWT_TTL_SECONDS,
    }
    return pyjwt.encode(payload, LOCAL_JWT_SECRET, algorithm=JWT_ALGO)


def new_user_id() -> str:
    return str(uuid.uuid4())


def _extract_token(request: Request,
                   creds: Optional[HTTPAuthorizationCredentials]) -> Optional[str]:
    """Prefer Authorization header; fall back to httpOnly session cookie."""
    if creds and creds.credentials:
        return creds.credentials
    cookie_token = request.cookies.get(SESSION_COOKIE)
    return cookie_token or None


async def _validate_token(token: str) -> dict:
    """Validate either a Cognito token (preferred) or our local HS256 token."""
    payload: dict = {}
    try:
        unverified = pyjwt.decode(token, options={"verify_signature": False})
    except Exception as e:
        raise HTTPException(401, f"Invalid token: {e}") from e
    iss = unverified.get("iss", "") or ""
    if COGNITO_USER_POOL_ID and "cognito-idp" in iss:
        try:
            payload = await verify_cognito_token(token)
        except Exception as e:
            raise HTTPException(401, f"Invalid Cognito token: {e}") from e
        return {
            "user_id": payload.get("sub"),
            "email": (
                payload.get("email")
                or payload.get("username")
                or payload.get("cognito:username")
            ),
            "source": "cognito",
        }
    # Local HS256 path (kept for parity; no endpoint currently issues these)
    try:
        payload = pyjwt.decode(token, LOCAL_JWT_SECRET, algorithms=[JWT_ALGO])
    except Exception as e:
        raise HTTPException(401, f"Invalid token: {e}") from e
    return {
        "user_id": payload.get("sub"),
        "email": payload.get("email"),
        "source": "local",
    }


async def get_current_principal(
    request: Request,
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> dict:
    token = _extract_token(request, creds)
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token"
        )
    return await _validate_token(token)


async def get_current_user_id(
    principal: dict = Depends(get_current_principal),
) -> str:
    return principal["user_id"]
