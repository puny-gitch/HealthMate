from datetime import datetime

from pydantic import BaseModel, Field, model_validator


class AuthRegisterReq(BaseModel):
    username: str | None = None
    account: str | None = None
    password: str = Field(min_length=6)
    confirmPassword: str = Field(min_length=6)

    @model_validator(mode="after")
    def validate_payload(self):
        if not self.username and not self.account:
            raise ValueError("username/account 至少传一个")
        if self.password != self.confirmPassword:
            raise ValueError("两次密码不一致")
        return self

    @property
    def login_name(self) -> str:
        return self.username or self.account or ""


class AuthLoginReq(BaseModel):
    username: str | None = None
    account: str | None = None
    password: str = Field(min_length=6)

    @model_validator(mode="after")
    def validate_payload(self):
        if not self.username and not self.account:
            raise ValueError("username/account 至少传一个")
        return self

    @property
    def login_name(self) -> str:
        return self.username or self.account or ""


class AuthRegisterResp(BaseModel):
    userId: int


class AuthLoginResp(BaseModel):
    token: str
    expireAt: datetime
    userId: int

