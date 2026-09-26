"""
Admin router – Stage 5 (partial, wired for frontend):
  GET  /api/admin/users
  GET  /api/admin/logs
  POST /api/admin/users/{id}/toggle-lock
"""

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.database import get_db
from app.models import User, LoginAuditLog
from app.dependencies import require_admin

router = APIRouter(prefix="/api/admin", tags=["admin"])

LOCK_DURATION_MINUTES = 60 * 24  # 24h manual lock


# ── Response schemas ─────────────────────────────────────────────────────────
class UserAdminView(BaseModel):
    id: int
    email: str
    role: str
    is_active: bool
    is_totp_enabled: bool
    failed_login_attempts: int
    locked_until: datetime | None
    oauth_provider: str | None

    model_config = {"from_attributes": True}


class LogView(BaseModel):
    id: int
    user_id: int | None
    attempted_email: str
    ip_address: str | None
    user_agent: str | None
    timestamp: datetime
    status: str

    model_config = {"from_attributes": True}


# ── Endpoints ────────────────────────────────────────────────────────────────
@router.get("/users", response_model=list[UserAdminView])
async def list_users(
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).order_by(User.id))
    return result.scalars().all()


@router.get("/logs", response_model=list[LogView])
async def list_logs(
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(LoginAuditLog).order_by(LoginAuditLog.timestamp.desc()).limit(500)
    )
    return result.scalars().all()


@router.post("/users/{user_id}/toggle-lock")
async def toggle_lock(
    user_id: int,
    _=Depends(require_admin),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(User).where(User.id == user_id))
    user: User | None = result.scalar_one_or_none()

    if not user:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found.")

    now = datetime.now(timezone.utc)
    is_currently_locked = user.locked_until and user.locked_until > now

    if is_currently_locked:
        # Unlock
        user.locked_until = None
        user.failed_login_attempts = 0
        message = "User unlocked successfully."
    else:
        # Lock for 24h
        user.locked_until = now + timedelta(minutes=LOCK_DURATION_MINUTES)
        message = "User locked for 24 hours."

    await db.commit()
    return {"message": message, "locked_until": user.locked_until}
