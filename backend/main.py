import logging
import asyncio
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from fastapi.staticfiles import StaticFiles
from pathlib import Path
from pydantic import BaseModel
from typing import Optional

from config import SERVER_PORT, MODEL_NAME, OLLAMA_HOST, TTS_VOICE_DEFAULT
from database import init_db
from memory import (
    create_conversation,
    get_conversations,
    get_messages,
    rename_conversation,
    delete_conversation,
    get_all_facts,
    save_fact
)
from ai_client import stream_chat
from tools.text_cleaner import clean_text_for_speech
from kokoro_onnx import Kokoro
import soundfile as sf
import io
import threading
from voice_manager import VoiceManager
from recall.clipboard_monitor import ClipboardMonitor
from recall.screen_memory import ScreenMemoryMonitor

# Configure logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("jarvis-backend")

app = FastAPI(title="Jarvis Backend", version="0.1.0")

# Mount plots folder as static assets directory
plots_dir = Path(__file__).parent / "data" / "plots"
plots_dir.mkdir(parents=True, exist_ok=True)
app.mount("/plots", StaticFiles(directory=str(plots_dir)), name="plots")

# Enable CORS for Tauri frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Tauri apps have varying origin URLs depending on platform/scheme
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

active_connections = set()
clipboard_monitor = None
screen_monitor = None
cached_cpu_name = None
cached_gpu_name = None

kokoro_instance = None
kokoro_downloading = False
kokoro_download_lock = threading.Lock()

def _ensure_kokoro_models():
    global kokoro_downloading
    with kokoro_download_lock:
        if kokoro_downloading:
            return
        kokoro_downloading = True
        
    try:
        models_dir = Path(__file__).parent / "models"
        models_dir.mkdir(parents=True, exist_ok=True)
        
        import requests
        
        files = {
            "kokoro-v1.0.onnx": ("https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx", 300000000),
            "voices-v1.0.bin": ("https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin", 25000000)
        }
        
        for name, (url, min_size) in files.items():
            file_path = models_dir / name
            if not file_path.exists() or file_path.stat().st_size < min_size:
                logger.info(f"Downloading Kokoro TTS model file: {name} from {url}...")
                temp_path = models_dir / f"{name}.download"
                try:
                    response = requests.get(url, stream=True)
                    response.raise_for_status()
                    with open(temp_path, "wb") as f:
                        for chunk in response.iter_content(chunk_size=8192):
                            if chunk:
                                f.write(chunk)
                    temp_path.rename(file_path)
                    logger.info(f"Successfully downloaded {name}.")
                except Exception as e:
                    if temp_path.exists():
                        try:
                            temp_path.unlink()
                        except Exception:
                            pass
                    logger.error(f"Failed to download Kokoro TTS model file {name}: {e}")
                    raise e
    finally:
        with kokoro_download_lock:
            kokoro_downloading = False

def get_kokoro():
    global kokoro_instance
    if kokoro_instance is None:
        models_dir = Path(__file__).parent / "models"
        model_path = models_dir / "kokoro-v1.0.onnx"
        voices_path = models_dir / "voices-v1.0.bin"
        
        if not model_path.exists() or model_path.stat().st_size < 300000000 or not voices_path.exists() or voices_path.stat().st_size < 25000000:
            if kokoro_downloading:
                raise HTTPException(status_code=503, detail="TTS models are still downloading in the background. Please wait.")
            # Attempt synchronous download/check
            _ensure_kokoro_models()
            
        if not model_path.exists() or model_path.stat().st_size < 300000000 or not voices_path.exists() or voices_path.stat().st_size < 25000000:
            raise HTTPException(status_code=503, detail="TTS models are not available. Check server logs.")
            
        logger.info("Initializing Kokoro TTS engine...")
        kokoro_instance = Kokoro(str(model_path), str(voices_path))
    return kokoro_instance

