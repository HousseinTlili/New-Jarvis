import React, { useEffect, useRef } from "react";
import { useJarvisStore } from "../store";
import { NeuralOrb } from "./NeuralOrb";
import { ArrowLeft, History, Mic } from "lucide-react";

export const VoiceWindow: React.FC = () => {
  const {
    messages,
    streamingContent,
    orbState,
    voiceState,
    recordingVolume,
    showVoiceTranscript,
    toggleVoiceTranscript,
    setActiveView,
    triggerManualListen
  } = useJarvisStore();

  const transcriptEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll the transcript log
  useEffect(() => {
    if (showVoiceTranscript && transcriptEndRef.current) {
      transcriptEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [messages, streamingContent, showVoiceTranscript]);

  // Translate orb state to tactical cyberpunk deck labels
  const getOrbStateLabel = () => {
    switch (orbState) {
      case "listening":
        return "CAPTURE_FREQ // ACTIVE_LISTEN";
      case "thinking":
        return "COGNITIVE_PARSE // NEURAL_INDEX";
      case "speaking":
        return "WAVEFORM_GEN // VOCAL_SYNTH";
      case "executing":
        return "KERNEL_EXEC // AGENT_DEEP_RUN";
      case "idle":
      default:
        return "SYS_STANDBY // COR_SECURE";
    }
  };

  const getStatusColorClass = () => {
    switch (orbState) {
      case "listening":
        return "text-neon-purple cyber-glow-text-purple border-neon-purple/30";
      case "thinking":
        return "text-neon-yellow cyber-glow-text-yellow border-neon-yellow/30";
      case "speaking":
        return "text-neon-green cyber-glow-text-green border-neon-green/30";
      case "executing":
        return "text-neon-pink cyber-glow-text-pink border-neon-pink/30";
      case "idle":
      default:
        return "text-neon-cyan cyber-glow-text-cyan border-neon-cyan/20";
    }
  };

  // Filter out tool messages and only show user/assistant dialogue in voice transcript
  const dialogMessages = messages.filter((m) => m.role === "user" || m.role === "assistant");

  return (
    <div className="flex-1 flex flex-col h-full overflow-hidden bg-[#050508]/95 relative z-10 select-none">
      
      {/* Upper Cyber HUD Bar */}
      <div className="h-14 w-full flex items-center justify-between px-6 border-b border-neon-cyan/10 bg-[#0a0c12]/80 backdrop-blur-md relative shrink-0">
        
        {/* Left: Back to Terminal Deck */}
        <button
          onClick={() => setActiveView("chat")}
          className="flex items-center gap-2 py-1 px-3 bg-[#0a0e17] border border-neon-cyan/20 hover:border-neon-cyan text-neon-cyan hover:text-white rounded transition-all active:scale-95 cursor-pointer cyber-clip-sm hover:shadow-[0_0_8px_rgba(0,240,255,0.25)] no-drag-region"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-xs font-mono tracking-widest font-semibold uppercase">DECK_CHAT</span>
        </button>

        {/* Center Jargon */}
        <div className="hidden sm:flex items-center gap-2.5 font-mono text-[10px] text-slate-500 tracking-wider">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
          <span>VOICE_CHAT_NODE_V0.1</span>
          <span className="text-slate-700">|</span>
          <span>SECURE_LOCAL_LINK</span>
        </div>

        {/* Right: Toggle Logs */}
        <button
          onClick={toggleVoiceTranscript}
          className={`flex items-center gap-2 py-1 px-3 border transition-all active:scale-95 cursor-pointer cyber-clip-sm no-drag-region ${
            showVoiceTranscript
              ? "bg-neon-cyan/10 border-neon-cyan text-neon-cyan hover:bg-neon-cyan/20 hover:shadow-[0_0_10px_rgba(0,240,255,0.2)]"
              : "bg-transparent border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200"
          }`}
          title="Toggle Message Log"
        >
          <History className="w-4 h-4" />
          <span className="text-xs font-mono tracking-widest font-semibold uppercase">
            {showVoiceTranscript ? "HIDE_LOGS" : "SHOW_LOGS"}
          </span>
        </button>
      </div>

      {/* Main Core Space */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 relative overflow-y-auto no-drag-region">
        
        {/* Massive 3D Orb Section */}
        <div className="flex flex-col items-center justify-center mb-6 relative">
          
          {/* Decorative Corner HUD Brackets around Orb */}
          <div className="absolute -top-4 -left-4 w-6 h-6 border-t-2 border-l-2 border-neon-cyan/30 pointer-events-none" />
          <div className="absolute -top-4 -right-4 w-6 h-6 border-t-2 border-r-2 border-neon-cyan/30 pointer-events-none" />
          <div className="absolute -bottom-4 -left-4 w-6 h-6 border-b-2 border-l-2 border-neon-cyan/30 pointer-events-none" />
          <div className="absolute -bottom-4 -right-4 w-6 h-6 border-b-2 border-r-2 border-neon-cyan/30 pointer-events-none" />

          {/* Center Concentric HUD Rings (CSS rotation) */}
          <div className="absolute w-[340px] h-[340px] border border-dashed border-neon-cyan/10 rounded-full animate-[spin_40s_linear_infinite] pointer-events-none" />
          <div className="absolute w-[360px] h-[360px] border border-double border-neon-cyan/5 rounded-full animate-[spin_60s_linear_infinite_reverse] pointer-events-none" />
          
          {/* Orb canvas container */}
          <div className="w-[300px] h-[300px] md:w-[350px] md:h-[350px] relative">
            <NeuralOrb size="large" />
          </div>
        </div>

        {/* State Label & Diagnostics HUD block */}
        <div className="mb-6 text-center select-none w-full max-w-sm">
          <div className={`inline-block px-4 py-1.5 bg-[#0a0c12] border rounded font-mono text-xs tracking-widest transition-all duration-300 font-bold ${getStatusColorClass()}`}>
            {getOrbStateLabel()}
          </div>
        </div>

        {/* Dialog / Transcription logs panel */}
        {showVoiceTranscript && (
          <div className="w-full max-w-lg h-44 bg-[#0a0c12]/75 border border-neon-cyan/15 rounded-lg flex flex-col p-3 mb-6 relative overflow-hidden backdrop-blur-sm cyber-glow-cyan">
            {/* Tech Details border line */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-neon-cyan/40 to-transparent" />
            
            <div className="flex-1 overflow-y-auto pr-1 flex flex-col gap-2.5 font-mono text-xs select-text">
              {dialogMessages.map((msg, index) => (
                <div 
                  key={index} 
                  className={`flex flex-col p-2 rounded border ${
                    msg.role === "user" 
                      ? "bg-neon-cyan/5 border-neon-cyan/20 self-end max-w-[85%]" 
                      : "bg-[#111520]/60 border-neon-pink/15 self-start max-w-[85%]"
                  }`}
                >
                  <span className={`text-[9px] font-semibold tracking-wider mb-1 ${
                    msg.role === "user" ? "text-neon-cyan" : "text-neon-pink"
                  }`}>
                    {msg.role === "user" ? "USR_NODE" : "JARVIS_AI"}
                  </span>
                  <p className="text-slate-300 leading-relaxed break-words">{msg.content}</p>
                </div>
              ))}
              
              {/* If speaking and streaming, display active response block */}
              {orbState === "speaking" && streamingContent && (
                <div className="bg-[#111520]/60 border-neon-pink/15 p-2 rounded border self-start max-w-[85%]">
                  <span className="text-[9px] font-semibold tracking-wider text-neon-pink mb-1 block">JARVIS_AI_STREAMING</span>
                  <p className="text-slate-300 leading-relaxed break-words">{streamingContent}</p>
                </div>
              )}

              {dialogMessages.length === 0 && !streamingContent && (
                <div className="flex-1 flex items-center justify-center text-slate-500 italic text-[11px]">
                  No conversation logs recorded in this session.
                </div>
              )}
              
              <div ref={transcriptEndRef} />
            </div>
          </div>
        )}

        {/* Lower deck mic visualizer & Action Center */}
        <div className="flex flex-col items-center w-full max-w-sm mt-2">
          
          {/* Concentric Audio Volume wave bars */}
          <div className="flex items-end justify-center gap-[3px] h-8 w-48 mb-4">
            {Array.from({ length: 15 }).map((_, i) => {
              // Generate bar height based on recordingVolume (0-100)
              // Calculate mapping so outer bars are smaller and middle bars spike more, reacting dynamically
              const isActive = voiceState === "listening";
              const volumeThreshold = (i < 8 ? i : 14 - i) * 6;
              const isVolActive = isActive && recordingVolume > volumeThreshold;
              const barHeight = isActive 
                ? isVolActive 
                  ? Math.min(100, Math.max(15, (recordingVolume - volumeThreshold) * 1.5)) 
                  : 10 
                : 6;

              return (
                <div
                  key={i}
                  className={`w-[5px] rounded-full transition-all duration-75 ${
                    isVolActive 
                      ? "bg-gradient-to-t from-neon-purple to-neon-cyan shadow-[0_0_8px_#00f0ff]" 
                      : "bg-slate-800"
                  }`}
                  style={{ height: `${barHeight}%` }}
                />
              );
            })}
          </div>

          {/* Trigger Recording / Mic button */}
          <button
            onClick={triggerManualListen}
            className={`w-20 h-20 rounded-full flex items-center justify-center transition-all cursor-pointer relative border ${
              voiceState === "listening"
                ? "bg-neon-pink/10 border-neon-pink text-neon-pink shadow-[0_0_20px_rgba(255,45,120,0.4)] animate-pulse-pink"
                : "bg-neon-cyan/5 border-neon-cyan/30 text-neon-cyan hover:border-neon-cyan hover:shadow-[0_0_15px_rgba(0,240,255,0.25)] active:scale-95"
            }`}
          >
            {/* Pulsing Outer Ripples for microphone */}
            {voiceState === "listening" && (
              <>
                <div className="absolute inset-0 rounded-full border border-neon-pink animate-ping opacity-25" />
                <div className="absolute inset-[-6px] rounded-full border border-neon-pink/20 animate-pulse opacity-15" />
              </>
            )}
            
            <Mic className={`w-8 h-8 ${voiceState === "listening" ? "animate-pulse" : ""}`} />
          </button>

          <span className="text-[10px] font-mono text-slate-500 mt-3.5 tracking-wider select-none uppercase">
            {voiceState === "listening" 
              ? "CAPTURE_STREAMING_AUDIO..." 
              : voiceState === "transcribing" 
              ? "TRANSCRIBING_DECK..." 
              : "CLICK_OR_SAY_WAKEWORD_TO_ENGAGE"}
          </span>

        </div>

      </div>
    </div>
  );
};
