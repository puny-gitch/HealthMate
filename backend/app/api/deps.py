from fastapi import Depends
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.exceptions import AppException
from app.core.security import decode_access_token
from app.db.session import get_db
from app.repositories.user_repository import UserRepository

bearer_scheme = HTTPBearer(auto_error=False)
user_repository = UserRepository()


def get_current_user_id(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> int:
    if not credentials:
        raise AppException("未登录或 token 缺失", code=40100, status_code=401)
    user_id_str = decode_access_token(credentials.credentials)
    return int(user_id_str)


def get_current_user(user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    user = user_repository.get_by_id(db, user_id)
    if not user:
        raise AppException("用户不存在", code=40401, status_code=404)
    return user

