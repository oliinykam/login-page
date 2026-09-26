"""
Auth router – Stages 2, 3 & 4:
  POST /api/auth/register   – register + send activation email
  POST /api/auth/login      – login with JWT
  GET  /api/auth/activate   – activate account via token
"""

import secrets
from datetime import datetime, timezone, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User, LoginAuditLog, LoginStatus
from app.schemas.auth import (
    RegisterRequest,
    RegisterResponse,
    LoginRequest,
    TokenResponse,
)
from app.security.passwords import hash_password, verify_password
from app.security.jwt import create_access_token, create_temp_token
from app.services.email import send_email, activation_email_html
from app.config import get_settings

settings = get_settings()

TURNSTILE_VERIFY_URL = "https://challenges.cloudflare.com/turnstile/v0/siteverify"
ACTIVATION_TOKEN_EXPIRE_HOURS = 24

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Maximum failed attempts before account lock
MAX_FAILED_ATTEMPTS = 5
LOCK_DURATION_MINUTES = 15


# ── Helpers ────────────────────────────────────────────────────────────────────

async def verify_turnstile(token: str | None, remote_ip: str | None = None) -> None:
    """Raise HTTP 400 if the Turnstile token is missing or fails verification."""
    secret = settings.TURNSTILE_SECRET_KEY
    if not secret:
        return
    if not token:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CAPTCHA token is missing. Please complete the CAPTCHA.",
        )
    async with httpx.AsyncClient() as client:
        payload = {"secret": secret, "response": token}
        if remote_ip:
            payload["remoteip"] = remote_ip
        try:
            resp = await client.post(TURNSTILE_VERIFY_URL, data=payload, timeout=5)
            result = resp.json()
        except Exception:
            return  # fail open if Cloudflare unreachable
    if not result.get("success"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="CAPTCHA verification failed. Please try again.",
        )


# ── Register ───────────────────────────────────────────────────────────────────
@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(
    body: RegisterRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    # 1. Verify Cloudflare Turnstile
    remote_ip = request.client.host if request.client else None
    await verify_turnstile(body.captcha_token, remote_ip)

    # 2. Check email uniqueness
    result = await db.execute(select(User).where(User.email == body.email))
    if result.scalar_one_or_none():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists.",
        )

    # 3. Generate activation token
    activation_token = secrets.token_urlsafe(32)
    expires_at = datetime.now(timezone.utc) + timedelta(hours=ACTIVATION_TOKEN_EXPIRE_HOURS)

    # 4. Create user (inactive until email confirmed)
    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        is_active=False,
        activation_token=activation_token,
        activation_token_expires=expires_at,
    )
    db.add(user)
    await db.commit()

    # 5. Send activation email (fire-and-forget)
    activation_link = (
        f"{settings.FRONTEND_BASE_URL}/activate.html"
        f"?token={activation_token}"
    )
    await send_email(
        to_email=body.email,
        subject="Activate your account",
        html_body=activation_email_html(activation_link),
    )

    return RegisterResponse(
        message="Registration successful. Please check your email to activate your account."
    )


# ── Activate ───────────────────────────────────────────────────────────────────
@router.get("/activate")
async def activate_account(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).where(User.activation_token == token)
    )
    user: User | None = result.scalar_one_or_none()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid or already used activation token.",
        )

    if user.activation_token_expires and user.activation_token_expires < datetime.now(timezone.utc):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Activation token has expired. Please register again.",
        )

    user.is_active = True
    user.activation_token = None
    user.activation_token_expires = None
    await db.commit()

    return {"message": "Account activated successfully. You can now log in."}


# ── Login ──────────────────────────────────────────────────────────────────────
@router.post("/login", response_model=TokenResponse)
async def login(
    body: LoginRequest,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    ip = request.client.host if request.client else "unknown"
    user_agent = request.headers.get("user-agent", "")

    result = await db.execute(select(User).where(User.email == body.email))
    user: User | None = result.scalar_one_or_none()

    async def _log(status_val: LoginStatus) -> None:
        log = LoginAuditLog(
            user_id=user.id if user else None,
            attempted_email=body.email,
            ip_address=ip,
            user_agent=user_agent,
            status=status_val,
        )
        db.add(log)
        await db.commit()

    # Check if account is locked
    if user and user.locked_until and user.locked_until > datetime.now(timezone.utc):
        await _log(LoginStatus.LOCKED)
        raise HTTPException(
            status_code=status.HTTP_423_LOCKED,
            detail=f"Account is temporarily locked. Try again after {user.locked_until.strftime('%H:%M UTC')}.",
        )

    if not user or not user.hashed_password or not verify_password(body.password, user.hashed_password):
        if user:
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
                user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOCK_DURATION_MINUTES)
            await db.commit()
        await _log(LoginStatus.FAILED)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    # Allow login even if not activated yet, so user can access profile to see their status


    # Reset failed attempts on success
    user.failed_login_attempts = 0
    user.locked_until = None
    await db.commit()

    await _log(LoginStatus.SUCCESS)

    # If 2FA is enabled, return a short-lived temp token instead
    if user.is_totp_enabled:
        temp_token = create_temp_token(user.id)
        return TokenResponse(
            access_token=temp_token,
            token_type="2fa_required",
        )

    access_token = create_access_token(data={"sub": str(user.id)})
    return TokenResponse(access_token=access_token)
