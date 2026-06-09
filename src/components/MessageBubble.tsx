import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import rehypeHighlight from "rehype-highlight";
import remarkGfm from "remark-gfm";
import { Message } from "../store";
import { MermaidRenderer } from "./MermaidRenderer";
import { Copy, Check, Terminal, FolderOpen, Search, Clock, ShieldCheck, Database, ChevronDown, ChevronUp } from "lucide-react";

interface MessageBubbleProps {
  message: Message;
}

export const MessageBubble: React.FC<MessageBubbleProps> = ({ message }) => {
  const { role, content, tool_name, tool_args, tool_result } = message;
  const isUser = role === "user";
  const isTool = role === "tool";

  const [copied, setCopied] = useState(false);
  const [toolCollapsed, setToolCollapsed] = useState(true);

  const handleCopyText = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // 1. Tool Call Card Renderer
  if (isTool && tool_name) {
    const getToolIcon = () => {
      switch (tool_name) {
        case "run_shell_command":
          return <Terminal className="w-4 h-4 text-neon-yellow shrink-0" />;
        case "web_search":
          return <Search className="w-4 h-4 text-neon-cyan shrink-0" />;
        case "read_file":
        case "write_file":
          return <FolderOpen className="w-4 h-4 text-neon-green shrink-0" />;
        case "get_datetime":
          return <Clock className="w-4 h-4 text-neon-purple shrink-0" />;
        case "remember_fact":
          return <Database className="w-4 h-4 text-neon-pink shrink-0" />;
        default:
          return <ShieldCheck className="w-4 h-4 text-neon-cyan shrink-0" />;
      }
    };

    const getToolDisplayName = () => {
      switch (tool_name) {
        case "run_shell_command":
          return "KERNEL_EXEC";
        case "web_search":
          return "WEB_SEARCH";
        case "read_file":
          return "FS_READ";
        case "write_file":
          return "FS_WRITE";
        case "get_datetime":
          return "SYS_CLOCK";
        case "remember_fact":
          return "MEM_INDEX";
        default:
          return tool_name.toUpperCase();
      }
    };

    return (
      <div className="w-full max-w-4xl mr-auto mb-4 px-6 select-none">
        <div className="border border-neon-cyan/20 bg-[#0a0c12]/75 backdrop-blur-md rounded-xl overflow-hidden shadow-[0_0_10px_rgba(0,240,255,0.05)] cyber-clip">
          {/* Header */}
          <div
            onClick={() => setToolCollapsed(!toolCollapsed)}
            className="flex items-center justify-between p-3.5 cursor-pointer hover:bg-neon-cyan/5 transition-colors"
          >
            <div className="flex items-center gap-2.5">
              {getToolIcon()}
              <span className="font-semibold text-xs tracking-widest text-slate-300 font-mono">
                {getToolDisplayName()}
              </span>
              {tool_args && Object.keys(tool_args).length > 0 && (
                <span className="text-[10px] font-mono text-slate-500 max-w-[200px] truncate">
                  ({Object.values(tool_args).join(", ")})
                </span>
              )}
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-neon-green font-mono tracking-wider cyber-glow-text-green">[ STATUS: EXEC_OK ]</span>
              {toolCollapsed ? (
                <ChevronDown className="w-4 h-4 text-slate-500" />
              ) : (
                <ChevronUp className="w-4 h-4 text-slate-500" />
              )}
            </div>
          </div>

          {/* Details Collapsible Area */}
          {!toolCollapsed && (
            <div className="border-t border-neon-cyan/15 p-4 bg-[#0a0e17]/90 space-y-3 font-mono text-xs text-slate-300">
              {/* Arguments Block */}
              {tool_args && (
                <div>
                  <div className="text-[9px] text-neon-yellow/70 font-semibold mb-1 tracking-widest">// PARAMETERS</div>
                  <pre className="p-2.5 bg-[#050508] border border-neon-cyan/10 rounded-lg overflow-x-auto text-[11px] text-neon-yellow/90">
                    {JSON.stringify(tool_args, null, 2)}
                  </pre>
                </div>
              )}
              
              {/* Output Block */}
              {tool_result && (
                <div>
                  <div className="text-[9px] text-neon-green/70 font-semibold mb-1 tracking-widest flex justify-between items-center">
                    <span>// EXECUTION OUTPUT</span>
                    <button
                      onClick={() => handleCopyText(tool_result)}
                      className="p-1 rounded hover:bg-neon-cyan/10 text-slate-500 hover:text-neon-cyan transition-colors cursor-pointer"
                      title="Copy Output"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-neon-green" /> : <Copy className="w-3.5 h-3.5 text-neon-cyan" />}
                    </button>
                  </div>
                  <pre className="p-2.5 bg-[#050508] border border-neon-cyan/10 rounded-lg overflow-x-auto text-[11px] text-neon-green/90 max-h-60 overflow-y-auto">
                    {tool_result}
                  </pre>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // 2. User Message Bubble
  if (isUser) {
    return (
      <div className="w-full max-w-2xl ml-auto mb-5 flex justify-end px-6">
        <div className="bg-[#0a1628]/60 border border-neon-cyan/20 border-l-2 border-l-neon-cyan text-slate-100 p-3.5 rounded-xl rounded-tr-sm shadow-md shadow-black/40">
          <p className="text-sm font-medium leading-relaxed whitespace-pre-wrap select-text">{content}</p>
        </div>
      </div>
    );
  }

  // 3. Assistant Message Bubble
  return (
    <div className="w-full max-w-4xl mr-auto mb-6 px-6">
      <div className="flex gap-4">
        {/* Avatar/Icon */}
        <div className="w-8 h-8 rounded bg-[#0a0c12] border border-neon-cyan/25 flex items-center justify-center shrink-0 shadow-[0_0_8px_rgba(0,240,255,0.1)] cyber-clip-sm">
          <div className="w-2.5 h-2.5 rounded-full bg-neon-cyan shadow-[0_0_8px_#00f0ff] animate-pulse" />
        </div>
        
        {/* Content Box */}
        <div className="flex-1 min-w-0 pt-0.5 select-text">
          <div className="prose prose-invert max-w-none text-slate-200 text-sm leading-relaxed space-y-4">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              rehypePlugins={[rehypeHighlight]}
              components={{
                code({ node, className, children, ...props }) {
                  const match = /language-(\w+)/.exec(className || "");
                  const isInline = !match;
                  const codeContent = String(children).replace(/\n$/, "");

                  if (isInline) {
                    return (
                      <code className="bg-[#111520] px-1.5 py-0.5 rounded font-mono text-xs text-neon-cyan border border-neon-cyan/15" {...props}>
                        {children}
                      </code>
                    );
                  }

                  if (match && match[1].toLowerCase() === "mermaid") {
                    return <MermaidRenderer chart={codeContent} />;
                  }

                  return (
                    <div className="my-4 border border-neon-cyan/15 rounded-xl overflow-hidden shadow-lg bg-[#0a0e17] cyber-clip">
                      {/* Copy header */}
                      <div className="flex justify-between items-center px-4 py-2 bg-[#06080e] border-b border-neon-cyan/15 text-xs font-mono text-slate-400">
                        <span className="text-neon-cyan font-bold tracking-wider">{match[1].toUpperCase()}</span>
                        <button
                          onClick={() => handleCopyText(codeContent)}
                          className={`flex items-center gap-1.5 transition-colors cursor-pointer ${
                            copied ? "text-neon-green font-bold" : "hover:text-neon-cyan text-slate-400"
                          }`}
                        >
                          {copied ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-neon-green" />
                              <span>COPIED</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>COPY</span>
                            </>
                          )}
                        </button>
                      </div>
                      <pre className="p-4 overflow-x-auto text-xs leading-relaxed font-mono bg-[#0a0e17]">
                        <code className={className} {...props}>
                          {children}
                        </code>
                      </pre>
                    </div>
                  );
                },
                table({ children }) {
                  return (
                    <div className="my-4 overflow-x-auto border border-neon-cyan/15 rounded-xl bg-[#0a0e17]/50 shadow-[0_0_10px_rgba(0,240,255,0.03)]">
                      <table className="cyber-table">
                        {children}
                      </table>
                    </div>
                  );
                },
                thead({ children }) {
                  return <thead>{children}</thead>;
                },
                tbody({ children }) {
                  return <tbody>{children}</tbody>;
                },
                tr({ children }) {
                  return <tr>{children}</tr>;
                },
                th({ children }) {
                  return <th className="border border-neon-cyan/25 bg-neon-cyan/5 text-neon-cyan font-mono text-xs p-2.5 font-bold tracking-wider">{children}</th>;
                },
                td({ children }) {
                  return <td className="border border-neon-cyan/10 bg-[#0a0c12]/45 text-slate-300 font-mono text-xs p-2.5">{children}</td>;
                },
                blockquote({ children }) {
                  return (
                    <blockquote className="cyber-blockquote px-4 py-2.5 font-mono text-xs">
                      {children}
                    </blockquote>
                  );
                },
                h1: ({ children }) => <h1 className="text-base font-bold text-white border-b border-neon-cyan/15 pb-2 mt-6 mb-4 font-mono tracking-wider text-neon-cyan cyber-glow-text-cyan">{children}</h1>,
                h2: ({ children }) => <h2 className="text-sm font-semibold text-slate-100 mt-5 mb-3 font-mono tracking-wide border-l-2 border-neon-pink pl-2">{children}</h2>,
                h3: ({ children }) => <h3 className="text-xs font-semibold text-slate-200 mt-4 mb-2 font-mono">{children}</h3>,
                ul: ({ children }) => <ul className="list-disc pl-5 my-3 space-y-1.5 text-slate-300">{children}</ul>,
                ol: ({ children }) => <ol className="list-decimal pl-5 my-3 space-y-1.5 text-slate-300">{children}</ol>,
                li: ({ children }) => <li className="marker:text-neon-cyan">{children}</li>,
              }}
            >
              {content}
            </ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  );
};
