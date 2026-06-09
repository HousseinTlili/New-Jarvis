import datetime
from database import get_db_connection

def create_conversation(title="New Chat"):
    conn = get_db_connection()
    cursor = conn.cursor()
    created_at = datetime.datetime.now().isoformat()
    cursor.execute(
        "INSERT INTO conversations (title, created_at) VALUES (?, ?)",
        (title, created_at)
    )
    conn.commit()
    conv_id = cursor.lastrowid
    conn.close()
    return conv_id

def get_conversations():
    conn = get_db_connection()
    cursor = conn.cursor()
    # Delete empty conversations older than 1 minute to avoid cluttering history
    one_minute_ago = (datetime.datetime.now() - datetime.timedelta(minutes=1)).isoformat()
    cursor.execute(
        """
        DELETE FROM conversations 
        WHERE created_at < ? 
          AND id NOT IN (SELECT DISTINCT conversation_id FROM messages)
        """,
        (one_minute_ago,)
    )
    conn.commit()
    
    cursor.execute("SELECT * FROM conversations ORDER BY created_at DESC")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_messages(conversation_id: int, include_archived: bool = True):
    conn = get_db_connection()
    cursor = conn.cursor()
    if include_archived:
        cursor.execute(
            "SELECT * FROM messages WHERE conversation_id = ? ORDER BY timestamp ASC",
            (conversation_id,)
        )
    else:
        cursor.execute(
            "SELECT * FROM messages WHERE conversation_id = ? AND (is_archived = 0 OR is_archived IS NULL) ORDER BY timestamp ASC",
            (conversation_id,)
        )
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def save_message(conversation_id: int, role: str, content: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    timestamp = datetime.datetime.now().isoformat()
    cursor.execute(
        "INSERT INTO messages (conversation_id, role, content, timestamp, is_archived) VALUES (?, ?, ?, ?, 0)",
        (conversation_id, role, content, timestamp)
    )
    conn.commit()
    conn.close()

def rename_conversation(conversation_id: int, title: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute(
        "UPDATE conversations SET title = ? WHERE id = ?",
        (title, conversation_id)
    )
    conn.commit()
    conn.close()

def delete_conversation(conversation_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("PRAGMA foreign_keys = ON;")
    cursor.execute("DELETE FROM conversations WHERE id = ?", (conversation_id,))
    conn.commit()
    conn.close()

def save_fact(key: str, value: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    updated_at = datetime.datetime.now().isoformat()
    cursor.execute(
        """
        INSERT INTO facts (key, value, updated_at) 
        VALUES (?, ?, ?) 
        ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at
        """,
        (key, value, updated_at)
    )
    conn.commit()
    conn.close()

def get_all_facts():
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM facts")
    rows = cursor.fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_conversation_summary(conversation_id: int) -> str or None:
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT summary FROM conversations WHERE id = ?", (conversation_id,))
    row = cursor.fetchone()
    conn.close()
    return row["summary"] if row else None

def update_conversation_summary(conversation_id: int, summary: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE conversations SET summary = ? WHERE id = ?", (summary, conversation_id))
    conn.commit()
    conn.close()

def archive_messages(message_ids: list):
    if not message_ids:
        return
    conn = get_db_connection()
    cursor = conn.cursor()
    placeholders = ",".join("?" for _ in message_ids)
    cursor.execute(f"UPDATE messages SET is_archived = 1 WHERE id IN ({placeholders})", message_ids)
    conn.commit()
    conn.close()

