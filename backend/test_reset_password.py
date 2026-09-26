"""
Automated unit & integration test suite for Stage 8: Password Reset via Email.
Tests:
  1. Forgot password with non-existing email (generic message, no enumeration)
  2. Forgot password with existing email (generates reset token, sends email)
  3. Reset password with invalid token (400)
  4. Reset password with expired token (400)
  5. Reset password with weak password (422 validation error)
  6. Reset password success (updates hash, clears token, allows login with new password)
"""

import unittest
import uuid
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, AsyncMock

from fastapi.testclient import TestClient
from sqlalchemy import select

from app.main import app
from app.database import AsyncSessionLocal
from app.models import User, UserRole
from app.security.passwords import hash_password, verify_password


class TestPasswordResetStage8(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app, base_url="http://127.0.0.1:8000")

    # 1. Non-existent email -> 200 with generic message (no enumeration)
    async def test_01_forgot_password_unknown_email(self):
        unknown_email = f"unknown_{uuid.uuid4().hex[:8]}@example.com"
        resp = self.client.post("/api/auth/forgot-password", json={"email": unknown_email})
        self.assertEqual(resp.status_code, 200)
        self.assertIn("message", resp.json())
        self.assertIn("instructions have been sent", resp.json()["message"])

    # 2. Existing email -> 200, generates reset_token with 15 min expiry, sends email
    async def test_02_forgot_password_registered_email(self):
        unique_id = uuid.uuid4().hex[:8]
        test_email = f"reset_user_{unique_id}@example.com"

        async with AsyncSessionLocal() as db:
            user = User(
                email=test_email,
                hashed_password=hash_password("OldPassword123!"),
                role=UserRole.user,
                is_active=True,
            )
            db.add(user)
            await db.commit()

        with patch("app.routers.auth.send_email", new=AsyncMock()) as mock_send:
            resp = self.client.post("/api/auth/forgot-password", json={"email": test_email})
            self.assertEqual(resp.status_code, 200)
            mock_send.assert_called_once()
            call_kwargs = mock_send.call_args[1] if mock_send.call_args[1] else {}
            call_args = mock_send.call_args[0] if mock_send.call_args[0] else ()
            recipient = call_kwargs.get("to_email") or (call_args[0] if len(call_args) > 0 else "")
            self.assertEqual(recipient, test_email)

        # Check DB
        async with AsyncSessionLocal() as db:
            res = await db.execute(select(User).where(User.email == test_email))
            user = res.scalar_one_or_none()
            self.assertIsNotNone(user)
            self.assertIsNotNone(user.reset_token)
            self.assertIsNotNone(user.reset_token_expires)
            # Expiry should be ~15 mins in future
            now = datetime.now(timezone.utc)
            expires = user.reset_token_expires
            if expires.tzinfo is None:
                expires = expires.replace(tzinfo=timezone.utc)
            self.assertGreater(expires, now)

    # 3. Reset password with invalid token -> 400
    def test_03_reset_password_invalid_token(self):
        resp = self.client.post(
            "/api/auth/reset-password",
            json={"token": "non-existent-token-xyz", "new_password": "NewValidPass123!"},
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Invalid or already used", resp.json()["detail"])

    # 4. Reset password with expired token -> 400
    async def test_04_reset_password_expired_token(self):
        unique_id = uuid.uuid4().hex[:8]
        test_email = f"expired_reset_{unique_id}@example.com"
        expired_token = f"expired-tok-{unique_id}"

        async with AsyncSessionLocal() as db:
            user = User(
                email=test_email,
                hashed_password=hash_password("OldPassword123!"),
                role=UserRole.user,
                is_active=True,
                reset_token=expired_token,
                reset_token_expires=datetime.now(timezone.utc) - timedelta(minutes=5),
            )
            db.add(user)
            await db.commit()

        resp = self.client.post(
            "/api/auth/reset-password",
            json={"token": expired_token, "new_password": "NewValidPass123!"},
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("expired", resp.json()["detail"].lower())

    # 5. Reset password with weak password -> 422
    def test_05_reset_password_weak_password(self):
        resp = self.client.post(
            "/api/auth/reset-password",
            json={"token": "some-token", "new_password": "short"},
        )
        self.assertEqual(resp.status_code, 422)

    # 6. Reset password success -> updates password hash, clears token, allows login
    async def test_06_reset_password_success(self):
        unique_id = uuid.uuid4().hex[:8]
        test_email = f"success_reset_{unique_id}@example.com"
        valid_token = f"valid-tok-{unique_id}"
        new_password = "BrandNewSecurePass123!"

        async with AsyncSessionLocal() as db:
            user = User(
                email=test_email,
                hashed_password=hash_password("OldPassword123!"),
                role=UserRole.user,
                is_active=True,
                reset_token=valid_token,
                reset_token_expires=datetime.now(timezone.utc) + timedelta(minutes=15),
                failed_login_attempts=4,
            )
            db.add(user)
            await db.commit()

        resp = self.client.post(
            "/api/auth/reset-password",
            json={"token": valid_token, "new_password": new_password},
        )
        self.assertEqual(resp.status_code, 200)
        self.assertIn("successful", resp.json()["message"].lower())

        # Verify DB state
        async with AsyncSessionLocal() as db:
            res = await db.execute(select(User).where(User.email == test_email))
            user = res.scalar_one_or_none()
            self.assertIsNotNone(user)
            self.assertIsNone(user.reset_token)
            self.assertIsNone(user.reset_token_expires)
            self.assertEqual(user.failed_login_attempts, 0)
            self.assertTrue(verify_password(new_password, user.hashed_password))

        # Verify login works with new password
        login_resp = self.client.post(
            "/api/auth/login",
            json={"email": test_email, "password": new_password},
        )
        self.assertEqual(login_resp.status_code, 200)
        self.assertIn("access_token", login_resp.json())


if __name__ == "__main__":
    unittest.main()
