import sys
import os
import unittest
from datetime import datetime

# Adjust path to include the backend directory
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import init_db, get_db_connection
from recall.telemetry import (
    log_query_metrics,
    get_telemetry_stats,
    get_telemetry_history,
    GPT4O_INPUT_RATE,
    GPT4O_OUTPUT_RATE
)

class TestTelemetry(unittest.TestCase):
    def setUp(self):
        # Initialize database and tables
        init_db()
        
        # Clear existing telemetry logs for testing
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM telemetry_logs")
        conn.commit()
        conn.close()

    def test_log_and_fetch_stats(self):
        # Log a dummy LLM generation query
        prompt_tokens = 1500
        completion_tokens = 450
        
        # Ollama durations in nanoseconds (e.g. 5 seconds total, 1 second load, 1.5 prompt, 2.5 eval)
        total_ns = 5_000_000_000
        load_ns = 1_000_000_000
        prompt_ns = 1_500_000_000
        eval_ns = 2_500_000_000
        
        expected_saved = (prompt_tokens * GPT4O_INPUT_RATE) + (completion_tokens * GPT4O_OUTPUT_RATE)
        
        saved = log_query_metrics(
            conversation_id=None,
            model_name="llama3.1:8b",
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            total_duration_ns=total_ns,
            load_duration_ns=load_ns,
            prompt_eval_duration_ns=prompt_ns,
            eval_duration_ns=eval_ns
        )
        
        self.assertAlmostEqual(saved, expected_saved)
        
        # Retrieve stats
        stats = get_telemetry_stats()
        self.assertEqual(stats["total_queries"], 1)
        self.assertEqual(stats["total_prompt_tokens"], prompt_tokens)
        self.assertEqual(stats["total_completion_tokens"], completion_tokens)
        self.assertEqual(stats["total_tokens"], prompt_tokens + completion_tokens)
        self.assertAlmostEqual(stats["total_cost_saved"], expected_saved)
        
        # Durations are in ms: 2500ns / 1M = 2500.0ms. Completion tokens = 450.
        # Speed = 450 / (2500 / 1000) = 180 tokens/sec
        self.assertAlmostEqual(stats["avg_tokens_per_sec"], 180.0)
        self.assertAlmostEqual(stats["avg_prompt_eval_ms"], 1500.0)
        self.assertAlmostEqual(stats["avg_total_duration_ms"], 5000.0)

    def test_telemetry_history(self):
        # Insert a query
        log_query_metrics(
            conversation_id=None,
            model_name="llama3.1:8b",
            prompt_tokens=1000,
            completion_tokens=300,
            total_duration_ns=3_000_000_000,
            load_duration_ns=500_000_000,
            prompt_eval_duration_ns=1_000_000_000,
            eval_duration_ns=1_500_000_000
        )
        
        # Fetch history
        history = get_telemetry_history(days=7)
        self.assertEqual(len(history), 1)
        
        today_str = datetime.now().strftime('%Y-%m-%d')
        self.assertEqual(history[0]["day"], today_str)
        self.assertEqual(history[0]["query_count"], 1)
        self.assertEqual(history[0]["prompt_tokens"], 1000)
        self.assertEqual(history[0]["completion_tokens"], 300)
        
        expected_saved = (1000 * GPT4O_INPUT_RATE) + (300 * GPT4O_OUTPUT_RATE)
        self.assertAlmostEqual(history[0]["cost_saved"], expected_saved)

if __name__ == "__main__":
    unittest.main()
