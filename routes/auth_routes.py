from fastapi import APIRouter, HTTPException

from auth import create_jwt, hash_password, verify_password
from database import get_connection
from models import LoginRequest, RegisterRequest, TokenResponse

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/register", response_model=TokenResponse)
def register(req: RegisterRequest):
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")

    conn = get_connection()
    cursor = conn.cursor()

    cursor.execute("SELECT id FROM users WHERE email = ?", (req.email.lower(),))
    if cursor.fetchone():
        conn.close()
        raise HTTPException(status_code=400, detail="Email already registered")

    password_hash = hash_password(req.password)
    cursor.execute(
        "INSERT INTO users (email, username, password_hash) VALUES (?, ?, ?)",
        (req.email.lower(), req.username.strip(), password_hash),
    )
    conn.commit()
    user_id = cursor.lastrowid
    conn.close()

    token = create_jwt(user_id, req.email.lower(), req.username.strip())
    return TokenResponse(
        access_token=token,
        user_id=user_id,
        email=req.email.lower(),
        username=req.username.strip(),
    )


@router.post("/login", response_model=TokenResponse)
def login(req: LoginRequest):
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        "SELECT id, email, username, password_hash FROM users WHERE email = ?",
        (req.email.lower(),),
    )
    row = cursor.fetchone()
    conn.close()

    if not row or not verify_password(req.password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")

    token = create_jwt(row["id"], row["email"], row["username"])
    return TokenResponse(
        access_token=token,
        user_id=row["id"],
        email=row["email"],
        username=row["username"],
    )
