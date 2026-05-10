"""AWS clients (S3 + Cognito) and helpers."""
import base64
import hashlib
import hmac
import json
import os
import time
import uuid
from typing import Optional

import boto3
import httpx
from botocore.client import Config as BotoConfig
from jose import jwk, jwt
from jose.utils import base64url_decode

AWS_REGION = os.environ.get("AWS_REGION", "us-east-1")
COGNITO_REGION = os.environ.get("COGNITO_REGION", AWS_REGION)
COGNITO_USER_POOL_ID = os.environ.get("COGNITO_USER_POOL_ID")
COGNITO_CLIENT_ID = os.environ.get("COGNITO_CLIENT_ID")
COGNITO_CLIENT_SECRET = os.environ.get("COGNITO_CLIENT_SECRET")
S3_BUCKET = os.environ.get("S3_BUCKET")


def _aws_session():
    return boto3.session.Session(
        aws_access_key_id=os.environ.get("AWS_ACCESS_KEY_ID"),
        aws_secret_access_key=os.environ.get("AWS_SECRET_ACCESS_KEY"),
        region_name=AWS_REGION,
    )


def cognito_client():
    return _aws_session().client("cognito-idp", region_name=COGNITO_REGION)


def s3_client():
    return _aws_session().client(
        "s3",
        region_name=AWS_REGION,
        config=BotoConfig(signature_version="s3v4"),
    )


# --- Cognito helpers -------------------------------------------------------
def cognito_secret_hash(username: str) -> str:
    if not COGNITO_CLIENT_SECRET:
        return ""
    msg = (username + COGNITO_CLIENT_ID).encode("utf-8")
    dig = hmac.new(
        COGNITO_CLIENT_SECRET.encode("utf-8"), msg, hashlib.sha256
    ).digest()
    return base64.b64encode(dig).decode("utf-8")


_JWKS_CACHE = {"data": None, "fetched": 0}
JWKS_TTL = 3600


async def get_jwks() -> dict:
    now = time.time()
    if _JWKS_CACHE["data"] and (now - _JWKS_CACHE["fetched"]) < JWKS_TTL:
        return _JWKS_CACHE["data"]
    url = (
        f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/"
        f"{COGNITO_USER_POOL_ID}/.well-known/jwks.json"
    )
    async with httpx.AsyncClient(timeout=10.0) as client:
        r = await client.get(url)
        r.raise_for_status()
        data = r.json()
    _JWKS_CACHE["data"] = data
    _JWKS_CACHE["fetched"] = now
    return data


async def verify_cognito_token(token: str) -> dict:
    """Validate a Cognito access or id token using JWKS. Returns payload dict."""
    headers = jwt.get_unverified_header(token)
    kid = headers.get("kid")
    jwks = await get_jwks()
    key_dict = next((k for k in jwks["keys"] if k["kid"] == kid), None)
    if not key_dict:
        raise ValueError("Cognito public key not found for kid=" + str(kid))
    public_key = jwk.construct(key_dict)
    message, encoded_sig = token.rsplit(".", 1)
    decoded_sig = base64url_decode(encoded_sig.encode("utf-8"))
    if not public_key.verify(message.encode("utf-8"), decoded_sig):
        raise ValueError("Invalid Cognito token signature")
    payload = jwt.get_unverified_claims(token)
    if payload.get("exp", 0) < time.time():
        raise ValueError("Cognito token expired")
    expected_iss = (
        f"https://cognito-idp.{COGNITO_REGION}.amazonaws.com/{COGNITO_USER_POOL_ID}"
    )
    if payload.get("iss") != expected_iss:
        raise ValueError("Cognito token issuer mismatch")
    # access tokens have 'client_id', id tokens have 'aud'
    if payload.get("client_id") and payload["client_id"] != COGNITO_CLIENT_ID:
        raise ValueError("Cognito client_id mismatch")
    if payload.get("aud") and payload["aud"] != COGNITO_CLIENT_ID:
        raise ValueError("Cognito audience mismatch")
    return payload


