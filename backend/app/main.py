"""
FastAPI application entry point.

Stage 1 deliverables wired here:
  - DB engine + table creation on startup
  - CORSMiddleware
  - StaticFiles serving (frontend at project root)
  - RBAC dependencies (imported via routers)

Stage 2 deliverables:
  - /api/auth/register
  - /api/auth/login
  - /api/users/me
"""

from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.database import engine
from app.models import Base
from app.routers import auth, users, admin, totp
from app.config import get_settings

settings = get_settings()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables on startup (dev only; use Alembic in production)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield


app = FastAPI(
    title="Secure Auth API",
    version="0.1.0",
    description="FastAPI backend for the login-page-test project – Stages 1 & 2",
    lifespan=lifespan,
)

# ── CORS ───────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_ORIGIN, "http://localhost:5500"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── API routers ────────────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(admin.router)
app.include_router(totp.router)

# ── Serve frontend static files ────────────────────────────────────────────────
# The frontend lives one directory above the backend folder.
import os, pathlib
FRONTEND_DIR = pathlib.Path(__file__).resolve().parent.parent.parent  # project root

if FRONTEND_DIR.exists():
    app.mount("/", StaticFiles(directory=str(FRONTEND_DIR), html=True), name="static")
