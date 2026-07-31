"""
chat_engine.py — LangGraph graph setup + helper functions for chat persistence.

Two chatbot instances:
  • auth_chatbot  – Uses SqliteSaver (persistent across restarts).
  • guest_chatbot – Uses MemorySaver (lost on server restart; suits guest sessions).

Thread-ID namespacing:
  • Auth users  : "user_{user_id}_{uuid4}"
  • Guest users : "guest_{session_id}_{uuid4}"
"""

from langgraph.graph import StateGraph, START, END
from langgraph.graph.message import add_messages
from langgraph.checkpoint.sqlite import SqliteSaver
from langgraph.checkpoint.memory import MemorySaver
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.messages import BaseMessage, HumanMessage
from typing import Annotated, TypedDict

from dotenv import load_dotenv
load_dotenv()

from database import get_shared_connection


# ── LLM ───────────────────────────────────────────────────────────────────────
llm = ChatGoogleGenerativeAI(model="gemini-3.6-flash")


# ── State schema ──────────────────────────────────────────────────────────────
class ChatState(TypedDict):
    messages: Annotated[list[BaseMessage], add_messages]


# ── Graph factory ─────────────────────────────────────────────────────────────
def _build_graph(checkpointer):
    def chat_node(state: ChatState):
        from langchain_core.messages import SystemMessage
        system_msg = SystemMessage(
            content=(
                "You are a helpful, concise assistant. "
                "Answer accurately in as few words as possible. "
                "Avoid filler, repetition, and extra preamble to save output tokens."
            )
        )
        return {"messages": [llm.invoke([system_msg] + state["messages"])]}

    g = StateGraph(ChatState)
    g.add_node("chat_node", chat_node)
    g.add_edge(START, "chat_node")
    g.add_edge("chat_node", END)
    return g.compile(checkpointer=checkpointer)


auth_chatbot = _build_graph(SqliteSaver(get_shared_connection()))
guest_chatbot = _build_graph(MemorySaver())


# ── Content extractor ─────────────────────────────────────────────────────────
def extract_text(content) -> str:
    """Normalize Gemini content (str or list of blocks) to plain text."""
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        parts = []
        for part in content:
            if isinstance(part, str):
                parts.append(part)
            elif isinstance(part, dict) and "text" in part:
                parts.append(part["text"])
        return "".join(parts)
    return str(content)


# ── Thread helpers ────────────────────────────────────────────────────────────
def get_user_threads(user_id: int) -> list[str]:
    """Return all thread IDs that belong to a given user."""
    conn = get_shared_connection()
    cursor = conn.cursor()
    prefix = f"user_{user_id}_"
    try:
        cursor.execute(
            "SELECT DISTINCT thread_id FROM checkpoints WHERE thread_id LIKE ?",
            (prefix + "%",),
        )
        return [row[0] for row in cursor.fetchall()]
    except Exception:
        return []


def get_thread_title(thread_id: str, is_guest: bool = False) -> str:
    """Return the first user message as a human-readable thread title."""
    bot = guest_chatbot if is_guest else auth_chatbot
    try:
        state = bot.get_state(config={"configurable": {"thread_id": thread_id}})
        for msg in state.values.get("messages", []):
            if isinstance(msg, HumanMessage):
                text = extract_text(msg.content).strip()
                if text:
                    return (text[:30] + "…") if len(text) > 30 else text
    except Exception:
        pass
    return f"Chat {thread_id[-6:]}"


def delete_user_thread(thread_id: str) -> None:
    """Remove all checkpoint rows for a specific thread."""
    conn = get_shared_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    for (table_name,) in cursor.fetchall():
        cursor.execute(f"PRAGMA table_info('{table_name}');")
        cols = [c[1] for c in cursor.fetchall()]
        if "thread_id" in cols:
            cursor.execute(
                f"DELETE FROM '{table_name}' WHERE thread_id = ?", (thread_id,)
            )
    conn.commit()


def clear_user_threads(user_id: int) -> None:
    """Remove all checkpoint rows for every thread owned by a user."""
    conn = get_shared_connection()
    cursor = conn.cursor()
    prefix = f"user_{user_id}_"
    cursor.execute("SELECT name FROM sqlite_master WHERE type='table';")
    for (table_name,) in cursor.fetchall():
        cursor.execute(f"PRAGMA table_info('{table_name}');")
        cols = [c[1] for c in cursor.fetchall()]
        if "thread_id" in cols:
            cursor.execute(
                f"DELETE FROM '{table_name}' WHERE thread_id LIKE ?",
                (prefix + "%",),
            )
    conn.commit()
