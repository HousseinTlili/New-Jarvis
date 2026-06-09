import React from "react";
import { useJarvisStore } from "../store";
import { Cpu, Terminal } from "lucide-react";
import { invoke } from "@tauri-apps/api/core";

export const SetupScreen: React.FC = () => {
  const { setupPhase, setupDetail } = useJarvisStore();

  const getStepStatus = (step: number) => {
    // Steps: 1 = Creating venv, 2 = Installing deps, 3 = Starting server
    if (setupPhase === "error") return "error";
    if (setupPhase === "ready") return "completed";
    
    if (step === 1) {
      if (setupDetail.includes("Creating python virtual environment")) return "active";
      if (setupDetail.includes("Installing dependencies") || setupDetail.includes("Starting") || setupPhase === "starting") return "completed";
      return "pending";
    }
    if (step === 2) {
      if (setupDetail.includes("Installing dependencies")) return "active";
      if (setupDetail.includes("Starting") || setupPhase === "starting") return "completed";
      return "pending";
    }
    if (step === 3) {
      if (setupDetail.includes("Starting") || setupPhase === "starting") return "active";
      return "pending";
    }
    return "pending";
  };

  const renderStepStatusLabel = (step: number) => {
    const status = getStepStatus(step);
    
    if (status === "completed") {
      return (
        <span className="font-mono text-neon-green font-bold text-[10px] shrink-0 bg-neon-green/5 border border-neon-green/20 px-2 py-0.5 rounded shadow-[0_0_6px_rgba(57,255,20,0.1)]">
          [ OK ]
        </span>
      );
    }
    if (status === "active") {
      return (
        <span className="font-mono text-neon-yellow font-bold text-[10px] shrink-0 bg-neon-yellow/5 border border-neon-yellow/20 px-2 py-0.5 rounded animate-pulse shadow-[0_0_6px_rgba(255,230,0,0.1)]">
          [ LOAD ]
        </span>
      );
    }
    if (status === "error") {
      return (
        <span className="font-mono text-neon-pink font-bold text-[10px] shrink-0 bg-neon-pink/5 border border-neon-pink/20 px-2 py-0.5 rounded shadow-[0_0_6px_rgba(255,45,120,0.1)]">
          [ FAIL ]
        </span>
      );
    }
    return (
      <span className="font-mono text-slate-600 font-bold text-[10px] shrink-0 bg-slate-950 border border-slate-900 px-2 py-0.5 rounded">
        [ PEND ]
      </span>
    );
  };

  const handleRetry = async () => {
    try {
      await invoke("exit_app");
    } catch (e) {
      window.location.reload();
    }
  };

  return (
    <div className="flex flex-col items-center justify-center h-full w-full bg-[#050508] text-slate-100 p-8 select-none relative cyber-scanlines">
      {/* Background Cyber-grid pattern */}
      <div className="absolute inset-0 cyber-grid pointer-events-none z-0" />
      
      {/* Ambient Neon Backdrops */}
      <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 h-80 rounded-full bg-neon-cyan/5 blur-[120px] pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 translate-y-1/2 w-80 h-80 rounded-full bg-neon-purple/5 blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md bg-[#0a0c12]/90 backdrop-blur-xl border border-neon-cyan/25 rounded-2xl p-8 shadow-[0_0_30px_rgba(0,240,255,0.05)] relative overflow-hidden z-10 cyber-clip">
        {/* Double-border accent outlines */}
        <div className="absolute inset-0.5 border border-neon-cyan/5 rounded-2xl pointer-events-none" />
        
        {/* Header */}
        <div className="flex flex-col items-center mb-8">
          <div className="relative mb-4">
            <div className="w-16 h-16 rounded bg-neon-cyan/5 border border-neon-cyan/35 flex items-center justify-center shadow-[0_0_15px_rgba(0,240,255,0.15)] cyber-clip-sm">
              <Cpu className="w-8 h-8 text-neon-cyan" />
            </div>
            <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-neon-cyan blur-[2px] animate-pulse" />
          </div>
          <h1 className="text-xl font-bold font-mono tracking-widest text-neon-cyan cyber-glow-text-cyan animate-glitch uppercase">
            BOOT_LOAD_JARVIS
          </h1>
          <p className="text-slate-500 font-mono text-[9px] uppercase tracking-wider mt-1 text-center">
            Initializing local AI companion core
          </p>
        </div>

        {/* Steps Card */}
        <div className="space-y-3.5 mb-8">
          <div className="flex items-center justify-between p-3.5 rounded bg-[#0a0e17] border border-neon-cyan/10 hover:border-neon-cyan/25 transition-all cyber-clip-sm">
            <div className="flex-1">
              <p className="text-xs font-bold font-mono text-slate-300 uppercase">SYS_VIRTUAL_ENV</p>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">Initialize Python virtual environment</p>
            </div>
            {renderStepStatusLabel(1)}
          </div>

          <div className="flex items-center justify-between p-3.5 rounded bg-[#0a0e17] border border-neon-cyan/10 hover:border-neon-cyan/25 transition-all cyber-clip-sm">
            <div className="flex-1">
              <p className="text-xs font-bold font-mono text-slate-300 uppercase">SYS_DEPENDENCY_DEP</p>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">Install FastAPI, websockets, duckduckgo</p>
            </div>
            {renderStepStatusLabel(2)}
          </div>

          <div className="flex items-center justify-between p-3.5 rounded bg-[#0a0e17] border border-neon-cyan/10 hover:border-neon-cyan/25 transition-all cyber-clip-sm">
            <div className="flex-1">
              <p className="text-xs font-bold font-mono text-slate-300 uppercase">SYS_LOCAL_SERVER</p>
              <p className="text-[10px] text-slate-500 font-mono mt-0.5">Launch local Uvicorn HTTP/WS servers</p>
            </div>
            {renderStepStatusLabel(3)}
          </div>
        </div>

        {/* Detail Logger */}
        <div className="bg-[#050508] rounded p-4 border border-neon-cyan/15 font-mono text-[10px] text-slate-400 overflow-hidden text-ellipsis mb-6">
          <div className="flex items-center gap-2 mb-2 text-slate-500 border-b border-neon-cyan/10 pb-1.5 uppercase tracking-wider font-semibold">
            <Terminal className="w-3.5 h-3.5 text-neon-cyan/50" />
            <span>BOOT_OUTPUT_LOG</span>
          </div>
          <div className="whitespace-nowrap overflow-hidden text-ellipsis text-neon-cyan">
            {setupPhase === "error" ? (
              <span className="text-neon-pink font-semibold cyber-glow-text-pink">{setupDetail}</span>
            ) : (
              <span>$ {setupDetail}</span>
            )}
          </div>
        </div>

        {/* Actions */}
        {setupPhase === "error" && (
          <button
            onClick={handleRetry}
            className="w-full py-2.5 px-4 bg-neon-pink hover:bg-neon-pink/90 text-black rounded font-semibold text-xs tracking-widest font-mono uppercase shadow-[0_0_12px_rgba(255,45,120,0.25)] active:scale-95 cyber-clip cursor-pointer"
          >
            Quit & Reload Jarvis
          </button>
        )}
      </div>
    </div>
  );
};
