"""
OAuth / OpenID Connect router – Stage 7:
  GET /api/auth/oauth/login     – redirect to Google authorization page
  GET /api/auth/oauth/callback  – exchange code, verify id_token, link/create user, issue JWT
"""

import hmac
import secrets
import urllib.parse
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request, status
from fastapi.responses import RedirectResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import get_settings
from app.database import get_db
from app.models import User, UserRole, LoginAuditLog, LoginStatus
from app.security.jwt import create_access_token, create_temp_token
from app.services import oauth as oauth_service

settings = get_settings()

router = APIRouter(prefix="/api/auth/oauth", tags=["oauth"])


def _is_locked(dt: datetime | None) -> bool:
    if dt is None:
        return False
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=timezone.utc)
    return dt > datetime.now(timezone.utc)


# ── Step 1: Redirect to Google consent screen ──────────────────────────────────
@router.get("/login")
async def oauth_login():
    """
    Redirect the user to Google's OpenID Connect authorization endpoint.
    Retrieves authorization_endpoint dynamically from Google's OIDC discovery document.
    Generates a secure state parameter stored in an HttpOnly cookie to mitigate CSRF attacks.
    """
    if not settings.GOOGLE_CLIENT_ID or not settings.GOOGLE_CLIENT_SECRET:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=(
                "Google OAuth is not configured on the server. "
                "Please configure GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in backend/.env."
            ),
        )

    try:
        oidc_config = await oauth_service.get_google_oidc_config()
        auth_endpoint = oidc_config.get("authorization_endpoint")
        if not auth_endpoint:
            raise ValueError("authorization_endpoint not found in Google discovery document.")
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=f"Failed to fetch Google OIDC configuration: {exc}",
        )

    # Generate random cryptographic state for CSRF defense
    state = secrets.token_urlsafe(32)

    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
        "state": state,
        "access_type": "offline",
        "prompt": "select_account",
    }
    redirect_target = f"{auth_endpoint}?{urllib.parse.urlencode(params)}"

    response = RedirectResponse(url=redirect_target, status_code=status.HTTP_302_FOUND)
    response.set_cookie(
        key="oauth_state",
        value=state,
        httponly=True,
        max_age=600,  # 10 minutes
        samesite="lax",
        secure=False,  # Allow testing over HTTP in local development
    )
    return response


# ── Step 2: Google Callback ────────────────────────────────────────────────────
@router.get("/callback")
async def oauth_callback(
    request: Request,
    code: str | None = None,
    state: str | None = None,
    error: str | None = None,
    error_description: str | None = None,
    db: AsyncSession = Depends(get_db),
):
    """
    Handle Google OAuth callback:
      1. Check for provider errors (e.g. user cancelled consent).
      2. Verify CSRF state parameter matches HttpOnly cookie.
      3. Exchange authorization code for Google tokens.
      4. Cryptographically verify id_token (JWKS signature, aud, iss, exp).
      5. Link with existing account or create a new user.
      6. Issue application JWT (or temp token if 2FA is active) and redirect to frontend.
    """
    ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "")

    # 1. Handle error response from Google
    if error:
        err_msg = error_description or error
        target = f"{settings.FRONTEND_BASE_URL}/index.html?error={urllib.parse.quote(err_msg)}"
        resp = RedirectResponse(url=target, status_code=status.HTTP_302_FOUND)
        resp.delete_cookie("oauth_state")
        return resp

    # 2. CSRF State Validation
    cookie_state = request.cookies.get("oauth_state")
    if not state or not cookie_state or not hmac.compare_digest(state, cookie_state):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or missing OAuth state parameter (potential CSRF attack / CSRF protection failed).",
        )

    # 3. Check for authorization code
    if not code:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Authorization code was not provided by Google.",
        )

    # 4. Exchange code for Google tokens
    try:
        token_data = await oauth_service.exchange_code_for_tokens(code)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Token exchange with Google failed: {exc}",
        )

    id_token = token_data.get("id_token")
    if not id_token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google did not return an id_token in token response.",
        )

    # 5. Cryptographically verify id_token
    try:
        claims = await oauth_service.verify_google_id_token(id_token)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Google id_token verification failed: {exc}",
        )

    sub = claims.get("sub")
    email = claims.get("email")
    email_verified = claims.get("email_verified", False)

    if not sub or not email:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google user profile does not contain required sub or email claims.",
        )

    if not email_verified:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Google account email is not verified.",
        )

    # 6. Locate or create user
    # A. Search by Google oauth_id
    result = await db.execute(
        select(User).where(User.oauth_provider == "google", User.oauth_id == str(sub))
    )
    user: User | None = result.scalars().first()

    # B. Search by email if not found by oauth_id (link existing password account)
    if not user:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalars().first()
        if user:
            user.oauth_provider = "google"
            user.oauth_id = str(sub)
            user.is_active = True  # Verified by Google

    # C. Create a new user if none exists
    if not user:
        user = User(
            email=email,
            hashed_password=None,
            role=UserRole.user,
            is_active=True,
            oauth_provider="google",
            oauth_id=str(sub),
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    # 7. Check account lock
    if _is_locked(user.locked_until):
        log = LoginAuditLog(
            user_id=user.id,
            attempted_email=user.email,
            ip_address=ip,
            user_agent=user_agent,
            status=LoginStatus.LOCKED,
        )
        db.add(log)
        await db.commit()
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Account is temporarily locked. Try again after {user.locked_until.strftime('%H:%M UTC')}.",
        )

    # Reset failed attempts and write successful audit log
    user.failed_login_attempts = 0
    user.locked_until = None
    log = LoginAuditLog(
        user_id=user.id,
        attempted_email=user.email,
        ip_address=ip,
        user_agent=user_agent,
        status=LoginStatus.SUCCESS,
    )
    db.add(log)
    await db.commit()
    await db.refresh(user)

    # 8. Check 2FA or issue permanent access token
    if user.is_totp_enabled:
        temp_token = create_temp_token(user.id)
        redirect_target = (
            f"{settings.FRONTEND_BASE_URL}/index.html"
            f"?two_factor=true&temp_token={temp_token}"
        )
    else:
        access_token = create_access_token(data={"sub": str(user.id)})
        redirect_target = (
            f"{settings.FRONTEND_BASE_URL}/profile.html"
            f"?token={access_token}"
        )

    response = RedirectResponse(url=redirect_target, status_code=status.HTTP_302_FOUND)
    response.delete_cookie("oauth_state")
    return response
