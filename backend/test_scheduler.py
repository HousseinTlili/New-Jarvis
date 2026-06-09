import sys
import os
import unittest
import time
from datetime import datetime

# Adjust path to include the backend directory
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from database import init_db, get_db_connection
from recall.scheduler import (
    add_scheduled_job,
    delete_scheduled_job,
    add_file_watcher,
    remove_file_watcher,
    JarvisFileEventHandler
)

class TestScheduler(unittest.TestCase):
    def setUp(self):
        # Initialize database and tables
        init_db()
        
        # Clear existing scheduled jobs and watchers for testing
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("DELETE FROM scheduled_jobs")
        cursor.execute("DELETE FROM file_watchers")
        conn.commit()
        conn.close()

    def test_add_and_delete_job(self):
        job_id = "test_cleanup_task"
        task_type = "script"
        trigger_type = "interval"
        trigger_value = "3600" # 1 hour
        task_content = "print('cleaning data')"
        
        # Test addition
        success = add_scheduled_job(job_id, task_type, trigger_type, trigger_value, task_content)
        self.assertTrue(success)
        
        # Check database persistence
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT job_id, task_type, trigger_value, status FROM scheduled_jobs WHERE job_id = ?", (job_id,))
        row = cursor.fetchone()
        conn.close()
        
        self.assertIsNotNone(row)
        self.assertEqual(row["job_id"], job_id)
        self.assertEqual(row["task_type"], task_type)
        self.assertEqual(row["trigger_value"], trigger_value)
        self.assertEqual(row["status"], "active")
        
        # Test deletion
        del_success = delete_scheduled_job(job_id)
        self.assertTrue(del_success)
        
        # Check database removal
        conn = get_db_connection()
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM scheduled_jobs WHERE job_id = ?", (job_id,))
        row = cursor.fetchone()
        conn.close()
        self.assertIsNone(row)

    def test_add_and_remove_file_watcher(self):
        # Create a dummy folder to watch
        test_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "dummy_watch_folder")
        os.makedirs(test_dir, exist_ok=True)
        
        try:
            # Test addition
            watcher_id = add_file_watcher(test_dir, "*.csv", "notify", "")
            self.assertGreater(watcher_id, 0)
            
            # Check database persistence
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT id, path, patterns, action_type FROM file_watchers WHERE id = ?", (watcher_id,))
            row = cursor.fetchone()
            conn.close()
            
            self.assertIsNotNone(row)
            self.assertEqual(row["patterns"], "*.csv")
            self.assertEqual(row["action_type"], "notify")
            
            # Test removal
            rem_success = remove_file_watcher(watcher_id)
            self.assertTrue(rem_success)
            
            # Check database removal
            conn = get_db_connection()
            cursor = conn.cursor()
            cursor.execute("SELECT * FROM file_watchers WHERE id = ?", (watcher_id,))
            row = cursor.fetchone()
            conn.close()
            self.assertIsNone(row)
            
        finally:
            if os.path.exists(test_dir):
                os.rmdir(test_dir)

    def test_file_watcher_event_trigger(self):
        triggered_actions = []
        
        # Subclass JarvisFileEventHandler to mock execution action
        class MockFileEventHandler(JarvisFileEventHandler):
            def execute_watcher_action(self, filepath):
                triggered_actions.append(filepath)
                
        # Register a mock file event handler
        handler = MockFileEventHandler(
            watcher_id=1,
            path="C:/test",
            patterns=["*.txt"],
            action_type="notify",
            action_content=""
        )
        
        # Create a mock file created event matching pattern
        class MockEvent:
            is_directory = False
            src_path = "C:/test/sample.txt"
            
        handler.on_created(MockEvent())
        
        # Create another event not matching pattern
        class NonMatchingEvent:
            is_directory = False
            src_path = "C:/test/sample.png"
            
        handler.on_created(NonMatchingEvent())
        
        # Check that only the matching event fired
        self.assertEqual(len(triggered_actions), 1)
        self.assertEqual(triggered_actions[0], "C:/test/sample.txt")

if __name__ == "__main__":
    unittest.main()
