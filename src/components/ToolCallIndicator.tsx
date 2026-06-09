import React from "react";
import { useJarvisStore } from "../store";
import { Loader2, Terminal, Search, FolderOpen, Clock, Database, Play } from "lucide-react";

export const ToolCallIndicator: React.FC = () => {
  const activeToolCall = useJarvisStore((state) => state.activeToolCall);

  if (!activeToolCall) return null;

  const { name, args } = activeToolCall;

  const getToolIcon = () => {
    switch (name) {
      case "run_shell_command":
        return <Terminal className="w-3.5 h-3.5 text-neon-yellow animate-pulse" />;
      case "web_search":
        return <Search className="w-3.5 h-3.5 text-neon-cyan animate-pulse" />;
      case "read_file":
      case "write_file":
        return <FolderOpen className="w-3.5 h-3.5 text-neon-green animate-pulse" />;
      case "get_datetime":
        return <Clock className="w-3.5 h-3.5 text-neon-purple animate-pulse" />;
      case "remember_fact":
        return <Database className="w-3.5 h-3.5 text-neon-pink animate-pulse" />;
      default:
        return <Play className="w-3.5 h-3.5 text-neon-cyan animate-pulse" />;
    }
  };

  const getStatusText = () => {
    switch (name) {
      case "run_shell_command":
        return `EXEC_COMMAND: ${args.command || ""}`;
      case "web_search":
        return `SEARCH_WEB: "${args.query || ""}"`;
      case "read_file":
        return `READ_FILE: ${args.path || ""}`;
      case "write_file":
        return `WRITE_FILE: ${args.path || ""}`;
      case "get_datetime":
        return `READ_CLOCK: ${args.type || "system_time"}`;
      case "remember_fact":
        return `SAVE_PREF: ${args.key || ""}`;
      default:
        return `INVOKE_TOOL: ${name}`;
    }
  };

  return (
    <div className="w-full max-w-4xl mr-auto mb-6 px-6">
      <div className="flex gap-4">
        {/* Placeholder Avatar with Spinner */}
        <div className="w-8 h-8 rounded bg-[#0a0c12] border border-neon-cyan/25 flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(0,240,255,0.1)] cyber-clip-sm">
          <Loader2 className="w-4 h-4 text-neon-cyan animate-spin" />
        </div>

        {/* Indicator Box */}
        <div className="flex-1 pt-1 select-none">
          <div className="inline-flex items-center gap-2.5 px-3 py-1.5 rounded bg-[#0a0c12]/95 border border-neon-cyan/15 shadow-[0_0_10px_rgba(0,240,255,0.03)] cyber-clip-sm">
            {getToolIcon()}
            <span className="text-[10px] text-neon-cyan font-mono tracking-widest uppercase">
              {getStatusText()}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
