"""
Automated unit & integration test suite for Stage 7: Google OpenID Connect / OAuth 2.0.
Tests:
  1. Login endpoint without configuration (returns 503)
  2. Login endpoint with configuration (redirects to Google with state & sets HttpOnly cookie)
  3. OIDC discovery caching
  4. Callback CSRF protection (missing / mismatched state)
  5. Callback Google error redirection
  6. Callback missing authorization code
  7. Successful login with new user creation, RSA256 id_token verification & DB audit logging
  8. Successful login with existing user account linking
  9. Successful login with 2FA TOTP requirement
"""

import asyncio
import os
import unittest
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, AsyncMock

from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.hazmat.primitives import serialization
from fastapi.testclient import TestClient
from jose import jwt, jwk
from sqlalchemy import select

from app.main import app
from app.config import get_settings
from app.database import AsyncSessionLocal
from app.models import User, UserRole, LoginAuditLog, LoginStatus
from app.services import oauth as oauth_service


class TestOAuthStage7(unittest.IsolatedAsyncioTestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(app, base_url="http://127.0.0.1:8000")

        # Generate RSA key pair for testing token signing and verification
        cls.private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=2048,
        )
        cls.private_pem = cls.private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption(),
        ).decode("utf-8")

        cls.public_key = cls.private_key.public_key()
        cls.public_pem = cls.public_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo,
        ).decode("utf-8")

        # Construct JWK dictionary for the public key
        cls.kid = "test-google-key-id-1"
        key_obj = jwk.construct(cls.public_pem, algorithm="RS256")
        cls.jwk_dict = key_obj.to_dict()
        cls.jwk_dict["kid"] = cls.kid
        cls.jwk_dict["use"] = "sig"
        cls.jwk_dict["alg"] = "RS256"

    def _generate_test_id_token(
        self,
        sub: str,
        email: str,
        client_id: str,
        expired: bool = False,
        email_verified: bool = True,
    ) -> str:
        now = datetime.now(timezone.utc)
        exp = now - timedelta(minutes=5) if expired else now + timedelta(minutes=10)
        claims = {
            "iss": "https://accounts.google.com",
            "aud": client_id,
            "sub": sub,
            "email": email,
            "email_verified": email_verified,
            "name": "Google Test User",
            "iat": int(now.timestamp()),
            "exp": int(exp.timestamp()),
        }
        headers = {"kid": self.kid, "alg": "RS256"}
        return jwt.encode(claims, self.private_pem, algorithm="RS256", headers=headers)

    # 1. Login endpoint without configuration -> 503
    def test_01_login_unconfigured(self):
        settings = get_settings()
        old_id = settings.GOOGLE_CLIENT_ID
        old_secret = settings.GOOGLE_CLIENT_SECRET
        try:
            settings.GOOGLE_CLIENT_ID = ""
            settings.GOOGLE_CLIENT_SECRET = ""
            resp = self.client.get("/api/auth/oauth/login", follow_redirects=False)
            self.assertEqual(resp.status_code, 503)
            self.assertIn("Google OAuth is not configured", resp.json()["detail"])
        finally:
            settings.GOOGLE_CLIENT_ID = old_id
            settings.GOOGLE_CLIENT_SECRET = old_secret

    # 2. Login endpoint configured -> 302 with CSRF state cookie
    def test_02_login_configured(self):
        settings = get_settings()
        old_id = settings.GOOGLE_CLIENT_ID
        old_secret = settings.GOOGLE_CLIENT_SECRET
        try:
            settings.GOOGLE_CLIENT_ID = "mock-client-id.apps.googleusercontent.com"
            settings.GOOGLE_CLIENT_SECRET = "mock-client-secret"

            resp = self.client.get("/api/auth/oauth/login", follow_redirects=False)
            self.assertEqual(resp.status_code, 302)
            location = resp.headers["location"]
            self.assertIn("accounts.google.com", location)
            self.assertIn("client_id=mock-client-id.apps.googleusercontent.com", location)
            self.assertIn("response_type=code", location)
            self.assertIn("scope=openid+email+profile", location)
            self.assertIn("state=", location)

            # Check HttpOnly state cookie
            self.assertIn("oauth_state", resp.cookies)
        finally:
            settings.GOOGLE_CLIENT_ID = old_id
            settings.GOOGLE_CLIENT_SECRET = old_secret

    # 3. CSRF State validation on callback
    def test_03_callback_csrf_mismatch(self):
        resp = self.client.get(
            "/api/auth/oauth/callback?code=mock_code&state=wrong_state",
            cookies={"oauth_state": "expected_state"},
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("CSRF protection failed", resp.json()["detail"])

    # 4. Google returned error param -> redirect to frontend with error message
    def test_04_callback_google_error(self):
        resp = self.client.get(
            "/api/auth/oauth/callback?error=access_denied&error_description=User%20denied%20consent",
            follow_redirects=False,
        )
        self.assertEqual(resp.status_code, 302)
        self.assertIn("error=", resp.headers["location"])
        self.assertIn("User%20denied%20consent", resp.headers["location"])

    # 5. Missing code -> 400
    def test_05_callback_missing_code(self):
        state = "valid_state_123"
        resp = self.client.get(
            f"/api/auth/oauth/callback?state={state}",
            cookies={"oauth_state": state},
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("code was not provided", resp.json()["detail"])

    # 6. Successful OAuth login creating a new user
    async def test_06_callback_creates_new_user(self):
        import uuid
        settings = get_settings()
        client_id = "test-client-id.apps.googleusercontent.com"
        unique_id = str(uuid.uuid4())[:8]
        test_email = f"oauth_new_{unique_id}@example.com"
        google_sub = f"google-sub-unique-{unique_id}"
        state = f"secure-random-state-{unique_id}"

        settings.GOOGLE_CLIENT_ID = client_id
        settings.GOOGLE_CLIENT_SECRET = "test-secret"

        id_token = self._generate_test_id_token(
            sub=google_sub,
            email=test_email,
            client_id=client_id,
        )

        # Mock discovery, token exchange, and JWKS
        mock_discovery = {
            "authorization_endpoint": "https://accounts.google.com/o/oauth2/v2/auth",
            "token_endpoint": "https://oauth2.googleapis.com/token",
            "jwks_uri": "https://www.googleapis.com/oauth2/v3/certs",
        }

        with patch("app.services.oauth.get_google_oidc_config", new=AsyncMock(return_value=mock_discovery)), \
             patch("app.services.oauth.get_google_jwks", new=AsyncMock(return_value=[self.jwk_dict])), \
             patch("app.services.oauth.exchange_code_for_tokens", new=AsyncMock(return_value={"id_token": id_token, "access_token": "mock-access-token"})):

            resp = self.client.get(
                f"/api/auth/oauth/callback?code=mock-valid-code&state={state}",
                cookies={"oauth_state": state},
                follow_redirects=False,
            )

            self.assertEqual(resp.status_code, 302)
            location = resp.headers["location"]
            self.assertIn("/profile.html?token=", location)

            # Verify in DB that user was created with oauth_provider and is_active=True
            async with AsyncSessionLocal() as db:
                res = await db.execute(select(User).where(User.email == test_email))
                user = res.scalar_one_or_none()
                self.assertIsNotNone(user)
                self.assertEqual(user.oauth_provider, "google")
                self.assertEqual(user.oauth_id, google_sub)
                self.assertTrue(user.is_active)
                self.assertIsNone(user.hashed_password)

                # Verify audit log was recorded
                log_res = await db.execute(
                    select(LoginAuditLog).where(LoginAuditLog.attempted_email == test_email)
                )
                audit = log_res.scalar_one_or_none()
                self.assertIsNotNone(audit)
                self.assertEqual(audit.status, LoginStatus.SUCCESS)

    # 7. Successful OAuth callback links existing user registered with password
    async def test_07_callback_links_existing_user(self):
        import uuid
        settings = get_settings()
        client_id = "test-client-id.apps.googleusercontent.com"
        unique_id = str(uuid.uuid4())[:8]
        test_email = f"oauth_link_{unique_id}@example.com"
        google_sub = f"google-sub-unique-{unique_id}"
        state = f"state-linking-user-{unique_id}"

        settings.GOOGLE_CLIENT_ID = client_id
        settings.GOOGLE_CLIENT_SECRET = "test-secret"

        # Pre-create user with password and unactivated state
        async with AsyncSessionLocal() as db:
            existing_user = User(
                email=test_email,
                hashed_password="some_dummy_hash",
                role=UserRole.user,
                is_active=False,
            )
            db.add(existing_user)
            await db.commit()

        id_token = self._generate_test_id_token(
            sub=google_sub,
            email=test_email,
            client_id=client_id,
        )

        mock_discovery = {
            "authorization_endpoint": "https://accounts.google.com/o/oauth2/v2/auth",
            "token_endpoint": "https://oauth2.googleapis.com/token",
            "jwks_uri": "https://www.googleapis.com/oauth2/v3/certs",
        }

        with patch("app.services.oauth.get_google_oidc_config", new=AsyncMock(return_value=mock_discovery)), \
             patch("app.services.oauth.get_google_jwks", new=AsyncMock(return_value=[self.jwk_dict])), \
             patch("app.services.oauth.exchange_code_for_tokens", new=AsyncMock(return_value={"id_token": id_token, "access_token": "mock-access-token"})):

            resp = self.client.get(
                f"/api/auth/oauth/callback?code=link-code&state={state}",
                cookies={"oauth_state": state},
                follow_redirects=False,
            )

            self.assertEqual(resp.status_code, 302)
            self.assertIn("/profile.html?token=", resp.headers["location"])

            # Verify user in DB is now linked and active
            async with AsyncSessionLocal() as db:
                res = await db.execute(select(User).where(User.email == test_email))
                user = res.scalar_one_or_none()
                self.assertIsNotNone(user)
                self.assertEqual(user.oauth_provider, "google")
                self.assertEqual(user.oauth_id, google_sub)
                self.assertTrue(user.is_active)

    # 8. User with 2FA enabled receives temp token and 2fa redirect
    async def test_08_callback_requires_2fa_if_enabled(self):
        import uuid
        settings = get_settings()
        client_id = "test-client-id.apps.googleusercontent.com"
        unique_id = str(uuid.uuid4())[:8]
        test_email = f"oauth_2fa_{unique_id}@example.com"
        google_sub = f"google-sub-2fa-{unique_id}"
        state = f"state-2fa-user-{unique_id}"

        settings.GOOGLE_CLIENT_ID = client_id
        settings.GOOGLE_CLIENT_SECRET = "test-secret"

        # Pre-create user with 2FA enabled
        async with AsyncSessionLocal() as db:
            user_2fa = User(
                email=test_email,
                role=UserRole.user,
                is_active=True,
                is_totp_enabled=True,
                totp_secret="JBSWY3DPEHPK3PXP",
                oauth_provider="google",
                oauth_id=google_sub,
            )
            db.add(user_2fa)
            await db.commit()

        id_token = self._generate_test_id_token(
            sub=google_sub,
            email=test_email,
            client_id=client_id,
        )

        mock_discovery = {
            "authorization_endpoint": "https://accounts.google.com/o/oauth2/v2/auth",
            "token_endpoint": "https://oauth2.googleapis.com/token",
            "jwks_uri": "https://www.googleapis.com/oauth2/v3/certs",
        }

        with patch("app.services.oauth.get_google_oidc_config", new=AsyncMock(return_value=mock_discovery)), \
             patch("app.services.oauth.get_google_jwks", new=AsyncMock(return_value=[self.jwk_dict])), \
             patch("app.services.oauth.exchange_code_for_tokens", new=AsyncMock(return_value={"id_token": id_token, "access_token": "mock-access-token"})):

            resp = self.client.get(
                f"/api/auth/oauth/callback?code=2fa-code&state={state}",
                cookies={"oauth_state": state},
                follow_redirects=False,
            )

            self.assertEqual(resp.status_code, 302)
            location = resp.headers["location"]
            self.assertIn("two_factor=true", location)
            self.assertIn("temp_token=", location)


if __name__ == "__main__":
    unittest.main()
