import sys
import os

# Ensure project root is on the path so all local modules resolve correctly
sys.path.insert(0, os.path.dirname(__file__))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from dotenv import load_dotenv

from database import init_db
from routes.auth_routes import router as auth_router
from routes.chat_routes import router as chat_router

load_dotenv()

app = FastAPI(title="ChatGPT Clone", version="2.0.0", docs_url="/api/docs")

# ── CORS ──────────────────────────────────────────────────────────────────────
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Static files ──────────────────────────────────────────────────────────────
app.mount("/static", StaticFiles(directory="frontend/static"), name="static")


# ── Startup ───────────────────────────────────────────────────────────────────
@app.on_event("startup")
def on_startup():
    init_db()


# ── HTML pages ────────────────────────────────────────────────────────────────
@app.get("/", include_in_schema=False)
def serve_index():
    return FileResponse("frontend/index.html")


@app.get("/chat", include_in_schema=False)
def serve_chat():
    return FileResponse("frontend/chat.html")


# ── API Routers ───────────────────────────────────────────────────────────────
app.include_router(auth_router)
app.include_router(chat_router)
