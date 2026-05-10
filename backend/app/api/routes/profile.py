from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.response import api_success
from app.db.session import get_db
from app.repositories.user_repository import UserRepository
from app.schemas.profile import GoalChangeReq, ProfileUpsertReq

router = APIRouter(prefix="/profile", tags=["profile"])
legacy_router = APIRouter(prefix="/user", tags=["user-compat"])
user_repository = UserRepository()


def _profile_completed(user) -> bool:
    return bool(user.gender is not None and user.height is not None and user.weight is not None and user.health_goal)


def _serialize_profile(user) -> dict:
    return {
        "userId": user.user_id,
        "username": user.username,
        "gender": user.gender,
        "height": float(user.height) if user.height is not None else None,
        "weight": float(user.weight) if user.weight is not None else None,
        "healthGoal": user.health_goal,
        "medicalHistory": user.medical_history,
        "healthGoalVersion": user.health_goal_version.isoformat() if user.health_goal_version else None,
        "profileCompleted": _profile_completed(user),
    }


@router.get("")
def get_profile(current_user=Depends(get_current_user)):
    return api_success(_serialize_profile(current_user), "查询成功")


@router.post("")
def save_profile(
    payload: ProfileUpsertReq,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    current_user.gender = payload.gender
    current_user.height = payload.height
    current_user.weight = payload.weight
    current_user.health_goal = payload.healthGoal
    current_user.medical_history = payload.medicalHistory
    current_user.health_goal_version = datetime.utcnow()
    user_repository.save(db, current_user)
    return api_success(_serialize_profile(current_user), "保存成功")


@router.put("")
def update_profile(
    payload: ProfileUpsertReq,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return save_profile(payload, db, current_user)


@legacy_router.post("/profile/create")
def legacy_create_profile(
    payload: ProfileUpsertReq,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return save_profile(payload, db, current_user)


@legacy_router.put("/profile/update")
def legacy_update_profile(
    payload: ProfileUpsertReq,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return save_profile(payload, db, current_user)


@legacy_router.put("/goal/change")
def legacy_change_goal(
    payload: GoalChangeReq,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    current_user.health_goal = payload.newGoal
    current_user.health_goal_version = datetime.utcnow()
    user_repository.save(db, current_user)
    return api_success(_serialize_profile(current_user), "目标修改成功")
