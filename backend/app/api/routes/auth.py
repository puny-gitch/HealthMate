from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.exceptions import AppException
from app.core.response import api_success
from app.core.security import create_access_token, hash_password, verify_password
from app.db.session import get_db
from app.models.user import User
from app.repositories.user_repository import UserRepository
from app.schemas.auth import AuthLoginReq, AuthRegisterReq

router = APIRouter(prefix="/auth", tags=["auth"])
user_repository = UserRepository()


@router.post("/register")
def register(payload: AuthRegisterReq, db: Session = Depends(get_db)):
    if user_repository.get_by_username(db, payload.login_name):
        raise AppException("用户名已存在", code=40010, status_code=400)
    user = User(
        username=payload.login_name,
        password_hash=hash_password(payload.password),
        health_goal="保持健康",
    )
    created = user_repository.create(db, user)
    return api_success({"userId": created.user_id}, "注册成功")


@router.post("/login")
def login(payload: AuthLoginReq, db: Session = Depends(get_db)):
    user = user_repository.get_by_username(db, payload.login_name)
    if not user or not verify_password(payload.password, user.password_hash):
        raise AppException("账号或密码错误", code=40011, status_code=400)
    token, expire = create_access_token(user.user_id)
    return api_success(
        {"token": token, "expireAt": expire.isoformat(), "userId": user.user_id},
        "登录成功",
    )

