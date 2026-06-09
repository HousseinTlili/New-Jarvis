import os
import sys
import json
import subprocess
import logging
import re
import threading

logger = logging.getLogger(__name__)

class PythonSandboxManager:
    _instance = None
    
    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance
        
    def __init__(self):
        self.process = None
        # Target the workspace root (parent of backend folder)
        self.workspace_path = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
        self.plots_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "plots")
        os.makedirs(self.plots_dir, exist_ok=True)
        self.start_worker()
        
    def start_worker(self):
        self.stop_worker()
        logger.info(f"Starting stateful sandbox worker process. Workspace: {self.workspace_path}")
        
        worker_script = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "recall", "py_worker.py")
        
        try:
            self.process = subprocess.Popen(
                [sys.executable, "-u", worker_script],
                stdin=subprocess.PIPE,
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
                cwd=self.workspace_path,
                bufsize=1
            )
            
            # Read ready signal blockingly on start
            ready_line = self.process.stdout.readline()
            if ready_line:
                ready_data = json.loads(ready_line)
                if ready_data.get("status") == "ready":
                    logger.info("Sandbox worker process ready.")
                else:
                    logger.error(f"Sandbox worker returned unexpected status: {ready_data}")
            else:
                logger.error("Sandbox worker process closed stream on startup.")
        except Exception as e:
            logger.error(f"Failed to launch sandbox worker: {e}")
            
    def stop_worker(self):
        if self.process:
            try:
                self.process.kill()
                self.process.wait(timeout=2)
            except Exception:
                pass
            self.process = None
            
    def execute_code(self, code: str, timeout: int = 15) -> dict:
        # Check if process died
        if not self.process or self.process.poll() is not None:
            self.start_worker()
            
        if not self.process:
            return {"status": "error", "error": "Sandbox worker process failed to start."}
            
        try:
            # Write request block to worker stdin
            req_data = json.dumps({"code": code})
            self.process.stdin.write(req_data + "\n")
            self.process.stdin.flush()
            
            # Read response in a separate thread to support Windows timeout
            response_container = []
            
            def read_stdout():
                try:
                    line = self.process.stdout.readline()
                    if line:
                        response_container.append(json.loads(line))
                except Exception as e:
                    logger.error(f"Error reading worker stdout: {e}")
                    
            t = threading.Thread(target=read_stdout, daemon=True)
            t.start()
            t.join(timeout=timeout)
            
            if t.is_alive():
                logger.warning(f"Execution timed out ({timeout}s). Restarting sandbox worker...")
                self.start_worker()
                return {
                    "status": "error",
                    "stdout": "",
                    "stderr": "",
                    "error": f"Execution Timed Out: Code execution exceeded the safety limit of {timeout} seconds."
                }
                
            if response_container:
                return response_container[0]
            else:
                self.start_worker()
                return {"status": "error", "error": "Sandbox worker process exited unexpectedly during execution."}
        except Exception as e:
            logger.error(f"Exception during worker execution communication: {e}")
            self.start_worker()
            return {"status": "error", "error": str(e)}

# Agent Tool Interface
def run_python_code(code: str) -> str:
    """Useful tool to execute python code statefully. Supports stdout, stderr, exception traces, plots, and auto-pip resolution."""
    sandbox = PythonSandboxManager.get_instance()
    result = sandbox.execute_code(code)
    
    error = result.get("error") or ""
    stdout = result.get("stdout") or ""
    stderr = result.get("stderr") or ""
    
    # Parse for missing module dependencies
    match = re.search(r"ModuleNotFoundError:\s*No\s+module\s+named\s+'([^']+)'", error)
    if not match:
        match = re.search(r"ModuleNotFoundError:\s*No\s+module\s+named\s+'([^']+)'", stderr)
        
    if match:
        missing_module = match.group(1)
        base_package = missing_module.split('.')[0]
        
        logger.info(f"Auto-installing missing dependency '{base_package}' via pip...")
        try:
            pip_cmd = [sys.executable, "-m", "pip", "install", base_package]
            pip_run = subprocess.run(pip_cmd, capture_output=True, text=True, timeout=45)
            
            if pip_run.returncode == 0:
                logger.info(f"Successfully installed '{base_package}'. Retrying code execution...")
                retry_result = sandbox.execute_code(code)
                error = retry_result.get("error") or ""
                stdout = retry_result.get("stdout") or ""
                stderr = retry_result.get("stderr") or ""
                
                install_note = f"[System: Automatically installed missing library '{base_package}' via pip and retried execution]\n"
                stdout = install_note + stdout
            else:
                pip_err = pip_run.stderr or pip_run.stdout
                logger.error(f"Failed to install package '{base_package}': {pip_err}")
                stderr += f"\n[System Auto-Pip Error: Failed to auto-install '{base_package}': {pip_err}]"
        except Exception as pip_ex:
            logger.error(f"Auto-pip exception: {pip_ex}")
            stderr += f"\n[System Auto-Pip Exception: {str(pip_ex)}]"
            
    # Format output nicely for Jarvis
    output = []
    if stdout.strip():
        output.append(f"Stdout:\n{stdout}")
    if stderr.strip():
        output.append(f"Stderr:\n{stderr}")
    if error.strip():
        output.append(f"Execution Error / Traceback:\n{error}")
        
    response = "\n\n".join(output)
    if not response.strip():
        response = "Code executed successfully with no stdout or stderr."
        
    return response
