"""
Users router – Stage 2:
  GET /api/users/me  – protected endpoint that returns current user profile
"""

from fastapi import APIRouter, Depends
from app.dependencies import get_current_user
from app.models import User
from app.schemas.auth import UserProfile

router = APIRouter(prefix="/api/users", tags=["users"])


@router.get("/me", response_model=UserProfile)
async def get_me(current_user: User = Depends(get_current_user)):
    return current_user
