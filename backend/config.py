import os
from pathlib import Path

SERVER_PORT = 8765
OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
MODEL_NAME = "qwen3.5:9b"

# Database lives next to the backend
DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)
DB_PATH = DATA_DIR / "jarvis.db"

# Ollama options: 32K context + 4-bit KV cache for RTX 4060
OLLAMA_OPTIONS = {
    "num_ctx": 32768,
    "kv_cache_type": "q4_0",
}

# Voice Settings
WAKE_WORD_MODEL = "hey_jarvis"
WHISPER_MODEL_SIZE = "base"  # Options: tiny, base, small, medium
TTS_VOICE_DEFAULT = "bm_george"
KOKORO_MODEL_NAME = "kokoro-v1.0.onnx"
KOKORO_VOICES_NAME = "voices-v1.0.bin"

# Silence detection (RMS-based VAD)
SILENCE_THRESHOLD = 0.015       # RMS amplitude threshold for voice activity
SILENCE_DURATION = 1.5          # Seconds of silence before stopping recording
MAX_RECORD_SECONDS = 20.0       # Max recording duration safety limit
