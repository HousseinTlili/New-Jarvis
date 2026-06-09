import os
from pathlib import Path

def read_file(path: str) -> str:
    resolved_path = Path(path).expanduser().resolve()
    if not resolved_path.exists():
        return f"Error: File not found at '{path}'"
    if resolved_path.is_dir():
        return f"Error: Path '{path}' is a directory, not a file."
        
    try:
        with open(resolved_path, "r", encoding="utf-8", errors="replace") as f:
            return f.read()
    except Exception as e:
        return f"Error reading file: {str(e)}"

def write_file(path: str, content: str) -> str:
    resolved_path = Path(path).expanduser().resolve()
    try:
        resolved_path.parent.mkdir(parents=True, exist_ok=True)
        with open(resolved_path, "w", encoding="utf-8") as f:
            f.write(content)
        return f"File successfully written to '{path}' ({len(content)} bytes)."
    except Exception as e:
        return f"Error writing file: {str(e)}"
