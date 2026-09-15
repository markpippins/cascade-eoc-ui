import React, { useState, useEffect, useRef } from 'react';
import { 
  Play, 
  Sparkles, 
  Layers, 
  Terminal, 
  CheckCircle2, 
  Clock, 
  ArrowRight, 
  GitFork, 
  Workflow, 
  Cpu, 
  Bot, 
  RefreshCw,
  Copy,
  Bell,
  BellRing,
  BellOff,
  AlertTriangle,
  Zap,
  Sliders,
  Activity,
  Volume2,
  VolumeX,
  Gauge
} from 'lucide-react';
import { useAppTheme } from '../context/ThemeContext';
import { EventEnvelope } from '../types';
import { cascadeStore } from '../services/cascadeService';
import { ToastContainer, ToastMessage } from './Toast';

interface SimulatorViewProps {
  onSelectEvent: (event: EventEnvelope) => void;
  onOpenLineage: (eventId: string) => void;
  onOpenPipeline: (correlationId: string) => void;
}

interface StepLog {
  timestamp: string;
  phase: string;
  event: EventEnvelope;
}

export const SimulatorView: React.FC<SimulatorViewProps> = ({
  onSelectEvent,
  onOpenLineage,
  onOpenPipeline
}) => {
  const { themeClasses, isSteel, isDark } = useAppTheme();

  const presets = [
    {
      title: 'Customer Voice Call: WebSocket Audio Frame Drops',
      source: 'gong.customer_interview_uber',
      text: 'During our weekly trading sync, the VP of Platform noted 250ms audio jitter during peak transcription. They requested non-blocking ring buffers and persistent keepalive heartbeats before scaling to 50k concurrent agents.'
    },
    {
      title: 'Security Compliance Audit: Enterprise SCIM Provisioning',
      source: 'zoom.security_audit_bank_corp',
      text: 'SOC2 Type II external audit requires automated user deprovisioning via Okta SCIM v2. We must bridge SAML 2.0 assertion attributes and audit all role changes in immutable cascade ledger.'
    },
    {
      title: 'Database Architecture: PostgreSQL Range Partitioning',
      source: 'slack_huddle.db_infra_wg',
      text: 'Cascade events table is exceeding 200M rows with 30-day analytics queries taking over 4 seconds. We need automated monthly range partitions with pg_partman to keep index memory footprint below 8GB.'
    }
  ];

  const [selectedPresetIndex, setSelectedPresetIndex] = useState<number>(0);
  const [sourceOrigin, setSourceOrigin] = useState<string>(presets[0].source);
  const [transcript, setTranscript] = useState<string>(presets[0].text);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isBursting, setIsBursting] = useState<boolean>(false);
  const [logs, setLogs] = useState<StepLog[]>([]);
  const [finishedCorrelationId, setFinishedCorrelationId] = useState<string | null>(null);

  // Rate Monitoring & Threshold Alert State
  const [rateAlertEnabled, setRateAlertEnabled] = useState<boolean>(true);
  const [rateThreshold, setRateThreshold] = useState<number>(10); // EPS
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);
  const [currentRate, setCurrentRate] = useState<number>(0);
  const [peakRate, setPeakRate] = useState<number>(0);
  const [totalSimulatedEvents, setTotalSimulatedEvents] = useState<number>(0);
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Sliding window timestamps for rate calculation
  const eventTimestampsRef = useRef<number[]>([]);
  const lastToastTimeRef = useRef<number>(0);

  // Sound generator using Web Audio API
  const playAlertChime = () => {
    if (!soundEnabled) return;
    try {
      const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioContextClass) return;
      const ctx = new AudioContextClass();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      
      osc.type = 'sine';
      osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      osc.frequency.exponentialRampToValueAtTime(880, ctx.currentTime + 0.15); // A5
      
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start();
      osc.stop(ctx.currentTime + 0.35);
    } catch (e) {
      // AudioContext might be blocked until user gesture, safely ignore
    }
  };

  // Record an emitted event in the rate tracker
  const trackEmittedEvent = () => {
    const now = Date.now();
    eventTimestampsRef.current.push(now);
    setTotalSimulatedEvents(prev => prev + 1);
  };

  // Subscribe to store events to track background events as well
  useEffect(() => {
    const unsubscribe = cascadeStore.subscribe(() => {
      // Store state updated
    });
    return unsubscribe;
  }, []);

  // Periodic Rate Calculation & Threshold Check Loop (runs every 200ms)
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now();
      // Keep events from the last 2 seconds
      eventTimestampsRef.current = eventTimestampsRef.current.filter(t => now - t <= 2000);
      
      const count = eventTimestampsRef.current.length;
      // Calculate rate as events per second (2s window -> count / 2)
      const calculatedRate = Number((count / 2).toFixed(1));
      setCurrentRate(calculatedRate);
      
      setPeakRate(prev => Math.max(prev, calculatedRate));

      // Check if rate exceeds defined threshold
      if (rateAlertEnabled && calculatedRate > rateThreshold) {
        const timeSinceLastToast = now - lastToastTimeRef.current;
        // Cooldown: at most one toast every 4 seconds
        if (timeSinceLastToast > 4000) {
          lastToastTimeRef.current = now;
          playAlertChime();

          const newToast: ToastMessage = {
            id: `rate-alert-${now}`,
            type: calculatedRate > rateThreshold * 1.5 ? 'error' : 'warning',
            title: `High Ingestion Rate Threshold Exceeded!`,
            message: `Current event rate is ${calculatedRate.toFixed(1)} EPS, exceeding your alert limit of ${rateThreshold} EPS.`,
            metric: `🔥 ${calculatedRate.toFixed(1)} EPS / ${rateThreshold} EPS Max`,
            timestamp: new Date().toLocaleTimeString(),
            durationMs: 5500
          };

          setToasts(prev => [newToast, ...prev.slice(0, 3)]); // Keep max 4 toasts
        }
      }
    }, 200);

    return () => clearInterval(interval);
  }, [rateAlertEnabled, rateThreshold, soundEnabled]);

  const handleDismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleClearAllToasts = () => {
    setToasts([]);
  };

  const handleApplyPreset = (idx: number) => {
    setSelectedPresetIndex(idx);
    setSourceOrigin(presets[idx].source);
    setTranscript(presets[idx].text);
  };

  // Standard Lifecycle Simulation
  const handleRunPipeline = async () => {
    if (isRunning || !transcript.trim()) return;

    setIsRunning(true);
    setLogs([]);
    setFinishedCorrelationId(null);

    const corrId = await cascadeStore.injectCustomWorkflow(
      transcript,
      sourceOrigin || 'console.manual_ingestion',
      (phase, evt) => {
        trackEmittedEvent();
        setLogs(prev => [...prev, {
          timestamp: new Date().toLocaleTimeString(),
          phase,
          event: evt
        }]);
      }
    );

    setFinishedCorrelationId(corrId);
    setIsRunning(false);
  };

  // High-Throughput Burst Test Simulation (specifically designed to demonstrate the rate threshold alert)
  const handleRunBurstTest = async (targetRate: number, totalEvents: number = 25) => {
    if (isBursting) return;
    setIsBursting(true);

    const delayBetweenEvents = Math.max(20, Math.floor(1000 / targetRate));
    let emitted = 0;

    const timer = setInterval(() => {
      cascadeStore.simulateNextRandomEvent();
      trackEmittedEvent();
      emitted++;

      if (emitted >= totalEvents) {
        clearInterval(timer);
        setIsBursting(false);
      }
    }, delayBetweenEvents);
  };

  // Calculate percentage of threshold for the visual gauge
  const ratePercentage = Math.min(150, Math.round((currentRate / Math.max(1, rateThreshold)) * 100));
  const isRateExceeded = currentRate > rateThreshold;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto custom-scrollbar relative">
      {/* Floating Toast Notification Container */}
      <ToastContainer
        toasts={toasts}
        onDismiss={handleDismissToast}
        onClearAll={handleClearAllToasts}
      />

      {/* Header Info */}
      <div className={`p-4 rounded-xl border ${themeClasses.border} ${themeClasses.bgCard} shadow-sm space-y-1`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-sky-400" />
              <span>Ingestion & Autonomous Execution Pipeline Simulator</span>
            </h2>
            <p className={`text-xs ${themeClasses.textMuted}`}>
              Input raw meeting transcripts, generate high-throughput burst streams, and configure real-time event rate threshold alerts.
            </p>
          </div>

          {/* Quick Header Rate Badge */}
          <div className="flex items-center space-x-3">
            <div className={`px-3 py-1.5 rounded-lg border text-xs font-mono flex items-center space-x-2 ${
              isRateExceeded 
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse' 
                : `${themeClasses.bgMuted} ${themeClasses.borderSubtle} text-slate-300`
            }`}>
              <Activity className={`w-3.5 h-3.5 ${isRateExceeded ? 'text-rose-400' : 'text-emerald-400'}`} />
              <span>Current Rate: <strong className={isRateExceeded ? 'text-rose-300' : 'text-slate-100'}>{currentRate.toFixed(1)} EPS</strong></span>
            </div>
          </div>
        </div>
      </div>

      {/* Rate Monitoring & Alert Notification Configuration Panel */}
      <div className={`p-5 rounded-xl border ${isRateExceeded && rateAlertEnabled ? 'border-amber-500/60 bg-amber-950/20' : themeClasses.border} ${themeClasses.bgCard} shadow-md space-y-4`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-3">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-lg ${rateAlertEnabled ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 'bg-slate-800 text-slate-500'}`}>
              {rateAlertEnabled ? <BellRing className="w-4 h-4 animate-bounce" /> : <BellOff className="w-4 h-4" />}
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-100 font-mono flex items-center space-x-2">
                <span>Event Ingestion Rate & Surge Threshold Monitor</span>
                {rateAlertEnabled && (
                  <span className="px-2 py-0.2 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    ALERTS ACTIVE
                  </span>
                )}
              </h3>
              <p className={`text-xs ${themeClasses.textMuted}`}>
                Triggers an automated floating toast alert whenever the live event stream exceeds your defined rate threshold.
              </p>
            </div>
          </div>

          {/* Toggle Controls */}
          <div className="flex items-center space-x-3">
            {/* Audio Sound Toggle */}
            <button
              onClick={() => setSoundEnabled(!soundEnabled)}
              className={`p-2 rounded-lg border text-xs font-mono transition-all flex items-center space-x-1.5 ${
                soundEnabled 
                  ? 'bg-slate-800 text-sky-300 border-sky-500/30' 
                  : 'bg-slate-900 text-slate-500 border-slate-800'
              }`}
              title={soundEnabled ? 'Alert Chime Sound: ON' : 'Alert Chime Sound: OFF'}
            >
              {soundEnabled ? <Volume2 className="w-3.5 h-3.5 text-sky-400" /> : <VolumeX className="w-3.5 h-3.5 text-slate-500" />}
              <span className="text-[11px]">{soundEnabled ? 'Chime ON' : 'Muted'}</span>
            </button>

            {/* Rate Alert Toggle Switch */}
            <div className="flex items-center space-x-2 bg-slate-900/80 p-1.5 rounded-xl border border-slate-800">
              <span className="text-[11px] font-mono text-slate-400 px-1">Alert Toast:</span>
              <button
                onClick={() => setRateAlertEnabled(!rateAlertEnabled)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${
                  rateAlertEnabled ? 'bg-amber-500' : 'bg-slate-700'
                }`}
                role="switch"
                aria-checked={rateAlertEnabled}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    rateAlertEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
              <span className={`text-xs font-mono font-bold px-1 ${rateAlertEnabled ? 'text-amber-300' : 'text-slate-500'}`}>
                {rateAlertEnabled ? 'ENABLED' : 'DISABLED'}
              </span>
            </div>
          </div>
        </div>

        {/* Live Gauge Meter & Threshold Slider Grid */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-center">
          {/* Left: Threshold Configuration */}
          <div className="md:col-span-6 space-y-3">
            <div className="flex items-center justify-between text-xs font-mono">
              <label className="font-bold text-slate-300 flex items-center space-x-1.5">
                <Sliders className="w-3.5 h-3.5 text-sky-400" />
                <span>Defined Rate Threshold (Events / Sec):</span>
              </label>
              <span className="font-bold text-amber-400 px-2 py-0.5 rounded bg-slate-900 border border-slate-800">
                {rateThreshold} EPS
              </span>
            </div>

            {/* Slider */}
            <input
              type="range"
              min="2"
              max="40"
              step="1"
              value={rateThreshold}
              onChange={(e) => setRateThreshold(Number(e.target.value))}
              className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
            />

            {/* Quick Threshold Presets */}
            <div className="flex items-center space-x-2 pt-1">
              <span className="text-[10px] font-mono text-slate-500 uppercase">Presets:</span>
              {[5, 10, 15, 25].map(val => (
                <button
                  key={val}
                  onClick={() => setRateThreshold(val)}
                  className={`px-2 py-0.5 rounded text-[10px] font-mono border transition-all ${
                    rateThreshold === val
                      ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 font-bold'
                      : `${themeClasses.bgMuted} text-slate-400 border-transparent hover:text-slate-200`
                  }`}
                >
                  {val} EPS
                </button>
              ))}
            </div>
          </div>

          {/* Right: Live Ingestion Throughput Meter */}
          <div className="md:col-span-6 space-y-2 p-3.5 rounded-xl bg-slate-900/60 border border-slate-800">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-slate-400 flex items-center space-x-1.5">
                <Gauge className="w-3.5 h-3.5 text-emerald-400" />
                <span>Live Throughput vs Limit:</span>
              </span>
              <div className="space-x-3 text-[11px]">
                <span className="text-slate-400">Peak: <strong className="text-slate-200">{peakRate.toFixed(1)} EPS</strong></span>
                <span className={isRateExceeded ? 'text-rose-400 font-bold' : 'text-emerald-400'}>
                  {isRateExceeded ? '⚠️ EXCEEDED' : '🟢 NOMINAL'}
                </span>
              </div>
            </div>

            {/* Visual Meter Bar */}
            <div className="relative w-full bg-slate-800/80 rounded-full h-3 overflow-hidden border border-slate-700">
              <div
                className={`h-full transition-all duration-200 rounded-full ${
                  isRateExceeded ? 'bg-gradient-to-r from-amber-500 to-rose-500' : 'bg-emerald-400'
                }`}
                style={{ width: `${Math.min(100, (currentRate / 40) * 100)}%` }}
              />
              {/* Threshold Target Line */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-amber-300 shadow-sm z-10"
                style={{ left: `${Math.min(100, (rateThreshold / 40) * 100)}%` }}
                title={`Threshold: ${rateThreshold} EPS`}
              />
            </div>

            {/* Quick Test Burst Buttons */}
            <div className="flex items-center justify-between pt-1 text-[10px] font-mono">
              <span className="text-slate-500">Test Alert Behavior:</span>
              <div className="flex items-center space-x-2">
                <button
                  disabled={isBursting}
                  onClick={() => handleRunBurstTest(rateThreshold + 8, 20)}
                  className="px-2 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold transition-all flex items-center space-x-1"
                >
                  <Zap className="w-3 h-3 text-amber-400" />
                  <span>Trigger Alert Burst ({rateThreshold + 8} EPS)</span>
                </button>
                <button
                  disabled={isBursting}
                  onClick={() => handleRunBurstTest(Math.max(2, Math.floor(rateThreshold / 2)), 10)}
                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-all"
                >
                  <span>Nominal Burst ({Math.max(2, Math.floor(rateThreshold / 2))} EPS)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Input Configuration */}
        <div className={`lg:col-span-5 p-5 rounded-xl border ${themeClasses.border} ${themeClasses.bgCard} shadow-md space-y-4`}>
          <div className="space-y-2">
            <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${themeClasses.textMuted}`}>
              Select Transcript Preset
            </span>
            <div className="space-y-2">
              {presets.map((p, idx) => (
                <button
                  key={idx}
                  onClick={() => handleApplyPreset(idx)}
                  className={`w-full text-left p-2.5 rounded-lg border text-xs font-mono transition-all ${
                    selectedPresetIndex === idx
                      ? 'bg-sky-500/15 border-sky-500/40 text-sky-300 font-semibold'
                      : `${themeClasses.borderSubtle} ${themeClasses.bgMuted} ${themeClasses.textSecondary} hover:text-slate-200`
                  }`}
                >
                  <div className="font-bold truncate">{p.title}</div>
                  <div className="text-[10px] text-slate-500 truncate mt-0.5">{p.source}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Source Origin Input */}
          <div className="space-y-1">
            <label className={`block text-[10px] font-mono font-bold uppercase tracking-wider ${themeClasses.textMuted}`}>
              Source Origin Producer
            </label>
            <input
              type="text"
              value={sourceOrigin}
              onChange={(e) => setSourceOrigin(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg text-xs font-mono border ${themeClasses.border} ${themeClasses.inputBg} ${themeClasses.textPrimary}`}
            />
          </div>

          {/* Transcript Textarea */}
          <div className="space-y-1">
            <label className={`block text-[10px] font-mono font-bold uppercase tracking-wider ${themeClasses.textMuted}`}>
              Harvest Transcript Excerpt / Meeting Notes
            </label>
            <textarea
              rows={4}
              value={transcript}
              onChange={(e) => setTranscript(e.target.value)}
              className={`w-full p-3 rounded-lg text-xs font-mono border ${themeClasses.border} ${themeClasses.inputBg} ${themeClasses.textPrimary} resize-none`}
              placeholder="Paste audio transcript or problem statement..."
            />
          </div>

          {/* Run Button */}
          <button
            disabled={isRunning || isBursting || !transcript.trim()}
            onClick={handleRunPipeline}
            className={`w-full py-3 rounded-xl font-bold text-xs shadow-lg transition-all flex items-center justify-center space-x-2 ${
              isRunning || isBursting
                ? 'bg-slate-700 text-slate-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-sky-500 to-indigo-600 hover:from-sky-400 hover:to-indigo-500 text-white shadow-sky-500/20'
            }`}
          >
            {isRunning ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin text-sky-300" />
                <span>Simulating Autonomous Workflow Progression...</span>
              </>
            ) : isBursting ? (
              <>
                <Zap className="w-4 h-4 animate-bounce text-amber-300" />
                <span>Emitting High-Throughput Burst Stream...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4" />
                <span>Ingest & Execute End-to-End Pipeline</span>
              </>
            )}
          </button>
        </div>

        {/* Right Live Stepper & Terminal Log */}
        <div className={`lg:col-span-7 p-5 rounded-xl border ${themeClasses.border} ${themeClasses.bgCard} shadow-md space-y-4 flex flex-col justify-between`}>
          <div>
            <div className="flex items-center justify-between border-b pb-3 border-slate-800/80">
              <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
                <Terminal className="w-4 h-4 text-emerald-400" />
                <span>Live Autonomous Execution Log</span>
              </h3>
              <div className="flex items-center space-x-3 text-xs font-mono text-slate-400">
                <span>Total Emitted: <strong className="text-slate-200">{totalSimulatedEvents}</strong></span>
                <span>{logs.length} / 7 Envelopes</span>
              </div>
            </div>

            {/* Stepper output */}
            <div className="mt-4 space-y-3 max-h-[380px] overflow-y-auto custom-scrollbar pr-1">
              {logs.length === 0 ? (
                <div className="py-20 text-center text-slate-500 font-mono text-xs space-y-2">
                  <div>Ready. Click "Ingest & Execute End-to-End Pipeline" to trigger autonomous pipeline run.</div>
                  <div className="text-[11px] text-slate-600">Or use "Trigger Alert Burst" above to test threshold rate warnings.</div>
                </div>
              ) : (
                logs.map((item, idx) => (
                  <div
                    key={idx}
                    onClick={() => onSelectEvent(item.event)}
                    className={`p-3 rounded-lg border ${themeClasses.borderSubtle} ${themeClasses.codeBg} hover:border-sky-400 transition-all cursor-pointer group flex items-start justify-between`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        <span className="text-xs font-mono font-bold text-slate-200 group-hover:text-sky-300">
                          {item.phase}
                        </span>
                      </div>
                      <div className="text-[11px] font-mono text-sky-400">
                        {item.event.event_type} (Seq #{item.event.sequence_number})
                      </div>
                      <div className="text-[10px] font-mono text-slate-500">
                        Producer: {item.event.source}
                      </div>
                    </div>

                    <span className="text-[10px] font-mono text-slate-500">
                      {item.timestamp}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Finished Action Bar */}
          {finishedCorrelationId && (
            <div className="pt-3 border-t border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3 animate-fadeIn">
              <div className="text-xs font-mono text-emerald-400 font-semibold flex items-center space-x-1">
                <CheckCircle2 className="w-4 h-4" />
                <span>Workflow Successfully Persisted in Ledger</span>
              </div>
              <div className="flex items-center space-x-2">
                <button
                  onClick={() => onOpenPipeline(finishedCorrelationId)}
                  className="px-3 py-1.5 rounded-lg bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30 border border-indigo-500/30 text-xs font-mono font-semibold transition-all flex items-center space-x-1"
                >
                  <Workflow className="w-3.5 h-3.5" />
                  <span>View Swimlane</span>
                </button>
                {logs[0] && (
                  <button
                    onClick={() => onOpenLineage(logs[0].event.event_id)}
                    className="px-3 py-1.5 rounded-lg bg-sky-500/20 text-sky-300 hover:bg-sky-500/30 border border-sky-500/30 text-xs font-mono font-semibold transition-all flex items-center space-x-1"
                  >
                    <GitFork className="w-3.5 h-3.5" />
                    <span>Trace Lineage DAG</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
