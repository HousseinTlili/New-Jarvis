import os
import json
from database import get_db_connection
from recall.scheduler import (
    add_scheduled_job,
    delete_scheduled_job,
    add_file_watcher,
    remove_file_watcher
)

def schedule_task(job_id: str, task_type: str, trigger_type: str, trigger_value: str, task_content: str) -> str:
    """
    Schedules a recurring or delayed task.
    - job_id: Unique identifier for the task, e.g. "morning_reminder".
    - task_type: "prompt" (to ask the AI something) or "script" (to run Python code).
    - trigger_type: "cron" (standard crontab format, e.g. '0 9 * * *'), "interval" (run every N seconds), or "date" (run once at ISO timestamp).
    - trigger_value: The trigger parameters (e.g. crontab expression or interval seconds).
    - task_content: The prompt or Python script to execute when triggered.
    """
    # Validation
    if task_type not in ["prompt", "script"]:
        return f"Error: task_type must be either 'prompt' or 'script', got '{task_type}'."
    if trigger_type not in ["cron", "interval", "date"]:
        return f"Error: trigger_type must be 'cron', 'interval', or 'date', got '{trigger_type}'."
        
    success = add_scheduled_job(job_id, task_type, trigger_type, trigger_value, task_content)
    if success:
        return f"Successfully scheduled task '{job_id}' (Trigger: {trigger_type} -> '{trigger_value}')"
    else:
        return f"Failed to schedule task '{job_id}'. Check if a job with this ID already exists."

def list_scheduled_tasks() -> str:
    """Retrieves all active background automated tasks/jobs."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT job_id, task_type, trigger_type, trigger_value, last_run, status FROM scheduled_jobs")
        rows = cursor.fetchall()
        if not rows:
            return "No background tasks scheduled."
            
        jobs = [dict(row) for row in rows]
        return json.dumps(jobs, indent=2)
    except Exception as e:
        return f"Error fetching tasks list: {e}"
    finally:
        conn.close()

def cancel_scheduled_task(job_id: str) -> str:
    """Cancels and deletes a background task by its job ID."""
    success = delete_scheduled_job(job_id)
    if success:
        return f"Successfully cancelled and deleted task '{job_id}'."
    else:
        return f"Failed to delete task '{job_id}' (it might not exist)."

def watch_folder(path: str, patterns: str, action_type: str, action_content: str = "") -> str:
    """
    Registers a file watcher daemon on a folder directory.
    - path: Absolute path to the folder to monitor.
    - patterns: Comma-separated filename globs to match, e.g. '*.pdf,*.csv' (or '*' to watch everything).
    - action_type: "notify" (pop up alert), "summarize" (generate an AI summary of new documents), or "run_script" (execute script on creation).
    - action_content: Custom python script to run when action_type is 'run_script'. A local variable `filepath` will be automatically populated with the path to the newly created file.
    """
    if not os.path.exists(path):
        return f"Error: The specified folder path '{path}' does not exist on this machine."
    if not os.path.isdir(path):
        return f"Error: The specified path '{path}' is a file. Folder watchers must target directories."
    if action_type not in ["notify", "summarize", "run_script"]:
        return f"Error: action_type must be 'notify', 'summarize', or 'run_script'."

    w_id = add_file_watcher(os.path.abspath(path), patterns, action_type, action_content)
    if w_id > 0:
        return f"Successfully registered file watcher (ID: {w_id}) on path '{path}'."
    else:
        return "Failed to register file watcher. A watcher on this path might already exist."

def list_folder_watchers() -> str:
    """Lists all active directory monitoring watchers."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("SELECT id, path, patterns, action_type, created_at FROM file_watchers")
        rows = cursor.fetchall()
        if not rows:
            return "No directory file watchers registered."
            
        watchers = [dict(row) for row in rows]
        return json.dumps(watchers, indent=2)
    except Exception as e:
        return f"Error listing file watchers: {e}"
    finally:
        conn.close()

def unwatch_folder(watcher_id: int) -> str:
    """Removes a directory file watcher using its database ID."""
    success = remove_file_watcher(int(watcher_id))
    if success:
        return f"Successfully stopped and deleted file watcher ID {watcher_id}."
    else:
        return f"Failed to stop file watcher ID {watcher_id} (it may not exist)."
