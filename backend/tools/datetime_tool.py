import datetime
import requests

def get_datetime(type: str, city: str = None) -> str:
    now = datetime.datetime.now()
    if type == "date":
        return now.strftime("%A, %B %d, %Y")
    elif type == "time":
        return now.strftime("%H:%M:%S")
    elif type == "datetime":
        return now.strftime("%A, %B %d, %Y at %H:%M")
    elif type == "weather":
        if not city:
            return "Error: city is required for weather."
        try:
            url = f"https://wttr.in/{city}?format=3"
            resp = requests.get(url, timeout=5)
            if resp.status_code == 200:
                return resp.text.strip()
            else:
                return f"Weather error: HTTP status {resp.status_code}"
        except Exception as e:
            return f"Weather error: {str(e)}"
    return "Error: Unknown type."
