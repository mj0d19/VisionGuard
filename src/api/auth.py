"""
Clerk JWT verification for FastAPI.

Fetches the Clerk JWKS once (and caches it), then verifies every incoming
Bearer token against those keys. Use `get_current_user` as a Depends()
dependency on any route that requires authentication.
"""

import os
import time
import threading
from typing import Any

import httpx
import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

_bearer_scheme = HTTPBearer()

# JWKS cache: refreshed at most every 60 minutes
_jwks_cache: dict[str, Any] | None = None
_jwks_fetched_at: float = 0.0
_jwks_lock = threading.Lock()
_JWKS_TTL_S = 3600


def _get_clerk_issuer() -> str:
    """Derive the Clerk issuer URL from the publishable key or explicit env var."""
    explicit = os.getenv("CLERK_ISSUER")
    if explicit:
        return explicit.rstrip("/")

    pk = os.getenv("CLERK_PUBLISHABLE_KEY", "")
    if not pk:
        raise RuntimeError(
            "Set CLERK_PUBLISHABLE_KEY (or CLERK_ISSUER) in the environment"
        )

    # Clerk publishable keys look like pk_test_<base64-encoded-domain>
    # but the simplest reliable approach: use the secret key's frontend API
    # domain.  Alternatively, the user can set CLERK_ISSUER directly.
    # For the standard Clerk setup the issuer is https://<frontend-api-host>.
    secret = os.getenv("CLERK_SECRET_KEY", "")
    if not secret:
        raise RuntimeError("Set CLERK_SECRET_KEY in the environment")

    # Clerk's issuer is always https://<frontend-api-domain>
    # The frontend API domain can be obtained from the Clerk dashboard.
    # Users should set CLERK_ISSUER=https://<your-clerk-frontend-api-domain>
    raise RuntimeError(
        "Cannot auto-derive issuer. Set CLERK_ISSUER to your Clerk Frontend API URL, "
        "e.g. CLERK_ISSUER=https://your-app.clerk.accounts.dev"
    )


def _get_jwks_url() -> str:
    return f"{_get_clerk_issuer()}/.well-known/jwks.json"


def _fetch_jwks() -> dict[str, Any]:
    """Fetch (or return cached) JWKS from Clerk."""
    global _jwks_cache, _jwks_fetched_at

    now = time.time()
    if _jwks_cache is not None and (now - _jwks_fetched_at) < _JWKS_TTL_S:
        return _jwks_cache

    with _jwks_lock:
        # Double-check after acquiring lock
        if _jwks_cache is not None and (time.time() - _jwks_fetched_at) < _JWKS_TTL_S:
            return _jwks_cache

        url = _get_jwks_url()
        resp = httpx.get(url, timeout=10)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        _jwks_fetched_at = time.time()
        return _jwks_cache


def _decode_token(token: str) -> dict[str, Any]:
    """Verify and decode a Clerk-issued JWT."""
    jwks_data = _fetch_jwks()
    public_keys: dict[str, jwt.PyJWK] = {}
    for jwk_dict in jwks_data.get("keys", []):
        kid = jwk_dict.get("kid")
        if kid:
            public_keys[kid] = jwt.PyJWK(jwk_dict)

    unverified_header = jwt.get_unverified_header(token)
    kid = unverified_header.get("kid")
    if kid not in public_keys:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token key ID not found in JWKS",
        )

    issuer = _get_clerk_issuer()
    try:
        payload = jwt.decode(
            token,
            public_keys[kid].key,
            algorithms=["RS256"],
            issuer=issuer,
            options={"verify_aud": False},
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired",
        )
    except jwt.InvalidTokenError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
        )

    return payload


async def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(_bearer_scheme),
) -> dict[str, Any]:
    """FastAPI dependency — returns the decoded JWT claims or raises 401."""
    return _decode_token(credentials.credentials)
