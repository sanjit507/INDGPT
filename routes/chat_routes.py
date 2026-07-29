import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage

from auth import get_current_user, get_optional_user
from chat_engine import (
    auth_chatbot,
    clear_user_threads,
    delete_user_thread,
    extract_text,
    get_thread_title,
    get_user_threads,
    guest_chatbot,
)
from models import ChatRequest

router = APIRouter(prefix="/api", tags=["chat"])


# ── Thread list ───────────────────────────────────────────────────────────────
@router.get("/threads")
def list_threads(user: dict = Depends(get_current_user)):
    user_id = int(user["sub"])
    thread_ids = get_user_threads(user_id)
    threads = [
        {"thread_id": tid, "title": get_thread_title(tid)}
        for tid in thread_ids
    ]
    return {"threads": threads[::-1]}  # newest first


# ── Streaming chat ────────────────────────────────────────────────────────────
@router.post("/chat/stream")
def chat_stream(
    req: ChatRequest,
    user: dict | None = Depends(get_optional_user),
):
    is_guest = user is None

    if is_guest:
        session_id = req.guest_session_id or str(uuid.uuid4())
        thread_id = req.thread_id or f"guest_{session_id}_{uuid.uuid4()}"
        bot = guest_chatbot
    else:
        user_id = int(user["sub"])
        thread_id = req.thread_id or f"user_{user_id}_{uuid.uuid4()}"
        bot = auth_chatbot

    config = {"configurable": {"thread_id": thread_id}}

    def event_generator():
        # Tell the client which thread_id was assigned (important for new chats)
        yield f"data: {json.dumps({'type': 'thread_id', 'thread_id': thread_id})}\n\n"

        try:
            for message_chunk, _ in bot.stream(
                {"messages": [HumanMessage(content=req.message)]},
                config=config,
                stream_mode="messages",
            ):
                text = extract_text(message_chunk.content)
                if text:
                    yield f"data: {json.dumps({'type': 'token', 'content': text})}\n\n"
        except Exception as exc:
            yield f"data: {json.dumps({'type': 'error', 'message': str(exc)})}\n\n"

        yield f"data: {json.dumps({'type': 'done'})}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ── Get thread messages ───────────────────────────────────────────────────────
@router.get("/thread_messages/{thread_id:path}")
def get_thread_messages(thread_id: str, user: dict = Depends(get_current_user)):
    user_id = int(user["sub"])
    if not thread_id.startswith(f"user_{user_id}_"):
        raise HTTPException(status_code=403, detail="Access denied")

    try:
        state = auth_chatbot.get_state(config={"configurable": {"thread_id": thread_id}})
        raw_msgs = state.values.get("messages", [])
        messages = []
        for msg in raw_msgs:
            msg_type = getattr(msg, "type", "")
            role = "user" if msg_type == "human" or isinstance(msg, HumanMessage) else "assistant"
            text = extract_text(msg.content)
            if text:
                messages.append({"role": role, "content": text})
        return {"messages": messages}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


# ── Delete a single thread ────────────────────────────────────────────────────
@router.delete("/thread/{thread_id:path}")
def delete_thread(thread_id: str, user: dict = Depends(get_current_user)):
    user_id = int(user["sub"])
    if not thread_id.startswith(f"user_{user_id}_"):
        raise HTTPException(status_code=403, detail="Access denied")
    delete_user_thread(thread_id)
    return {"success": True}


# ── Clear all threads for a user ──────────────────────────────────────────────
@router.delete("/threads/all")
def clear_all(user: dict = Depends(get_current_user)):
    clear_user_threads(int(user["sub"]))
    return {"success": True}
