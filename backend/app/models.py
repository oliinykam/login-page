from sqlalchemy import (
    Column,
    Integer,
    String,
    Boolean,
    DateTime,
    ForeignKey,
    Enum as SAEnum,
)
from sqlalchemy.orm import DeclarativeBase, relationship
from datetime import datetime, timezone
import enum


class Base(DeclarativeBase):
    pass


class UserRole(str, enum.Enum):
    user = "user"
    admin = "admin"


class LoginStatus(str, enum.Enum):
    SUCCESS = "SUCCESS"
    FAILED = "FAILED"
    LOCKED = "LOCKED"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=True)  # nullable for OAuth-only users
    role = Column(SAEnum(UserRole), default=UserRole.user, nullable=False)
    is_active = Column(Boolean, default=False, nullable=False)

    # Brute-force protection
    failed_login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime(timezone=True), nullable=True)

    # 2FA TOTP
    is_totp_enabled = Column(Boolean, default=False, nullable=False)
    totp_secret = Column(String, nullable=True)

    # OAuth
    oauth_provider = Column(String, nullable=True)  # e.g. "google", "github"
    oauth_id = Column(String, nullable=True)

    # Email activation token (one-time)
    activation_token = Column(String, nullable=True)
    activation_token_expires = Column(DateTime(timezone=True), nullable=True)

    # Password-reset token
    reset_token = Column(String, nullable=True)
    reset_token_expires = Column(DateTime(timezone=True), nullable=True)

    created_at = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )

    audit_logs = relationship("LoginAuditLog", back_populates="user")


class LoginAuditLog(Base):
    __tablename__ = "login_audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    attempted_email = Column(String, nullable=False)
    ip_address = Column(String, nullable=True)
    user_agent = Column(String, nullable=True)
    timestamp = Column(
        DateTime(timezone=True),
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
    )
    status = Column(SAEnum(LoginStatus), nullable=False)

    user = relationship("User", back_populates="audit_logs")
