import os
import sys
import time
import json
import numpy as np
import sounddevice as sd
from pathlib import Path
import zipfile
import requests

# Set path to Vosk model
MODEL_DIR = Path(__file__).parent / "models"
MODEL_NAME = "vosk-model-small-en-us-0.15"
MODEL_PATH = MODEL_DIR / MODEL_NAME
MODEL_ZIP_URL = f"https://alphacephei.com/vosk/models/{MODEL_NAME}.zip"

def ensure_model():
    if not MODEL_PATH.exists():
        MODEL_DIR.mkdir(parents=True, exist_ok=True)
        zip_path = MODEL_DIR / f"{MODEL_NAME}.zip"
        print(f"Downloading model from {MODEL_ZIP_URL}...")
        response = requests.get(MODEL_ZIP_URL, stream=True)
        with open(zip_path, "wb") as f:
            for chunk in response.iter_content(chunk_size=8192):
                if chunk:
                    f.write(chunk)
        print("Extracting model...")
        with zipfile.ZipFile(zip_path, "r") as zip_ref:
            zip_ref.extractall(MODEL_DIR)
        os.remove(zip_path)
        print("Model downloaded and extracted successfully.")

def test_mic():
    print("Querying default input device...")
    try:
        input_device = sd.query_devices(kind='input')
        print(f"Default microphone: {input_device['name']}")
    except Exception as e:
        print(f"Error: No microphone found! {e}")
        return False
    return True

def run_test():
    ensure_model()
    if not test_mic():
        return
        
    print("Loading Vosk Model (this might take a few seconds)...")
    from vosk import Model, KaldiRecognizer
    model = Model(str(MODEL_PATH))
    print("Vosk Model loaded successfully.")
    
    sample_rate = 16000
    duration = 4.0  # seconds
    
    print(f"\nRecording {duration} seconds of audio... Please say something!")
    
    # Record from mic
    audio_data = sd.rec(int(duration * sample_rate), samplerate=sample_rate, channels=1, dtype='float32')
    sd.wait()  # Wait until recording is finished
    print("Recording finished.")
    
    # Convert float32 recording data to int16 PCM bytes
    pcm16 = (audio_data.flatten() * 32767.0).astype(np.int16)
    pcm_bytes = pcm16.tobytes()
    
    print("Transcribing...")
    rec = KaldiRecognizer(model, sample_rate)
    rec.AcceptWaveform(pcm_bytes)
    
    res = json.loads(rec.FinalResult())
    print(f"\nResult Transcript: '{res.get('text', '')}'")

if __name__ == "__main__":
    run_test()