@app.on_event("startup")
def startup_event():
    global clipboard_monitor, screen_monitor
    logger.info("Initializing database...")
    init_db()
    logger.info("Database initialized successfully.")
    
    # Clean up empty conversations on startup
    try:
        from database import get_db_connection
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM conversations WHERE id NOT IN (SELECT DISTINCT conversation_id FROM messages)")
        conn.commit()
        conn.close()
        logger.info("Cleaned up empty conversations on startup.")
    except Exception as e:
        logger.error(f"Failed to clean up empty conversations on startup: {e}")
    logger.info("Triggering background loading of voice models...")
    VoiceManager.get_instance().load_models_in_background()
    
    logger.info("Triggering background download of Kokoro TTS models if needed...")
    threading.Thread(target=_ensure_kokoro_models, daemon=True).start()
    
    # Start Windows clipboard monitor
    logger.info("Starting clipboard monitor...")
    def on_clipboard_match(content_type: str, text: str):
        async def broadcast():
            disconnected = []
            for ws_conn in list(active_connections):
                try:
                    await ws_conn.send_json({
                        "type": "clipboard_toast",
                        "content_type": content_type,
                        "text": text
                    })
                except Exception:
                    disconnected.append(ws_conn)
            for ws_conn in disconnected:
                active_connections.discard(ws_conn)
                
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.run_coroutine_threadsafe(broadcast(), loop)
        except Exception as err:
            logger.error(f"Error dispatching clipboard event: {err}")
            
    clipboard_monitor = ClipboardMonitor(on_clipboard_match)
    clipboard_monitor.start()
    
    # Start screen memory window logger
    logger.info("Starting screen memory monitor...")
    screen_monitor = ScreenMemoryMonitor()
    screen_monitor.start()
    
    # Start background scheduler
    logger.info("Starting background scheduler...")
    from recall.scheduler import start_scheduler
    start_scheduler()

@app.on_event("shutdown")
def shutdown_event():
    global clipboard_monitor, screen_monitor
    if clipboard_monitor:
        clipboard_monitor.stop()
    if screen_monitor:
        screen_monitor.stop()
        
    # Stop background scheduler
    logger.info("Stopping background scheduler...")
    from recall.scheduler import shutdown_scheduler
    shutdown_scheduler()

# Models
class ConversationCreate(BaseModel):
    title: Optional[str] = "New Chat"

class ToggleJobRequest(BaseModel):
    job_id: str
    active: bool

class ConversationUpdate(BaseModel):
    title: str

class FactCreate(BaseModel):
    key: str
    value: str

# Endpoints
@app.get("/health")
def health_check():
    return {"status": "ok", "model": MODEL_NAME, "ollama_host": OLLAMA_HOST}

