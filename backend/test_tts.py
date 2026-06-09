import os
import sys
from pathlib import Path

# Add backend directory to path if needed
sys.path.append(str(Path(__file__).parent))

from kokoro_onnx import Kokoro
import soundfile as sf
import requests

def test_local_kokoro():
    try:
        print("Testing Kokoro local TTS...")
        models_dir = Path(__file__).parent / "models"
        model_path = models_dir / "kokoro-v1.0.onnx"
        voices_path = models_dir / "voices-v1.0.bin"
        
        # Download files if missing
        models_dir.mkdir(exist_ok=True)
        files = {
            "kokoro-v1.0.onnx": ("https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/kokoro-v1.0.onnx", 300000000),
            "voices-v1.0.bin": ("https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0/voices-v1.0.bin", 25000000)
        }
        for name, (url, min_size) in files.items():
            file_p = models_dir / name
            if not file_p.exists() or file_p.stat().st_size < min_size:
                print(f"Downloading {name} from {url}...")
                resp = requests.get(url, stream=True)
                resp.raise_for_status()
                with open(file_p, "wb") as f:
                    for chunk in resp.iter_content(chunk_size=8192):
                        if chunk:
                            f.write(chunk)
                print(f"Downloaded {name} successfully.")
        
        print("Initializing Kokoro...")
        kokoro = Kokoro(str(model_path), str(voices_path))
        
        print("Generating speech...")
        samples, sample_rate = kokoro.create(
            "Hello, this is a local voice test for Jarvis.",
            voice="bm_george",
            speed=1.0,
            lang="en-gb"
        )
        
        output_file = Path(__file__).parent / "test_output.wav"
        sf.write(output_file, samples, sample_rate)
        print(f"Success! Generated WAV file at {output_file} with size {output_file.stat().st_size} bytes.")
    except Exception as e:
        print(f"Error testing Kokoro: {e}")

if __name__ == "__main__":
    test_local_kokoro()
