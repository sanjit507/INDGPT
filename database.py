import sqlite3

DB_PATH = "chatbot.db"

# Shared connection for LangGraph SqliteSaver (must remain open)
_shared_conn = sqlite3.connect(DB_PATH, check_same_thread=False)
_shared_conn.row_factory = sqlite3.Row


def get_shared_connection() -> sqlite3.Connection:
    """Return the long-lived connection used by LangGraph checkpointer."""
    return _shared_conn


def get_connection() -> sqlite3.Connection:
    """Return a short-lived connection for user/auth queries."""
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    return conn


def init_db() -> None:
    """Create application tables if they don't already exist."""
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS users (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            email         TEXT    UNIQUE NOT NULL,
            username      TEXT    NOT NULL,
            password_hash TEXT    NOT NULL,
            created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.commit()
    conn.close()
    print("[INFO] Database initialized.")
