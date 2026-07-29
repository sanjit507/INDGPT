from pydantic import BaseModel
from typing import Optional


class RegisterRequest(BaseModel):
    email: str
    username: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_id: int
    email: str
    username: str


class ChatRequest(BaseModel):
    message: str
    thread_id: Optional[str] = None
    guest_session_id: Optional[str] = None
