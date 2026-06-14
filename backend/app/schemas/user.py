from pydantic import BaseModel, Field

ALLOWED_ROLES = {"admin", "qc", "supervisor", "operator"}


class UserCreate(BaseModel):
    username: str = Field(min_length=3, max_length=50)
    password: str = Field(min_length=8)
    role: str
    full_name: str | None = None


class UserUpdate(BaseModel):  # 部分更新
    role: str | None = None
    full_name: str | None = None
    is_active: bool | None = None


class PasswordReset(BaseModel):
    new_password: str = Field(min_length=8)


class UserResponse(BaseModel):  # 絕對不可包含 password_hash
    user_id: int
    username: str
    full_name: str | None = None
    role: str
    is_active: bool

    class Config:
        from_attributes = True
