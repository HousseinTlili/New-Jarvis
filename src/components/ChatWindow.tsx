import React, { useEffect, useRef } from "react";
import { useJarvisStore } from "../store";
import { MessageBubble } from "./MessageBubble";
import { ToolCallIndicator } from "./ToolCallIndicator";
import { NeuralOrb } from "./NeuralOrb";
import { Terminal, Search, Clock, Cpu } from "lucide-react";

export const ChatWindow: React.FC = () => {
  const {
    messages,
    isStreaming,
    streamingContent,
    activeConversationId,
    sendMessage
  } = useJarvisStore();

  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  const handleQuickAction = (content: string) => {
    sendMessage(content);
  };

  const hasMessages = messages.length > 0 || streamingContent;

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050508]/40 overflow-hidden relative">
      {/* Titlebar Drag Spacer (for frameless windows) */}
      <div className="h-10 w-full drag-region shrink-0" />

      {/* Dedicated Header for Neural Orb (sits mid conversation) */}
      {hasMessages && (
        <div className="w-full flex flex-col items-center justify-center py-4 bg-[#0a0c12]/80 border-b border-neon-cyan/15 backdrop-blur-md shrink-0 relative z-20 shadow-[0_4px_25px_rgba(0,0,0,0.5)]">
          <div className="w-40 h-40 relative flex items-center justify-center">
            {/* Concentric rotating border rings for cyberpunk deck visual in mid-chat header */}
            <div className="absolute inset-[-4px] border border-dashed border-neon-cyan/20 rounded-full animate-[spin_30s_linear_infinite]" />
            <NeuralOrb size="small" />
          </div>
        </div>
      )}

      {/* Messages Scroll Container */}
      <div
        ref={scrollRef}
        className={`flex-1 overflow-y-auto z-10 select-text ${
          hasMessages ? "py-4" : "flex flex-col items-center justify-center pt-4"
        }`}
      >
        {!hasMessages ? (
          /* Empty Welcome State */
          <div className="flex flex-col items-center justify-center max-w-md w-full px-6 text-center select-none no-drag-region">
            
            {/* Massive Center Orb with HUD corner brackets */}
            <div className="w-72 h-72 mb-6 relative flex items-center justify-center">
              {/* Outer decorative rings */}
              <div className="absolute inset-[-15px] border border-dashed border-neon-cyan/20 rounded-full animate-[spin_50s_linear_infinite]" />
              <div className="absolute inset-[-5px] border border-double border-neon-cyan/10 rounded-full animate-[spin_40s_linear_infinite_reverse]" />
              
              <div className="absolute -top-6 -left-6 w-8 h-8 border-t-2 border-l-2 border-neon-cyan/40" />
              <div className="absolute -top-6 -right-6 w-8 h-8 border-t-2 border-r-2 border-neon-cyan/40" />
              <div className="absolute -bottom-6 -left-6 w-8 h-8 border-b-2 border-l-2 border-neon-cyan/40" />
              <div className="absolute -bottom-6 -right-6 w-8 h-8 border-b-2 border-r-2 border-neon-cyan/40" />
              
              <NeuralOrb size="large" />
            </div>
            
            <h2 className="text-lg font-bold tracking-widest text-white mb-2 font-mono uppercase cyber-glow-text-cyan">
              INITIALIZE_AI_DECK
            </h2>
            <p className="text-[11px] text-slate-400 max-w-xs leading-relaxed mb-8 font-mono">
              Jarvis running locally via Qwen 3.5. Execute PowerShell, compile schemas, remember settings.
            </p>

            {/* Quick Suggestions Grid */}
            <div className="grid grid-cols-2 gap-3.5 w-full">
              <button
                onClick={() => handleQuickAction("What time is it in Tokyo?")}
                className="p-3.5 text-left bg-[#0a0e17]/80 hover:bg-[#111520] border border-neon-cyan/15 hover:border-neon-cyan/40 rounded-lg flex flex-col gap-1.5 transition-all active:scale-97 cursor-pointer cyber-clip-sm hover:shadow-[0_0_12px_rgba(0,240,255,0.1)]"
              >
                <Clock className="w-4 h-4 text-neon-purple" />
                <span className="text-xs font-bold font-mono tracking-wider text-neon-cyan">SYS_CLOCK</span>
                <span className="text-[10px] text-slate-500 font-mono">Query date, time, or location weather</span>
              </button>

              <button
                onClick={() => handleQuickAction("Search the web for Qwen 3.5 9B benchmarks")}
                className="p-3.5 text-left bg-[#0a0e17]/80 hover:bg-[#111520] border border-neon-cyan/15 hover:border-neon-cyan/40 rounded-lg flex flex-col gap-1.5 transition-all active:scale-97 cursor-pointer cyber-clip-sm hover:shadow-[0_0_12px_rgba(0,240,255,0.1)]"
              >
                <Search className="w-4 h-4 text-neon-cyan" />
                <span className="text-xs font-bold font-mono tracking-wider text-neon-cyan">WEB_SEARCH</span>
                <span className="text-[10px] text-slate-500 font-mono">Query online info via DuckDuckGo</span>
              </button>

              <button
                onClick={() => handleQuickAction("run: get-process | select-object -first 10")}
                className="p-3.5 text-left bg-[#0a0e17]/80 hover:bg-[#111520] border border-neon-cyan/15 hover:border-neon-cyan/40 rounded-lg flex flex-col gap-1.5 transition-all active:scale-97 cursor-pointer cyber-clip-sm hover:shadow-[0_0_12px_rgba(0,240,255,0.1)]"
              >
                <Terminal className="w-4 h-4 text-neon-yellow" />
                <span className="text-xs font-bold font-mono tracking-wider text-neon-cyan">SHELL_RUN</span>
                <span className="text-[10px] text-slate-500 font-mono">Execute powershell on host machine</span>
              </button>

              <button
                onClick={() => handleQuickAction("My name is Houston and I am building an AI desktop companion.")}
                className="p-3.5 text-left bg-[#0a0e17]/80 hover:bg-[#111520] border border-neon-cyan/15 hover:border-neon-cyan/40 rounded-lg flex flex-col gap-1.5 transition-all active:scale-97 cursor-pointer cyber-clip-sm hover:shadow-[0_0_12px_rgba(0,240,255,0.1)]"
              >
                <Cpu className="w-4 h-4 text-neon-pink" />
                <span className="text-xs font-bold font-mono tracking-wider text-neon-cyan">MEM_INDEX</span>
                <span className="text-[10px] text-slate-500 font-mono">Save persistent user facts in DB</span>
              </button>
            </div>
          </div>
        ) : (
          /* Render Active Message History */
          <div className="w-full flex flex-col">
            {messages.map((msg, index) => (
              <MessageBubble key={msg.id || index} message={msg} />
            ))}
            
            {/* Live Streaming Assistant Output */}
            {isStreaming && streamingContent && (
              <MessageBubble
                message={{
                  conversation_id: activeConversationId || 0,
                  role: "assistant",
                  content: streamingContent,
                  timestamp: new Date().toISOString()
                }}
              />
            )}

            {/* Active Executing Tool Indicator */}
            <ToolCallIndicator />
          </div>
        )}
      </div>
    </div>
  );
};