def cognito_signup(email: str, password: str, name: Optional[str] = None) -> dict:
    """Create + auto-confirm a Cognito user. Returns Cognito user info."""
    cog = cognito_client()
    attrs = [{"Name": "email", "Value": email}, {"Name": "email_verified", "Value": "true"}]
    if name:
        attrs.append({"Name": "name", "Value": name})
    cog.admin_create_user(
        UserPoolId=COGNITO_USER_POOL_ID,
        Username=email,
        UserAttributes=attrs,
        MessageAction="SUPPRESS",  # don't email a temp password
        TemporaryPassword=password,  # we'll override immediately
    )
    cog.admin_set_user_password(
        UserPoolId=COGNITO_USER_POOL_ID,
        Username=email,
        Password=password,
        Permanent=True,
    )
    return {"username": email}


def cognito_login(email: str, password: str) -> dict:
    """USER_PASSWORD_AUTH login. Returns tokens + user info."""
    cog = cognito_client()
    auth_params = {"USERNAME": email, "PASSWORD": password}
    if COGNITO_CLIENT_SECRET:
        auth_params["SECRET_HASH"] = cognito_secret_hash(email)
    resp = cog.admin_initiate_auth(
        UserPoolId=COGNITO_USER_POOL_ID,
        ClientId=COGNITO_CLIENT_ID,
        AuthFlow="ADMIN_USER_PASSWORD_AUTH",
        AuthParameters=auth_params,
    )
    auth = resp.get("AuthenticationResult", {})
    return {
        "access_token": auth.get("AccessToken"),
        "id_token": auth.get("IdToken"),
        "refresh_token": auth.get("RefreshToken"),
        "expires_in": auth.get("ExpiresIn"),
    }


def cognito_get_user(access_token: str) -> dict:
    """Fetch user attrs by access token."""
    cog = cognito_client()
    r = cog.get_user(AccessToken=access_token)
    out = {"username": r["Username"]}
    for a in r.get("UserAttributes", []):
        out[a["Name"]] = a["Value"]
    return out


def cognito_admin_update_user(email: str, name: Optional[str] = None,
                              phone_number: Optional[str] = None) -> None:
    cog = cognito_client()
    attrs = []
    if name is not None:
        attrs.append({"Name": "name", "Value": name or ""})
    if phone_number is not None:
        attrs.append({"Name": "phone_number", "Value": phone_number or ""})
    if not attrs:
        return
    cog.admin_update_user_attributes(
        UserPoolId=COGNITO_USER_POOL_ID,
        Username=email,
        UserAttributes=attrs,
    )


# --- S3 helpers ------------------------------------------------------------
def s3_upload_bytes(content: bytes, prefix: str, filename: str,
                     content_type: str = "application/octet-stream") -> dict:
    """Upload to S3 under <prefix>/<uuid>-<filename>; return {key, bucket, size}."""
    if not S3_BUCKET:
        raise RuntimeError("S3_BUCKET not configured")
    safe_name = filename.replace(" ", "_")[:120]
    key = f"{prefix}/{uuid.uuid4().hex}-{safe_name}"
    s3 = s3_client()
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=key,
        Body=content,
        ContentType=content_type,
        ServerSideEncryption="AES256",
    )
    return {"bucket": S3_BUCKET, "key": key, "size": len(content), "content_type": content_type}


def s3_get_bytes(key: str) -> bytes:
    s3 = s3_client()
    obj = s3.get_object(Bucket=S3_BUCKET, Key=key)
    return obj["Body"].read()


def s3_presigned_url(key: str, expires_in: int = 600) -> str:
    s3 = s3_client()
    return s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": S3_BUCKET, "Key": key},
        ExpiresIn=expires_in,
    )


def s3_delete(key: str) -> None:
    try:
        s3_client().delete_object(Bucket=S3_BUCKET, Key=key)
    except Exception:  # noqa: BLE001
        pass


def aws_status() -> dict:
    """Lightweight status indicator for the UI."""
    return {
        "region": AWS_REGION,
        "cognito_pool": COGNITO_USER_POOL_ID,
        "s3_bucket": S3_BUCKET,
        "using_cognito": bool(COGNITO_USER_POOL_ID and COGNITO_CLIENT_ID),
        "using_s3": bool(S3_BUCKET),
    }
