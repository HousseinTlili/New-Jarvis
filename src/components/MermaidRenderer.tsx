import React, { useEffect, useState, useRef } from "react";
import mermaid from "mermaid";

// Initialize mermaid with dark mode styling matching cyberpunk deck
mermaid.initialize({
  startOnLoad: false,
  theme: "dark",
  securityLevel: "loose",
  themeVariables: {
    background: "transparent",
    primaryColor: "#0a1628",
    primaryTextColor: "#e0e6f0",
    primaryBorderColor: "#00f0ff",
    lineColor: "#00f0ff",
    secondaryColor: "#111520",
    tertiaryColor: "#0a0e17",
  }
});

interface MermaidRendererProps {
  chart: string;
}

export const MermaidRenderer: React.FC<MermaidRendererProps> = ({ chart }) => {
  const [svg, setSvg] = useState<string>("");
  const [error, setError] = useState<string | null>(null);
  const elementId = useRef(`mermaid-${Math.floor(Math.random() * 1000000)}`);

  useEffect(() => {
    const renderChart = async () => {
      try {
        setError(null);
        // Clear any previous bad DOM elements left over by failed compiles
        const oldEl = document.getElementById(`d${elementId.current}`);
        if (oldEl) oldEl.remove();

        const { svg: svgHtml } = await mermaid.render(`d${elementId.current}`, chart);
        setSvg(svgHtml);
      } catch (err: any) {
        console.error("Mermaid parsing error:", err);
        // Set standard error output
        setError("Failed to compile Mermaid diagram. Please verify syntax.");
        
        // Clean up error element injected in body by mermaid parser
        const errEl = document.getElementById(`d${elementId.current}`);
        if (errEl) errEl.remove();
        
        const bindEl = document.getElementById(`bind-${elementId.current}`);
        if (bindEl) bindEl.remove();
      }
    };

    if (chart && chart.trim()) {
      renderChart();
    }
  }, [chart]);

  if (error) {
    return (
      <div className="my-4 p-3.5 bg-neon-pink/5 border border-neon-pink/20 text-neon-pink rounded-xl text-xs font-mono cyber-clip">
        <div className="font-semibold mb-1 text-neon-pink cyber-glow-text-pink">Mermaid Render Warning:</div>
        <p className="text-[10px] text-neon-pink/80 mb-2">{error}</p>
        <pre className="p-2 bg-[#050508]/80 border border-neon-pink/15 rounded overflow-x-auto leading-relaxed max-h-36 overflow-y-auto text-slate-400 select-text">
          {chart}
        </pre>
      </div>
    );
  }

  if (!svg) {
    return (
      <div className="my-4 py-6 bg-[#0a0e17]/40 border border-neon-cyan/15 rounded-xl flex items-center justify-center text-[10px] text-neon-cyan/70 font-mono animate-pulse">
        Compiling diagram...
      </div>
    );
  }

  return (
    <div 
      className="my-4 p-4 bg-[#0a0e17]/80 border border-neon-cyan/20 rounded-xl flex justify-center overflow-x-auto shadow-inner select-none no-drag-region cyber-glow-cyan cyber-clip"
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
};
