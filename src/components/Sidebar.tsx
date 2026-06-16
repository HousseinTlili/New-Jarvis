import React, { useState, useEffect } from "react";
import { useJarvisStore, Conversation } from "../store";
import { Plus, MessageSquare, Trash2, Edit2, Check, X, Menu, Terminal, Zap, Mic, Volume2, Folder, FolderPlus, Loader2, ChevronDown, ChevronRight, LayoutDashboard, Settings } from "lucide-react";

const SegmentedProgressBar: React.FC<{ value: number; colorClass: string }> = ({ value, colorClass }) => {
  const activeSegments = Math.round(value / 10);
  return (
    <div className="flex gap-[3px] w-full h-1.5 mt-1">
      {Array.from({ length: 10 }).map((_, i) => {
        const isActive = i < activeSegments;
        return (
          <div
            key={i}
            className={`flex-1 h-full rounded-[1px] transition-all duration-300 ${
              isActive ? colorClass : "bg-slate-900/60"
            }`}
          />
        );
      })}
    </div>
  );
};

export const Sidebar: React.FC = () => {
  const {
    conversations,
    activeConversationId,
    createConversation,
    selectConversation,
    renameConversation,
    deleteConversation,
    sidebarOpen,
    setSidebarOpen,
    wakeWordActive,
    toggleWakeWord,
    voiceResponseEnabled,
    toggleVoiceResponse,
    voiceStatus,
    ragFolders,
    ragLoading,
    indexFolder,
    removeFolder,
    activeView,
    setActiveView,
    fetchTelemetry,
    systemStats,
    fetchSystemStats
  } = useJarvisStore();

  // Poll system performance stats periodically
  useEffect(() => {
    fetchSystemStats();
    const interval = setInterval(() => {
      fetchSystemStats();
    }, 8000);
    return () => clearInterval(interval);
  }, [fetchSystemStats]);

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [ragOpen, setRagOpen] = useState(false);
  const [newPath, setNewPath] = useState("");

  const handleStartRename = (e: React.MouseEvent, conv: Conversation) => {
    e.stopPropagation();
    setEditingId(conv.id);
    setEditTitle(conv.title);
  };

  const handleSaveRename = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (editTitle.trim()) {
      await renameConversation(id, editTitle.trim());
    }
    setEditingId(null);
  };

  const handleCancelRename = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingId(null);
  };

  const handleDelete = async (e: React.MouseEvent, id: number) => {
    e.stopPropagation();
    if (confirm("Are you sure you want to delete this chat? This cannot be undone.")) {
      await deleteConversation(id);
    }
  };

  if (!sidebarOpen) {
    return (
      <button
        onClick={() => setSidebarOpen(true)}
        className="absolute top-4 left-4 z-50 p-2 rounded-lg bg-[#16191f]/60 hover:bg-[#1f232b]/80 border border-slate-800 text-slate-300 hover:text-white transition-all shadow-lg backdrop-blur-md active:scale-95 no-drag-region"
        title="Open Sidebar"
      >
        <Menu className="w-5 h-5" />
      </button>
    );
  }

  return (
    <aside className="w-64 h-full bg-[#07080c]/95 border-r border-neon-cyan/10 flex flex-col z-40 relative backdrop-blur-xl transition-all duration-300 shrink-0 select-none">
      {/* Titlebar Drag Spacer */}
      <div className="h-10 w-full drag-region" />
      
      {/* Logo & Toggle Header */}
      <div className="p-4 flex items-center justify-between border-b border-neon-cyan/10 bg-[#0a0c12]/30">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded bg-neon-cyan/5 border border-neon-cyan/35 flex items-center justify-center shadow-[0_0_8px_rgba(0,240,255,0.15)] cyber-clip-sm">
            <Zap className="w-4 h-4 text-neon-cyan" />
          </div>
          <div>
            <span className="font-bold text-sm tracking-widest text-white cyber-glow-text-cyan animate-glitch">JARVIS</span>
            <span className="text-[9px] text-neon-cyan/60 block font-mono">LOCAL v0.1</span>
          </div>
        </div>
        <div className="flex items-center gap-1 no-drag-region">
          <button
            onClick={() => setActiveView("settings")}
            className={`p-1.5 border border-transparent rounded hover:bg-neon-cyan/5 transition-colors cursor-pointer active:scale-95 ${
              activeView === "settings"
                ? "text-neon-cyan border-neon-cyan/20 bg-neon-cyan/5"
                : "text-slate-400 hover:text-white"
            }`}
            title="Settings"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={() => setSidebarOpen(false)}
            className="p-1.5 border border-transparent hover:border-neon-cyan/30 rounded text-slate-400 hover:text-white hover:bg-neon-cyan/5 transition-colors active:scale-95 cursor-pointer"
            title="Collapse Sidebar"
          >
            <X className="w-4.5 h-4.5" />
          </button>
        </div>
      </div>

      {/* New Chat Button */}
      <div className="p-3 pb-1.5">
        <button
          onClick={() => {
            setActiveView("chat");
            createConversation();
          }}
          className="w-full py-2 px-3 bg-neon-cyan/10 hover:bg-neon-cyan text-neon-cyan hover:text-black border border-neon-cyan/35 flex items-center justify-center gap-2 text-sm font-semibold transition-all shadow-[0_0_10px_rgba(0,240,255,0.1)] hover:shadow-[0_0_15px_#00f0ff] active:scale-98 cursor-pointer cyber-clip"
        >
          <Plus className="w-4 h-4" />
          <span>New Chat</span>
        </button>
      </div>

      {/* View Switcher */}
      <div className="px-3 pb-3 flex gap-1.5">
        <button
          onClick={() => setActiveView("chat")}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 border transition-all active:scale-95 cursor-pointer ${
            activeView === "chat"
              ? "bg-neon-cyan/10 border-neon-cyan text-white shadow-[0_0_8px_rgba(0,240,255,0.15)]"
              : "border-transparent bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5" />
          <span>Chat</span>
        </button>
        <button
          onClick={() => setActiveView("voice")}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 border transition-all active:scale-95 cursor-pointer ${
            activeView === "voice"
              ? "bg-neon-cyan/10 border-neon-cyan text-white shadow-[0_0_8px_rgba(0,240,255,0.15)]"
              : "border-transparent bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
          }`}
        >
          <Mic className="w-3.5 h-3.5" />
          <span>Voice</span>
        </button>
        <button
          onClick={() => {
            setActiveView("dashboard");
            fetchTelemetry();
          }}
          className={`flex-1 py-1.5 px-2 rounded-lg text-xs font-semibold flex items-center justify-center gap-1 border transition-all active:scale-95 cursor-pointer ${
            activeView === "dashboard"
              ? "bg-neon-cyan/10 border-neon-cyan text-white shadow-[0_0_8px_rgba(0,240,255,0.15)]"
              : "border-transparent bg-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/30"
          }`}
        >
          <LayoutDashboard className="w-3.5 h-3.5" />
          <span>Stats</span>
        </button>
      </div>

      {/* Conversation List */}
      <div className="flex-1 overflow-y-auto px-2 pb-4 space-y-1">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-8 px-4 text-center text-slate-500">
            <MessageSquare className="w-8 h-8 mb-2 opacity-30" />
            <p className="text-xs">No active chats.</p>
          </div>
        ) : (
          conversations.map((conv) => {
            const isActive = conv.id === activeConversationId;
            const isEditing = conv.id === editingId;

            return (
              <div
                key={conv.id}
                onClick={() => !isEditing && selectConversation(conv.id)}
                className={`group flex items-center justify-between p-2.5 rounded-md text-sm transition-all cursor-pointer border ${
                  isActive
                    ? "bg-[#111520]/80 border-l-2 border-l-neon-cyan border-t-transparent border-r-transparent border-b-transparent text-white font-semibold shadow-[0_0_8px_rgba(0,240,255,0.05)]"
                    : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-[#111520]/40"
                }`}
              >
                <div className="flex items-center gap-2.5 flex-1 min-w-0">
                  <MessageSquare className={`w-4 h-4 shrink-0 ${isActive ? "text-neon-cyan" : "text-slate-500"}`} />
                  
                  {isEditing ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveRename(e as any, conv.id);
                        if (e.key === "Escape") handleCancelRename(e as any);
                      }}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      className="bg-[#0b0c0e] text-white border border-blue-500/50 rounded px-1.5 py-0.5 w-full text-xs font-medium focus:outline-none"
                    />
                  ) : (
                    <span className="truncate font-medium text-xs tracking-wide">{conv.title}</span>
                  )}
                </div>

                {/* Hover Action Buttons */}
                {!isEditing && (
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-0.5 shrink-0 transition-opacity ml-2">
                    <button
                      onClick={(e) => handleStartRename(e, conv)}
                      className="p-1 text-slate-500 hover:text-blue-400 hover:bg-slate-800/30 rounded"
                      title="Rename"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, conv.id)}
                      className="p-1 text-slate-500 hover:text-rose-400 hover:bg-slate-800/30 rounded"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}

                {/* Edit Confirm Action Buttons */}
                {isEditing && (
                  <div className="flex items-center gap-0.5 shrink-0 ml-2">
                    <button
                      onClick={(e) => handleSaveRename(e, conv.id)}
                      className="p-1 text-emerald-400 hover:bg-slate-800/30 rounded"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={handleCancelRename}
                      className="p-1 text-rose-400 hover:bg-slate-800/30 rounded"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
        
        {/* RAG Knowledge Base indexing section */}
        <div className="pt-3 border-t border-slate-900/40 mt-3">
          <button
            onClick={() => setRagOpen(!ragOpen)}
            className="w-full flex items-center justify-between px-2 py-1.5 text-xs font-semibold text-slate-400 hover:text-slate-200 transition-colors cursor-pointer no-drag-region"
          >
            <span className="flex items-center gap-1.5 font-mono text-[9px] tracking-wide">
              <Folder className="w-3.5 h-3.5 text-slate-500" />
              <span>WORKSPACE KNOWLEDGE (RAG)</span>
            </span>
            {ragOpen ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
          </button>
          
          {ragOpen && (
            <div className="mt-2 px-2 space-y-2.5">
              {/* Add folder path input */}
              <div className="flex items-center gap-1.5">
                <input
                  type="text"
                  placeholder="C:\projects\my-code"
                  value={newPath}
                  onChange={(e) => setNewPath(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && newPath.trim()) {
                      indexFolder(newPath.trim());
                      setNewPath("");
                    }
                  }}
                  className="bg-[#0b0c0e] text-slate-200 placeholder-slate-600 border border-slate-800 focus:border-neon-cyan/50 rounded px-2 py-1 text-[10px] w-full focus:outline-none"
                />
                <button
                  onClick={() => {
                    if (newPath.trim()) {
                      indexFolder(newPath.trim());
                      setNewPath("");
                    }
                  }}
                  disabled={ragLoading}
                  className="p-1.5 bg-neon-cyan/10 hover:bg-neon-cyan text-neon-cyan hover:text-black border border-neon-cyan/25 rounded transition-all active:scale-95 disabled:opacity-40 cursor-pointer"
                  title="Index folder"
                >
                  <FolderPlus className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Loader */}
              {ragLoading && (
                <div className="flex items-center gap-1.5 text-[9px] text-neon-cyan animate-pulse bg-neon-cyan/5 border border-neon-cyan/15 rounded p-1.5">
                  <Loader2 className="w-3 h-3 animate-spin shrink-0" />
                  <span className="truncate">Indexing project files...</span>
                </div>
              )}

              {/* Folders List */}
              <div className="space-y-1 max-h-40 overflow-y-auto pr-0.5">
                {ragFolders.length === 0 ? (
                  <p className="text-[9px] text-slate-500 italic py-1 pl-1">No folders indexed.</p>
                ) : (
                  ragFolders.map((f) => {
                    const parts = f.path.split(/[\\/]/);
                    const folderName = parts.pop() || parts.pop() || f.path;
                    return (
                      <div key={f.id} className="group/folder flex items-center justify-between p-1.5 bg-[#0a0e17] border border-neon-cyan/10 hover:border-neon-cyan/35 hover:bg-[#111520] text-xs transition-all duration-200 cyber-clip-sm">
                         <div className="flex-1 min-w-0 pr-1" title={f.path}>
                           <div className="font-semibold text-[10px] text-slate-300 truncate">{folderName}</div>
                           <div className="text-[8px] text-slate-500 font-mono mt-0.5">
                             <span className="text-neon-green">{f.file_count}</span> files • <span className="text-neon-cyan">{f.chunk_count}</span> chunks
                           </div>
                         </div>
                         <button
                           onClick={() => removeFolder(f.id)}
                           className="p-1 text-slate-600 hover:text-rose-400 hover:bg-rose-500/15 rounded transition-all cursor-pointer"
                           title="Remove folder index"
                         >
                           <Trash2 className="w-3 h-3" />
                         </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Voice Controls Panel */}
      <div className="p-3 border-t border-neon-cyan/10 bg-[#0a0c12]/50 space-y-2.5">
        <div className="flex items-center gap-1.5 font-mono text-[10px] text-neon-cyan/60 mb-1">
          <Mic className="w-3.5 h-3.5 text-neon-cyan/40" />
          <span className="tracking-widest">VOICE_SYSTEM</span>
        </div>
        
        {/* Toggle Wake Word */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span>"Hey Jarvis"</span>
            {voiceStatus === "downloading" && (
              <span className="text-[9px] text-neon-cyan font-mono animate-pulse">(loading...)</span>
            )}
            {voiceStatus === "error" && (
              <span className="text-[9px] text-neon-pink font-mono">(error)</span>
            )}
          </span>
          <button
            onClick={toggleWakeWord}
            disabled={voiceStatus === "error"}
            className={`w-9 h-5 rounded-full p-0.5 transition-all relative border ${
              wakeWordActive ? "bg-neon-cyan border-neon-cyan shadow-[0_0_8px_#00f0ff]" : "bg-[#0a0c12] border-slate-800"
            } ${voiceStatus === "error" ? "opacity-30 cursor-not-allowed" : "cursor-pointer active:scale-95"}`}
            title="Enable background wake word listener"
          >
            <div
              className={`w-4 h-4 rounded-full transition-transform ${
                wakeWordActive ? "translate-x-4 bg-black" : "translate-x-0 bg-slate-500"
              }`}
            />
          </button>
        </div>

        {/* Toggle Voice Output */}
        <div className="flex items-center justify-between text-xs text-slate-400">
          <span className="flex items-center gap-1">
            <Volume2 className="w-3.5 h-3.5 text-slate-500" />
            <span>Spoken Feedback</span>
          </span>
          <button
            onClick={toggleVoiceResponse}
            className={`w-9 h-5 rounded-full p-0.5 transition-all relative border cursor-pointer active:scale-95 ${
              voiceResponseEnabled ? "bg-neon-cyan border-neon-cyan shadow-[0_0_8px_#00f0ff]" : "bg-[#0a0c12] border-slate-800"
            }`}
            title="Read assistant responses aloud"
          >
            <div
              className={`w-4 h-4 rounded-full transition-transform ${
                voiceResponseEnabled ? "translate-x-4 bg-black" : "translate-x-0 bg-slate-500"
              }`}
            />
          </button>
        </div>
      </div>

      {/* System Stats Footer */}
      <div className="p-3.5 border-t border-slate-900/40 bg-[#0c0d10]/50 font-mono text-[10px] text-slate-400 space-y-3 shrink-0">
        <div className="flex items-center justify-between text-slate-500 border-b border-slate-900/30 pb-1.5">
          <div className="flex items-center gap-1.5">
            <Terminal className="w-3.5 h-3.5 text-slate-600" />
            <span className="text-[9px] font-bold tracking-wider uppercase">PC Performance</span>
          </div>
          <span className="text-[8px] bg-emerald-500/10 text-emerald-400 px-1 py-0.5 rounded border border-emerald-500/15">ONLINE</span>
        </div>

        {systemStats ? (
          <div className="space-y-2.5">
            {/* CPU */}
            <div className="space-y-1">
              <div className="flex justify-between text-[9px] leading-none">
                <span className="text-slate-500 truncate max-w-[130px] block" title={systemStats.cpu_name}>
                  CPU: {systemStats.cpu_name}
                </span>
                <span className="text-neon-cyan font-bold shrink-0">{systemStats.cpu_usage}%</span>
              </div>
              <SegmentedProgressBar value={systemStats.cpu_usage} colorClass="bg-neon-cyan shadow-[0_0_4px_#00f0ff]" />
            </div>

            {/* RAM */}
            <div className="space-y-1">
              <div className="flex justify-between text-[9px] leading-none">
                <span className="text-slate-500">
                  RAM: {systemStats.ram_used} / {systemStats.ram_total} GB
                </span>
                <span className="text-neon-purple font-bold">{systemStats.ram_usage}%</span>
              </div>
              <SegmentedProgressBar value={systemStats.ram_usage} colorClass="bg-neon-purple shadow-[0_0_4px_#bc13fe]" />
            </div>

            {/* Disk */}
            <div className="space-y-1">
              <div className="flex justify-between text-[9px] leading-none">
                <span className="text-slate-500">
                  Disk: {systemStats.disk_used} / {systemStats.disk_total} GB
                </span>
                <span className="text-neon-yellow font-bold">{systemStats.disk_usage}%</span>
              </div>
              <SegmentedProgressBar value={systemStats.disk_usage} colorClass="bg-neon-yellow shadow-[0_0_4px_#ffe600]" />
            </div>

            {/* GPU Info */}
            {systemStats.gpu_name && (
              <div className="flex flex-col gap-0.5 pt-0.5 text-[8.5px] text-slate-500 border-t border-slate-900/20">
                <span className="font-semibold uppercase tracking-wider text-[7.5px] text-neon-cyan/60">GPU Controller</span>
                <span className="text-slate-400 truncate" title={systemStats.gpu_name}>{systemStats.gpu_name}</span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center justify-center gap-1.5 py-4 text-neon-cyan animate-pulse text-[9px]">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>Loading Telemetry...</span>
          </div>
        )}
      </div>
    </aside>
  );
};
