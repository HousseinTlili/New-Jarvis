import { create } from "zustand";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";

export interface Conversation {
  id: number;
  title: string;
  created_at: string;
}

export interface Message {
  id?: number;
  conversation_id: number;
  role: "user" | "assistant" | "tool";
  content: string;
  timestamp: string;
  // Ephemeral fields for UI rendering
  tool_name?: string;
  tool_args?: Record<string, any>;
  tool_result?: string;
}

export type OrbState = "idle" | "thinking" | "speaking" | "listening" | "executing";

export interface TelemetryStats {
  total_queries: number;
  total_prompt_tokens: number;
  total_completion_tokens: number;
  total_tokens: number;
  total_cost_saved: number;
  avg_prompt_eval_ms: number;
  avg_total_duration_ms: number;
  avg_tokens_per_sec: number;
}

export interface DailyHistory {
  day: string;
  prompt_tokens: number;
  completion_tokens: number;
  cost_saved: number;
  query_count: number;
}

export interface SystemStats {
  cpu_name: string;
  cpu_usage: number;
  ram_total: number;
  ram_used: number;
  ram_usage: number;
  disk_total: number;
  disk_used: number;
  disk_usage: number;
  gpu_name: string;
}

export interface TelemetryLog {
  timestamp: string;
  model_name: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_duration_ms: number;
  load_duration_ms: number;
  prompt_eval_duration_ms: number;
  eval_duration_ms: number;
  estimated_cost_saved_usd: number;
}

export interface ScheduledJob {
  job_id: string;
  task_type: string;
  trigger_type: string;
  trigger_value: string;
  last_run: string | null;
  status: string;
}

export interface FileWatcher {
  id: number;
  path: string;
  patterns: string;
  action_type: string;
  action_content: string;
  created_at: string;
}

interface SetupProgressPayload {
  phase: "starting" | "installing" | "ready" | "error";
  detail: string;
}

interface JarvisState {
  // Setup State
  setupPhase: "starting" | "installing" | "ready" | "error";
  setupDetail: string;
  apiBase: string;
  
  // Conversations State
  conversations: Conversation[];
  activeConversationId: number | null;
  messages: Message[];
  
  // Chat Streaming State
  isStreaming: boolean;
  streamingContent: string;
  activeToolCall: { name: string; args: Record<string, any>; result?: string } | null;
  
  // UI States
  orbState: OrbState;
  sidebarOpen: boolean;

  // Voice UI States
  voiceStatus: "idle" | "downloading" | "extracting" | "ready" | "error";
  voiceMessage: string;
  voiceState: "idle" | "listening" | "transcribing";
  recordingVolume: number;
  wakeWordActive: boolean;
  voiceResponseEnabled: boolean;
  lastRequestFromVoice: boolean;
  activeAudioElement: HTMLAudioElement | null;
  audioAnalyser: AnalyserNode | null;
  audioContext: AudioContext | null;
  showVoiceTranscript: boolean;
  
  // Actions
  initSetup: () => Promise<void>;
  fetchConversations: () => Promise<void>;
  createConversation: (title?: string) => Promise<number>;
  selectConversation: (id: number) => Promise<void>;
  renameConversation: (id: number, title: string) => Promise<void>;
  deleteConversation: (id: number) => Promise<void>;
  
  sendMessage: (content: string) => Promise<void>;
  setOrbState: (state: OrbState) => void;
  setSidebarOpen: (open: boolean) => void;
  clearActiveToolCall: () => void;
  transcribedText: string;
  setTranscribedText: (text: string) => void;
  stopResponse: () => void;
  systemStats: SystemStats | null;
  fetchSystemStats: () => Promise<void>;

  // Voice Actions
  connectWebSocket: (conversationId: number) => void;
  toggleWakeWord: () => void;
  toggleVoiceResponse: () => void;
  triggerManualListen: () => void;
  playVoiceResponse: (text: string) => void;
  stopVoiceResponse: () => void;
  toggleVoiceTranscript: () => void;

  // RAG & Clipboard States
  ragFolders: { id: number; path: string; file_count: number; chunk_count: number }[];
  ragLoading: boolean;
  activeClipboardToast: { type: "traceback" | "json" | "yaml" | "link"; text: string } | null;

  // RAG & Clipboard Actions
  fetchRagStatus: () => Promise<void>;
  indexFolder: (path: string) => Promise<void>;
  removeFolder: (id: number) => Promise<void>;
  clearClipboardToast: () => void;

