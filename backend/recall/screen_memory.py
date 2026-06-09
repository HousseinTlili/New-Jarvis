import time
import threading
import sqlite3
import ctypes
import logging
from datetime import datetime
from database import get_db_connection

logger = logging.getLogger(__name__)

# Native Windows APIs for Active Window Tracking
def get_active_window_title() -> str | None:
    user32 = ctypes.windll.user32
    hwnd = user32.GetForegroundWindow()
    if not hwnd:
        return None
    length = user32.GetWindowTextLengthW(hwnd)
    if length > 0:
        buff = ctypes.create_unicode_buffer(length + 1)
        user32.GetWindowTextW(hwnd, buff, length + 1)
        return buff.value
    return None

def save_screen_event(event_type: str, title: str, content: str):
    conn = get_db_connection()
    cursor = conn.cursor()
    timestamp = datetime.now().isoformat()
    try:
        cursor.execute(
            "INSERT INTO screen_memory (timestamp, event_type, title, content) VALUES (?, ?, ?, ?)",
            (timestamp, event_type, title or "", content or "")
        )
        conn.commit()
    except Exception as e:
        logger.error(f"Error saving screen recall event: {e}")
    finally:
        conn.close()

class ScreenMemoryMonitor(threading.Thread):
    def __init__(self):
        super().__init__(name="ScreenMemoryMonitorThread", daemon=True)
        self.last_window_title = None
        self.running = False
        
    def run(self):
        self.running = True
        logger.info("ScreenMemoryMonitor thread started.")
        
        try:
            self.last_window_title = get_active_window_title()
        except Exception:
            pass
            
        while self.running:
            try:
                title = get_active_window_title()
                if title and title != self.last_window_title:
                    if len(title.strip()) > 1:
                        self.last_window_title = title
                        logger.info(f"Active window title changed: {title}")
                        save_screen_event("window_change", title, "")
            except Exception as e:
                logger.error(f"Error in ScreenMemoryMonitor loop: {e}")
                
            time.sleep(2.0)
            
    def stop(self):
        self.running = False
        logger.info("ScreenMemoryMonitor thread stopped.")

def search_screen_memory(query: str, limit: int = 10) -> str:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        try:
            cursor.execute(
                "SELECT timestamp, event_type, title, content FROM screen_memory WHERE screen_memory MATCH ? ORDER BY timestamp DESC LIMIT ?",
                (query, limit)
            )
            rows = cursor.fetchall()
        except sqlite3.OperationalError:
            like_query = f"%{query}%"
            cursor.execute(
                """
                SELECT timestamp, event_type, title, content FROM screen_memory 
                WHERE title LIKE ? OR content LIKE ? 
                ORDER BY timestamp DESC LIMIT ?
                """,
                (like_query, like_query, limit)
            )
            rows = cursor.fetchall()
            
        if not rows:
            return f"No recall memory events found matching query: '{query}'"
            
        output = [f"Recall Memory Search Results for query: '{query}':"]
        for idx, row in enumerate(rows):
            dt = row["timestamp"]
            event_type = row["event_type"]
            title = row["title"] or "Unknown Window"
            content = row["content"] or ""
            
            detail = f"Window: '{title}'"
            if event_type == "clipboard_copy":
                snippet = content[:150] + ("..." if len(content) > 150 else "")
                detail += f"\n  Copied Content: \"{snippet}\""
                
            output.append(
                f"[{idx+1}] [{dt}] Event: {event_type}\n"
                f"  {detail}\n"
            )
        return "\n".join(output)
    except Exception as e:
        return f"Error searching recall memory: {str(e)}"
    finally:
        conn.close()
