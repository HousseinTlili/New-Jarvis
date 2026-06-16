# 🤖 Jarvis - Intelligent Desktop Companion

Jarvis is a local, private, and fully offline intelligent desktop assistant built using **Tauri v2**, **React + TypeScript (Vite)**, and a robust **Python AI Backend**. It combines interactive AI chat, local voice intelligence, active system monitoring, and folder indexing (RAG) into a single unified desktop experience.

---

## 🚀 Key Features

* **💬 Multi-Provider AI Support:** Chat in real-time with local LLMs via **Ollama**, or seamlessly route requests to external providers including **OpenAI**, **Anthropic Claude**, **Google Gemini**, and **Nvidia NIM**.
* **⚙️ Cyber Settings Panel:** Sleek configuration window to switch active model providers, update custom base URLs, manage API keys, and test connections with live feedback before saving.
* **🧠 Thinking Process Logs:** Stream and display model reasoning paths (from reasoning-enabled models like DeepSeek-R1 or NIM) inside collapsible **"Thinking Process"** accordions in the chat bubbles.
* **🗣️ Offline Voice System:**
  * **Wake Word Detection:** Activate Jarvis hands-free using **openwakeword** ("Hey Jarvis").
  * **High-Quality Speech Synthesis (TTS):** Beautiful, natural-sounding voice output powered by **Kokoro ONNX**.
  * **Local Transcription (STT):** Fast and accurate speech recognition powered by **Faster-Whisper**.
* **🔮 Neural Orb:** An interactive Three.js 3D orb that visualizes voice states (listening, thinking, speaking) with smooth animations.
* **📂 Local Knowledge RAG (Retrieval-Augmented Generation):** Index your local directories to let Jarvis retrieve and answer questions based on your files.
* **🔍 Resilient Web Search:** Search the web using a fail-safe pipeline: DuckDuckGo -> Startpage (Google search results proxy parsed with a custom HTML parser) -> Wikipedia Search API, ensuring search never fails due to IP rate limits.
* **📋 Active System Monitoring:**
  * **Clipboard Monitor:** Real-time Windows clipboard tracking with prompt toast alerts.
  * **Screen Memory Monitor:** Periodically logs active window telemetry to capture contextual workflows.
* **📅 Automation Scheduler & Watchers:** Schedule jobs or trigger customized scripts dynamically on file system modifications.
* **🖥️ OS Telemetry:** Live hardware diagnostics (CPU usage, GPU name, RAM footprint, Disk space) displayed in the interface.

---

## 🏗️ Architecture

```mermaid
graph TD
    subgraph Frontend [Tauri Desktop App]
        UI[React UI / TypeScript] -->|State Management| ZS[Zustand Store]
        UI -->|3D Orb Canvas| Three[Three.js Engine]
        UI -->|Diagram Render| Mermaid[Mermaid.js]
    end

    subgraph Backend [Local Python Service]
        FastAPI[FastAPI Server / WebSockets]
        AIC[ai_client.py Inference Client]
        RAG[RAG Manager / Vector Search]
        Voice[Voice Manager]
        Sched[Task Scheduler & Watchers]
        DB[(SQLite - jarvis.db)]
    end

    subgraph External [AI Providers & OS Tools]
        Ollama[Ollama Local LLM]
        APIs[Cloud APIs: OpenAI / Claude / Gemini / NIM]
        Whisper[Faster-Whisper STT]
        Kokoro[Kokoro ONNX TTS]
        OpenWakeWord[OpenWakeWord]
        OS[Windows API / PowerShell]
    end

    UI <==>|WebSockets & REST| FastAPI
    FastAPI <--> AIC
    FastAPI <--> RAG
    FastAPI <--> Voice
    FastAPI <--> Sched
    FastAPI <--> DB
    Voice <--> Whisper
    Voice <--> Kokoro
    Voice <--> OpenWakeWord
    RAG <--> DB
    AIC <--> Ollama
    AIC <--> APIs
    Sched <--> OS
```

---

## ⚙️ Prerequisites

Ensure you have the following installed on your machine:
* **Node.js** (v18 or higher)
* **Python** (v3.10 or higher)
* **Rust & Cargo** (Required to compile the Tauri bridge)
* **Ollama** (Running locally with the default model pulled):
  ```bash
  ollama pull qwen3.5:9b
  ```

---

## 🏁 Getting Started

### 1. Set Up the Python Backend

1. Navigate to the `backend/` directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv .venv
   # On Windows:
   .venv\Scripts\activate
   # On macOS/Linux:
   source .venv/bin/activate
   ```
3. Install the required dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the backend server:
   ```bash
   python main.py
   ```
   > [!NOTE]
   > On the very first startup, the backend will automatically download the required Kokoro TTS models (`kokoro-v1.0.onnx` and `voices-v1.0.bin`) into `backend/models/`. Please allow a moment for this to complete.

### 2. Set Up the Tauri Frontend

1. Return to the project root directory.
2. Install the frontend dependencies:
   ```bash
   npm install
   ```
3. Launch Jarvis in development mode:
   ```bash
   npm run tauri dev
   ```

---

## 🛠️ Configuration

You can customize voice parameters, wake word settings, and local defaults in [backend/config.py](file:///c:/Users/houst/Desktop/Projects/New%20Jarvis/backend/config.py):

* `MODEL_NAME`: Set the local Ollama model (e.g., `qwen3.5:9b`, `llama3`).
* `OLLAMA_OPTIONS`: Configure local context length and quantization cache.
* `TTS_VOICE_DEFAULT`: Set the default speaker voice accent (e.g., `bm_george` for British Male).
* `SILENCE_THRESHOLD` & `SILENCE_DURATION`: Tune Voice Activity Detection (VAD) sensitivity.
