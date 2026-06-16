import React, { useState, useEffect } from "react";
import { useJarvisStore } from "../store";
import { Cpu, Globe, Key, Eye, EyeOff, Save, Activity, CheckCircle, AlertCircle, Loader2 } from "lucide-react";

export const SettingsWindow: React.FC = () => {
  const { settings, fetchSettings, saveSetting, testSettings } = useJarvisStore();

  const [activeProvider, setActiveProvider] = useState<string>("local");
  
  // Local Ollama fields
  const [localModel, setLocalModel] = useState<string>("qwen3.5:9b");
  const [localHost, setLocalHost] = useState<string>("http://localhost:11434");

  // OpenAI fields
  const [openaiKey, setOpenaiKey] = useState<string>("");
  const [openaiModel, setOpenaiModel] = useState<string>("gpt-4o-mini");
  const [openaiBaseUrl, setOpenaiBaseUrl] = useState<string>("https://api.openai.com/v1");

  // Anthropic fields
  const [anthropicKey, setAnthropicKey] = useState<string>("");
  const [anthropicModel, setAnthropicModel] = useState<string>("claude-3-5-sonnet-latest");

  // Gemini fields
  const [geminiKey, setGeminiKey] = useState<string>("");
  const [geminiModel, setGeminiModel] = useState<string>("gemini-1.5-flash");

  // Nvidia NIM fields
  const [nvidiaKey, setNvidiaKey] = useState<string>("");
  const [nvidiaModel, setNvidiaModel] = useState<string>("minimaxai/minimax-m3");
  const [nvidiaBaseUrl, setNvidiaBaseUrl] = useState<string>("https://integrate.api.nvidia.com/v1");

  // Password visibility
  const [showOpenaiKey, setShowOpenaiKey] = useState<boolean>(false);
  const [showAnthropicKey, setShowAnthropicKey] = useState<boolean>(false);
  const [showGeminiKey, setShowGeminiKey] = useState<boolean>(false);
  const [showNvidiaKey, setShowNvidiaKey] = useState<boolean>(false);

  // Testing & Save states
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testResult, setTestResult] = useState<{ status: "ok" | "error" | null; message: string }>({
    status: null,
    message: "",
  });
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  // Load existing settings on mount
  useEffect(() => {
    const load = async () => {
      await fetchSettings();
    };
    load();
  }, [fetchSettings]);

  // Sync state with settings values when settings are loaded/fetched
  useEffect(() => {
    if (Object.keys(settings).length > 0) {
      if (settings.provider) setActiveProvider(settings.provider);
      
      if (settings.local_model) setLocalModel(settings.local_model);
      if (settings.local_host) setLocalHost(settings.local_host);
      
      if (settings.openai_key) setOpenaiKey(settings.openai_key);
      if (settings.openai_model) setOpenaiModel(settings.openai_model);
      if (settings.openai_base_url) setOpenaiBaseUrl(settings.openai_base_url);
      
      if (settings.anthropic_key) setAnthropicKey(settings.anthropic_key);
      if (settings.anthropic_model) setAnthropicModel(settings.anthropic_model);
      
      if (settings.gemini_key) setGeminiKey(settings.gemini_key);
      if (settings.gemini_model) setGeminiModel(settings.gemini_model);
      
      if (settings.nvidia_key) setNvidiaKey(settings.nvidia_key);
      if (settings.nvidia_model) setNvidiaModel(settings.nvidia_model);
      if (settings.nvidia_base_url) setNvidiaBaseUrl(settings.nvidia_base_url);
    }
  }, [settings]);

  // Prepare payload for active provider testing/saving
  const getActiveFieldsPayload = () => {
    return {
      provider: activeProvider,
      local_model: localModel,
      local_host: localHost,
      openai_key: openaiKey,
      openai_model: openaiModel,
      openai_base_url: openaiBaseUrl,
      anthropic_key: anthropicKey,
      anthropic_model: anthropicModel,
      gemini_key: geminiKey,
      gemini_model: geminiModel,
      nvidia_key: nvidiaKey,
      nvidia_model: nvidiaModel,
      nvidia_base_url: nvidiaBaseUrl,
    };
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult({ status: null, message: "" });
    try {
      const payload = getActiveFieldsPayload();
      const res = await testSettings(payload);
      setTestResult({
        status: res.status,
        message: res.message,
      });
    } catch (err: any) {
      setTestResult({
        status: "error",
        message: err.message || "Failed to reach backend test api.",
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveSettings = async () => {
    setIsSaving(true);
    setSaveSuccess(false);
    try {
      // Save all active settings variables sequentially
      await saveSetting("provider", activeProvider);
      
      if (activeProvider === "local") {
        await saveSetting("local_model", localModel);
        await saveSetting("local_host", localHost);
      } else if (activeProvider === "openai") {
        await saveSetting("openai_key", openaiKey);
        await saveSetting("openai_model", openaiModel);
        await saveSetting("openai_base_url", openaiBaseUrl);
      } else if (activeProvider === "anthropic") {
        await saveSetting("anthropic_key", anthropicKey);
        await saveSetting("anthropic_model", anthropicModel);
      } else if (activeProvider === "gemini") {
        await saveSetting("gemini_key", geminiKey);
        await saveSetting("gemini_model", geminiModel);
      } else if (activeProvider === "nvidia") {
        await saveSetting("nvidia_key", nvidiaKey);
        await saveSetting("nvidia_model", nvidiaModel);
        await saveSetting("nvidia_base_url", nvidiaBaseUrl);
      }
      
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      console.error("Failed to commit settings:", err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-[#050508] text-slate-200 p-6 overflow-y-auto relative select-none">
      {/* Header section */}
      <div className="flex items-center justify-between border-b border-neon-cyan/20 pb-4 mb-6 relative">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded bg-neon-cyan/5 border border-neon-cyan/35 flex items-center justify-center shadow-[0_0_10px_rgba(0,240,255,0.2)] cyber-clip-sm">
            <Cpu className="w-5 h-5 text-neon-cyan" />
          </div>
          <div>
            <h1 className="font-bold font-mono tracking-widest text-white text-md uppercase cyber-glow-text-cyan">
              SYSTEM_CORE_CONFIGURATION
            </h1>
            <p className="text-[10px] text-slate-500 font-mono uppercase tracking-wider mt-0.5">
              Select active inference engines & authentication keys
            </p>
          </div>
        </div>
        <div className="text-[10px] font-mono bg-neon-cyan/5 text-neon-cyan border border-neon-cyan/25 px-2.5 py-1 rounded">
          CORE: ACTIVE
        </div>
      </div>

      {/* Select Inference Provider Cards */}
      <div className="mb-6">
        <h2 className="font-mono text-xs text-slate-400 font-semibold mb-3 tracking-widest uppercase">// inference_provider_selection</h2>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          {/* Local Ollama Card */}
          <div
            onClick={() => {
              setActiveProvider("local");
              setTestResult({ status: null, message: "" });
            }}
            className={`cursor-pointer p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all cyber-clip-sm ${
              activeProvider === "local"
                ? "bg-neon-cyan/5 border-neon-cyan shadow-[0_0_12px_rgba(0,240,255,0.15)] text-white"
                : "bg-[#0c0f16]/60 border-slate-900 text-slate-400 hover:border-slate-800 hover:text-slate-200"
            }`}
          >
            <Cpu className={`w-6 h-6 mb-2 ${activeProvider === "local" ? "text-neon-cyan" : "text-slate-500"}`} />
            <span className="font-bold text-xs tracking-wider">Local (Ollama)</span>
            <span className="text-[8px] font-mono text-slate-500 mt-1 uppercase">Offline core</span>
          </div>

          {/* OpenAI Card */}
          <div
            onClick={() => {
              setActiveProvider("openai");
              setTestResult({ status: null, message: "" });
            }}
            className={`cursor-pointer p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all cyber-clip-sm ${
              activeProvider === "openai"
                ? "bg-neon-cyan/5 border-neon-cyan shadow-[0_0_12px_rgba(0,240,255,0.15)] text-white"
                : "bg-[#0c0f16]/60 border-slate-900 text-slate-400 hover:border-slate-800 hover:text-slate-200"
            }`}
          >
            <Globe className={`w-6 h-6 mb-2 ${activeProvider === "openai" ? "text-neon-cyan" : "text-slate-500"}`} />
            <span className="font-bold text-xs tracking-wider">OpenAI (GPT)</span>
            <span className="text-[8px] font-mono text-slate-500 mt-1 uppercase">GPT-4o / Mini</span>
          </div>

          {/* Anthropic Card */}
          <div
            onClick={() => {
              setActiveProvider("anthropic");
              setTestResult({ status: null, message: "" });
            }}
            className={`cursor-pointer p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all cyber-clip-sm ${
              activeProvider === "anthropic"
                ? "bg-neon-cyan/5 border-neon-cyan shadow-[0_0_12px_rgba(0,240,255,0.15)] text-white"
                : "bg-[#0c0f16]/60 border-slate-900 text-slate-400 hover:border-slate-800 hover:text-slate-200"
            }`}
          >
            <Globe className={`w-6 h-6 mb-2 ${activeProvider === "anthropic" ? "text-neon-cyan" : "text-slate-500"}`} />
            <span className="font-bold text-xs tracking-wider">Claude (Anthropic)</span>
            <span className="text-[8px] font-mono text-slate-500 mt-1 uppercase">Claude 3.5 Sonnet</span>
          </div>

          {/* Gemini Card */}
          <div
            onClick={() => {
              setActiveProvider("gemini");
              setTestResult({ status: null, message: "" });
            }}
            className={`cursor-pointer p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all cyber-clip-sm ${
              activeProvider === "gemini"
                ? "bg-neon-cyan/5 border-neon-cyan shadow-[0_0_12px_rgba(0,240,255,0.15)] text-white"
                : "bg-[#0c0f16]/60 border-slate-900 text-slate-400 hover:border-slate-800 hover:text-slate-200"
            }`}
          >
            <Globe className={`w-6 h-6 mb-2 ${activeProvider === "gemini" ? "text-neon-cyan" : "text-slate-500"}`} />
            <span className="font-bold text-xs tracking-wider">Gemini (Google)</span>
            <span className="text-[8px] font-mono text-slate-500 mt-1 uppercase">Gemini 1.5 core</span>
          </div>

          {/* Nvidia NIM Card */}
          <div
            onClick={() => {
              setActiveProvider("nvidia");
              setTestResult({ status: null, message: "" });
            }}
            className={`cursor-pointer p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all cyber-clip-sm ${
              activeProvider === "nvidia"
                ? "bg-neon-cyan/5 border-neon-cyan shadow-[0_0_12px_rgba(0,240,255,0.15)] text-white"
                : "bg-[#0c0f16]/60 border-slate-900 text-slate-400 hover:border-slate-800 hover:text-slate-200"
            }`}
          >
            <Globe className={`w-6 h-6 mb-2 ${activeProvider === "nvidia" ? "text-neon-cyan" : "text-slate-500"}`} />
            <span className="font-bold text-xs tracking-wider">Nvidia NIM</span>
            <span className="text-[8px] font-mono text-slate-500 mt-1 uppercase">MiniMax-M3 core</span>
          </div>
        </div>
      </div>

      {/* Settings Form Container */}
      <div className="flex-1 bg-[#0a0c12]/80 border border-slate-900 rounded-2xl p-6 shadow-xl relative overflow-hidden cyber-clip">
        <div className="absolute inset-0.5 border border-white/5 rounded-2xl pointer-events-none" />

        {/* Selected Provider Form Header */}
        <div className="border-b border-slate-900 pb-3 mb-5 flex items-center justify-between">
          <div className="font-mono text-xs text-slate-400 font-bold uppercase">
            // active_settings_block: <span className="text-neon-cyan font-bold">{activeProvider.toUpperCase()}</span>
          </div>
          <span className="text-[8.5px] text-slate-500 font-mono tracking-widest uppercase">CONFIGURATION_FIELDS</span>
        </div>

        {/* Form Fields renderer */}
        <div className="space-y-4 max-w-2xl">
          {/* LOCAL OLLAMA FORM */}
          {activeProvider === "local" && (
            <>
              {/* Ollama Host */}
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase font-bold font-mono tracking-wider text-slate-400">Ollama API Host Endpoint</label>
                <div className="flex gap-2">
                  <div className="flex-1 bg-[#050508] border border-slate-800 focus-within:border-neon-cyan/50 rounded-lg flex items-center px-3 py-2 transition-all">
                    <Globe className="w-4 h-4 text-slate-500 mr-2.5 shrink-0" />
                    <input
                      type="text"
                      value={localHost}
                      onChange={(e) => setLocalHost(e.target.value)}
                      placeholder="e.g. http://localhost:11434"
                      className="bg-transparent text-white border-0 outline-none w-full text-xs font-mono"
                    />
                  </div>
                </div>
              </div>

              {/* Ollama Model Name */}
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase font-bold font-mono tracking-wider text-slate-400">Model Identifier Name</label>
                <div className="bg-[#050508] border border-slate-800 focus-within:border-neon-cyan/50 rounded-lg flex items-center px-3 py-2 transition-all">
                  <Cpu className="w-4 h-4 text-slate-500 mr-2.5 shrink-0" />
                  <input
                    type="text"
                    value={localModel}
                    onChange={(e) => setLocalModel(e.target.value)}
                    placeholder="e.g. qwen3.5:9b or llama3"
                    className="bg-transparent text-white border-0 outline-none w-full text-xs font-mono"
                  />
                </div>
                <p className="text-[9px] text-slate-500 font-mono">Make sure this model is already downloaded in Ollama (`ollama pull &lt;name&gt;`).</p>
              </div>
            </>
          )}

          {/* OPENAI FORM */}
          {activeProvider === "openai" && (
            <>
              {/* API Key */}
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase font-bold font-mono tracking-wider text-slate-400">OpenAI API Authentication Key</label>
                <div className="bg-[#050508] border border-slate-800 focus-within:border-neon-cyan/50 rounded-lg flex items-center px-3 py-2 transition-all">
                  <Key className="w-4 h-4 text-slate-500 mr-2.5 shrink-0" />
                  <input
                    type={showOpenaiKey ? "text" : "password"}
                    value={openaiKey}
                    onChange={(e) => setOpenaiKey(e.target.value)}
                    placeholder="sk-..."
                    className="bg-transparent text-white border-0 outline-none w-full text-xs font-mono"
                  />
                  <button onClick={() => setShowOpenaiKey(!showOpenaiKey)} className="text-slate-400 hover:text-slate-200 transition-colors ml-2 cursor-pointer">
                    {showOpenaiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Model Name */}
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase font-bold font-mono tracking-wider text-slate-400">Model Name</label>
                <div className="bg-[#050508] border border-slate-800 focus-within:border-neon-cyan/50 rounded-lg flex items-center px-3 py-2 transition-all">
                  <Cpu className="w-4 h-4 text-slate-500 mr-2.5 shrink-0" />
                  <input
                    type="text"
                    value={openaiModel}
                    onChange={(e) => setOpenaiModel(e.target.value)}
                    placeholder="e.g. gpt-4o-mini"
                    className="bg-transparent text-white border-0 outline-none w-full text-xs font-mono"
                  />
                </div>
              </div>

              {/* Base URL */}
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase font-bold font-mono tracking-wider text-slate-400">API Endpoint Base URL (Optional)</label>
                <div className="bg-[#050508] border border-slate-800 focus-within:border-neon-cyan/50 rounded-lg flex items-center px-3 py-2 transition-all">
                  <Globe className="w-4 h-4 text-slate-500 mr-2.5 shrink-0" />
                  <input
                    type="text"
                    value={openaiBaseUrl}
                    onChange={(e) => setOpenaiBaseUrl(e.target.value)}
                    placeholder="https://api.openai.com/v1"
                    className="bg-transparent text-white border-0 outline-none w-full text-xs font-mono"
                  />
                </div>
              </div>
            </>
          )}

          {/* ANTHROPIC FORM */}
          {activeProvider === "anthropic" && (
            <>
              {/* API Key */}
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase font-bold font-mono tracking-wider text-slate-400">Anthropic API Authentication Key</label>
                <div className="bg-[#050508] border border-slate-800 focus-within:border-neon-cyan/50 rounded-lg flex items-center px-3 py-2 transition-all">
                  <Key className="w-4 h-4 text-slate-500 mr-2.5 shrink-0" />
                  <input
                    type={showAnthropicKey ? "text" : "password"}
                    value={anthropicKey}
                    onChange={(e) => setAnthropicKey(e.target.value)}
                    placeholder="sk-ant-..."
                    className="bg-transparent text-white border-0 outline-none w-full text-xs font-mono"
                  />
                  <button onClick={() => setShowAnthropicKey(!showAnthropicKey)} className="text-slate-400 hover:text-slate-200 transition-colors ml-2 cursor-pointer">
                    {showAnthropicKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Model Name */}
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase font-bold font-mono tracking-wider text-slate-400">Model Name</label>
                <div className="bg-[#050508] border border-slate-800 focus-within:border-neon-cyan/50 rounded-lg flex items-center px-3 py-2 transition-all">
                  <Cpu className="w-4 h-4 text-slate-500 mr-2.5 shrink-0" />
                  <input
                    type="text"
                    value={anthropicModel}
                    onChange={(e) => setAnthropicModel(e.target.value)}
                    placeholder="e.g. claude-3-5-sonnet-latest"
                    className="bg-transparent text-white border-0 outline-none w-full text-xs font-mono"
                  />
                </div>
              </div>
            </>
          )}

          {/* GEMINI FORM */}
          {activeProvider === "gemini" && (
            <>
              {/* API Key */}
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase font-bold font-mono tracking-wider text-slate-400">Google Gemini API Key</label>
                <div className="bg-[#050508] border border-slate-800 focus-within:border-neon-cyan/50 rounded-lg flex items-center px-3 py-2 transition-all">
                  <Key className="w-4 h-4 text-slate-500 mr-2.5 shrink-0" />
                  <input
                    type={showGeminiKey ? "text" : "password"}
                    value={geminiKey}
                    onChange={(e) => setGeminiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="bg-transparent text-white border-0 outline-none w-full text-xs font-mono"
                  />
                  <button onClick={() => setShowGeminiKey(!showGeminiKey)} className="text-slate-400 hover:text-slate-200 transition-colors ml-2 cursor-pointer">
                    {showGeminiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Model Name */}
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase font-bold font-mono tracking-wider text-slate-400">Model Name</label>
                <div className="bg-[#050508] border border-slate-800 focus-within:border-neon-cyan/50 rounded-lg flex items-center px-3 py-2 transition-all">
                  <Cpu className="w-4 h-4 text-slate-500 mr-2.5 shrink-0" />
                  <input
                    type="text"
                    value={geminiModel}
                    onChange={(e) => setGeminiModel(e.target.value)}
                    placeholder="e.g. gemini-1.5-flash"
                    className="bg-transparent text-white border-0 outline-none w-full text-xs font-mono"
                  />
                </div>
              </div>
            </>
          )}

          {/* NVIDIA NIM FORM */}
          {activeProvider === "nvidia" && (
            <>
              {/* API Key */}
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase font-bold font-mono tracking-wider text-slate-400">Nvidia NIM API Key</label>
                <div className="bg-[#050508] border border-slate-800 focus-within:border-neon-cyan/50 rounded-lg flex items-center px-3 py-2 transition-all">
                  <Key className="w-4 h-4 text-slate-500 mr-2.5 shrink-0" />
                  <input
                    type={showNvidiaKey ? "text" : "password"}
                    value={nvidiaKey}
                    onChange={(e) => setNvidiaKey(e.target.value)}
                    placeholder="nvapi-..."
                    className="bg-transparent text-white border-0 outline-none w-full text-xs font-mono"
                  />
                  <button onClick={() => setShowNvidiaKey(!showNvidiaKey)} className="text-slate-400 hover:text-slate-200 transition-colors ml-2 cursor-pointer">
                    {showNvidiaKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* Model Name */}
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase font-bold font-mono tracking-wider text-slate-400">Model Name</label>
                <div className="bg-[#050508] border border-slate-800 focus-within:border-neon-cyan/50 rounded-lg flex items-center px-3 py-2 transition-all">
                  <Cpu className="w-4 h-4 text-slate-500 mr-2.5 shrink-0" />
                  <input
                    type="text"
                    value={nvidiaModel}
                    onChange={(e) => setNvidiaModel(e.target.value)}
                    placeholder="e.g. minimaxai/minimax-m3"
                    className="bg-transparent text-white border-0 outline-none w-full text-xs font-mono"
                  />
                </div>
              </div>

              {/* Base URL */}
              <div className="space-y-1.5">
                <label className="block text-[10px] uppercase font-bold font-mono tracking-wider text-slate-400">Nvidia Base Endpoint URL</label>
                <div className="bg-[#050508] border border-slate-800 focus-within:border-neon-cyan/50 rounded-lg flex items-center px-3 py-2 transition-all">
                  <Globe className="w-4 h-4 text-slate-500 mr-2.5 shrink-0" />
                  <input
                    type="text"
                    value={nvidiaBaseUrl}
                    onChange={(e) => setNvidiaBaseUrl(e.target.value)}
                    placeholder="https://integrate.api.nvidia.com/v1"
                    className="bg-transparent text-white border-0 outline-none w-full text-xs font-mono"
                  />
                </div>
              </div>
            </>
          )}

          {/* Connection Test Results */}
          {testResult.status !== null && (
            <div className={`flex items-start gap-3 p-3 rounded-lg border text-xs font-mono leading-relaxed ${
              testResult.status === "ok"
                ? "bg-neon-green/5 border-neon-green/30 text-neon-green shadow-[0_0_8px_rgba(57,255,20,0.05)]"
                : "bg-neon-pink/5 border-neon-pink/30 text-neon-pink shadow-[0_0_8px_rgba(255,45,120,0.05)]"
            }`}>
              {testResult.status === "ok" ? (
                <CheckCircle className="w-4 h-4 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              )}
              <div>
                <span className="font-bold uppercase tracking-wider">{testResult.status === "ok" ? "SUCCESS" : "TEST_CONNECTION_FAILED"}:</span>
                <p className="mt-0.5 text-[11px] opacity-90">{testResult.message}</p>
              </div>
            </div>
          )}

          {/* Form Actions Section */}
          <div className="flex gap-3 pt-4 border-t border-slate-900 mt-6 select-none">
            {/* Test Connection Button */}
            <button
              onClick={handleTestConnection}
              disabled={isTesting || isSaving}
              className="px-4 py-2 bg-transparent hover:bg-neon-cyan/5 text-neon-cyan border border-neon-cyan/35 font-mono text-xs uppercase tracking-wider rounded-lg transition-all active:scale-95 disabled:opacity-40 flex items-center gap-2 cursor-pointer cyber-clip-sm"
            >
              {isTesting ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>TESTING_LINK...</span>
                </>
              ) : (
                <>
                  <Activity className="w-3.5 h-3.5" />
                  <span>TEST_CONNECTION</span>
                </>
              )}
            </button>

            {/* Save Button */}
            <button
              onClick={handleSaveSettings}
              disabled={isTesting || isSaving}
              className="px-5 py-2 bg-neon-cyan text-black hover:bg-neon-cyan/95 font-semibold text-xs uppercase tracking-widest rounded-lg shadow-[0_0_10px_rgba(0,240,255,0.25)] transition-all active:scale-95 disabled:opacity-40 flex items-center gap-2 cursor-pointer cyber-clip-sm"
            >
              {isSaving ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>SAVING...</span>
                </>
              ) : (
                <>
                  <Save className="w-3.5 h-3.5" />
                  <span>SAVE_CHANGES</span>
                </>
              )}
            </button>

            {/* Success notification flag */}
            {saveSuccess && (
              <div className="flex items-center gap-1.5 text-xs text-neon-green font-mono bg-neon-green/5 border border-neon-green/20 px-3 py-1 rounded shadow-[0_0_6px_rgba(57,255,20,0.1)]">
                <CheckCircle className="w-3.5 h-3.5" />
                <span>COMMITTED_SUCCESSFULLY</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
