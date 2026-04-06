from datetime import datetime

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.core.response import api_success
from app.db.session import get_db
from app.repositories.user_repository import UserRepository
from app.schemas.profile import ProfileUpsertReq

router = APIRouter(prefix="/profile", tags=["profile"])
user_repository = UserRepository()


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
    return api_success(
        {
            "userId": current_user.user_id,
            "gender": current_user.gender,
            "height": float(current_user.height) if current_user.height else None,
            "weight": float(current_user.weight) if current_user.weight else None,
            "healthGoal": current_user.health_goal,
            "medicalHistory": current_user.medical_history,
        },
        "保存成功",
    )


@router.put("")
def update_profile(
    payload: ProfileUpsertReq,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_user),
):
    return save_profile(payload, db, current_user)

