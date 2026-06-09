import time
import threading
import re
import json
import ctypes
import logging

logger = logging.getLogger(__name__)

from ctypes import wintypes

# Explicitly configure Windows API signatures for 64-bit pointer safety
user32 = ctypes.windll.user32
kernel32 = ctypes.windll.kernel32

user32.OpenClipboard.argtypes = [wintypes.HWND]
user32.OpenClipboard.restype = wintypes.BOOL

user32.CloseClipboard.argtypes = []
user32.CloseClipboard.restype = wintypes.BOOL

user32.IsClipboardFormatAvailable.argtypes = [wintypes.UINT]
user32.IsClipboardFormatAvailable.restype = wintypes.BOOL

user32.GetClipboardData.argtypes = [wintypes.UINT]
user32.GetClipboardData.restype = wintypes.HANDLE

kernel32.GlobalLock.argtypes = [wintypes.HGLOBAL]
kernel32.GlobalLock.restype = ctypes.c_void_p  # Returns 64-bit memory address pointer

kernel32.GlobalUnlock.argtypes = [wintypes.HGLOBAL]
kernel32.GlobalUnlock.restype = wintypes.BOOL

def get_clipboard_text() -> str | None:
    if not user32.OpenClipboard(None):
        return None
    
    text = None
    try:
        # Try CF_UNICODETEXT first (13)
        if user32.IsClipboardFormatAvailable(13):
            h_data = user32.GetClipboardData(13)
            if h_data:
                ptr = kernel32.GlobalLock(h_data)
                if ptr:
                    text = ctypes.wstring_at(ptr)
                    kernel32.GlobalUnlock(h_data)
        # Fallback to CF_TEXT (1)
        elif user32.IsClipboardFormatAvailable(1):
            h_data = user32.GetClipboardData(1)
            if h_data:
                ptr = kernel32.GlobalLock(h_data)
                if ptr:
                    text = ctypes.string_at(ptr).decode('utf-8', errors='ignore')
                    kernel32.GlobalUnlock(h_data)
    except Exception as e:
        logger.error(f"Error accessing Windows clipboard: {e}")
    finally:
        user32.CloseClipboard()
    return text

TRACEBACK_PATTERNS = [
    r"Traceback \(most recent call last\):",
    r"Exception in thread",
    r"at [a-zA-Z0-9_$./<>]+ \([^)]+:\d+:\d+\)",
    r"TypeError: ",
    r"ValueError: ",
    r"AttributeError: ",
    r"KeyError: ",
    r"NameError: ",
    r"SyntaxError: ",
    r"RuntimeError: ",
    r"panic: ",
    r"thread '[^']+' panicked at"
]

def classify_clipboard_text(text: str) -> str | None:
    if not text:
        return None
        
    stripped = text.strip()
    if len(stripped) < 5:
        return None
        
    if re.match(r"^https?://[^\s/$.?#].[^\s]*$", stripped, re.IGNORECASE) or re.match(r"^file:///[^\s]*$", stripped, re.IGNORECASE):
        if len(stripped) < 1000:
            return "link"
            
    for pattern in TRACEBACK_PATTERNS:
        if re.search(pattern, text):
            return "traceback"
            
    if (stripped.startswith("{") and stripped.endswith("}")) or (stripped.startswith("[") and stripped.endswith("]")):
        try:
            json.loads(stripped)
            return "json"
        except Exception:
            pass
            
    if "\n" in stripped and ":" in stripped:
        try:
            import yaml
            data = yaml.safe_load(stripped)
            if isinstance(data, (dict, list)):
                return "yaml"
        except ImportError:
            lines = stripped.split("\n")
            key_val_lines = 0
            for line in lines:
                if re.match(r"^\s*[\w\-_]+:\s*.*$", line):
                    key_val_lines += 1
            if key_val_lines >= 3:
                return "yaml"
        except Exception:
            pass
            
    return None

class ClipboardMonitor(threading.Thread):
    def __init__(self, on_match_callback):
        super().__init__(name="ClipboardMonitorThread", daemon=True)
        self.on_match_callback = on_match_callback
        self.last_text = None
        self.last_matched_text = None
        self.running = False
        
    def run(self):
        self.running = True
        logger.info("ClipboardMonitor thread started.")
        
        try:
            self.last_text = get_clipboard_text()
        except Exception:
            pass
            
        while self.running:
            try:
                text = get_clipboard_text()
                if text and text != self.last_text:
                    self.last_text = text
                    
                    try:
                        from recall.screen_memory import save_screen_event, get_active_window_title
                        active_win = get_active_window_title() or "Unknown Window"
                        saved_text = text if len(text) < 10000 else text[:10000] + "\n... [truncated]"
                        save_screen_event("clipboard_copy", active_win, saved_text)
                    except Exception as sem_err:
                        logger.error(f"Error logging clipboard copy to recall: {sem_err}")
                    
                    if text != self.last_matched_text:
                        content_type = classify_clipboard_text(text)
                        if content_type:
                            self.last_matched_text = text
                            logger.info(f"Detected relevant clipboard copy: {content_type}")
                            self.on_match_callback(content_type, text)
            except Exception as e:
                logger.error(f"Error in ClipboardMonitor loop: {e}")
                
            time.sleep(1.5)
            
    def stop(self):
        self.running = False
        logger.info("ClipboardMonitor thread stopped.")
