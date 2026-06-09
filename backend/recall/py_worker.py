import sys
import json
import traceback
from io import StringIO

# 1. Force matplotlib to run headlessly using Agg backend (no UI windows)
try:
    import matplotlib
    matplotlib.use('Agg')
except Exception:
    pass

# 2. Maintain persistent global and local namespaces for execution state
globals_dict = {
    "__builtins__": __builtins__
}
locals_dict = {}

def main():
    # Write ready signal to parent process
    sys.stdout.write(json.dumps({"status": "ready"}) + "\n")
    sys.stdout.flush()
    
    while True:
        try:
            line = sys.stdin.readline()
            if not line:
                break
            
            request = json.loads(line)
            code = request.get("code", "")
            
            # Intercept stdout & stderr
            old_stdout = sys.stdout
            old_stderr = sys.stderr
            redirected_stdout = sys.stdout = StringIO()
            redirected_stderr = sys.stderr = StringIO()
            
            error_msg = None
            try:
                # Compile and execute within our persistent namespaces
                compiled = compile(code, "<sandbox>", "exec")
                exec(compiled, globals_dict, locals_dict)
            except Exception:
                error_msg = traceback.format_exc()
            finally:
                # Restore original outputs
                sys.stdout = old_stdout
                sys.stderr = old_stderr
                
            stdout_val = redirected_stdout.getvalue()
            stderr_val = redirected_stderr.getvalue()
            
            response = {
                "status": "success" if not error_msg else "error",
                "stdout": stdout_val,
                "stderr": stderr_val,
                "error": error_msg
            }
            sys.stdout.write(json.dumps(response) + "\n")
            sys.stdout.flush()
        except Exception as e:
            try:
                sys.stdout.write(json.dumps({"status": "error", "error": str(e)}) + "\n")
                sys.stdout.flush()
            except Exception:
                pass

if __name__ == "__main__":
    main()
