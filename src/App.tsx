import React, { useEffect } from "react";
import { useJarvisStore } from "./store";
import { SetupScreen } from "./components/SetupScreen";
import { Sidebar } from "./components/Sidebar";
import { ChatWindow } from "./components/ChatWindow";
import { InputBar } from "./components/InputBar";
import { Dashboard } from "./components/Dashboard";
import { VoiceWindow } from "./components/VoiceWindow";
import { SettingsWindow } from "./components/SettingsWindow";
import { ClipboardToast } from "./components/ClipboardToast";
import { invoke } from "@tauri-apps/api/core";
import { Minus, Square, X } from "lucide-react";

const App: React.FC = () => {
  const { setupPhase, initSetup, activeView } = useJarvisStore();

  useEffect(() => {
    initSetup();
  }, [initSetup]);

  if (setupPhase !== "ready") {
    return <SetupScreen />;
  }

  return (
    <div className="flex h-screen w-screen bg-[#050508] text-slate-100 overflow-hidden font-sans relative select-none cyber-scanlines">
      {/* Background Cyber-grid pattern */}
      <div className="absolute inset-0 cyber-grid pointer-events-none z-0" />

      {/* Custom Frameless Titlebar Control Buttons */}
      <div className="absolute top-3 right-3 flex items-center gap-1.5 z-50 no-drag-region">
        <button
          onClick={() => invoke("minimize_window")}
          className="p-1.5 border border-transparent hover:border-neon-cyan/40 hover:bg-neon-cyan/5 text-slate-400 hover:text-neon-cyan transition-all active:scale-90 cursor-pointer cyber-clip-sm"
          title="Minimize"
        >
          <Minus className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={() => invoke("maximize_window")}
          className="p-1.5 border border-transparent hover:border-neon-cyan/40 hover:bg-neon-cyan/5 text-slate-400 hover:text-neon-cyan transition-all active:scale-90 cursor-pointer cyber-clip-sm"
          title="Maximize"
        >
          <Square className="w-3 h-3" />
        </button>
        <button
          onClick={() => invoke("close_window")}
          className="p-1.5 border border-transparent hover:border-neon-pink/40 hover:bg-neon-pink/5 text-slate-400 hover:text-neon-pink transition-all active:scale-90 cursor-pointer cyber-clip-sm"
          title="Hide to Tray"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Main UI layout - Hide sidebar in voice view */}
      {activeView !== "voice" && <Sidebar />}
      
      <div className="flex-1 flex flex-col h-full overflow-hidden relative z-10">
        {activeView === "voice" ? (
          <VoiceWindow />
        ) : activeView === "chat" ? (
          <>
            <ChatWindow />
            <InputBar />
          </>
        ) : activeView === "settings" ? (
          <SettingsWindow />
        ) : (
          <Dashboard />
        )}
      </div>

      {/* Clipboard Toast Notification overlay */}
      <ClipboardToast />
    </div>
  );
};

export default App;
