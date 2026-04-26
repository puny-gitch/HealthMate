from fastapi import Depends, Query
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
    return parse_user_id_from_token(credentials.credentials)


def get_current_user_id_from_header_or_query(
    token: str | None = Query(default=None),
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
) -> int:
    raw_token = credentials.credentials if credentials else token
    if not raw_token:
        raise AppException("未登录或 token 缺失", code=40100, status_code=401)
    return parse_user_id_from_token(raw_token)


def parse_user_id_from_token(token: str) -> int:
    user_id_str = decode_access_token(token)
    try:
        return int(user_id_str)
    except ValueError as exc:
        raise AppException("无效 token", code=40101, status_code=401) from exc


def get_current_user(user_id: int = Depends(get_current_user_id), db: Session = Depends(get_db)):
    user = user_repository.get_by_id(db, user_id)
    if not user:
        raise AppException("用户不存在", code=40401, status_code=404)
    return user
