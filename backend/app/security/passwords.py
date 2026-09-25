"""
Password utilities:
  - hashing via bcrypt (direct, bypassing passlib's bcrypt wrapper)
  - validation policy (Stage 2)
  - common-password check (bonus Stage 2)
"""

import re
import bcrypt
from fastapi import HTTPException, status

# ── Top-100 most commonly used / compromised passwords ─────────────────────────
COMMON_PASSWORDS: set[str] = {
    "password", "123456", "12345678", "qwerty", "abc123", "monkey", "1234567",
    "letmein", "trustno1", "dragon", "baseball", "iloveyou", "master", "sunshine",
    "ashley", "bailey", "passw0rd", "shadow", "123123", "654321", "superman",
    "qazwsx", "michael", "football", "password1", "password123", "admin",
    "welcome", "login", "hello", "charlie", "donald", "password2", "qwerty123",
    "test", "111111", "000000", "121212", "1q2w3e4r", "qwertyuiop", "starwars",
    "access", "master", "flower", "hunter", "whatever", "pass", "jessica",
    "princess", "zxcvbnm", "mustang", "password01", "mypass", "changeme",
}

# ── Policy checks ───────────────────────────────────────────────────────────────
PASSWORD_POLICY = [
    (r".{8,}", "at least 8 characters"),
    (r"[A-Z]", "at least one uppercase letter"),
    (r"[a-z]", "at least one lowercase letter"),
    (r"\d", "at least one digit"),
    (r"[!@#$%^&*()_+\-=\[\]{};':\"\\|,.<>\/?`~]", "at least one special character"),
]


def validate_password(password: str) -> None:
    """Raise HTTPException 422 if the password does not meet policy requirements."""
    errors: list[str] = []
    for pattern, description in PASSWORD_POLICY:
        if not re.search(pattern, password):
            errors.append(description)

    if password.lower() in COMMON_PASSWORDS:
        errors.append("password is too common / has been compromised")

    if errors:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"Password must contain: {', '.join(errors)}.",
        )


def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())
