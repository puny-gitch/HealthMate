from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.user import User


class UserRepository:
    def get_by_username(self, db: Session, username: str) -> User | None:
        return db.scalar(select(User).where(User.username == username))

    def get_by_id(self, db: Session, user_id: int) -> User | None:
        return db.scalar(select(User).where(User.user_id == user_id))

    def list_all(self, db: Session) -> list[User]:
        return list(db.scalars(select(User).order_by(User.user_id.asc())).all())

    def create(self, db: Session, user: User) -> User:
        db.add(user)
        db.commit()
        db.refresh(user)
        return user

    def save(self, db: Session, user: User) -> User:
        db.add(user)
        db.commit()
        db.refresh(user)
        return user
