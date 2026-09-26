"""
Google OpenID Connect / OAuth 2.0 Service (Stage 7).
Handles:
  - Dynamic Google OIDC Discovery document fetching & caching
  - Google JWKS public signing keys fetching & caching
  - Authorization code exchange for tokens (id_token & access_token)
  - Cryptographic validation of Google id_token (JWKS signature, aud, iss, exp)
  - Userinfo retrieval (optional fallback)
"""

import time
import httpx
from jose import jwt, jwk
from jose.exceptions import JWTError

from app.config import get_settings

settings = get_settings()

GOOGLE_DISCOVERY_URL = "https://accounts.google.com/.well-known/openid-configuration"
GOOGLE_ISSUERS = ["https://accounts.google.com", "accounts.google.com"]

# In-memory caches for OIDC discovery config and JWKS keys
_discovery_cache: dict = {
    "data": None,
    "expires_at": 0.0,
}

_jwks_cache: dict = {
    "keys": None,
    "expires_at": 0.0,
}

DISCOVERY_CACHE_TTL = 86400  # 24 hours
JWKS_CACHE_TTL = 3600         # 1 hour


async def get_google_oidc_config(force_refresh: bool = False) -> dict:
    """Fetch and cache the Google OIDC discovery document."""
    now = time.time()
    if not force_refresh and _discovery_cache["data"] and now < _discovery_cache["expires_at"]:
        return _discovery_cache["data"]

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(GOOGLE_DISCOVERY_URL)
        resp.raise_for_status()
        data = resp.json()

    _discovery_cache["data"] = data
    _discovery_cache["expires_at"] = now + DISCOVERY_CACHE_TTL
    return data


async def get_google_jwks(jwks_uri: str, force_refresh: bool = False) -> list[dict]:
    """Fetch and cache Google's public signing keys (JWKS)."""
    now = time.time()
    if not force_refresh and _jwks_cache["keys"] and now < _jwks_cache["expires_at"]:
        return _jwks_cache["keys"]

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(jwks_uri)
        resp.raise_for_status()
        data = resp.json()

    keys = data.get("keys", [])
    _jwks_cache["keys"] = keys
    _jwks_cache["expires_at"] = now + JWKS_CACHE_TTL
    return keys


async def exchange_code_for_tokens(code: str) -> dict:
    """Exchange authorization code with Google for tokens."""
    config = await get_google_oidc_config()
    token_endpoint = config.get("token_endpoint")
    if not token_endpoint:
        raise ValueError("Could not determine token_endpoint from Google OIDC discovery.")

    payload = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.post(
            token_endpoint,
            data=payload,
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if resp.status_code != 200:
            raise ValueError(f"Google token endpoint error ({resp.status_code}): {resp.text}")
        return resp.json()


async def verify_google_id_token(id_token_str: str, expected_client_id: str | None = None) -> dict:
    """
    Cryptographically verify a Google id_token:
      1. Extract 'kid' and 'alg' from unverified header.
      2. Match with public keys from Google JWKS.
      3. Verify RS256 signature against Google's public key.
      4. Verify audience ('aud') matches GOOGLE_CLIENT_ID.
      5. Verify issuer ('iss') is Google.
      6. Verify expiration ('exp').
    """
    client_id = expected_client_id or settings.GOOGLE_CLIENT_ID
    if not client_id:
        raise ValueError("GOOGLE_CLIENT_ID is not configured in settings.")

    config = await get_google_oidc_config()
    jwks_uri = config.get("jwks_uri")
    if not jwks_uri:
        raise ValueError("Could not determine jwks_uri from Google OIDC discovery.")

    try:
        header = jwt.get_unverified_header(id_token_str)
    except JWTError as e:
        raise ValueError(f"Invalid id_token header: {e}")

    kid = header.get("kid")
    if not kid:
        raise ValueError("id_token is missing 'kid' in header.")

    keys = await get_google_jwks(jwks_uri)
    key_dict = next((k for k in keys if k.get("kid") == kid), None)

    # If key not found, refresh JWKS once in case Google rotated signing keys
    if not key_dict:
        keys = await get_google_jwks(jwks_uri, force_refresh=True)
        key_dict = next((k for k in keys if k.get("kid") == kid), None)

    if not key_dict:
        raise ValueError(f"Matching Google public key not found for kid: {kid}")

    # Construct public RSA key from JWK
    try:
        rsa_key = jwk.construct(key_dict)
        pem_key = rsa_key.to_pem()
    except Exception as e:
        raise ValueError(f"Failed to construct RSA key from JWK: {e}")

    # Decode and verify token
    try:
        claims = jwt.decode(
            id_token_str,
            pem_key,
            algorithms=["RS256"],
            audience=client_id,
            issuer=GOOGLE_ISSUERS,
            options={
                "verify_signature": True,
                "verify_aud": True,
                "verify_iss": True,
                "verify_exp": True,
            },
        )
    except JWTError as e:
        raise ValueError(f"id_token verification failed: {e}")

    return claims


async def get_google_userinfo(access_token: str) -> dict:
    """Fetch user profile information from Google userinfo_endpoint (optional fallback)."""
    config = await get_google_oidc_config()
    userinfo_endpoint = config.get("userinfo_endpoint")
    if not userinfo_endpoint:
        return {}

    async with httpx.AsyncClient(timeout=10.0) as client:
        resp = await client.get(
            userinfo_endpoint,
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if resp.status_code == 200:
            return resp.json()
    return {}
