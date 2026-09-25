"""
Auth router – Stage 2:
  POST /api/auth/register
  POST /api/auth/login
"""

from datetime import datetime, timezone
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
from app.security.jwt import create_access_token

router = APIRouter(prefix="/api/auth", tags=["auth"])

# Maximum failed attempts before account lock
MAX_FAILED_ATTEMPTS = 5
LOCK_DURATION_MINUTES = 15


# ── Register ───────────────────────────────────────────────────────────────────
@router.post("/register", response_model=RegisterResponse, status_code=201)
async def register(
    body: RegisterRequest,
    db: AsyncSession = Depends(get_db),
):
    # Check email uniqueness
    result = await db.execute(select(User).where(User.email == body.email))
    existing = result.scalar_one_or_none()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email already exists.",
        )

    user = User(
        email=body.email,
        hashed_password=hash_password(body.password),
        is_active=True,  # for Stage 2 – activation via email comes in Stage 4
    )
    db.add(user)
    await db.commit()

    return RegisterResponse(
        message="Registration successful. Please check your email to activate your account."
    )


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
        # Increment failed attempts
        if user:
            user.failed_login_attempts += 1
            if user.failed_login_attempts >= MAX_FAILED_ATTEMPTS:
                from datetime import timedelta
                user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=LOCK_DURATION_MINUTES)
            await db.commit()
        await _log(LoginStatus.FAILED)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    # Reset failed attempts on success
    user.failed_login_attempts = 0
    user.locked_until = None
    await db.commit()

    await _log(LoginStatus.SUCCESS)

    access_token = create_access_token(data={"sub": str(user.id)})
    return TokenResponse(access_token=access_token)
