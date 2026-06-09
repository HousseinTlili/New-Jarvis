import React, { useEffect, useState } from "react";
import { useJarvisStore } from "../store";
import { AlertCircle, Link, FileJson, X, Play, Copy } from "lucide-react";

export const ClipboardToast: React.FC = () => {
  const { activeClipboardToast, clearClipboardToast, sendMessage } = useJarvisStore();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (activeClipboardToast) {
      setVisible(true);
      // Auto-hide after 12 seconds
      const timer = setTimeout(() => {
        handleClose();
      }, 12000);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
    }
  }, [activeClipboardToast]);

  if (!activeClipboardToast || !visible) return null;

  const { type, text } = activeClipboardToast;

  const handleClose = () => {
    setVisible(false);
    clearClipboardToast();
  };

  const handleAction = () => {
    if (type === "traceback") {
      sendMessage(`Analyze this error traceback and suggest a solution:\n\`\`\`\n${text}\n\`\`\``);
    } else if (type === "link") {
      sendMessage(`Read and summarize this link: ${text}`);
    } else if (type === "json" || type === "yaml") {
      sendMessage(`Inspect this ${type.toUpperCase()} data and summarize its schema/contents:\n\`\`\`${type}\n${text}\n\`\`\``);
    } else {
      sendMessage(`Inspect this copied text:\n${text}`);
    }
    handleClose();
  };

  const getIcon = () => {
    switch (type) {
      case "traceback":
        return <AlertCircle className="w-4 h-4 text-neon-pink" />;
      case "link":
        return <Link className="w-4 h-4 text-neon-cyan" />;
      case "json":
      case "yaml":
        return <FileJson className="w-4 h-4 text-neon-yellow" />;
      default:
        return <Copy className="w-4 h-4 text-neon-cyan" />;
    }
  };

  const getTitle = () => {
    switch (type) {
      case "traceback":
        return "TRACEBACK_DETECTED";
      case "link":
        return "URL_LINK_DETECTED";
      case "json":
        return "JSON_OBJECT_DETECTED";
      case "yaml":
        return "YAML_BLOCK_DETECTED";
      default:
        return "CONTENT_COPIED";
    }
  };

  const getButtonText = () => {
    switch (type) {
      case "traceback":
        return "ANALYZE_TRACEBACK";
      case "link":
        return "SUMMARIZE_URL";
      case "json":
      case "yaml":
        return "INSPECT_SCHEMA";
      default:
        return "SEND_TO_JARVIS";
    }
  };

  const snippet = text.trim().slice(0, 120) + (text.length > 120 ? "..." : "");

  return (
    <div className="absolute bottom-20 right-6 z-50 max-w-sm w-full bg-[#0a0c12]/95 border border-neon-cyan/20 rounded-xl shadow-[0_4px_25px_rgba(0,0,0,0.6)] animate-in fade-in slide-in-from-bottom-5 duration-300 overflow-hidden select-none no-drag-region cyber-glow-cyan cyber-clip">
      {/* Glow Top Border */}
      <div className={`h-[2px] w-full bg-gradient-to-r ${
        type === 'traceback' ? 'from-neon-pink to-neon-yellow' : 
        type === 'link' ? 'from-neon-cyan to-neon-purple' : 'from-neon-yellow to-neon-cyan'
      }`} />
      
      <div className="p-3.5 flex gap-3">
        <div className="shrink-0 mt-0.5">
          <div className={`p-1.5 rounded ${
            type === 'traceback' ? 'bg-neon-pink/10 border border-neon-pink/20' : 
            type === 'link' ? 'bg-neon-cyan/10 border border-neon-cyan/20' : 'bg-neon-yellow/10 border border-neon-yellow/20'
          }`}>
            {getIcon()}
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-[11px] font-bold font-mono tracking-widest text-white">{getTitle()}</h4>
            <button 
              onClick={handleClose} 
              className="p-1 border border-transparent hover:border-neon-cyan/20 rounded text-slate-500 hover:text-neon-cyan hover:bg-neon-cyan/5 transition-colors cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          
          <p className="text-[10px] text-slate-400 font-mono mt-1.5 px-2 py-1.5 bg-[#050508]/80 rounded border border-neon-cyan/10 break-all select-text max-h-16 overflow-y-auto">
            {snippet}
          </p>
          
          <div className="flex items-center justify-end gap-2 mt-3.5">
            <button
              onClick={handleClose}
              className="px-2.5 py-1 text-[9px] font-bold font-mono uppercase tracking-wider text-slate-400 hover:text-neon-cyan hover:bg-neon-cyan/5 rounded transition-all cursor-pointer"
            >
              Ignore
            </button>
            <button
              onClick={handleAction}
              className={`px-3 py-1 text-[9px] font-bold font-mono uppercase tracking-wider text-black rounded border flex items-center gap-1 transition-all active:scale-95 shadow-md cursor-pointer cyber-clip-sm ${
                type === 'traceback' ? 'bg-neon-pink hover:bg-neon-pink/90 border-neon-pink shadow-[0_0_8px_#ff2d78]' : 
                type === 'link' ? 'bg-neon-cyan hover:bg-neon-cyan/90 border-neon-cyan shadow-[0_0_8px_#00f0ff]' : 'bg-neon-yellow hover:bg-neon-yellow/90 border-neon-yellow shadow-[0_0_8px_#ffe600]'
              }`}
            >
              <Play className="w-2.5 h-2.5 fill-current" />
              <span>{getButtonText()}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
