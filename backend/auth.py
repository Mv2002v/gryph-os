"""Auth dependency — supports BOTH AWS Cognito tokens and the local demo JWT."""
import os
import time
import uuid
from typing import Optional

import jwt as pyjwt
import bcrypt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from pydantic import BaseModel, EmailStr, Field

from aws_clients import verify_cognito_token, COGNITO_USER_POOL_ID

LOCAL_JWT_SECRET = os.environ.get("JWT_SECRET", "dev-secret")
JWT_ALGO = "HS256"
JWT_TTL_SECONDS = 60 * 60 * 24 * 30

bearer = HTTPBearer(auto_error=False)

DEMO_USER_ID = "demo-user-001"
DEMO_EMAIL = "demo@studyspark.app"


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


async def get_current_principal(
    creds: HTTPAuthorizationCredentials = Depends(bearer),
) -> dict:
    """Returns {'user_id': str, 'email': str, 'source': 'cognito'|'local'}."""
    if not creds:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing token"
        )
    token = creds.credentials
    # Decide which validator: Cognito tokens have specific issuer
    try:
        unverified = pyjwt.decode(token, options={"verify_signature": False})
    except Exception:
        raise HTTPException(401, "Invalid token")
    iss = unverified.get("iss", "")
    if COGNITO_USER_POOL_ID and "cognito-idp" in iss:
        try:
            payload = await verify_cognito_token(token)
        except Exception as e:
            raise HTTPException(401, f"Invalid Cognito token: {e}")
        # Use 'sub' as user_id; resolve email
        email = payload.get("email") or payload.get("username") or payload.get("cognito:username")
        return {
            "user_id": payload.get("sub"),
            "email": email,
            "source": "cognito",
        }
    # Fall back to local JWT (demo bypass only)
    try:
        payload = pyjwt.decode(token, LOCAL_JWT_SECRET, algorithms=[JWT_ALGO])
    except Exception as e:
        raise HTTPException(401, f"Invalid token: {e}")
    return {
        "user_id": payload["sub"],
        "email": payload.get("email"),
        "source": "local",
    }


async def get_current_user_id(
    principal: dict = Depends(get_current_principal),
) -> str:
    return principal["user_id"]
