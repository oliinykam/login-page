"""
2FA router – Stage 6:
  POST /api/auth/2fa/generate  – create TOTP secret + base64 QR code
  POST /api/auth/2fa/enable    – verify first code and activate 2FA
  POST /api/auth/2fa/disable   – turn off 2FA
  POST /api/auth/2fa/verify    – submit TOTP code after login (step 2)
"""

import base64
import io
import pyotp
import qrcode

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.database import get_db
from app.models import User
from app.dependencies import get_current_user
from app.security.jwt import create_access_token, decode_token
from app.config import get_settings

settings = get_settings()

router = APIRouter(prefix="/api/auth/2fa", tags=["2fa"])

APP_NAME = "AuthApp"


def _make_qr_base64(uri: str) -> str:
    """Generate a QR code image from an OTP auth URI and return as base64 PNG."""
    img = qrcode.make(uri)
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()


# ── Generate secret + QR ──────────────────────────────────────────────────────
@router.post("/generate")
async def generate_2fa(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Generate a new TOTP secret and return QR code (does NOT enable 2FA yet)."""
    secret = pyotp.random_base32()
    totp = pyotp.TOTP(secret)
    uri = totp.provisioning_uri(name=current_user.email, issuer_name=APP_NAME)
    qr_code = _make_qr_base64(uri)

    # Store the pending secret temporarily (will be confirmed in /enable)
    current_user.totp_secret = secret
    await db.commit()

    return {
        "secret": secret,
        "qr_code": qr_code,
    }


# ── Enable 2FA (verify first code) ───────────────────────────────────────────
@router.post("/enable")
async def enable_2fa(
    body: dict,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Confirm the TOTP secret is working by verifying the first code."""
    totp_code: str = body.get("totp_code", "")

    if not current_user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No 2FA secret found. Call /generate first.",
        )

    totp = pyotp.TOTP(current_user.totp_secret)
    if not totp.verify(totp_code, valid_window=1):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid TOTP code. Please try again.",
        )

    current_user.is_totp_enabled = True
    await db.commit()

    return {"message": "Two-factor authentication enabled successfully."}


# ── Disable 2FA ───────────────────────────────────────────────────────────────
@router.post("/disable")
async def disable_2fa(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    current_user.is_totp_enabled = False
    current_user.totp_secret = None
    await db.commit()

    return {"message": "Two-factor authentication disabled."}


# ── Verify TOTP during login (step 2) ────────────────────────────────────────
@router.post("/verify")
async def verify_2fa_login(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """
    Called after a login attempt on a 2FA-enabled account.
    Expects: { "temp_token": "...", "totp_code": "123456" }
    Returns: { "access_token": "...", "token_type": "bearer" }
    """
    temp_token: str = body.get("temp_token", "")
    totp_code: str = body.get("totp_code", "")

    # Decode the short-lived temp token
    payload = decode_token(temp_token)
    if not payload or payload.get("type") != "2fa_pending":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired 2FA session. Please log in again.",
        )

    user_id = int(payload["sub"])
    result = await db.execute(select(User).where(User.id == user_id))
    user: User | None = result.scalar_one_or_none()

    if not user or not user.is_totp_enabled or not user.totp_secret:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid 2FA session.",
        )

    totp = pyotp.TOTP(user.totp_secret)
    if not totp.verify(totp_code, valid_window=1):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Invalid TOTP code.",
        )

    # Issue the full access token
    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}
