import os
import platform
import subprocess
import webbrowser

def open_app_or_file(target: str) -> str:
    try:
        # Check if it is a URL
        if target.startswith("http://") or target.startswith("https://"):
            webbrowser.open(target)
            return f"Opened web browser: {target}"
            
        # Check if it is a local file or folder path
        expanded_target = os.path.expandvars(os.path.expanduser(target))
        if os.path.exists(expanded_target):
            if platform.system() == "Linux":
                subprocess.Popen(["xdg-open", expanded_target])
            elif platform.system() == "Darwin":
                subprocess.Popen(["open", expanded_target])
            else:
                os.startfile(expanded_target)
            return f"Opened file/folder: {expanded_target}"
            
        else:
            # Try to launch as a system application command
            if platform.system() == "Windows":
                # Start shell-less background application
                subprocess.Popen(target, shell=True)
            else:
                subprocess.Popen([target])
            return f"Launched command/application: {target}"
    except Exception as e:
        return f"Error opening target '{target}': {str(e)}"
