import subprocess
from tools.security import is_safe_command

def run_shell_command(command: str) -> str:
    safe, reason = is_safe_command(command)
    if not safe:
        return f"Execution Blocked: {reason}"
        
    try:
        # Run in PowerShell on Windows
        result = subprocess.run(
            ["powershell", "-Command", command],
            capture_output=True,
            text=True,
            timeout=30
        )
        output = result.stdout
        error = result.stderr
        
        response = ""
        if output:
            response += output
        if error:
            response += f"\nError output:\n{error}"
            
        if not response.strip():
            response = "Command executed successfully with no output."
            
        return response
    except subprocess.TimeoutExpired:
        return "Command timed out after 30 seconds."
    except Exception as e:
        return f"Error executing command: {str(e)}"
