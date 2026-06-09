import os
import logging
import fnmatch
import asyncio
from datetime import datetime
from apscheduler.schedulers.background import BackgroundScheduler
from apscheduler.triggers.cron import CronTrigger
from apscheduler.triggers.interval import IntervalTrigger
from apscheduler.triggers.date import DateTrigger
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

from database import get_db_connection

logger = logging.getLogger("jarvis-scheduler")

# Global instances
scheduler = None
observer = None
active_watchers = {}  # watcher_db_id -> watch_handle
watcher_event_handlers = {}  # watcher_db_id -> event_handler

def broadcast_system_notification(title: str, message: str):
    """Sends a websocket notification payload to all connected clients."""
    try:
        from main import active_connections
        async def broadcast():
            disconnected = []
            for ws_conn in list(active_connections):
                try:
                    await ws_conn.send_json({
                        "type": "system_notification",
                        "title": title,
                        "message": message
                    })
                except Exception:
                    disconnected.append(ws_conn)
            for ws_conn in disconnected:
                active_connections.discard(ws_conn)
                
        loop = asyncio.get_event_loop()
        if loop.is_running():
            asyncio.run_coroutine_threadsafe(broadcast(), loop)
    except Exception as e:
        logger.error(f"Failed to broadcast system notification: {e}")

def execute_background_task(job_id: str, task_type: str, task_content: str):
    """Executes a scheduled job (either running Python code or triggering an Ollama prompt)."""
    logger.info(f"Triggering scheduled job: {job_id} (Type: {task_type})")
    
    # Update last run timestamp in SQLite
    conn = get_db_connection()
    cursor = conn.cursor()
    now_str = datetime.now().isoformat()
    try:
        cursor.execute("UPDATE scheduled_jobs SET last_run = ? WHERE job_id = ?", (now_str, job_id))
        conn.commit()
    except Exception as db_err:
        logger.error(f"Failed to update last run for job {job_id}: {db_err}")
    finally:
        conn.close()

    try:
        if task_type == "script":
            from tools.python_sandbox import run_python_code
            result = run_python_code(task_content)
            logger.info(f"Job {job_id} script output: {result}")
            broadcast_system_notification(
                title=f"Scheduled Script Finished",
                message=f"Job '{job_id}' output: {result[:120]}..."
            )
        elif task_type == "prompt":
            async def run_prompt():
                from ollama import AsyncClient
                from config import OLLAMA_HOST, MODEL_NAME
                client = AsyncClient(host=OLLAMA_HOST)
                
                logger.info(f"Running scheduled prompt for job {job_id} against {MODEL_NAME}")
                resp = await client.generate(model=MODEL_NAME, prompt=task_content)
                response_text = resp.get("response", "").strip()
                logger.info(f"Job {job_id} prompt response: {response_text[:100]}")
                
                # Log to a special "Automated Tasks Log" conversation
                from memory import create_conversation, save_message, get_conversations
                convs = get_conversations()
                target_conv_id = None
                for c in convs:
                    if c["title"] == "Automated Tasks Log":
                        target_conv_id = c["id"]
                        break
                if target_conv_id is None:
                    target_conv_id = create_conversation("Automated Tasks Log")
                
                save_message(target_conv_id, "user", f"Cron Task [{job_id}]: {task_content}")
                save_message(target_conv_id, "assistant", response_text)
                
                broadcast_system_notification(
                    title=f"Scheduled Job Triggered: {job_id}",
                    message=response_text
                )

            loop = asyncio.get_event_loop()
            if loop.is_running():
                asyncio.run_coroutine_threadsafe(run_prompt(), loop)
            else:
                loop.run_until_complete(run_prompt())
    except Exception as err:
        logger.error(f"Failed to execute job {job_id}: {err}")


