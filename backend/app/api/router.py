from fastapi import APIRouter

from app.api.routes import admin, advice, auth, health, profile, task

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(auth.legacy_router)
api_router.include_router(profile.router)
api_router.include_router(profile.legacy_router)
api_router.include_router(health.router)
api_router.include_router(health.visual_router)
api_router.include_router(advice.router)
api_router.include_router(task.router)
api_router.include_router(admin.router)