@app.get("/api/system/stats")
def api_system_stats():
    import subprocess
    import json
    global cached_cpu_name, cached_gpu_name
    
    cpu_part = "$cpu_name = $cpu.Name" if not cached_cpu_name else f"$cpu_name = '{cached_cpu_name}'"
    gpu_part = "$gpu_name = $gpu.Name" if not cached_gpu_name else f"$gpu_name = '{cached_gpu_name}'"
    
    script = f"""
    $cpu = Get-CimInstance Win32_Processor | Select-Object Name, LoadPercentage
    $os = Get-CimInstance Win32_OperatingSystem | Select-Object TotalVisibleMemorySize, FreePhysicalMemory
    $disk = Get-CimInstance Win32_LogicalDisk -Filter "DeviceID='C:'" | Select-Object Size, FreeSpace
    {"$gpu = Get-CimInstance Win32_VideoController | Select-Object Name" if not cached_gpu_name else ""}

    $totalRam = [Math]::Round($os.TotalVisibleMemorySize / 1024 / 1024, 1)
    $freeRam = [Math]::Round($os.FreePhysicalMemory / 1024 / 1024, 1)
    $usedRam = [Math]::Round($totalRam - $freeRam, 1)
    $ramPercent = [Math]::Round(($usedRam / $totalRam) * 100, 1)

    $totalDisk = [Math]::Round($disk.Size / 1024 / 1024 / 1024, 1)
    $freeDisk = [Math]::Round($disk.FreeSpace / 1024 / 1024 / 1024, 1)
    $usedDisk = [Math]::Round($totalDisk - $freeDisk, 1)
    $diskPercent = [Math]::Round(($usedDisk / $totalDisk) * 100, 1)

    {cpu_part}
    {gpu_part}
    if ($gpu_name -is [array]) {{ $gpu_name = $gpu_name[0] }}

    @{{
      cpu_name = $cpu_name
      cpu_usage = $cpu.LoadPercentage
      ram_total = $totalRam
      ram_used = $usedRam
      ram_usage = $ramPercent
      disk_total = $totalDisk
      disk_used = $usedDisk
      disk_usage = $diskPercent
      gpu_name = $gpu_name
    }} | ConvertTo-Json
    """
    try:
        proc = subprocess.run(
            ["powershell", "-NoProfile", "-Command", script],
            capture_output=True,
            text=True,
            check=True
        )
        data = json.loads(proc.stdout)
        if not cached_cpu_name:
            cached_cpu_name = data["cpu_name"]
        if not cached_gpu_name:
            cached_gpu_name = data["gpu_name"]
        return data
    except Exception as e:
        logger.error(f"Error fetching system stats: {e}")
        return {
            "cpu_name": cached_cpu_name or "Unknown Processor",
            "cpu_usage": 0,
            "ram_total": 16.0,
            "ram_used": 0,
            "ram_usage": 0,
            "disk_total": 512.0,
            "disk_used": 0,
            "disk_usage": 0,
            "gpu_name": cached_gpu_name or "Unknown Graphics Card"
        }

@app.get("/api/tts")
async def text_to_speech(text: str, voice: Optional[str] = None):
    # Clean markdown and formatting before reading
    cleaned_text = clean_text_for_speech(text)
    
    if not cleaned_text.strip():
        cleaned_text = "Hmm"
        
    try:
        kokoro = get_kokoro()
        selected_voice = voice or TTS_VOICE_DEFAULT
        
        # Determine language based on voice prefix: bm_* (British Male), bf_* (British Female) -> en-gb
        lang = "en-gb"
        v = selected_voice.lower()
        if v.startswith("a"):
            lang = "en-us"
        elif v.startswith("b"):
            lang = "en-gb"
            
        samples, sample_rate = kokoro.create(
            cleaned_text,
            voice=selected_voice,
            speed=1.0,
            lang=lang
        )
        
        # Write to WAV buffer
        buf = io.BytesIO()
        sf.write(buf, samples, sample_rate, format="WAV")
        buf.seek(0)
        
        return StreamingResponse(buf, media_type="audio/wav")
    except Exception as e:
        logger.error(f"Error generating TTS: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/conversations")
def list_conversations():
    try:
        return get_conversations()
    except Exception as e:
        logger.error(f"Error listing conversations: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/conversations")
def new_conversation(data: ConversationCreate):
    try:
        conv_id = create_conversation(data.title)
        return {"id": conv_id, "title": data.title}
    except Exception as e:
        logger.error(f"Error creating conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/conversations/{conversation_id}/messages")