class JarvisFileEventHandler(FileSystemEventHandler):
    """Listens for files created inside watched directories and dispatches tasks."""
    def __init__(self, watcher_id: int, path: str, patterns: list[str], action_type: str, action_content: str):
        super().__init__()
        self.watcher_id = watcher_id
        self.path = path
        self.patterns = patterns
        self.action_type = action_type
        self.action_content = action_content

    def on_created(self, event):
        if event.is_directory:
            return
            
        filename = os.path.basename(event.src_path)
        matched = False
        for pattern in self.patterns:
            if fnmatch.fnmatch(filename, pattern):
                matched = True
                break
                
        if matched:
            logger.info(f"Folder watcher {self.watcher_id} triggered by file: {event.src_path}")
            self.execute_watcher_action(event.src_path)

    def execute_watcher_action(self, filepath: str):
        filename = os.path.basename(filepath)
        try:
            if self.action_type == "notify":
                broadcast_system_notification(
                    title="File Watcher Alert",
                    message=f"Detected new file '{filename}' in monitored folder."
                )
            elif self.action_type == "summarize":
                async def perform_summary():
                    # Read prefix contents of file
                    try:
                        with open(filepath, "r", encoding="utf-8", errors="ignore") as f:
                            text_snippet = f.read(1500)
                    except Exception as r_err:
                        text_snippet = f"[Binary/Unreadable file type: {r_err}]"
                        
                    from ollama import AsyncClient
                    from config import OLLAMA_HOST, MODEL_NAME
                    client = AsyncClient(host=OLLAMA_HOST)
                    
                    prompt = (
                        f"Summarize the following file contents. The file name is '{filename}'. "
                        f"Provide a brief 1-2 sentence description of its purpose/contents.\n\n"
                        f"File content:\n{text_snippet}\n\n"
                        f"Summary:"
                    )
                    resp = await client.generate(model=MODEL_NAME, prompt=prompt)
                    summary = resp.get("response", "").strip()
                    
                    from memory import create_conversation, save_message, get_conversations
                    convs = get_conversations()
                    target_conv_id = None
                    for c in convs:
                        if c["title"] == "Automated Tasks Log":
                            target_conv_id = c["id"]
                            break
                    if target_conv_id is None:
                        target_conv_id = create_conversation("Automated Tasks Log")
                    
                    save_message(target_conv_id, "user", f"File watcher summary trigger: {filepath}")
                    save_message(target_conv_id, "assistant", summary)
                    
                    broadcast_system_notification(
                        title=f"File Summary: {filename}",
                        message=summary
                    )

                loop = asyncio.get_event_loop()
                if loop.is_running():
                    asyncio.run_coroutine_threadsafe(perform_summary(), loop)
                else:
                    loop.run_until_complete(perform_summary())
            elif self.action_type == "run_script":
                from tools.python_sandbox import run_python_code
                exec_code = f"filepath = r'{os.path.abspath(filepath)}'\n{self.action_content}"
                result = run_python_code(exec_code)
                broadcast_system_notification(
                    title=f"Auto Script Executed",
                    message=f"Result for '{filename}': {result[:120]}..."
                )
        except Exception as e:
            logger.error(f"Error handling watcher action: {e}")


def start_scheduler():
    """Initializes the background scheduler and directory observers from SQLite configs."""
    global scheduler, observer, active_watchers, watcher_event_handlers
    logger.info("Starting background scheduler...")
    
    # 1. Startup APScheduler
    scheduler = BackgroundScheduler()
    scheduler.start()
    
    # 2. Startup Watchdog Observer
    observer = Observer()
    observer.start()
    
    # Load and register jobs from DB
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        # Load Scheduled Jobs
        cursor.execute("SELECT job_id, task_type, trigger_type, trigger_value, task_content, status FROM scheduled_jobs")
        jobs = cursor.fetchall()
        for job in jobs:
            if job["status"] == "active":
                schedule_job_in_memory(
                    job["job_id"], 
                    job["task_type"], 
                    job["trigger_type"], 
                    job["trigger_value"], 
                    job["task_content"]
                )
        logger.info(f"Loaded {len(jobs)} scheduled jobs from database.")
        
        # Load Folder Watchers
        cursor.execute("SELECT id, path, patterns, action_type, action_content FROM file_watchers")
        watchers = cursor.fetchall()
        for w in watchers:
            schedule_watcher_in_memory(
                w["id"], 
                w["path"], 
                w["patterns"], 
                w["action_type"], 
                w["action_content"]
            )
        logger.info(f"Loaded {len(watchers)} directory watchers from database.")
    except Exception as e:
        logger.error(f"Failed loading scheduler configuration from DB: {e}")
    finally:
        conn.close()

def shutdown_scheduler():
    """Stops all running scheduler and watcher daemon loops."""
    global scheduler, observer
    logger.info("Halting background scheduler and watchers...")
    if scheduler:
        try:
            scheduler.shutdown(wait=False)
        except Exception as e:
            logger.error(f"Error shutting down scheduler: {e}")
    if observer:
        try:
            observer.stop()
            observer.join(timeout=2)
        except Exception as e:
            logger.error(f"Error shutting down watchdog: {e}")

