import os
import time
import sqlite3
import numpy as np
import requests
import logging
from datetime import datetime
from database import get_db_connection
from config import OLLAMA_HOST

logger = logging.getLogger(__name__)

# File patterns and folders to ignore
IGNORE_FOLDERS = {
    ".git", "node_modules", ".venv", "venv", "__pycache__", 
    ".idea", ".vscode", "dist", "build", "target", "env", 
    ".next", ".svelte-kit", "out", "bin", "obj"
}

IGNORE_EXTENSIONS = {
    # Images
    ".png", ".jpg", ".jpeg", ".gif", ".ico", ".svg", ".webp", ".bmp",
    # Audio/Video
    ".mp3", ".mp4", ".wav", ".avi", ".mkv", ".mov", ".flac",
    # Archives
    ".zip", ".tar", ".gz", ".rar", ".7z", ".bz2",
    # Compiled/Binary
    ".exe", ".dll", ".so", ".dylib", ".class", ".pyc", ".db", ".sqlite",
    # Documents/Other
    ".pdf", ".doc", ".docx", ".xls", ".xlsx", ".ppt", ".pptx", ".woff", ".woff2", ".ttf", ".eot"
}

def is_text_file(filename: str) -> bool:
    _, ext = os.path.splitext(filename.lower())
    return ext not in IGNORE_EXTENSIONS and not ext.startswith(".") or ext in {".py", ".js", ".ts", ".tsx", ".html", ".css", ".json", ".md", ".txt", ".rs", ".toml", ".yaml", ".yml", ".c", ".cpp", ".h", ".go", ".java", ".sh", ".bat", ".ps1"}

def chunk_text(text: str, chunk_size: int = 800, overlap: int = 100) -> list[str]:
    chunks = []
    if not text:
        return chunks
        
    length = len(text)
    start = 0
    while start < length:
        end = start + chunk_size
        chunk = text[start:end]
        chunks.append(chunk)
        if end >= length:
            break
        start += (chunk_size - overlap)
        
    return chunks

def get_embedding(text: str) -> list[float]:
    url = f"{OLLAMA_HOST}/api/embed"
    try:
        response = requests.post(url, json={"model": "nomic-embed-text", "input": text}, timeout=15)
        if response.status_code == 200:
            res_json = response.json()
            if "embeddings" in res_json and len(res_json["embeddings"]) > 0:
                return res_json["embeddings"][0]
            elif "embedding" in res_json:
                return res_json["embedding"]
    except Exception:
        pass

    try:
        url_old = f"{OLLAMA_HOST}/api/embeddings"
        response = requests.post(url_old, json={"model": "nomic-embed-text", "prompt": text}, timeout=15)
        if response.status_code == 200:
            return response.json().get("embedding", [])
    except Exception as e:
        logger.error(f"Failed to generate embedding from Ollama: {e}")
        
    return []

def serialize_vector(vector: list[float]) -> bytes:
    return np.array(vector, dtype=np.float32).tobytes()

def deserialize_vector(blob: bytes) -> np.ndarray:
    return np.frombuffer(blob, dtype=np.float32)

def add_folder_to_index(folder_path: str) -> int:
    folder_path = os.path.abspath(folder_path)
    conn = get_db_connection()
    cursor = conn.cursor()
    created_at = datetime.now().isoformat()
    try:
        cursor.execute(
            "INSERT INTO indexed_folders (path, created_at) VALUES (?, ?) ON CONFLICT(path) DO UPDATE SET created_at = created_at",
            (folder_path, created_at)
        )
        conn.commit()
        
        cursor.execute("SELECT id FROM indexed_folders WHERE path = ?", (folder_path,))
        folder_id = cursor.fetchone()[0]
        return folder_id
    finally:
        conn.close()

def remove_folder_from_index(folder_id: int):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("PRAGMA foreign_keys = ON;")
        cursor.execute("DELETE FROM indexed_folders WHERE id = ?", (folder_id,))
        conn.commit()
    finally:
        conn.close()

def get_rag_status() -> list[dict]:
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, path, created_at FROM indexed_folders")
        folders = [dict(row) for row in cursor.fetchall()]
        
        for folder in folders:
            cursor.execute("SELECT COUNT(*) FROM indexed_files WHERE folder_id = ?", (folder["id"],))
            folder["file_count"] = cursor.fetchone()[0]
            
            cursor.execute("""
                SELECT COUNT(*) FROM file_chunks 
                JOIN indexed_files ON file_chunks.file_id = indexed_files.id 
                WHERE indexed_files.folder_id = ?
            """, (folder["id"],))
            folder["chunk_count"] = cursor.fetchone()[0]
            
        return folders
    finally:
        conn.close()