def list_messages(conversation_id: int):
    try:
        return get_messages(conversation_id)
    except Exception as e:
        logger.error(f"Error fetching messages: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.put("/conversations/{conversation_id}")
def update_conv(conversation_id: int, data: ConversationUpdate):
    try:
        rename_conversation(conversation_id, data.title)
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Error updating conversation title: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.delete("/conversations/{conversation_id}")
def remove_conv(conversation_id: int):
    try:
        delete_conversation(conversation_id)
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Error deleting conversation: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/facts")
def list_facts():
    try:
        return get_all_facts()
    except Exception as e:
        logger.error(f"Error listing facts: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/facts")
def add_fact(data: FactCreate):
    try:
        save_fact(data.key, data.value)
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Error saving fact: {e}")
        raise HTTPException(status_code=500, detail=str(e))

# RAG Schemas & Routes
class RAGIndexRequest(BaseModel):
    path: str

class RAGSearchRequest(BaseModel):
    query: str
    limit: Optional[int] = 5

@app.post("/api/rag/index")
async def api_index_folder(data: RAGIndexRequest):
    from recall.rag_manager import index_folder
    import os
    if not os.path.exists(data.path):
        raise HTTPException(status_code=400, detail="Provided directory path does not exist.")
    if not os.path.isdir(data.path):
        raise HTTPException(status_code=400, detail="Provided path is a file, not a directory.")
    
    def do_index():
        try:
            logger.info(f"Starting background index for folder: {data.path}")
            index_folder(data.path)
            logger.info(f"Finished background index for folder: {data.path}")
        except Exception as err:
            logger.error(f"Error during background index for {data.path}: {err}")
            
    asyncio.create_task(asyncio.to_thread(do_index))
    return {"status": "indexing_started", "path": data.path}

@app.delete("/api/rag/remove/{folder_id}")
def api_remove_folder(folder_id: int):
    from recall.rag_manager import remove_folder_from_index
    try:
        remove_folder_from_index(folder_id)
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Error removing folder {folder_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/rag/status")
def api_rag_status():
    from recall.rag_manager import get_rag_status
    try:
        return get_rag_status()
    except Exception as e:
        logger.error(f"Error getting RAG status: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/rag/search")
def api_rag_search(data: RAGSearchRequest):
    from recall.rag_manager import search_indexed_files
    try:
        results = search_indexed_files(data.query, limit=data.limit)
        return {"results": results}
    except Exception as e:
        logger.error(f"Error searching RAG: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/telemetry/stats")
def api_telemetry_stats():
    from recall.telemetry import get_telemetry_stats
    try:
        return get_telemetry_stats()
    except Exception as e:
        logger.error(f"Error getting telemetry stats: {e}")
        raise HTTPException(status_code=500, detail=str(e))

class SettingItem(BaseModel):
    key: str
    value: str

class TestSettingsRequest(BaseModel):
    provider: str
    local_model: Optional[str] = None
    local_host: Optional[str] = None
    openai_key: Optional[str] = None
    openai_model: Optional[str] = None
    openai_base_url: Optional[str] = None
    anthropic_key: Optional[str] = None
    anthropic_model: Optional[str] = None
    gemini_key: Optional[str] = None
    gemini_model: Optional[str] = None
    nvidia_key: Optional[str] = None
    nvidia_model: Optional[str] = None
    nvidia_base_url: Optional[str] = None

@app.get("/api/settings")
def get_all_settings_api():
    from database import get_db_connection
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT key, value FROM settings")
        rows = cursor.fetchall()
        return {row["key"]: row["value"] for row in rows}
    except Exception as e:
        logger.error(f"Error loading settings: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.post("/api/settings")
def save_setting_api(data: SettingItem):
    from database import save_setting
    try:
        save_setting(data.key, data.value)
        return {"status": "ok"}
    except Exception as e:
        logger.error(f"Error saving setting {data.key}: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/settings/test")
async def test_settings_api(data: TestSettingsRequest):
    try:
        if data.provider == "local":
            try:
                from ollama import AsyncClient
            except ImportError:
                raise ValueError("Ollama python client library is not installed in the backend venv.")
                
            client = AsyncClient(host=data.local_host or "http://localhost:11434")
            await client.generate(model=data.local_model or "qwen3.5:9b", prompt="say ok")
            return {"status": "ok", "message": "Connection to Ollama successful!"}
            
        elif data.provider in ["openai", "gemini", "nvidia"]:
            try:
                from openai import AsyncOpenAI
            except ImportError:
                raise ValueError("OpenAI python client library is not installed in the backend venv.")
                
            if data.provider == "openai":
                key = data.openai_key
                base_url = data.openai_base_url or "https://api.openai.com/v1"
                model = data.openai_model or "gpt-4o-mini"
            elif data.provider == "gemini":
                key = data.gemini_key
                base_url = "https://generativelanguage.googleapis.com/v1beta/openai/"
                model = data.gemini_model or "gemini-1.5-flash"
            else: # nvidia
                key = data.nvidia_key
                base_url = data.nvidia_base_url or "https://integrate.api.nvidia.com/v1"
                model = data.nvidia_model or "minimaxai/minimax-m3"
                
            if not key:
                raise ValueError(f"API Key is required for {data.provider.upper()}")
                
            client = AsyncOpenAI(api_key=key, base_url=base_url)
            await client.chat.completions.create(
                model=model,
                messages=[{"role": "user", "content": "say ok"}],
                max_tokens=5
            )
            return {"status": "ok", "message": f"Connection to {data.provider.upper()} successful!"}
            
        elif data.provider == "anthropic":
            try:
                from anthropic import AsyncAnthropic
            except ImportError:
                raise ValueError("Anthropic python client library is not installed in the backend venv.")
                
            key = data.anthropic_key
            model = data.anthropic_model or "claude-3-5-sonnet-latest"
            if not key:
                raise ValueError("API Key is required for Anthropic")
                
            client = AsyncAnthropic(api_key=key)
            await client.messages.create(
                model=model,
                max_tokens=5,
                messages=[{"role": "user", "content": "say ok"}]
            )
            return {"status": "ok", "message": "Connection to Anthropic successful!"}
            
        else:
            raise ValueError(f"Unknown provider: {data.provider}")
            
    except Exception as e:
        logger.error(f"Test connection failed: {e}")
        return {"status": "error", "message": str(e)}

@app.get("/api/telemetry/history")
def api_telemetry_history(days: Optional[int] = 7):
    from recall.telemetry import get_telemetry_history
    try:
        return get_telemetry_history(days=days)
    except Exception as e:
        logger.error(f"Error getting telemetry history: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/telemetry/recent")
def api_telemetry_recent(limit: Optional[int] = 10):
    from recall.telemetry import get_recent_telemetry_logs
    try:
        return get_recent_telemetry_logs(limit=limit)
    except Exception as e:
        logger.error(f"Error getting recent telemetry logs: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/scheduler/jobs")
def api_list_jobs():
    from database import get_db_connection
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT job_id, task_type, trigger_type, trigger_value, last_run, status FROM scheduled_jobs")
        jobs = [dict(row) for row in cursor.fetchall()]
        
        cursor.execute("SELECT id, path, patterns, action_type, action_content, created_at FROM file_watchers")
        watchers = [dict(row) for row in cursor.fetchall()]
        
        return {"jobs": jobs, "watchers": watchers}
    except Exception as e:
        logger.error(f"Error listing scheduler config: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.post("/api/scheduler/jobs/toggle")
def api_toggle_job(data: ToggleJobRequest):
    from database import get_db_connection
    from recall.scheduler import scheduler, schedule_job_in_memory
    conn = get_db_connection()
    cursor = conn.cursor()
    status = "active" if data.active else "paused"
    try:
        cursor.execute("UPDATE scheduled_jobs SET status = ? WHERE job_id = ?", (status, data.job_id))
        conn.commit()
        
        if scheduler:
            if data.active:
                cursor.execute("SELECT task_type, trigger_type, trigger_value, task_content FROM scheduled_jobs WHERE job_id = ?", (data.job_id,))
                job = cursor.fetchone()
                if job:
                    schedule_job_in_memory(
                        data.job_id,
                        job["task_type"],
                        job["trigger_type"],
                        job["trigger_value"],
                        job["task_content"]
                    )
            else:
                if scheduler.get_job(data.job_id):
                    scheduler.remove_job(data.job_id)
                    
        return {"status": "ok", "job_id": data.job_id, "active": data.active}
    except Exception as e:
        logger.error(f"Error toggling job {data.job_id}: {e}")
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.delete("/api/scheduler/jobs/{job_id}")
def api_delete_job(job_id: str):
    from recall.scheduler import delete_scheduled_job
    if delete_scheduled_job(job_id):
        return {"status": "ok"}
    raise HTTPException(status_code=500, detail="Failed to delete scheduled job")

@app.delete("/api/scheduler/watchers/{watcher_id}")
def api_delete_watcher(watcher_id: int):
    from recall.scheduler import remove_file_watcher
    if remove_file_watcher(watcher_id):
        return {"status": "ok"}
    raise HTTPException(status_code=500, detail="Failed to delete file watcher")

async def auto_rename_chat(conversation_id: int, user_query: str):
    # Generates a quick 3-5 word title using the active provider core
    try:
        from ai_client import generate_text
        prompt = (
            f"Generate a short title (3 to 5 words max) summarizing this user query. "
            f"Do not write any prefix, suffix, quotes, or markdown. Output ONLY the plain title text.\n"
            f"Query: {user_query}"
        )
        title = await generate_text(prompt)
        title = title.strip().strip('"').strip("'").strip()
        if title and len(title) > 2:
            title = title[:35]  # Keep it short
            logger.info(f"Auto-renaming conversation {conversation_id} to '{title}'")
            rename_conversation(conversation_id, title)
    except Exception as e:
        logger.warning(f"Failed to auto-rename conversation: {e}")

@app.websocket("/ws/chat")
async def websocket_chat(websocket: WebSocket):
    await websocket.accept()
    active_connections.add(websocket)
    logger.info("WebSocket connection established.")
    
    chat_task = None
    try:
        while True:
            data = await websocket.receive_json()
            msg_type = data.get("type")
            
            if msg_type == "init":
                conversation_id = data.get("conversation_id")
                if conversation_id:
                    VoiceManager.get_instance().start(websocket, conversation_id, asyncio.get_running_loop())
                    if VoiceManager.get_instance().models_loaded:
                        await websocket.send_json({"type": "voice_status", "status": "ready"})
                    elif VoiceManager.get_instance().models_loading:
                        await websocket.send_json({"type": "voice_status", "status": "downloading", "message": "Speech models are loading..."})
                    else:
                        await websocket.send_json({"type": "voice_status", "status": "idle"})
                        
            elif msg_type == "toggle_wake_word":
                enabled = data.get("enabled", False)
                VoiceManager.get_instance().set_wake_word_enabled(enabled)
                
            elif msg_type == "start_voice_recording":
                VoiceManager.get_instance().trigger_manual_listen()
                
            elif msg_type == "stop":
                if chat_task and not chat_task.done():
                    logger.info("Interrupting active chat task...")
                    chat_task.cancel()
                    await websocket.send_json({"type": "done", "conversation_id": data.get("conversation_id", 0), "status": "cancelled"})
                else:
                    logger.info("No active chat task to stop.")
                    
            elif msg_type == "chat":
                conversation_id = data.get("conversation_id")
                content = data.get("content")
                
                if not conversation_id or not content:
                    await websocket.send_json({"type": "error", "message": "Missing conversation_id or content."})
                    continue
                
                # Check if this is the first message in the conversation (to trigger auto-title)
                existing_messages = get_messages(conversation_id)
                is_first_message = len(existing_messages) == 0
                
                logger.info(f"Starting chat stream for conversation {conversation_id}")
                if chat_task and not chat_task.done():
                    chat_task.cancel()
                chat_task = asyncio.create_task(stream_chat(conversation_id, content, websocket))
                
                # If first message, auto-generate title in background
                if is_first_message:
                    asyncio.create_task(auto_rename_chat(conversation_id, content))
            else:
                await websocket.send_json({"type": "error", "message": f"Unsupported message type: {msg_type}"})
                
    except WebSocketDisconnect:
        logger.info("WebSocket disconnected.")
    except Exception as e:
        logger.error(f"WebSocket error: {e}")
        try:
            await websocket.send_json({"type": "error", "message": str(e)})
        except Exception:
            pass
    finally:
        active_connections.discard(websocket)
        if chat_task and not chat_task.done():
            chat_task.cancel()
        logger.info("Stopping VoiceManager due to WebSocket disconnect.")
        VoiceManager.get_instance().stop()

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=SERVER_PORT)