  // Telemetry View & State
  activeView: "chat" | "dashboard" | "voice";
  telemetryStats: TelemetryStats | null;
  telemetryHistory: DailyHistory[];
  telemetryRecent: TelemetryLog[];
  telemetryLoading: boolean;

  // Telemetry Actions
  setActiveView: (view: "chat" | "dashboard" | "voice") => void;
  fetchTelemetry: () => Promise<void>;

  // Scheduler States
  scheduledJobs: ScheduledJob[];
  fileWatchers: FileWatcher[];
  schedulerLoading: boolean;

  // Scheduler Actions
  fetchJobs: () => Promise<void>;
  toggleJob: (jobId: string, active: boolean) => Promise<void>;
  deleteJob: (jobId: string) => Promise<void>;
  deleteWatcher: (id: number) => Promise<void>;
}

let ws: WebSocket | null = null;

export const useJarvisStore = create<JarvisState>((set, get) => ({
  setupPhase: "starting",
  setupDetail: "Initializing...",
  apiBase: "http://127.0.0.1:8765",
  
  conversations: [],
  activeConversationId: null,
  messages: [],
  
  isStreaming: false,
  streamingContent: "",
  activeToolCall: null,
  
  orbState: "idle",
  sidebarOpen: true,
  transcribedText: "",
  systemStats: null,

  voiceStatus: "idle",
  voiceMessage: "",
  voiceState: "idle",
  recordingVolume: 0,
  wakeWordActive: false,
  voiceResponseEnabled: false,
  lastRequestFromVoice: false,
  activeAudioElement: null,
  audioAnalyser: null,
  audioContext: null,
  showVoiceTranscript: true,
  
  ragFolders: [],
  ragLoading: false,
  activeClipboardToast: null,
  
  activeView: "chat",
  telemetryStats: null,
  telemetryHistory: [],
  telemetryRecent: [],
  telemetryLoading: false,
  
  scheduledJobs: [],
  fileWatchers: [],
  schedulerLoading: false,
  
  initSetup: async () => {
    // Listen for progress updates from Tauri Rust
    await listen<SetupProgressPayload>("setup:progress", (event) => {
      set({
        setupPhase: event.payload.phase,
        setupDetail: event.payload.detail,
      });
      if (event.payload.phase === "ready") {
        get().fetchConversations();
        get().fetchRagStatus();
        get().fetchJobs();
      }
    });

    try {
      // Get current status on boot
      const status = await invoke<SetupProgressPayload>("get_setup_status");
      const apiBase = await invoke<string>("get_api_base");
      
      set({
        setupPhase: status.phase,
        setupDetail: status.detail,
        apiBase,
      });

      if (status.phase === "ready") {
        await get().fetchConversations();
        await get().fetchRagStatus();
        await get().fetchJobs();
      }
    } catch (e) {
      set({
        setupPhase: "error",
        setupDetail: `Failed to retrieve backend status: ${e}`,
      });
    }
  },
  
  fetchConversations: async () => {
    const { apiBase } = get();
    try {
      const resp = await fetch(`${apiBase}/conversations`);
      if (resp.ok) {
        const conversations = await resp.json();
        set({ conversations });
        
        // Auto-select first conversation if exists and none is selected
        if (conversations.length > 0 && get().activeConversationId === null) {
          get().selectConversation(conversations[0].id);
        }
      }
    } catch (e) {
      console.error("Failed to fetch conversations:", e);
    }
  },
  
  createConversation: async (title = "New Chat") => {
    const { apiBase } = get();
    try {
      const resp = await fetch(`${apiBase}/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (resp.ok) {
        const newConv = await resp.json();
        await get().fetchConversations();
        set({ activeConversationId: newConv.id, messages: [] });
        get().connectWebSocket(newConv.id);
        return newConv.id;
      }
    } catch (e) {
      console.error("Failed to create conversation:", e);
    }
    return -1;
  },
  
  selectConversation: async (id: number) => {
    const { apiBase } = get();
    get().stopVoiceResponse();
    set({ activeConversationId: id, messages: [], streamingContent: "", activeToolCall: null });
    
    get().connectWebSocket(id);
    
    try {
      const resp = await fetch(`${apiBase}/conversations/${id}/messages`);
      if (resp.ok) {
        const messages = await resp.json();
        set({ messages });
      }
    } catch (e) {
      console.error("Failed to fetch messages:", e);
    }
  },
  
  renameConversation: async (id: number, title: string) => {
    const { apiBase } = get();
    try {
      const resp = await fetch(`${apiBase}/conversations/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (resp.ok) {
        await get().fetchConversations();
      }
    } catch (e) {
      console.error("Failed to rename conversation:", e);
    }
  },
  
  deleteConversation: async (id: number) => {
    const { apiBase, activeConversationId } = get();
    get().stopVoiceResponse();
    try {
      const resp = await fetch(`${apiBase}/conversations/${id}`, {
        method: "DELETE",
      });
      if (resp.ok) {
        await get().fetchConversations();
        if (activeConversationId === id) {
          const { conversations } = get();
          if (conversations.length > 0) {
            get().selectConversation(conversations[0].id);
          } else {
            set({ activeConversationId: null, messages: [] });
            if (ws) {
              ws.close();
              ws = null;
            }
          }
        }
      }
    } catch (e) {
      console.error("Failed to delete conversation:", e);
    }
  },
  
  sendMessage: async (content: string) => {
    const { activeConversationId, isStreaming } = get();
    if (isStreaming || !content.trim()) return;
    
    let convId = activeConversationId;
    if (convId === null) {
      convId = await get().createConversation();
      if (convId === -1) return;
    }
    
    // Add user message to UI immediately
    const userMsg: Message = {
      conversation_id: convId,
      role: "user",
      content,
      timestamp: new Date().toISOString()
    };
    
    set((state) => ({
      messages: [...state.messages, userMsg],
      isStreaming: true,
      streamingContent: "",
      orbState: "thinking",
      activeToolCall: null,
      lastRequestFromVoice: false // Typed, so don't read response aloud unless voiceMode active
    }));
    
    get().stopVoiceResponse();
    get().connectWebSocket(convId);
    
    // Send message via persistent WebSocket
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({
        type: "chat",
        conversation_id: convId,
        content
      }));
    } else {
      setTimeout(() => {
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({
            type: "chat",
            conversation_id: convId,
            content
          }));
        } else {
          set({ isStreaming: false, orbState: "idle" });
        }
      }, 500);
    }
  },

  connectWebSocket: (convId: number) => {
    const { apiBase } = get();
    const wsUrl = apiBase.replace("http://", "ws://") + "/ws/chat";

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "init", conversation_id: convId }));
      ws.send(JSON.stringify({ type: "toggle_wake_word", enabled: get().wakeWordActive }));
      return;
    }

    if (ws) {
      try { ws.close(); } catch(e) {}
    }

    logger_info("Connecting WebSocket...");
    ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      ws?.send(JSON.stringify({ type: "init", conversation_id: convId }));
      ws?.send(JSON.stringify({ type: "toggle_wake_word", enabled: get().wakeWordActive }));
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      const type = data.type;

      if (type === "clipboard_toast") {
        set({
          activeClipboardToast: {
            type: data.content_type,
            text: data.text
          }
        });
      } else if (type === "voice_status") {
        set({ voiceStatus: data.status, voiceMessage: data.message || data.error || "" });
      } else if (type === "voice_state") {
        const state = data.state;
        set({ voiceState: state });
        if (state === "listening") {
          get().stopVoiceResponse(); // Stop speaking if user starts talking
          set({ orbState: "listening" });
        } else if (state === "transcribing") {
          set({ orbState: "thinking" });
        } else if (state === "idle" && !get().isStreaming) {
          set({ orbState: "idle" });
        }
      } else if (type === "audio_volume") {
        set({ recordingVolume: data.volume });
      } else if (type === "transcription") {
        const userMsg: Message = {
          conversation_id: convId,
          role: "user",
          content: data.text,
          timestamp: new Date().toISOString()
        };
        set((state) => ({
          messages: [...state.messages, userMsg],
          isStreaming: true,
          streamingContent: "",
          orbState: "thinking",
          lastRequestFromVoice: true,
          voiceState: "idle"
        }));
      } else if (type === "token") {
        set((state) => ({
          streamingContent: state.streamingContent + data.content,
          orbState: "speaking"
        }));
      } else if (type === "tool_start") {
        set({
          orbState: "executing",
          activeToolCall: {
            name: data.name,
            args: data.args
          }
        });
      } else if (type === "tool_result") {
        const toolMsg: Message = {
          conversation_id: convId,
          role: "tool",
          content: data.result,
          timestamp: new Date().toISOString(),
          tool_name: data.name,
          tool_args: get().activeToolCall?.args || {},
          tool_result: data.result
        };
        set((state) => ({
          messages: [...state.messages, toolMsg],
          activeToolCall: null,
          orbState: "thinking"
        }));
      } else if (type === "done") {
        const assistantMsg: Message = {
          conversation_id: convId,
          role: "assistant",
          content: get().streamingContent,
          timestamp: new Date().toISOString()
        };

        set((state) => ({
          messages: [...state.messages, assistantMsg],
          isStreaming: false,
          streamingContent: "",
          orbState: "idle",
          activeToolCall: null
        }));

        if (get().voiceResponseEnabled) {
          get().playVoiceResponse(assistantMsg.content);
        }

        set({ lastRequestFromVoice: false });

        setTimeout(() => {
          get().fetchConversations();
        }, 1000);
      } else if (type === "error") {
        console.error("WebSocket error:", data.message);
        set({ isStreaming: false, orbState: "idle", activeToolCall: null });
      }
    };

    ws.onclose = () => {
      ws = null;
      if (get().setupPhase === "ready") {
        // Reconnect loop after 3 seconds
        setTimeout(() => {
          if (get().activeConversationId === convId) {
            get().connectWebSocket(convId);
          }
        }, 3000);
      }
    };
  },

  toggleWakeWord: () => {
    const nextVal = !get().wakeWordActive;
    set({ wakeWordActive: nextVal });
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "toggle_wake_word", enabled: nextVal }));
    }
  },

  toggleVoiceResponse: () => {
    const nextVal = !get().voiceResponseEnabled;
    set({ voiceResponseEnabled: nextVal });
    if (!nextVal) {
      get().stopVoiceResponse();
    }
  },

  triggerManualListen: () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "start_voice_recording" }));
    }
  },

  playVoiceResponse: (text: string) => {
    get().stopVoiceResponse();

    const { apiBase } = get();
    const audioUrl = `${apiBase}/api/tts?text=${encodeURIComponent(text)}`;
    const audio = new Audio(audioUrl);
    audio.crossOrigin = "anonymous";

    let audioContext = get().audioContext;
    let analyser = get().audioAnalyser;

    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 64;
        set({ audioContext, audioAnalyser: analyser });
      }

      if (audioContext.state === "suspended") {
        audioContext.resume();
      }

        if (analyser) {
          const source = audioContext.createMediaElementSource(audio);
          source.connect(analyser);
          analyser.connect(audioContext.destination);
        }

        set({ activeAudioElement: audio, orbState: "speaking" });

      audio.play().catch(e => {
        console.error("Failed to play audio:", e);
        set({ orbState: "idle", activeAudioElement: null });
      });

      audio.onended = () => {
        set((state) => {
          if (state.orbState === "speaking") {
            return { orbState: "idle", activeAudioElement: null };
          }
          return { activeAudioElement: null };
        });
      };
    } catch (e) {
      console.error("Audio analyser init error, fallback playing:", e);
      // Fallback: play audio normally if context creation fails
      set({ activeAudioElement: audio, orbState: "speaking" });
      audio.play().catch(() => {});
      audio.onended = () => {
        if (get().orbState === "speaking") set({ orbState: "idle" });
        set({ activeAudioElement: null });
      };
    }
  },

  stopVoiceResponse: () => {
    const { activeAudioElement } = get();
    if (activeAudioElement) {
      try {
        activeAudioElement.pause();
      } catch (e) {}
      set({ activeAudioElement: null });
      if (get().orbState === "speaking") {
        set({ orbState: "idle" });
      }
    }
  },
  
  setOrbState: (orbState) => set({ orbState }),
  setSidebarOpen: (sidebarOpen) => set({ sidebarOpen }),
  clearActiveToolCall: () => set({ activeToolCall: null }),
  setTranscribedText: (transcribedText) => set({ transcribedText }),
  stopResponse: () => {
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: "stop", conversation_id: get().activeConversationId }));
    }
    get().stopVoiceResponse();
    set({ isStreaming: false, orbState: "idle", activeToolCall: null });
  },
  fetchSystemStats: async () => {
    const { apiBase } = get();
    try {
      const resp = await fetch(`${apiBase}/api/system/stats`);
      if (resp.ok) {
        const systemStats = await resp.json();
        set({ systemStats });
      }
    } catch (e) {
      console.error("Failed to fetch system stats:", e);
    }
  },

  // RAG & Clipboard Actions
  fetchRagStatus: async () => {
    const { apiBase } = get();
    try {
      const resp = await fetch(`${apiBase}/api/rag/status`);
      if (resp.ok) {
        const folders = await resp.json();
        set({ ragFolders: folders });
      }
    } catch (e) {
      console.error("Failed to fetch RAG status:", e);
    }
  },

  indexFolder: async (path: string) => {
    const { apiBase } = get();
    set({ ragLoading: true });
    try {
      const resp = await fetch(`${apiBase}/api/rag/index`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });
      if (resp.ok) {
        // Poll status every 2 seconds for a bit
        let count = 0;
        const interval = setInterval(async () => {
          await get().fetchRagStatus();
          count++;
          if (count > 5) {
            clearInterval(interval);
            set({ ragLoading: false });
          }
        }, 2000);
      } else {
        set({ ragLoading: false });
      }
    } catch (e) {
      console.error("Failed to index folder:", e);
      set({ ragLoading: false });
    }
  },

  removeFolder: async (id: number) => {
    const { apiBase } = get();
    try {
      const resp = await fetch(`${apiBase}/api/rag/remove/${id}`, {
        method: "DELETE",
      });
      if (resp.ok) {
        await get().fetchRagStatus();
      }
    } catch (e) {
      console.error("Failed to remove folder from index:", e);
    }
  },

  clearClipboardToast: () => set({ activeClipboardToast: null }),

  setActiveView: (view) => {
    set({ activeView: view });
    if (view === "voice") {
      set({ lastRequestFromVoice: true });
      if (!get().wakeWordActive) {
        set({ wakeWordActive: true });
        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: "toggle_wake_word", enabled: true }));
        }
      }
      if (!get().voiceResponseEnabled) {
        set({ voiceResponseEnabled: true });
      }
    }
  },
  toggleVoiceTranscript: () => set((s) => ({ showVoiceTranscript: !s.showVoiceTranscript })),
  fetchTelemetry: async () => {
    const { apiBase } = get();
    set({ telemetryLoading: true });
    try {
      const [statsResp, historyResp, recentResp] = await Promise.all([
        fetch(`${apiBase}/api/telemetry/stats`),
        fetch(`${apiBase}/api/telemetry/history`),
        fetch(`${apiBase}/api/telemetry/recent`)
      ]);
      
      let stats = null;
      let history = [];
      let recent = [];
      
      if (statsResp.ok) {
        stats = await statsResp.json();
      }
      if (historyResp.ok) {
        history = await historyResp.json();
      }
      if (recentResp.ok) {
        recent = await recentResp.json();
      }
      
      set({ telemetryStats: stats, telemetryHistory: history, telemetryRecent: recent });
    } catch (e) {
      console.error("Failed to fetch telemetry data:", e);
    } finally {
      set({ telemetryLoading: false });
    }
  },

  fetchJobs: async () => {
    const { apiBase } = get();
    set({ schedulerLoading: true });
    try {
      const resp = await fetch(`${apiBase}/api/scheduler/jobs`);
      if (resp.ok) {
        const data = await resp.json();
        set({ 
          scheduledJobs: data.jobs || [], 
          fileWatchers: data.watchers || [] 
        });
      }
    } catch (e) {
      console.error("Failed to fetch scheduled jobs:", e);
    } finally {
      set({ schedulerLoading: false });
    }
  },

  toggleJob: async (jobId: string, active: boolean) => {
    const { apiBase } = get();
    try {
      const resp = await fetch(`${apiBase}/api/scheduler/jobs/toggle`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ job_id: jobId, active }),
      });
      if (resp.ok) {
        await get().fetchJobs();
      }
    } catch (e) {
      console.error(`Failed to toggle job ${jobId}:`, e);
    }
  },

  deleteJob: async (jobId: string) => {
    const { apiBase } = get();
    try {
      const resp = await fetch(`${apiBase}/api/scheduler/jobs/${jobId}`, {
        method: "DELETE",
      });
      if (resp.ok) {
        await get().fetchJobs();
      }
    } catch (e) {
      console.error(`Failed to delete job ${jobId}:`, e);
    }
  },

  deleteWatcher: async (id: number) => {
    const { apiBase } = get();
    try {
      const resp = await fetch(`${apiBase}/api/scheduler/watchers/${id}`, {
        method: "DELETE",
      });
      if (resp.ok) {
        await get().fetchJobs();
      }
    } catch (e) {
      console.error(`Failed to delete watcher ${id}:`, e);
    }
  }
}));

function logger_info(msg: string) {
  console.log(`[Store] ${msg}`);
}
