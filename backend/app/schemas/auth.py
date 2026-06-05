from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    username: str
    # FIX: [fix_6] — Add max_length=128 constraint to password field to prevent oversized bcrypt DoS payloads
    password: str = Field(max_length=128)


class TokenResponse(BaseModel):
    access_token: str
    token_type: str


class UserOut(BaseModel):
    user_id: int
    username: str
    full_name: str | None
    role: str

    class Config:
        from_attributes = True
