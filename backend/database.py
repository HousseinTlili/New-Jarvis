import sqlite3
from config import DB_PATH

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Enable foreign keys
    cursor.execute("PRAGMA foreign_keys = ON;")
    
    # Create conversations table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    """)
    
    # Create messages table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        conversation_id INTEGER NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );
    """)
    
    # Create facts table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS facts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        key TEXT UNIQUE NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
    );
    """)
    
    # Migrations: Add summary to conversations if not present
    try:
        cursor.execute("SELECT summary FROM conversations LIMIT 1;")
    except sqlite3.OperationalError:
        cursor.execute("ALTER TABLE conversations ADD COLUMN summary TEXT;")
        
    # Migrations: Add is_archived to messages if not present
    try:
        cursor.execute("SELECT is_archived FROM messages LIMIT 1;")
    except sqlite3.OperationalError:
        cursor.execute("ALTER TABLE messages ADD COLUMN is_archived INTEGER DEFAULT 0;")
        
    # RAG: Create indexed_folders table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS indexed_folders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT UNIQUE NOT NULL,
        created_at TEXT NOT NULL
    );
    """)
    
    # RAG: Create indexed_files table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS indexed_files (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        folder_id INTEGER,
        path TEXT UNIQUE NOT NULL,
        last_modified REAL NOT NULL,
        FOREIGN KEY (folder_id) REFERENCES indexed_folders(id) ON DELETE CASCADE
    );
    """)
    
    # RAG: Create file_chunks table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS file_chunks (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        file_id INTEGER NOT NULL,
        chunk_index INTEGER NOT NULL,
        content TEXT NOT NULL,
        embedding BLOB NOT NULL,
        FOREIGN KEY (file_id) REFERENCES indexed_files(id) ON DELETE CASCADE
    );
    """)
    
    # Screen Memory (Recall): Create virtual table using FTS5
    try:
        cursor.execute("""
        CREATE VIRTUAL TABLE IF NOT EXISTS screen_memory USING fts5(
            timestamp,
            event_type,
            title,
            content
        );
        """)
    except sqlite3.OperationalError:
        # Fallback to standard table if FTS5 module is not compiled in sqlite3
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS screen_memory (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            timestamp TEXT NOT NULL,
            event_type TEXT NOT NULL,
            title TEXT,
            content TEXT
        );
        """)
        cursor.execute("CREATE INDEX IF NOT EXISTS idx_screen_memory_timestamp ON screen_memory(timestamp);")
        
    # Telemetry: Create telemetry_logs table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS telemetry_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        timestamp TEXT NOT NULL,
        conversation_id INTEGER,
        model_name TEXT NOT NULL,
        prompt_tokens INTEGER NOT NULL,
        completion_tokens INTEGER NOT NULL,
        total_duration_ms REAL,
        load_duration_ms REAL,
        prompt_eval_duration_ms REAL,
        eval_duration_ms REAL,
        estimated_cost_saved_usd REAL NOT NULL,
        FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE SET NULL
    );
    """)

    # Scheduler: Create scheduled_jobs table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS scheduled_jobs (
        job_id TEXT PRIMARY KEY,
        task_type TEXT NOT NULL,
        trigger_type TEXT NOT NULL,
        trigger_value TEXT NOT NULL,
        task_content TEXT NOT NULL,
        created_at TEXT NOT NULL,
        last_run TEXT,
        status TEXT NOT NULL
    );
    """)

    # Scheduler: Create file_watchers table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS file_watchers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT UNIQUE NOT NULL,
        patterns TEXT NOT NULL,
        action_type TEXT NOT NULL,
        action_content TEXT NOT NULL,
        created_at TEXT NOT NULL
    );
    """)
    
    # Settings: Create settings table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
    );
    """)
    
    # Pre-populate default settings
    default_settings = {
        "provider": "local",
        "local_model": "qwen3.5:9b",
        "local_host": "http://localhost:11434",
        "openai_model": "gpt-4o-mini",
        "openai_base_url": "https://api.openai.com/v1",
        "anthropic_model": "claude-3-5-sonnet-latest",
        "gemini_model": "gemini-1.5-flash",
        "nvidia_model": "minimaxai/minimax-m3",
        "nvidia_base_url": "https://integrate.api.nvidia.com/v1",
    }
    for k, v in default_settings.items():
        cursor.execute("INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)", (k, v))
        
    # Migrations: Add reasoning_content to messages if not present
    try:
        cursor.execute("SELECT reasoning_content FROM messages LIMIT 1;")
    except sqlite3.OperationalError:
        cursor.execute("ALTER TABLE messages ADD COLUMN reasoning_content TEXT;")
        
    conn.commit()
    conn.close()

def get_setting(key: str, default: str = None) -> str:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT value FROM settings WHERE key = ?", (key,))
        row = cursor.fetchone()
        if row:
            return row["value"]
    except sqlite3.OperationalError:
        pass
    finally:
        conn.close()
    return default

def save_setting(key: str, value: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
            (key, value)
        )
        conn.commit()
    finally:
        conn.close()

