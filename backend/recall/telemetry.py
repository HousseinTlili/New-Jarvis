import sqlite3
import logging
from datetime import datetime
from database import get_db_connection

logger = logging.getLogger(__name__)

# GPT-4o pricing constants (Rates per token)
GPT4O_INPUT_RATE = 2.50 / 1_000_000   # $2.50 per 1M input tokens
GPT4O_OUTPUT_RATE = 10.00 / 1_000_000 # $10.00 per 1M output tokens

def log_query_metrics(
    conversation_id: int or None,
    model_name: str,
    prompt_tokens: int,
    completion_tokens: int,
    total_duration_ns: int or None,
    load_duration_ns: int or None,
    prompt_eval_duration_ns: int or None,
    eval_duration_ns: int or None
) -> float:
    """Logs a single LLM transaction performance to SQLite and calculates cost saved."""
    # Convert nanoseconds to milliseconds
    total_ms = (total_duration_ns / 1_000_000.0) if total_duration_ns else 0.0
    load_ms = (load_duration_ns / 1_000_000.0) if load_duration_ns else 0.0
    prompt_ms = (prompt_eval_duration_ns / 1_000_000.0) if prompt_eval_duration_ns else 0.0
    eval_ms = (eval_duration_ns / 1_000_000.0) if eval_duration_ns else 0.0
    
    # Calculate estimated cost saved (USD)
    cost_saved = (prompt_tokens * GPT4O_INPUT_RATE) + (completion_tokens * GPT4O_OUTPUT_RATE)
    
    conn = get_db_connection()
    cursor = conn.cursor()
    timestamp = datetime.now().isoformat()
    try:
        cursor.execute(
            """
            INSERT INTO telemetry_logs (
                timestamp, conversation_id, model_name, prompt_tokens, completion_tokens,
                total_duration_ms, load_duration_ms, prompt_eval_duration_ms, eval_duration_ms,
                estimated_cost_saved_usd
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                timestamp, conversation_id, model_name, prompt_tokens, completion_tokens,
                total_ms, load_ms, prompt_ms, eval_ms, cost_saved
            )
        )
        conn.commit()
        logger.info(f"Logged query telemetry: {prompt_tokens} in, {completion_tokens} out. Saved: ${cost_saved:.5f}")
    except Exception as e:
        logger.error(f"Failed to log query telemetry: {e}")
    finally:
        conn.close()
        
    return cost_saved

def get_telemetry_stats() -> dict:
    """Computes aggregate analytics over all recorded queries."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT 
                COUNT(*) as total_queries,
                COALESCE(SUM(prompt_tokens), 0) as total_prompt_tokens,
                COALESCE(SUM(completion_tokens), 0) as total_completion_tokens,
                COALESCE(SUM(prompt_tokens + completion_tokens), 0) as total_tokens,
                COALESCE(SUM(estimated_cost_saved_usd), 0.0) as total_cost_saved,
                COALESCE(AVG(prompt_eval_duration_ms), 0.0) as avg_prompt_eval_ms,
                COALESCE(AVG(total_duration_ms), 0.0) as avg_total_duration_ms,
                COALESCE(SUM(completion_tokens), 0) as sum_completion_tokens,
                COALESCE(SUM(eval_duration_ms), 0.0) as sum_eval_ms
            FROM telemetry_logs
            """
        )
        row = cursor.fetchone()
        stats = dict(row)
        
        # Calculate overall throughput speed (tokens/sec)
        sum_completion = stats.pop("sum_completion_tokens", 0)
        sum_eval_ms = stats.pop("sum_eval_ms", 0.0)
        if sum_eval_ms > 0:
            stats["avg_tokens_per_sec"] = sum_completion / (sum_eval_ms / 1000.0)
        else:
            stats["avg_tokens_per_sec"] = 0.0
            
        return stats
    finally:
        conn.close()

def get_telemetry_history(days: int = 7) -> list[dict]:
    """Compiles daily token volume and cost savings trends."""
    conn = get_db_connection()
    cursor = conn.cursor()
    # Subtracting days in SQLite format: e.g. '-7 days'
    param_days = f"-{days} days"
    try:
        cursor.execute(
            """
            SELECT 
                strftime('%Y-%m-%d', timestamp) as day,
                SUM(prompt_tokens) as prompt_tokens,
                SUM(completion_tokens) as completion_tokens,
                SUM(estimated_cost_saved_usd) as cost_saved,
                COUNT(*) as query_count
            FROM telemetry_logs
            WHERE timestamp >= datetime('now', ?)
            GROUP BY day
            ORDER BY day ASC
            """,
            (param_days,)
        )
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()

def get_recent_telemetry_logs(limit: int = 10) -> list[dict]:
    """Retrieves the most recent queries log details."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            """
            SELECT 
                timestamp, model_name, prompt_tokens, completion_tokens,
                total_duration_ms, load_duration_ms, prompt_eval_duration_ms, eval_duration_ms,
                estimated_cost_saved_usd
            FROM telemetry_logs
            ORDER BY timestamp DESC
            LIMIT ?
            """,
            (limit,)
        )
        rows = cursor.fetchall()
        return [dict(row) for row in rows]
    finally:
        conn.close()