def index_folder(folder_path: str, progress_callback=None):
    folder_path = os.path.abspath(folder_path)
    folder_id = add_folder_to_index(folder_path)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, path, last_modified FROM indexed_files WHERE folder_id = ?", (folder_id,))
    tracked_files = {row["path"]: (row["id"], row["last_modified"]) for row in cursor.fetchall()}
    
    current_files = set()
    files_to_index = []
    
    for root, dirs, files in os.walk(folder_path):
        dirs[:] = [d for d in dirs if d not in IGNORE_FOLDERS]
        
        for file in files:
            if not is_text_file(file):
                continue
                
            full_path = os.path.join(root, file)
            current_files.add(full_path)
            
            try:
                mtime = os.path.getmtime(full_path)
            except OSError:
                continue
                
            if full_path not in tracked_files:
                files_to_index.append((full_path, mtime, None))
            else:
                db_id, db_mtime = tracked_files[full_path]
                if mtime > db_mtime:
                    files_to_index.append((full_path, mtime, db_id))

    deleted_files = set(tracked_files.keys()) - current_files
    if deleted_files:
        cursor.execute("PRAGMA foreign_keys = ON;")
        for del_path in deleted_files:
            cursor.execute("DELETE FROM indexed_files WHERE path = ?", (del_path,))
        conn.commit()
        logger.info(f"Removed {len(deleted_files)} deleted files from index.")

    total_files = len(files_to_index)
    logger.info(f"Found {total_files} files that need indexing/re-indexing.")

    for idx, (file_path, mtime, file_id) in enumerate(files_to_index):
        if progress_callback:
            progress_callback(idx + 1, total_files, file_path)
            
        try:
            with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
                content = f.read()
        except Exception as e:
            logger.error(f"Failed to read file {file_path}: {e}")
            continue
            
        if not content.strip():
            continue

        if file_id is not None:
            cursor.execute("DELETE FROM file_chunks WHERE file_id = ?", (file_id,))
        else:
            cursor.execute(
                "INSERT INTO indexed_files (folder_id, path, last_modified) VALUES (?, ?, ?)",
                (folder_id, file_path, mtime)
            )
            file_id = cursor.lastrowid
            
        chunks = chunk_text(content)
        for chunk_idx, chunk in enumerate(chunks):
            embedding = get_embedding(chunk)
            if not embedding:
                continue
                
            serialized = serialize_vector(embedding)
            cursor.execute(
                "INSERT INTO file_chunks (file_id, chunk_index, content, embedding) VALUES (?, ?, ?, ?)",
                (file_id, chunk_idx, chunk, serialized)
            )
            
        cursor.execute("UPDATE indexed_files SET last_modified = ? WHERE id = ?", (mtime, file_id))
        conn.commit()
        
    conn.close()
    logger.info(f"Folder {folder_path} indexing completed.")

def search_indexed_files(query: str, limit: int = 5) -> list[dict]:
    query_vector = get_embedding(query)
    if not query_vector:
        logger.warning("Failed to embed query, returning empty results.")
        return []
        
    query_np = np.array(query_vector, dtype=np.float32)
    query_norm = np.linalg.norm(query_np)
    if query_norm == 0:
        return []

    conn = get_db_connection()
    cursor = conn.cursor()
    
    try:
        cursor.execute("""
            SELECT file_chunks.id, file_chunks.content, file_chunks.embedding, file_chunks.chunk_index, indexed_files.path 
            FROM file_chunks 
            JOIN indexed_files ON file_chunks.file_id = indexed_files.id
        """)
        rows = cursor.fetchall()
        
        if not rows:
            return []
            
        candidates = []
        embeddings = []
        
        for row in rows:
            vec = deserialize_vector(row["embedding"])
            if len(vec) == len(query_np):
                embeddings.append(vec)
                candidates.append({
                    "id": row["id"],
                    "content": row["content"],
                    "path": row["path"],
                    "chunk_index": row["chunk_index"]
                })
                
        if not candidates:
            return []
            
        embeddings_matrix = np.vstack(embeddings)
        dot_products = np.dot(embeddings_matrix, query_np)
        row_norms = np.linalg.norm(embeddings_matrix, axis=1)
        row_norms[row_norms == 0] = 1e-10
        
        similarities = dot_products / (row_norms * query_norm)
        top_indices = np.argsort(similarities)[::-1][:limit]
        
        results = []
        for idx in top_indices:
            score = float(similarities[idx])
            if score > 0.3:
                cand = candidates[idx]
                cand["similarity"] = score
                results.append(cand)
                
        return results
    finally:
        conn.close()

def search_indexed_codebase(query: str, limit: int = 5) -> str:
    try:
        results = search_indexed_files(query, limit=limit)
        if not results:
            return "No matching code or documentation found in the indexed workspace folders."
            
        output = [f"Semantic Search Results for query: '{query}':"]
        for idx, res in enumerate(results):
            filename = os.path.basename(res["path"])
            output.append(
                f"[{idx+1}] File: {filename} (Path: {res['path']}) - Similarity: {res['similarity']:.3f}\n"
                f"--- Chunk {res['chunk_index']} ---\n"
                f"{res['content']}\n"
                f"-------------------\n"
            )
        return "\n".join(output)
    except Exception as e:
        return f"Error searching indexed codebase: {str(e)}"