def schedule_job_in_memory(job_id: str, task_type: str, trigger_type: str, trigger_value: str, task_content: str):
    """Inserts a job into the active APScheduler instance."""
    global scheduler
    if not scheduler:
        return
        
    try:
        # Check if already scheduled, remove first
        if scheduler.get_job(job_id):
            scheduler.remove_job(job_id)
            
        trigger = None
        if trigger_type == "cron":
            trigger = CronTrigger.from_crontab(trigger_value)
        elif trigger_type == "interval":
            trigger = IntervalTrigger(seconds=int(trigger_value))
        elif trigger_type == "date":
            trigger = DateTrigger(run_date=datetime.fromisoformat(trigger_value))
            
        if trigger:
            scheduler.add_job(
                execute_background_task,
                trigger=trigger,
                args=[job_id, task_type, task_content],
                id=job_id,
                replace_existing=True
            )
            logger.info(f"Scheduled memory job '{job_id}' (Trigger: {trigger_type} -> {trigger_value})")
        else:
            logger.error(f"Invalid trigger type '{trigger_type}' for job '{job_id}'")
    except Exception as e:
        logger.error(f"Failed to schedule job {job_id} in memory: {e}")

def schedule_watcher_in_memory(w_id: int, path: str, patterns_str: str, action_type: str, action_content: str):
    """Binds a filesystem event monitor using watchdog."""
    global observer, active_watchers, watcher_event_handlers
    if not observer:
        return
        
    if not os.path.exists(path):
        logger.warning(f"Watch path does not exist, skipping: {path}")
        return

    try:
        # Unschedule existing if present
        if w_id in active_watchers:
            try:
                observer.unschedule(active_watchers[w_id])
            except Exception:
                pass
                
        patterns = [p.strip() for p in patterns_str.split(",") if p.strip()]
        if not patterns:
            patterns = ["*"]
            
        handler = JarvisFileEventHandler(w_id, path, patterns, action_type, action_content)
        watch_handle = observer.schedule(handler, path, recursive=False)
        
        active_watchers[w_id] = watch_handle
        watcher_event_handlers[w_id] = handler
        logger.info(f"Scheduled memory directory watcher '{w_id}' for path '{path}'")
    except Exception as e:
        logger.error(f"Failed to schedule watchdog for path {path}: {e}")

def add_scheduled_job(job_id: str, task_type: str, trigger_type: str, trigger_value: str, task_content: str) -> bool:
    """Saves a job in SQLite and registers it in the running background scheduler."""
    conn = get_db_connection()
    cursor = conn.cursor()
    created_at = datetime.now().isoformat()
    try:
        cursor.execute(
            """
            INSERT OR REPLACE INTO scheduled_jobs (
                job_id, task_type, trigger_type, trigger_value, task_content, created_at, status
            ) VALUES (?, ?, ?, ?, ?, ?, 'active')
            """,
            (job_id, task_type, trigger_type, trigger_value, task_content, created_at)
        )
        conn.commit()
        
        # Add to running instance
        schedule_job_in_memory(job_id, task_type, trigger_type, trigger_value, task_content)
        return True
    except Exception as e:
        logger.error(f"Failed to insert scheduled job: {e}")
        return False
    finally:
        conn.close()

def delete_scheduled_job(job_id: str) -> bool:
    """Removes a job from database and halts its scheduler triggers."""
    global scheduler
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM scheduled_jobs WHERE job_id = ?", (job_id,))
        conn.commit()
        
        if scheduler and scheduler.get_job(job_id):
            scheduler.remove_job(job_id)
        logger.info(f"Deleted scheduled job '{job_id}'")
        return True
    except Exception as e:
        logger.error(f"Failed to delete scheduled job: {e}")
        return False
    finally:
        conn.close()

def add_file_watcher(path: str, patterns: str, action_type: str, action_content: str) -> int:
    """Registers a directory monitor, persisting settings in SQLite."""
    conn = get_db_connection()
    cursor = conn.cursor()
    created_at = datetime.now().isoformat()
    try:
        cursor.execute(
            """
            INSERT INTO file_watchers (
                path, patterns, action_type, action_content, created_at
            ) VALUES (?, ?, ?, ?, ?)
            """,
            (path, patterns, action_type, action_content, created_at)
        )
        conn.commit()
        w_id = cursor.lastrowid
        
        # Schedule in watchdog observer
        schedule_watcher_in_memory(w_id, path, patterns, action_type, action_content)
        return w_id
    except Exception as e:
        logger.error(f"Failed to add file watcher: {e}")
        return -1
    finally:
        conn.close()

def remove_file_watcher(w_id: int) -> bool:
    """Deletes a directory monitor from database and unschedules it from watchdog."""
    global observer, active_watchers, watcher_event_handlers
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("DELETE FROM file_watchers WHERE id = ?", (w_id,))
        conn.commit()
        
        if w_id in active_watchers:
            if observer:
                try:
                    observer.unschedule(active_watchers[w_id])
                except Exception:
                    pass
            active_watchers.pop(w_id, None)
            watcher_event_handlers.pop(w_id, None)
            
        logger.info(f"Removed folder watcher '{w_id}'")
        return True
    except Exception as e:
        logger.error(f"Failed to delete folder watcher: {e}")
        return False
    finally:
        conn.close()
