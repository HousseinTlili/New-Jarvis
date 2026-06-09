import React, { useState, useRef, useEffect } from "react";
import { useJarvisStore } from "../store";
import { ArrowUp, CornerDownLeft, Mic, Square } from "lucide-react";

export const InputBar: React.FC = () => {
  const { sendMessage, isStreaming, voiceState, triggerManualListen, voiceStatus, transcribedText, setTranscribedText, stopResponse } = useJarvisStore();
  const [input, setInput] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sync voice transcription to input text area
  useEffect(() => {
    if (transcribedText) {
      setInput((prev) => (prev ? prev + " " + transcribedText : transcribedText));
      setTranscribedText("");
    }
  }, [transcribedText, setTranscribedText]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || isStreaming) return;
    sendMessage(input.trim());
    setInput("");
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Auto-grow textarea height
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to compute scrollHeight
    textarea.style.height = "auto";
    // Set height to scrollHeight up to max-height limit (defined by classes)
    textarea.style.height = `${Math.min(textarea.scrollHeight, 180)}px`;
  }, [input]);

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-4xl mx-auto px-6 mb-6 shrink-0 relative z-30 no-drag-region"
    >
      <div className="relative flex items-end bg-[#0a0c12]/85 backdrop-blur-lg border border-neon-cyan/15 rounded-2xl p-2 pl-4 pr-2.5 shadow-[0_0_15px_rgba(0,240,255,0.02)] transition-all duration-300 focus-within:border-neon-cyan/40 focus-within:shadow-[0_0_15px_rgba(0,240,255,0.08)] cyber-clip">
        
        {/* Voice Trigger Microphone Button */}
        <button
          type="button"
          onClick={triggerManualListen}
          disabled={voiceStatus === "error" || voiceState === "transcribing" || isStreaming}
          className={`mr-2.5 mb-0.5 p-2 rounded-xl transition-all relative shrink-0 border ${
            voiceState === "listening"
              ? "bg-neon-pink/15 text-neon-pink border-neon-pink/40 shadow-[0_0_10px_rgba(255,45,120,0.2)] animate-pulse"
              : voiceState === "transcribing"
              ? "bg-neon-yellow/15 text-neon-yellow border-neon-yellow/40 animate-pulse"
              : "bg-[#0a0e17] border-neon-cyan/20 hover:border-neon-cyan text-slate-400 hover:text-white hover:bg-neon-cyan/5"
          } ${
            voiceStatus === "error" || voiceState === "transcribing" || isStreaming
              ? "opacity-40 cursor-not-allowed"
              : "cursor-pointer active:scale-95"
          }`}
          title={
            voiceStatus === "error"
              ? "Mic unavailable or models failed to load"
              : voiceState === "listening"
              ? "Listening... Speak now"
              : "Talk to Jarvis"
          }
        >
          <Mic className="w-4 h-4" />
          {voiceStatus === "downloading" && (
            <span className="absolute -top-0.5 -right-0.5 w-2 h-2 bg-neon-cyan rounded-full animate-ping" />
          )}
        </button>

        {/* Growing Text Area */}
        <textarea
          ref={textareaRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={
            voiceState === "listening"
              ? "Listening to your voice..."
              : voiceState === "transcribing"
              ? "Transcribing your speech..."
              : isStreaming
              ? "Jarvis is writing..."
              : "Ask Jarvis anything or run a command..."
          }
          disabled={isStreaming || voiceState === "listening" || voiceState === "transcribing"}
          rows={1}
          className="w-full bg-transparent text-slate-100 text-xs font-mono leading-relaxed resize-none focus:outline-none max-h-[180px] min-h-[24px] pr-12 pb-1.5 placeholder-slate-600 disabled:opacity-50 select-text"
        />

        {/* Submit & Meta Actions */}
        <div className="absolute right-3.5 bottom-3 flex items-center gap-2">
          {input.trim() && !isStreaming && (
            <span className="hidden md:flex items-center gap-1 text-[9px] text-slate-650 font-mono pr-1 select-none">
              <span>SEND</span>
              <CornerDownLeft className="w-3 h-3 text-slate-600" />
            </span>
          )}
          
          {isStreaming ? (
            <button
              type="button"
              onClick={stopResponse}
              className="w-8 h-8 flex items-center justify-center bg-neon-pink hover:bg-neon-pink/90 text-black shadow-[0_0_12px_rgba(255,45,120,0.25)] cursor-pointer active:scale-95 cyber-clip-sm"
              title="Stop response"
            >
              <Square className="w-3.5 h-3.5 fill-black text-black" />
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              className={`w-8 h-8 flex items-center justify-center transition-all border ${
                input.trim()
                  ? "bg-neon-cyan hover:bg-neon-cyan/95 text-black border-neon-cyan shadow-[0_0_12px_rgba(0,240,255,0.25)] cursor-pointer active:scale-95 cyber-clip-sm"
                  : "bg-[#111520] text-slate-700 border-slate-900 cursor-not-allowed"
              }`}
            >
              <ArrowUp className="w-4 h-4 stroke-[2.5]" />
            </button>
          )}
        </div>
      </div>
    </form>
  );
};
