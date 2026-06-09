from memory import save_fact

def remember_fact(key: str, value: str) -> str:
    try:
        save_fact(key, value)
        return f"Successfully remembered fact: '{key}' -> '{value}'"
    except Exception as e:
        return f"Error saving fact: {str(e)}"
