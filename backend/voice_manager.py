import os
import sys
import time
import json
import queue
import logging
import asyncio
import zipfile
import threading
import requests
import numpy as np
import sounddevice as sd
from pathlib import Path

from config import (
    WAKE_WORD_MODEL,
    SILENCE_THRESHOLD,
    SILENCE_DURATION,
    MAX_RECORD_SECONDS,
    WHISPER_MODEL_SIZE
)

logger = logging.getLogger("jarvis-voice")



class VoiceManager:
    _instance = None
    _lock = threading.Lock()

    @classmethod
    def get_instance(cls):
        with cls._lock:
            if cls._instance is None:
                cls._instance = cls()
            return cls._instance

    def __init__(self):
        self.sample_rate = 16000
        self.channels = 1
        self.chunk_size = 1280  # 80ms chunks for openWakeWord
        
        self.wakeword_model = None
        self.whisper_model = None
        self.models_loaded = False
        self.models_loading = False
        
        self.is_running = False
        self.wake_word_enabled = False
        self.state = "idle"  # "idle", "listening", "transcribing"
        
        self.audio_queue = queue.Queue()
        self.websocket = None
        self.active_conversation_id = None
        self.loop = None
        self.stream = None
        self.thread = None

        self.models_dir = Path(__file__).parent / "models"

    def load_models_in_background(self):
        if self.models_loaded or self.models_loading:
            return
        self.models_loading = True
        threading.Thread(target=self._load_models_sync, daemon=True).start()

    def _load_models_sync(self):
        try:
            logger.info("Initializing voice models in background...")
            import openwakeword
            from openwakeword.model import Model
            from faster_whisper import WhisperModel

            logger.info("Downloading openWakeWord models if needed...")
            openwakeword.utils.download_models()
            
            logger.info("Loading openWakeWord model...")
            self.wakeword_model = Model(wakeword_models=[WAKE_WORD_MODEL])
            
            logger.info("Loading Whisper Model into memory...")
            self._send_to_websocket({
                "type": "voice_status",
                "status": "loading",
                "message": f"Loading Whisper model ({WHISPER_MODEL_SIZE})..."
            })
            self.whisper_model = WhisperModel(WHISPER_MODEL_SIZE, device="cpu", compute_type="int8")
            
            self.models_loaded = True
            self.models_loading = False
            logger.info("All voice models loaded successfully.")
            self._send_to_websocket({"type": "voice_status", "status": "ready"})
        except Exception as e:
            self.models_loading = False
            logger.error(f"Failed to load voice models: {e}", exc_info=True)
            self._send_to_websocket({"type": "voice_status", "status": "error", "error": str(e)})

    def start(self, websocket, conversation_id, loop):
        self.websocket = websocket
        self.active_conversation_id = conversation_id
        self.loop = loop
        
        self.load_models_in_background()
        
        if self.is_running:
            logger.info("VoiceManager already running.")
            return
            
        self.is_running = True
        self.thread = threading.Thread(target=self._audio_loop, daemon=True)
        self.thread.start()
        logger.info("VoiceManager background thread started.")

    def stop(self):
        self.is_running = False
        if self.stream:
            try:
                self.stream.stop()
                self.stream.close()
            except Exception as e:
                logger.error(f"Error closing audio stream: {e}")
            self.stream = None
        
        self.websocket = None
        self.loop = None
        logger.info("VoiceManager background thread stopped.")

    def set_wake_word_enabled(self, enabled: bool):
        self.wake_word_enabled = enabled
        logger.info(f"Wake word listening set to: {enabled}")

    def trigger_manual_listen(self):
        if not self.models_loaded:
            logger.warning("Cannot start listening: Voice models are still loading.")
            self._send_to_websocket({
                "type": "error", 
                "message": "Voice models are loading. Please wait a moment."
            })
            return
            
        if self.state == "idle":
            logger.info("Manual voice trigger received.")
            self._transition_to_listening()

    def _transition_to_listening(self):
        self.state = "listening"
        logger.info("Transitioned state to LISTENING")
        self._send_to_websocket({"type": "voice_state", "state": "listening"})

    def _send_to_websocket(self, data):
        if self.websocket and self.loop:
            asyncio.run_coroutine_threadsafe(
                self.websocket.send_json(data),
                self.loop
            )

    def _audio_loop(self):
        try:
            input_device = sd.query_devices(kind='input')
            if not input_device:
                logger.error("No default audio input device (microphone) found.")
                self._send_to_websocket({
                    "type": "error",
                    "message": "No microphone found. Voice features are disabled."
                })
                return
        except Exception as e:
            logger.error(f"Error querying audio devices: {e}")
            return

        def callback(indata, frames, time, status):
            if status:
                logger.warning(f"Sounddevice callback status: {status}")
            self.audio_queue.put(indata.copy())

        try:
            self.stream = sd.InputStream(
                samplerate=self.sample_rate,
                channels=self.channels,
                dtype='float32',
                blocksize=self.chunk_size,
                callback=callback
            )
            self.stream.start()
            logger.info("Sounddevice microphone InputStream started successfully.")
        except Exception as e:
            logger.error(f"Failed to start sounddevice input stream: {e}")
            self._send_to_websocket({
                "type": "error",
                "message": f"Failed to access microphone: {str(e)}"
            })
            return

        recording_buffer = []
        silent_chunks = 0
        
        silence_chunks_needed = int(SILENCE_DURATION / 0.08)
        max_record_chunks = int(MAX_RECORD_SECONDS / 0.08)
        
        while self.is_running:
            if not self.models_loaded:
                time.sleep(0.1)
                continue
                
            try:
                # Wait for chunk from stream
                chunk = self.audio_queue.get(timeout=0.5)
            except queue.Empty:
                continue

            # State Machine processing
            if self.state == "idle":
                if self.wake_word_enabled:
                    # Convert float32 chunk (-1.0 to 1.0) to int16 PCM (expected by openWakeWord)
                    pcm16 = (chunk * 32767.0).astype(np.int16).flatten()
                    
                    # Feed chunk to openWakeWord
                    predictions = self.wakeword_model.predict(pcm16)
                    
                    # Scan keys for any wake word matching our target
                    score = 0.0
                    for k, v in predictions.items():
                        if "jarvis" in k.lower():
                            score = max(score, v)
                            
                    if score > 0.5:
                        logger.info(f"Wake word 'Hey Jarvis' detected! Score: {score}")
                        self._transition_to_listening()
                        recording_buffer = []
                        silent_chunks = 0
                        
            elif self.state == "listening":
                recording_buffer.append(chunk)
                rms = np.sqrt(np.mean(chunk**2))
                
                # Send volume metrics back to the UI for Visual Orb Sync
                self._send_to_websocket({
                    "type": "audio_volume",
                    "volume": float(rms)
                })
                
                # Check for VAD / silence detection
                if rms < SILENCE_THRESHOLD:
                    silent_chunks += 1
                    if silent_chunks >= silence_chunks_needed:
                        logger.info("VAD detected silence. Recording stopped.")
                        self._process_recording(recording_buffer)
                        recording_buffer = []
                        silent_chunks = 0
                else:
                    silent_chunks = 0
                    
                # Guard against infinite recording
                if len(recording_buffer) >= max_record_chunks:
                    logger.info("Safety limit reached. Recording stopped.")
                    self._process_recording(recording_buffer)
                    recording_buffer = []
                    silent_chunks = 0

    def _process_recording(self, recording_buffer):
        self.state = "transcribing"
        logger.info("Transitioned state to TRANSCRIBING")
        self._send_to_websocket({"type": "voice_state", "state": "transcribing"})
        
        # Dispatch transcription to background thread to not block the audio pipeline
        threading.Thread(
            target=self._transcribe_and_chat_thread,
            args=(recording_buffer,),
            daemon=True
        ).start()

    def _transcribe_and_chat_thread(self, recording_buffer):
        try:
            if not recording_buffer:
                logger.warning("Empty recording buffer. Returning to idle.")
                self.state = "idle"
                self._send_to_websocket({"type": "voice_state", "state": "idle"})
                return

            logger.info("Converting audio data to float32 numpy array for Whisper...")
            audio_data = np.concatenate(recording_buffer, axis=0).flatten().astype(np.float32)
            
            logger.info("Transcribing audio via Whisper...")
            segments, info = self.whisper_model.transcribe(audio_data, language="en", beam_size=5, vad_filter=True)
            text = " ".join([seg.text for seg in segments]).strip()
            logger.info(f"Whisper transcript output: '{text}'")
            
            if not text or len(text) < 2:
                logger.info("Speech transcript is too short or empty. Returning to idle.")
                self.state = "idle"
                self._send_to_websocket({"type": "voice_state", "state": "idle"})
                return
                
            # Send transcription text to frontend
            self._send_to_websocket({
                "type": "transcription",
                "text": text
            })
            
            # Dispatch directly to the main WebSocket chat loop
            from ai_client import stream_chat
            
            async def run_chat():
                try:
                    await stream_chat(self.active_conversation_id, text, self.websocket)
                finally:
                    # Once chat stream completes, set voice state back to idle
                    self.state = "idle"
                    self._send_to_websocket({"type": "voice_state", "state": "idle"})
                    logger.info("Returned state to IDLE")

            asyncio.run_coroutine_threadsafe(run_chat(), self.loop)
            
        except Exception as e:
            logger.error(f"Error transcribing voice: {e}", exc_info=True)
            self.state = "idle"
            self._send_to_websocket({"type": "voice_state", "state": "idle"})
