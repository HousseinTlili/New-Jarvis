import re

BLOCKED_COMMANDS = [
    # formatting / partition tools
    r"\bformat\b", r"\bmkfs\b", r"\bfdisk\b", r"\bshred\b", r"\bdd\b", r"\bdiskpart\b",
    # registry deletion
    r"\breg\s+delete\b",
    # recursive file deletion
    r"\bdel\s+.*?/s\b", r"\brmdir\s+.*?/s\b", r"\brm\s+-[rR]*[fF]\b"
]

def is_safe_command(command: str) -> tuple[bool, str]:
    # Normalize command to lowercase and single spaces
    normalized = re.sub(r"\s+", " ", command.lower().strip())
    
    for pattern in BLOCKED_COMMANDS:
        if re.search(pattern, normalized):
            return False, f"Command contains blocked system utility or pattern: '{pattern}'"
            
    # Prevent deleting directories recursively at root or Windows system level
    if "rmdir" in normalized or "del" in normalized or "remove-item" in normalized or "rm" in normalized:
        if any(root in normalized for root in ["c:\\", "c:/", "system32", "windows", "env:"]):
            if "/s" in normalized or "-recurse" in normalized or "-r" in normalized:
                return False, "Dangerous recursive delete operation targeted at system paths."
                
    return True, "Safe"
