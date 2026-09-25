"""
Seed script – Stage 1:
Creates the first admin account if one doesn't already exist.

Run with:
    cd backend
    venv\Scripts\python seed.py
"""

import asyncio
from sqlalchemy import select
from app.database import engine, AsyncSessionLocal
from app.models import Base, User, UserRole
from app.security.passwords import hash_password
from app.config import get_settings

settings = get_settings()


async def seed() -> None:
    # Ensure tables exist
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    async with AsyncSessionLocal() as db:
        result = await db.execute(
            select(User).where(User.email == settings.FIRST_ADMIN_EMAIL)
        )
        existing = result.scalar_one_or_none()

        if existing:
            print(f"[seed] Admin '{settings.FIRST_ADMIN_EMAIL}' already exists – skipping.")
            return

        admin = User(
            email=settings.FIRST_ADMIN_EMAIL,
            hashed_password=hash_password(settings.FIRST_ADMIN_PASSWORD),
            role=UserRole.admin,
            is_active=True,
        )
        db.add(admin)
        await db.commit()
        print(f"[seed] Admin account created: {settings.FIRST_ADMIN_EMAIL}")


if __name__ == "__main__":
    asyncio.run(seed())
