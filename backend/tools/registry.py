from tools.shell import run_shell_command
from tools.filesystem import read_file, write_file
from tools.search import web_search
from tools.apps import open_app_or_file
from tools.datetime_tool import get_datetime
from tools.facts import remember_fact
from recall.rag_manager import search_indexed_codebase
from recall.screen_memory import search_screen_memory
from tools.python_sandbox import run_python_code
from tools.scheduler_tools import (
    schedule_task,
    list_scheduled_tasks,
    cancel_scheduled_task,
    watch_folder,
    list_folder_watchers,
    unwatch_folder
)

TOOLS_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "run_shell_command",
            "description": "Execute a shell command in PowerShell (Windows) and return the stdout and stderr.",
            "parameters": {
                "type": "object",
                "properties": {
                    "command": {
                        "type": "string",
                        "description": "The shell command to run."
                    }
                },
                "required": ["command"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "read_file",
            "description": "Read the text contents of a file on disk.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "The absolute or relative path to the file."
                    }
                },
                "required": ["path"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "write_file",
            "description": "Create a new file or overwrite an existing file with the specified content.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "The absolute or relative path to write the file to."
                    },
                    "content": {
                        "type": "string",
                        "description": "The content to write into the file."
                    }
                },
                "required": ["path", "content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "open_app_or_file",
            "description": "Open a file, folder, URL (webpage), or system application.",
            "parameters": {
                "type": "object",
                "properties": {
                    "target": {
                        "type": "string",
                        "description": "The file path, URL, or application command to open."
                    }
                },
                "required": ["target"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "web_search",
            "description": "Search the web using DuckDuckGo and return search results.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query."
                    },
                    "max_results": {
                        "type": "integer",
                        "description": "Maximum number of search results to return (default is 5).",
                        "default": 5
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "get_datetime",
            "description": "Get the current date, time, datetime, or weather for a city.",
            "parameters": {
                "type": "object",
                "properties": {
                    "type": {
                        "type": "string",
                        "enum": ["date", "time", "datetime", "weather"],
                        "description": "Type of information to retrieve."
                    },
                    "city": {
                        "type": "string",
                        "description": "City name (required only when type is 'weather')."
                    }
                },
                "required": ["type"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "remember_fact",
            "description": "Save long-term facts or preferences about the user (e.g. name, work, interests, project notes) in SQLite.",
            "parameters": {
                "type": "object",
                "properties": {
                    "key": {
                        "type": "string",
                        "description": "The short descriptor of the fact (e.g., 'user_name', 'favorite_ide')."
                    },
                    "value": {
                        "type": "string",
                        "description": "The fact details to remember."
                    }
                },
                "required": ["key", "value"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_indexed_codebase",
            "description": "Search the indexed project files or codebase for semantic matches using a query.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "The search query to match against files."
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max number of matches to return (default is 5).",
                        "default": 5
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "search_screen_memory",
            "description": "Search the user's active window titles and copied clipboard text history (recall memory) for context.",
            "parameters": {
                "type": "object",
                "properties": {
                    "query": {
                        "type": "string",
                        "description": "Keywords or error messages to search for in active window titles or clipboard history."
                    },
                    "limit": {
                        "type": "integer",
                        "description": "Max number of results to return (default is 10).",
                        "default": 10
                    }
                },
                "required": ["query"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "run_python_code",
            "description": "Execute a block of Python code statefully in a persistent sandbox, and return the stdout/stderr. Matplotlib runs headlessly; save plots as files under 'data/plots/filename.png' to display them to the user.",
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {
                        "type": "string",
                        "description": "The Python code snippet to run."
                    }
                },
                "required": ["code"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "schedule_task",
            "description": "Schedules a recurring background task (prompt or script) using cron, interval, or date triggers.",
            "parameters": {
                "type": "object",
                "properties": {
                    "job_id": {
                        "type": "string",
                        "description": "Unique identifier for the task, e.g., 'morning_news'."
                    },
                    "task_type": {
                        "type": "string",
                        "enum": ["prompt", "script"],
                        "description": "Type of task: 'prompt' to ask Jarvis a question in the background, or 'script' to execute Python code."
                    },
                    "trigger_type": {
                        "type": "string",
                        "enum": ["cron", "interval", "date"],
                        "description": "Trigger scheduling algorithm: 'cron' for crontab strings, 'interval' for seconds periodicity, 'date' for one-time run."
                    },
                    "trigger_value": {
                        "type": "string",
                        "description": "Scheduling trigger value. E.g. for 'cron', '*/5 * * * *' (5-field syntax); for 'interval', '60' (seconds); for 'date', '2026-06-05T12:00:00'."
                    },
                    "task_content": {
                        "type": "string",
                        "description": "The exact prompt text or Python script code to run."
                    }
                },
                "required": ["job_id", "task_type", "trigger_type", "trigger_value", "task_content"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_scheduled_tasks",
            "description": "Retrieve list of all active background automated tasks/jobs.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "cancel_scheduled_task",
            "description": "Cancel and delete a background task by its job ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "job_id": {
                        "type": "string",
                        "description": "The ID of the task to delete."
                    }
                },
                "required": ["job_id"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "watch_folder",
            "description": "Monitor a folder directory for newly created files and run a notify, summary, or custom script action.",
            "parameters": {
                "type": "object",
                "properties": {
                    "path": {
                        "type": "string",
                        "description": "Absolute folder path to watch."
                    },
                    "patterns": {
                        "type": "string",
                        "description": "Comma-separated filename globs to match, e.g. '*.pdf,*.csv' or '*' to match everything."
                    },
                    "action_type": {
                        "type": "string",
                        "enum": ["notify", "summarize", "run_script"],
                        "description": "Action when file matches: 'notify' (toast alert), 'summarize' (AI document summary), 'run_script' (execute Python code)."
                    },
                    "action_content": {
                        "type": "string",
                        "description": "Optional Python script to execute when action_type is 'run_script'."
                    }
                },
                "required": ["path", "patterns", "action_type"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "list_folder_watchers",
            "description": "Retrieve list of all active directory folder watchers.",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "unwatch_folder",
            "description": "Stop and delete a folder directory watcher by its watcher ID.",
            "parameters": {
                "type": "object",
                "properties": {
                    "watcher_id": {
                        "type": "integer",
                        "description": "The numeric database ID of the watcher to delete."
                    }
                },
                "required": ["watcher_id"]
            }
        }
    }
]

TOOL_MAP = {
    "run_shell_command": run_shell_command,
    "read_file": read_file,
    "write_file": write_file,
    "open_app_or_file": open_app_or_file,
    "web_search": web_search,
    "get_datetime": get_datetime,
    "remember_fact": remember_fact,
    "search_indexed_codebase": search_indexed_codebase,
    "run_screen_memory": search_screen_memory, # mapped just in case
    "search_screen_memory": search_screen_memory,
    "run_python_code": run_python_code,
    "schedule_task": schedule_task,
    "list_scheduled_tasks": list_scheduled_tasks,
    "cancel_scheduled_task": cancel_scheduled_task,
    "watch_folder": watch_folder,
    "list_folder_watchers": list_folder_watchers,
    "unwatch_folder": unwatch_folder,
}

def dispatch_tool(name: str, args: dict) -> str:
    if name not in TOOL_MAP:
        return f"Error: Tool '{name}' not found."
    try:
        # Clean arguments before passing
        cleaned_args = {}
        for k, v in args.items():
            cleaned_args[k] = v
            
        return TOOL_MAP[name](**cleaned_args)
    except Exception as e:
        return f"Error executing tool '{name}': {str(e)}"
