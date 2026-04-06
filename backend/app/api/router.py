from fastapi import APIRouter

from app.api.routes import advice, auth, health, profile, task

api_router = APIRouter()
api_router.include_router(auth.router)
api_router.include_router(profile.router)
api_router.include_router(health.router)
api_router.include_router(advice.router)
api_router.include_router(task.router)

