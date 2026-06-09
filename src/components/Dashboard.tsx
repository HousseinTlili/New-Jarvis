import React, { useState } from "react";
import { useJarvisStore, TelemetryLog, DailyHistory } from "../store";
import { 
  TrendingUp, 
  Cpu, 
  Activity, 
  DollarSign, 
  RefreshCw, 
  Layers, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Clock, 
  Terminal,
  ChevronRight,
  Database,
  FolderOpen,
  Play,
  Pause,
  Trash2
} from "lucide-react";

export const Dashboard: React.FC = () => {
  const { 
    telemetryStats, 
    telemetryHistory, 
    telemetryRecent, 
    telemetryLoading, 
    fetchTelemetry,
    scheduledJobs,
    fileWatchers,
    toggleJob,
    deleteJob,
    deleteWatcher,
    fetchJobs,
    schedulerLoading
  } = useJarvisStore();

  const [activeTab, setActiveTab] = useState<"analytics" | "automation">("analytics");

  const [hoveredAreaPoint, setHoveredAreaPoint] = useState<{
    index: number;
    x: number;
    y: number;
    data: DailyHistory & { cumulative_saved: number };
  } | null>(null);

  const [hoveredBarGroup, setHoveredBarGroup] = useState<{
    index: number;
    x: number;
    y: number;
    data: DailyHistory;
  } | null>(null);

  const [isRefreshing, setIsRefreshing] = useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    if (activeTab === "analytics") {
      await fetchTelemetry();
    } else {
      await fetchJobs();
    }
    setTimeout(() => setIsRefreshing(false), 600);
  };

  // Helper to format currency
  const formatUSD = (val: number) => {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 4,
      maximumFractionDigits: 5
    }).format(val);
  };

  // Process data for cumulative savings
  let cumulative = 0;
  const processedHistory = (telemetryHistory || []).map((day) => {
    cumulative += day.cost_saved;
    return {
      ...day,
      cumulative_saved: cumulative
    };
  });

  const hasData = processedHistory.length > 0 && telemetryStats && telemetryStats.total_queries > 0;

  // Render Empty State
  const renderEmptyState = () => (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center bg-[#0a0c12]/70 backdrop-blur-md rounded-2xl border border-neon-cyan/15 shadow-[0_0_10px_rgba(0,240,255,0.03)] cyber-clip">
      <div className="relative mb-6">
        <div className="w-16 h-16 rounded bg-neon-cyan/5 border border-neon-cyan/20 flex items-center justify-center">
          <Database className="w-8 h-8 text-neon-cyan/30" />
        </div>
        <div className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-slate-950 border border-slate-800 flex items-center justify-center text-[8px] text-slate-500 font-mono">
          ?
        </div>
      </div>
      <h3 className="text-sm font-bold text-neon-cyan tracking-widest font-mono uppercase">NO_TELEMETRY_RECORDED</h3>
      <p className="text-slate-400 text-xs max-w-sm mt-2 font-mono leading-relaxed">
        Start chatting with Jarvis or run clipboard triggers! Ollama performance logs and cost savings will populate here automatically.
      </p>
      <button
        onClick={handleRefresh}
        disabled={isRefreshing}
        className="mt-6 py-2 px-4 bg-neon-cyan/15 hover:bg-neon-cyan text-neon-cyan hover:text-black border border-neon-cyan/25 hover:border-transparent rounded text-xs font-semibold font-mono tracking-wide flex items-center gap-2 transition-all active:scale-95 disabled:opacity-40 cursor-pointer cyber-clip-sm hover:shadow-[0_0_12px_#00f0ff]"
      >
        <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
        <span>SCAN_DATABASE</span>
      </button>
    </div>
  );

  // SVG Area Chart Setup (Cumulative Cost Saved)
  const drawAreaChart = () => {
    const width = 500;
    const height = 180;
    const paddingLeft = 50;
    const paddingRight = 15;
    const paddingTop = 15;
    const paddingBottom = 25;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const maxCumulative = Math.max(...processedHistory.map(d => d.cumulative_saved), 0.001);

    const points = processedHistory.map((d, index) => {
      const x = paddingLeft + (index / Math.max(processedHistory.length - 1, 1)) * chartWidth;
      const y = paddingTop + chartHeight - (d.cumulative_saved / maxCumulative) * chartHeight;
      return { x, y, data: d };
    });

    const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");
    const areaPath = points.length > 0 
      ? `${linePath} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`
      : "";

    // Grid levels
    const gridLevels = [0, 0.25, 0.5, 0.75, 1];

    return (
      <div className="relative w-full h-full bg-[#0a0c12]/75 backdrop-blur-md rounded-xl border border-neon-cyan/15 p-4 cyber-clip shadow-[0_0_10px_rgba(0,240,255,0.03)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-neon-green" />
            <span className="text-xs font-bold text-slate-300 tracking-wide font-mono">CUMULATIVE SAVINGS (USD)</span>
          </div>
          <span className="text-[10px] font-semibold text-neon-green bg-neon-green/10 border border-neon-green/20 px-2 py-0.5 rounded font-mono">
            Saved vs. Cloud APIs
          </span>
        </div>

        <div className="relative">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
            <defs>
              <linearGradient id="savingsAreaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#39ff14" stopOpacity="0.25" />
                <stop offset="100%" stopColor="#39ff14" stopOpacity="0.00" />
              </linearGradient>
              <linearGradient id="savingsLineGrad" x1="0" y1="0" x2="1" y2="0">
                <stop offset="0%" stopColor="#39ff14" />
                <stop offset="100%" stopColor="#00ff88" />
              </linearGradient>
            </defs>

            {/* Grid Lines */}
            {gridLevels.map((level, idx) => {
              const y = paddingTop + chartHeight - level * chartHeight;
              const val = level * maxCumulative;
              return (
                <g key={idx} className="opacity-40">
                  <line 
                    x1={paddingLeft} 
                    y1={y} 
                    x2={width - paddingRight} 
                    y2={y} 
                    stroke="rgba(0, 240, 255, 0.08)" 
                    strokeWidth="1" 
                    strokeDasharray="4 4"
                  />
                  <text 
                    x={paddingLeft - 8} 
                    y={y + 3.5} 
                    fill="#64748b" 
                    fontSize="8" 
                    fontFamily="monospace"
                    textAnchor="end"
                  >
                    ${val.toFixed(3)}
                  </text>
                </g>
              );
            })}

            {/* Area path */}
            {areaPath && (
              <path d={areaPath} fill="url(#savingsAreaGrad)" />
            )}

            {/* Line path */}
            {linePath && (
              <path 
                d={linePath} 
                fill="none" 
                stroke="url(#savingsLineGrad)" 
                strokeWidth="2.5" 
                strokeLinecap="round" 
                strokeLinejoin="round" 
              />
            )}

            {/* X Axis labels */}
            {points.map((p, idx) => {
              // Only draw some labels if length is large
              if (points.length > 5 && idx % Math.ceil(points.length / 4) !== 0 && idx !== points.length - 1) return null;
              const formattedDate = p.data.day.substring(5); // MM-DD
              return (
                <text 
                  key={idx}
                  x={p.x} 
                  y={height - 5} 
                  fill="#64748b" 
                  fontSize="8.5" 
                  fontFamily="monospace"
                  textAnchor="middle"
                >
                  {formattedDate}
                </text>
              );
            })}

            {/* Hover Hotspots / Interaction Dots */}
            {points.map((p, idx) => (
              <g 
                key={idx}
                onMouseEnter={(e) => {
                  const svgEl = e.currentTarget.ownerSVGElement;
                  if (!svgEl) return;
                  const rect = svgEl.getBoundingClientRect();
                  setHoveredAreaPoint({
                    index: idx,
                    x: (p.x / width) * rect.width,
                    y: (p.y / height) * rect.height,
                    data: p.data
                  });
                }}
                onMouseLeave={() => setHoveredAreaPoint(null)}
              >
                <circle 
                  cx={p.x} 
                  cy={p.y} 
                  r="7" 
                  fill="transparent" 
                  className="cursor-pointer"
                />
                {hoveredAreaPoint?.index === idx && (
                  <>
                    <circle 
                      cx={p.x} 
                      cy={p.y} 
                      r="5" 
                      fill="#39ff14" 
                      stroke="#0d0f12" 
                      strokeWidth="2" 
                    />
                    <circle 
                      cx={p.x} 
                      cy={p.y} 
                      r="10" 
                      fill="transparent" 
                      stroke="#39ff14" 
                      strokeWidth="1.5" 
                      className="animate-ping opacity-60"
                    />
                  </>
                )}
              </g>
            ))}
          </svg>

          {/* Interactive HTML Tooltip overlay */}
          {hoveredAreaPoint && (
            <div 
              className="absolute z-30 p-2.5 bg-[#0a0c12]/95 border border-neon-cyan/25 text-[10px] text-slate-350 rounded shadow-[0_0_10px_rgba(0,240,255,0.15)] pointer-events-none font-mono"
              style={{ 
                left: `${hoveredAreaPoint.x}px`, 
                top: `${hoveredAreaPoint.y - 65}px`,
                transform: "translateX(-50%)" 
              }}
            >
              <div className="text-slate-450 font-bold border-b border-slate-850 pb-1 mb-1">// DIAGNOSTICS</div>
              <div className="flex justify-between gap-6">
                <span>Cumulative Savings:</span>
                <span className="text-neon-green font-semibold">{formatUSD(hoveredAreaPoint.data.cumulative_saved)}</span>
              </div>
              <div className="flex justify-between gap-6">
                <span>Day Savings:</span>
                <span className="text-slate-200">{formatUSD(hoveredAreaPoint.data.cost_saved)}</span>
              </div>
              <div className="flex justify-between gap-6">
                <span>Query Volume:</span>
                <span className="text-neon-cyan font-bold">{hoveredAreaPoint.data.query_count} runs</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  // SVG Bar Chart Setup (Daily Token Volume)
  const drawBarChart = () => {
    const width = 500;
    const height = 180;
    const paddingLeft = 50;
    const paddingRight = 15;
    const paddingTop = 15;
    const paddingBottom = 25;

    const chartWidth = width - paddingLeft - paddingRight;
    const chartHeight = height - paddingTop - paddingBottom;

    const maxTokens = Math.max(...(telemetryHistory || []).map(d => Math.max(d.prompt_tokens, d.completion_tokens)), 100);

    const numDays = telemetryHistory.length;
    const groupWidth = chartWidth / Math.max(numDays, 1);
    const barWidth = Math.max((groupWidth * 0.7) / 2, 4.5);
    const barGap = 1.5;

    // Grid levels
    const gridLevels = [0, 0.25, 0.5, 0.75, 1];

    return (
      <div className="relative w-full h-full bg-[#0a0c12]/75 backdrop-blur-md rounded-xl border border-neon-cyan/15 p-4 cyber-clip shadow-[0_0_10px_rgba(0,240,255,0.03)]">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-neon-cyan" />
            <span className="text-xs font-bold text-slate-300 tracking-wide font-mono">DAILY TOKEN DISTRIBUTION</span>
          </div>
          <div className="flex items-center gap-3 text-[9px] font-bold font-mono">
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-neon-cyan shadow-[0_0_4px_#00f0ff]"></span>IN</span>
            <span className="flex items-center gap-1"><span className="w-2 h-2 rounded bg-neon-purple shadow-[0_0_4px_#bc13fe]"></span>OUT</span>
          </div>
        </div>

        <div className="relative">
          <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto overflow-visible">
            {/* Grid Lines */}
            {gridLevels.map((level, idx) => {
              const y = paddingTop + chartHeight - level * chartHeight;
              const val = level * maxTokens;
              return (
                <g key={idx} className="opacity-40">
                  <line 
                    x1={paddingLeft} 
                    y1={y} 
                    x2={width - paddingRight} 
                    y2={y} 
                    stroke="rgba(0, 240, 255, 0.08)" 
                    strokeWidth="1" 
                    strokeDasharray="4 4"
                  />
                  <text 
                    x={paddingLeft - 8} 
                    y={y + 3} 
                    fill="#64748b" 
                    fontSize="8" 
                    fontFamily="monospace"
                    textAnchor="end"
                  >
                    {val >= 1000 ? `${(val / 1000).toFixed(1)}k` : val.toFixed(0)}
                  </text>
                </g>
              );
            })}

            {/* Bars */}
            {(telemetryHistory || []).map((day, idx) => {
              const groupCenter = paddingLeft + idx * groupWidth + groupWidth / 2;
              
              // Prompt Bar (Input)
              const promptH = (day.prompt_tokens / maxTokens) * chartHeight;
              const promptX = groupCenter - barWidth - barGap / 2;
              const promptY = paddingTop + chartHeight - promptH;
              
              // Completion Bar (Output)
              const completionH = (day.completion_tokens / maxTokens) * chartHeight;
              const completionX = groupCenter + barGap / 2;
              const completionY = paddingTop + chartHeight - completionH;

              const formattedDate = day.day.substring(5); // MM-DD

              const isHovered = hoveredBarGroup?.index === idx;

              return (
                <g 
                  key={idx}
                  onMouseEnter={(e) => {
                    const svgEl = e.currentTarget.ownerSVGElement;
                    if (!svgEl) return;
                    const rect = svgEl.getBoundingClientRect();
                    setHoveredBarGroup({
                      index: idx,
                      x: (groupCenter / width) * rect.width,
                      y: ((Math.min(promptY, completionY)) / height) * rect.height,
                      data: day
                    });
                  }}
                  onMouseLeave={() => setHoveredBarGroup(null)}
                >
                  {/* Prompt Bar (Input) */}
                  <rect
                    x={promptX}
                    y={promptY}
                    width={barWidth}
                    height={Math.max(promptH, 1)}
                    fill="#00f0ff"
                    opacity={isHovered ? 0.95 : 0.65}
                    rx="1.5"
                    className="transition-all duration-200"
                  />

                  {/* Completion Bar (Output) */}
                  <rect
                    x={completionX}
                    y={completionY}
                    width={barWidth}
                    height={Math.max(completionH, 1)}
                    fill="#bc13fe"
                    opacity={isHovered ? 0.95 : 0.65}
                    rx="1.5"
                    className="transition-all duration-200"
                  />

                  {/* X Axis Label */}
                  {/* Only draw some labels if length is large */}
                  {(numDays <= 5 || idx % Math.ceil(numDays / 4) === 0 || idx === numDays - 1) && (
                    <text
                      x={groupCenter}
                      y={height - 5}
                      fill="#64748b"
                      fontSize="8.5"
                      fontFamily="monospace"
                      textAnchor="middle"
                    >
                      {formattedDate}
                    </text>
                  )}
                </g>
              );
            })}
          </svg>

          {/* Interactive Tooltip for Bars */}
          {hoveredBarGroup && (
            <div 
              className="absolute z-30 p-2.5 bg-[#0a0c12]/95 border border-neon-cyan/25 text-[10px] text-slate-350 rounded shadow-[0_0_10px_rgba(0,240,255,0.15)] pointer-events-none font-mono"
              style={{ 
                left: `${hoveredBarGroup.x}px`, 
                top: `${hoveredBarGroup.y - 70}px`,
                transform: "translateX(-50%)" 
              }}
            >
              <div className="text-slate-400 font-bold border-b border-slate-800 pb-1 mb-1">
                {hoveredBarGroup.data.day}
              </div>
              <div className="flex justify-between gap-6">
                <span>Input (Prompt) Tokens:</span>
                <span className="text-neon-cyan font-semibold">{hoveredBarGroup.data.prompt_tokens.toLocaleString()}</span>
              </div>
              <div className="flex justify-between gap-6">
                <span>Output (Eval) Tokens:</span>
                <span className="text-neon-purple font-semibold">{hoveredBarGroup.data.completion_tokens.toLocaleString()}</span>
              </div>
              <div className="flex justify-between gap-6">
                <span>Daily Total:</span>
                <span className="text-slate-200 font-bold">{(hoveredBarGroup.data.prompt_tokens + hoveredBarGroup.data.completion_tokens).toLocaleString()}</span>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAutomationTab = () => (
    <div className="z-10 space-y-6 flex-1">
      {/* Scheduled Jobs Section */}
      <div className="bg-[#0a0c12]/75 backdrop-blur-md rounded-xl border border-neon-cyan/15 p-5 cyber-clip">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Clock className="w-4.5 h-4.5 text-neon-cyan" />
            <span className="text-sm font-bold text-slate-200 tracking-wider font-mono uppercase">SCHEDULED BACKGROUND TASKS</span>
          </div>
          <span className="text-[9.5px] text-slate-500 font-mono">APScheduler Core</span>
        </div>

        {scheduledJobs.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-800/80 rounded-lg text-slate-500 text-xs">
            No background tasks scheduled. Ask Jarvis in chat to:
            <div className="mt-2 text-neon-cyan/70 font-mono italic">
              "Remind me every 1 hour to drink water"
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-[10px]">
              <thead>
                <tr className="border-b border-neon-cyan/15 text-neon-cyan/60 pb-2">
                  <th className="font-semibold py-2">JOB ID</th>
                  <th className="font-semibold py-2">TASK TYPE</th>
                  <th className="font-semibold py-2">TRIGGER</th>
                  <th className="font-semibold py-2">TRIGGER VALUE</th>
                  <th className="font-semibold py-2">LAST RUN</th>
                  <th className="font-semibold py-2 text-center">STATUS</th>
                  <th className="font-semibold py-2 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/30 text-slate-400">
                {scheduledJobs.map((job) => {
                  const isActive = job.status === "active";
                  return (
                    <tr key={job.job_id} className="hover:bg-neon-cyan/5 transition-colors">
                      <td className="py-3 font-bold text-slate-300">{job.job_id}</td>
                      <td className="py-3">
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                          job.task_type === "script" 
                            ? "bg-neon-purple/10 text-neon-purple border border-neon-purple/10" 
                            : "bg-neon-cyan/10 text-neon-cyan border border-neon-cyan/10"
                        }`}>
                          {job.task_type.toUpperCase()}
                        </span>
                      </td>
                      <td className="py-3 font-semibold text-slate-300">{job.trigger_type}</td>
                      <td className="py-3 text-slate-300 max-w-[150px] truncate" title={job.trigger_value}>
                        {job.trigger_value}
                      </td>
                      <td className="py-3 text-slate-500">
                        {job.last_run ? new Date(job.last_run).toLocaleTimeString() : "Never"}
                      </td>
                      <td className="py-3 text-center">
                        <span className={`inline-block w-2 h-2 rounded-full ${
                          isActive ? "bg-emerald-500 animate-pulse" : "bg-slate-700"
                        }`} />
                      </td>
                      <td className="py-3 text-right">
                        <div className="flex justify-end gap-1.5">
                          <button
                            onClick={() => toggleJob(job.job_id, !isActive)}
                            className={`p-1.5 rounded transition-all cursor-pointer ${
                              isActive 
                                ? "text-neon-yellow hover:bg-neon-yellow/10" 
                                : "text-neon-green hover:bg-neon-green/10"
                            }`}
                            title={isActive ? "Pause Job" : "Resume Job"}
                          >
                            {isActive ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            onClick={() => deleteJob(job.job_id)}
                            className="p-1.5 text-neon-pink hover:bg-neon-pink/15 rounded transition-all cursor-pointer"
                            title="Delete Job"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* File Watchers Section */}
      <div className="bg-[#0a0c12]/75 backdrop-blur-md rounded-xl border border-neon-cyan/15 p-5 cyber-clip">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <FolderOpen className="w-4.5 h-4.5 text-neon-cyan" />
            <span className="text-sm font-bold text-slate-200 tracking-wider font-mono uppercase">DIRECTORY FILE WATCHERS</span>
          </div>
          <span className="text-[9.5px] text-slate-500 font-mono">Watchdog observers</span>
        </div>

        {fileWatchers.length === 0 ? (
          <div className="text-center py-8 border border-dashed border-slate-800/80 rounded-lg text-slate-500 text-xs">
            No active folder monitors. Ask Jarvis in chat to:
            <div className="mt-2 text-blue-400/70 font-mono italic">
              "Watch my Downloads folder for any new PDFs"
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left font-mono text-[10px]">
              <thead>
                <tr className="border-b border-neon-cyan/15 text-neon-cyan/60 pb-2">
                  <th className="font-semibold py-2">ID</th>
                  <th className="font-semibold py-2">WATCH PATH</th>
                  <th className="font-semibold py-2">MATCH PATTERN</th>
                  <th className="font-semibold py-2">ACTION</th>
                  <th className="font-semibold py-2">REGISTERED AT</th>
                  <th className="font-semibold py-2 text-right">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900/30 text-slate-400">
                {fileWatchers.map((w) => {
                  const parts = w.path.split(/[\\/]/);
                  const folderName = parts.pop() || parts.pop() || w.path;
                  return (
                    <tr key={w.id} className="hover:bg-neon-cyan/5 transition-colors">
                      <td className="py-3 text-slate-500">#{w.id}</td>
                      <td className="py-3 font-semibold text-slate-300" title={w.path}>
                        {folderName}
                        <span className="text-[9px] text-slate-600 block truncate max-w-[200px]" title={w.path}>{w.path}</span>
                      </td>
                      <td className="py-3 text-neon-cyan font-bold font-mono">{w.patterns}</td>
                      <td className="py-3">
                        <span className="px-2 py-0.5 rounded text-[9px] font-bold bg-[#0a0e17] text-slate-350 border border-neon-cyan/15">
                          {w.action_type}
                        </span>
                      </td>
                      <td className="py-3 text-slate-500">
                        {new Date(w.created_at).toLocaleDateString()}
                      </td>
                      <td className="py-3 text-right">
                        <button
                          onClick={() => deleteWatcher(w.id)}
                          className="p-1.5 text-neon-pink hover:bg-neon-pink/15 rounded transition-all cursor-pointer"
                          title="Delete Watcher"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050508]/40 p-6 overflow-y-auto relative no-drag-region">
      {/* Glow Backdrops */}
      <div className="absolute top-10 left-10 w-96 h-96 rounded-full bg-neon-cyan/5 blur-[120px] pointer-events-none z-0" />
      <div className="absolute bottom-10 right-10 w-96 h-96 rounded-full bg-neon-purple/5 blur-[120px] pointer-events-none z-0" />

      {/* Header Panel */}
      <header className="flex items-center justify-between border-b border-neon-cyan/15 pb-4 mb-4 z-10">
        <div>
          <h1 className="text-xl font-bold font-mono tracking-widest text-white uppercase flex items-center gap-2">
            <Cpu className="w-5 h-5 text-neon-cyan cyber-glow-text-cyan" />
            <span>SYSTEM_TELEMETRY</span>
          </h1>
          <p className="text-slate-400 text-[11px] font-sans mt-0.5">
            Local generation benchmarks, context evaluation throughput, and cloud API cost comparisons.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {(telemetryLoading || schedulerLoading) && (
            <span className="text-[10px] font-mono text-neon-cyan animate-pulse bg-neon-cyan/5 border border-neon-cyan/15 px-2.5 py-1 rounded-md">
              Fetching database updates...
            </span>
          )}
          <button
            onClick={handleRefresh}
            disabled={isRefreshing || telemetryLoading || schedulerLoading}
            className="p-2 bg-[#0a0c12]/85 hover:bg-[#111520] border border-neon-cyan/15 hover:border-neon-cyan/35 text-slate-350 hover:text-white rounded transition-all shadow active:scale-95 disabled:opacity-40 cursor-pointer"
            title="Refresh Metrics"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* Tab Selector */}
      <div className="flex gap-2 border-b border-neon-cyan/10 pb-3 mb-6 z-10">
        <button
          onClick={() => setActiveTab("analytics")}
          className={`py-1.5 px-4 rounded text-xs font-semibold flex items-center gap-2 border transition-all active:scale-95 cursor-pointer ${
            activeTab === "analytics"
              ? "bg-neon-cyan/10 border-neon-cyan text-white shadow-[0_0_8px_rgba(0,240,255,0.15)]"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20"
          }`}
        >
          <Activity className="w-3.5 h-3.5" />
          <span>Analytics & Telemetry</span>
        </button>
        <button
          onClick={() => {
            setActiveTab("automation");
            fetchJobs();
          }}
          className={`py-1.5 px-4 rounded text-xs font-semibold flex items-center gap-2 border transition-all active:scale-95 cursor-pointer ${
            activeTab === "automation"
              ? "bg-neon-cyan/10 border-neon-cyan text-white shadow-[0_0_8px_rgba(0,240,255,0.15)]"
              : "border-transparent text-slate-400 hover:text-slate-200 hover:bg-slate-800/20"
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Background Automation</span>
        </button>
      </div>

      {activeTab === "analytics" ? (
        !hasData ? (
          renderEmptyState()
        ) : (
          <div className="z-10 space-y-6 flex-1">
            {/* Key KPI Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Estimated Cost Saved */}
              <div className="bg-[#0a0c12]/75 backdrop-blur-md border border-neon-cyan/15 rounded-xl p-4.5 shadow-lg relative overflow-hidden group hover:border-neon-green/30 hover:shadow-neon-green/5 transition-all duration-300 cyber-clip">
                <div className="absolute top-0 left-0 w-1 h-full bg-neon-green" />
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 tracking-wide font-mono block">EST_COST_SAVED</span>
                    <span className="text-xl font-bold font-mono text-neon-green block mt-1 tracking-tight cyber-glow-text-green">
                      {formatUSD(telemetryStats?.total_cost_saved || 0)}
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded bg-neon-green/5 flex items-center justify-center text-neon-green border border-neon-green/20 cyber-clip-sm">
                    <DollarSign className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex items-center gap-1 text-[9px] text-slate-400 font-mono mt-3">
                  <TrendingUp className="w-3.5 h-3.5 text-neon-green" />
                  <span>Cumulative vs. GPT-4o API</span>
                </div>
              </div>

              {/* Card 2: Total Tokens */}
              <div className="bg-[#0a0c12]/75 backdrop-blur-md border border-neon-cyan/15 rounded-xl p-4.5 shadow-lg relative overflow-hidden group hover:border-neon-cyan/30 hover:shadow-neon-cyan/5 transition-all duration-300 cyber-clip">
                <div className="absolute top-0 left-0 w-1 h-full bg-neon-cyan" />
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 tracking-wide font-mono block">TOTAL_TOKENS_SEC</span>
                    <span className="text-xl font-bold font-mono text-neon-cyan block mt-1 tracking-tight cyber-glow-text-cyan">
                      {(telemetryStats?.total_tokens || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded bg-neon-cyan/5 flex items-center justify-center text-neon-cyan border border-neon-cyan/20 cyber-clip-sm">
                    <Layers className="w-4 h-4" />
                  </div>
                </div>
                <div className="flex justify-between items-center text-[9px] text-slate-500 font-mono mt-3">
                  <span className="flex items-center gap-0.5 text-slate-400"><ArrowDownLeft className="w-3 h-3 text-neon-cyan" /> {(telemetryStats?.total_prompt_tokens || 0).toLocaleString()} In</span>
                  <span className="flex items-center gap-0.5 text-slate-400"><ArrowUpRight className="w-3 h-3 text-neon-purple" /> {(telemetryStats?.total_completion_tokens || 0).toLocaleString()} Out</span>
                </div>
              </div>

              {/* Card 3: Inference Throughput */}
              <div className="bg-[#0a0c12]/75 backdrop-blur-md border border-neon-cyan/15 rounded-xl p-4.5 shadow-lg relative overflow-hidden group hover:border-neon-purple/30 hover:shadow-neon-purple/5 transition-all duration-300 cyber-clip">
                <div className="absolute top-0 left-0 w-1 h-full bg-neon-purple" />
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 tracking-wide font-mono block">GENERATION_SPEED</span>
                    <span className="text-xl font-bold font-mono text-neon-purple block mt-1 tracking-tight cyber-glow-text-purple">
                      {(telemetryStats?.avg_tokens_per_sec || 0).toFixed(1)} t/s
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded bg-neon-purple/5 flex items-center justify-center text-neon-purple border border-neon-purple/20 cyber-clip-sm">
                    <Activity className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-[9px] text-slate-400 font-mono mt-3 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 text-neon-purple" />
                  <span>Average text generation rate</span>
                </div>
              </div>

              {/* Card 4: TTFT Latency */}
              <div className="bg-[#0a0c12]/75 backdrop-blur-md border border-neon-cyan/15 rounded-xl p-4.5 shadow-lg relative overflow-hidden group hover:border-neon-yellow/30 hover:shadow-neon-yellow/5 transition-all duration-300 cyber-clip">
                <div className="absolute top-0 left-0 w-1 h-full bg-neon-yellow" />
                <div className="flex justify-between items-start">
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 tracking-wide font-mono block">AVG_PROMPT_TTFT</span>
                    <span className="text-xl font-bold font-mono text-neon-yellow block mt-1 tracking-tight cyber-glow-text-yellow">
                      {((telemetryStats?.avg_prompt_eval_ms || 0) / 1000).toFixed(2)}s
                    </span>
                  </div>
                  <div className="w-8 h-8 rounded bg-neon-yellow/5 flex items-center justify-center text-neon-yellow border border-neon-yellow/20 cyber-clip-sm">
                    <Clock className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-[9px] text-slate-400 font-mono mt-3 flex items-center gap-1.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-neon-yellow animate-ping"></span>
                  <span>Time to first completion token</span>
                </div>
              </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {drawAreaChart()}
              {drawBarChart()}
            </div>

            {/* Granular Logs Table */}
            <div className="bg-[#0a0c12]/75 backdrop-blur-md rounded-xl border border-neon-cyan/15 p-4 cyber-clip">
              <div className="flex items-center gap-2 mb-3.5">
                <Terminal className="w-4 h-4 text-neon-cyan" />
                <span className="text-xs font-bold text-slate-300 tracking-wide font-mono">RECENT INFERENCE RUNS</span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left font-mono text-[10px]">
                  <thead>
                    <tr className="border-b border-neon-cyan/15 text-neon-cyan/60 pb-2">
                      <th className="font-semibold py-2">TIMESTAMP</th>
                      <th className="font-semibold py-2">MODEL</th>
                      <th className="font-semibold py-2 text-right">TOKENS (IN/OUT)</th>
                      <th className="font-semibold py-2 text-right">LATENCY (TOTAL/TTFT)</th>
                      <th className="font-semibold py-2 text-right">SPEED</th>
                      <th className="font-semibold py-2 text-right text-neon-green">SAVED</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-900/40 text-slate-400">
                    {(telemetryRecent || []).map((log: TelemetryLog, idx) => {
                      const localTime = new Date(log.timestamp).toLocaleTimeString([], {
                        hour: "2-digit",
                        minute: "2-digit",
                        second: "2-digit"
                      });
                      const localDate = new Date(log.timestamp).toLocaleDateString([], {
                        month: "short",
                        day: "numeric"
                      });
                      
                      const speed = log.eval_duration_ms > 0
                        ? log.completion_tokens / (log.eval_duration_ms / 1000.0)
                        : 0;
                      
                      return (
                        <tr key={idx} className="hover:bg-neon-cyan/5 transition-colors">
                          <td className="py-2.5 text-slate-500">
                            {localDate} {localTime}
                          </td>
                          <td className="py-2.5 font-bold text-slate-300 flex items-center gap-1">
                            <ChevronRight className="w-3.5 h-3.5 text-slate-600" />
                            {log.model_name}
                          </td>
                          <td className="py-2.5 text-right">
                            <span className="text-slate-300">{log.prompt_tokens}</span>
                            <span className="text-slate-600">/</span>
                            <span className="text-purple-400">{log.completion_tokens}</span>
                          </td>
                          <td className="py-2.5 text-right">
                            <span className="text-slate-300">{(log.total_duration_ms / 1000).toFixed(1)}s</span>
                            <span className="text-slate-600">/</span>
                            <span className="text-cyan-400">{(log.prompt_eval_duration_ms / 1000).toFixed(2)}s</span>
                          </td>
                          <td className="py-2.5 text-right font-semibold text-purple-400">
                            {speed > 0 ? `${speed.toFixed(1)} t/s` : "—"}
                          </td>
                          <td className="py-2.5 text-right font-bold text-emerald-400">
                            {formatUSD(log.estimated_cost_saved_usd)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )
      ) : (
        renderAutomationTab()
      )}
    </div>
  );
};
