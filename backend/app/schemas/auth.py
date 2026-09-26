"""Pydantic schemas for auth endpoints (Stage 2)."""

import re
from pydantic import BaseModel, EmailStr, field_validator


# ── Password policy validator (reusable) ───────────────────────────────────────
COMMON_PASSWORDS: set[str] = {
    "password", "123456", "12345678", "qwerty", "abc123", "monkey", "1234567",
    "letmein", "trustno1", "dragon", "baseball", "iloveyou", "master", "sunshine",
    "ashley", "bailey", "passw0rd", "shadow", "123123", "654321", "superman",
    "qazwsx", "michael", "football", "password1", "password123", "admin",
    "welcome", "login", "hello", "charlie", "donald", "password2", "qwerty123",
}

PASSWORD_POLICY = [
    (r".{8,}", "at least 8 characters"),
    (r"[A-Z]", "at least one uppercase letter"),
    (r"[a-z]", "at least one lowercase letter"),
    (r"\d", "at least one digit"),
    (r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?`~]", "at least one special character"),
]


def _validate_password_policy(value: str) -> str:
    errors = [desc for pat, desc in PASSWORD_POLICY if not re.search(pat, value)]
    if value.lower() in COMMON_PASSWORDS:
        errors.append("password is too common / has been compromised")
    if errors:
        raise ValueError(f"Password must contain: {', '.join(errors)}.")
    return value


# ── Register ───────────────────────────────────────────────────────────────────
class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    captcha_token: str | None = None  # optional at schema level; enforced in router

    @field_validator("password")
    @classmethod
    def password_policy(cls, v: str) -> str:
        return _validate_password_policy(v)


class RegisterResponse(BaseModel):
    message: str


# ── Login ──────────────────────────────────────────────────────────────────────
class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ── User profile ───────────────────────────────────────────────────────────────
class UserProfile(BaseModel):
    id: int
    email: str
    role: str
    is_active: bool
    is_totp_enabled: bool
    oauth_provider: str | None

    model_config = {"from_attributes": True}


# ── Password reset (Stage 8) ──────────────────────────────────────────────────
class ForgotPasswordRequest(BaseModel):
    email: EmailStr


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

    @field_validator("new_password")
    @classmethod
    def password_policy(cls, v: str) -> str:
        return _validate_password_policy(v)

