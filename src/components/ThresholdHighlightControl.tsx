import React, { useState, useRef, useEffect } from 'react';
import { 
  Zap, 
  Clock, 
  Sliders, 
  AlertTriangle, 
  ShieldAlert, 
  Check, 
  X, 
  ChevronDown, 
  ChevronUp, 
  Filter,
  Sparkles,
  Gauge,
  Info
} from 'lucide-react';
import { 
  ThresholdHighlightConfig, 
  HighlightTarget, 
  HighlightVisualEffect,
  EventThresholdBreach
} from '../utils/thresholdHighlighting';
import { useAppTheme } from '../context/ThemeContext';

interface ThresholdHighlightControlProps {
  config: ThresholdHighlightConfig;
  onChangeConfig: (newConfig: ThresholdHighlightConfig) => void;
  breachStats: {
    totalBreached: number;
    latencyBreached: number;
    errorBreached: number;
    totalVisible: number;
  };
  onJumpToNextBreach?: () => void;
  onJumpToPrevBreach?: () => void;
}

const PRESET_THRESHOLDS = [30, 45, 60, 100, 150, 200];

export const ThresholdHighlightControl: React.FC<ThresholdHighlightControlProps> = ({
  config,
  onChangeConfig,
  breachStats,
  onJumpToNextBreach,
  onJumpToPrevBreach
}) => {
  const { themeClasses, isDark, isSteel } = useAppTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggleEnabled = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChangeConfig({
      ...config,
      enabled: !config.enabled
    });
  };

  const handleSetTarget = (target: HighlightTarget) => {
    onChangeConfig({
      ...config,
      target
    });
  };

  const handleSetEffect = (effect: HighlightVisualEffect) => {
    onChangeConfig({
      ...config,
      effect
    });
  };

  const handleSetLatencyThreshold = (threshold: number) => {
    onChangeConfig({
      ...config,
      latencyThresholdMs: threshold
    });
  };

  const handleToggleOnlyBreached = () => {
    onChangeConfig({
      ...config,
      onlyShowBreachedRows: !config.onlyShowBreachedRows
    });
  };

  return (
    <div className="relative inline-block" ref={dropdownRef} id="threshold-highlight-container">
      {/* Trigger Control Bar */}
      <div className="flex items-center space-x-1.5 bg-slate-900/90 p-1 rounded-lg border border-slate-800 text-xs font-mono">
        {/* Quick Power Toggle */}
        <button
          type="button"
          id="toggle-threshold-highlight-btn"
          onClick={handleToggleEnabled}
          className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-xs font-semibold transition-all ${
            config.enabled
              ? breachStats.totalBreached > 0
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 shadow-xs'
                : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 shadow-xs'
              : 'text-slate-500 hover:text-slate-300 hover:bg-slate-800/60'
          }`}
          title={config.enabled ? 'Threshold highlighting is active' : 'Click to enable threshold highlighting'}
        >
          <Zap className={`w-3.5 h-3.5 ${config.enabled ? (breachStats.totalBreached > 0 ? 'text-amber-400' : 'text-emerald-400') : 'text-slate-500'}`} />
          <span>
            {config.enabled ? 'Threshold Highlighting' : 'Highlighting Off'}
          </span>
          {config.enabled && (
            <span className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
              breachStats.totalBreached > 0 
                ? 'bg-amber-500/30 text-amber-200 border border-amber-500/50' 
                : 'bg-emerald-500/20 text-emerald-300'
            }`}>
              {breachStats.totalBreached}
            </span>
          )}
        </button>

        {/* Breach Jump Controls (if breaches exist and enabled) */}
        {config.enabled && breachStats.totalBreached > 0 && (
          <div className="hidden lg:flex items-center space-x-0.5 border-l border-slate-800 pl-1 text-[10px]">
            {onJumpToPrevBreach && (
              <button
                type="button"
                id="btn-prev-breached-row"
                onClick={onJumpToPrevBreach}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                title="Scroll to previous breached event"
              >
                <ChevronUp className="w-3.5 h-3.5" />
              </button>
            )}
            {onJumpToNextBreach && (
              <button
                type="button"
                id="btn-next-breached-row"
                onClick={onJumpToNextBreach}
                className="p-1 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                title="Scroll to next breached event"
              >
                <ChevronDown className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        )}

        {/* Settings Popover Dropdown Toggle */}
        <button
          type="button"
          id="btn-threshold-settings-toggle"
          onClick={() => setIsOpen(!isOpen)}
          className={`p-1.5 rounded-md transition-colors ${
            isOpen 
              ? 'bg-sky-500/25 text-sky-200 border border-sky-500/40' 
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
          }`}
          title="Configure threshold latency limit, error codes, and visual pulse/tint style"
        >
          <Sliders className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Popover Settings Menu */}
      {isOpen && (
        <div 
          id="threshold-highlight-settings-panel"
          className={`absolute right-0 top-full mt-2 w-80 sm:w-96 rounded-xl border p-4 shadow-2xl z-50 animate-fadeIn font-mono text-xs ${
            isDark 
              ? 'bg-slate-900 border-slate-700 text-slate-200' 
              : isSteel
                ? 'bg-slate-800 border-slate-600 text-slate-100'
                : 'bg-white border-slate-300 text-slate-800 shadow-xl'
          }`}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-3 border-b border-slate-700/60">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span className="font-bold text-sm tracking-wide">Threshold Highlighting</span>
            </div>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="py-3 space-y-4">
            {/* Master Toggle */}
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold text-slate-200">Highlighting Active</div>
                <div className="text-[11px] text-slate-400">Visually emphasize breached events</div>
              </div>
              <button
                type="button"
                id="threshold-master-toggle-btn"
                onClick={() => onChangeConfig({ ...config, enabled: !config.enabled })}
                className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors ${
                  config.enabled ? 'bg-amber-500' : 'bg-slate-700'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    config.enabled ? 'translate-x-5' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* Target Scope */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-slate-400 flex items-center justify-between">
                <span>HIGHLIGHT TARGET</span>
                <span className="text-amber-400 font-normal">
                  {config.target === 'all_breaches' ? 'Latency & Errors' : config.target === 'latency_only' ? 'Latency Only' : 'Errors Only'}
                </span>
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  id="target-all-breaches-btn"
                  onClick={() => handleSetTarget('all_breaches')}
                  className={`px-2 py-1.5 rounded-lg border text-center transition-all ${
                    config.target === 'all_breaches'
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-200 font-bold ring-1 ring-amber-500/40'
                      : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Both
                </button>
                <button
                  type="button"
                  id="target-latency-only-btn"
                  onClick={() => handleSetTarget('latency_only')}
                  className={`px-2 py-1.5 rounded-lg border text-center transition-all ${
                    config.target === 'latency_only'
                      ? 'bg-amber-500/20 border-amber-500/60 text-amber-200 font-bold ring-1 ring-amber-500/40'
                      : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Latency
                </button>
                <button
                  type="button"
                  id="target-errors-only-btn"
                  onClick={() => handleSetTarget('errors_only')}
                  className={`px-2 py-1.5 rounded-lg border text-center transition-all ${
                    config.target === 'errors_only'
                      ? 'bg-rose-500/20 border-rose-500/60 text-rose-200 font-bold ring-1 ring-rose-500/40'
                      : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Errors
                </button>
              </div>
            </div>

            {/* Latency Threshold Stepper & Presets */}
            {(config.target === 'all_breaches' || config.target === 'latency_only') && (
              <div className="space-y-2 pt-1 border-t border-slate-800">
                <div className="flex items-center justify-between text-[11px]">
                  <span className="font-semibold text-slate-400 flex items-center space-x-1">
                    <Clock className="w-3 h-3 text-amber-400" />
                    <span>LATENCY THRESHOLD</span>
                  </span>
                  <span className="font-bold text-amber-400 text-xs">
                    &ge; {config.latencyThresholdMs} ms
                  </span>
                </div>

                {/* Range Slider */}
                <input
                  type="range"
                  id="latency-threshold-slider"
                  min={15}
                  max={300}
                  step={5}
                  value={config.latencyThresholdMs}
                  onChange={(e) => handleSetLatencyThreshold(Number(e.target.value))}
                  className="w-full h-1.5 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-amber-500"
                />

                {/* Quick Presets */}
                <div className="flex items-center justify-between gap-1 text-[10px]">
                  {PRESET_THRESHOLDS.map(th => (
                    <button
                      key={th}
                      type="button"
                      onClick={() => handleSetLatencyThreshold(th)}
                      className={`flex-1 py-1 rounded border transition-all ${
                        config.latencyThresholdMs === th
                          ? 'bg-amber-500 text-slate-950 font-bold border-amber-400'
                          : 'border-slate-700 bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {th}ms
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Visual Effect Mode */}
            <div className="space-y-1.5 pt-1 border-t border-slate-800">
              <label className="text-[11px] font-semibold text-slate-400">
                VISUAL EMPHASIS STYLE
              </label>
              <div className="grid grid-cols-3 gap-1.5 text-[11px]">
                <button
                  type="button"
                  id="effect-pulse-and-tint-btn"
                  onClick={() => handleSetEffect('pulse_and_tint')}
                  className={`p-1.5 rounded-lg border text-center transition-all ${
                    config.effect === 'pulse_and_tint'
                      ? 'bg-sky-500/20 border-sky-500/60 text-sky-200 font-bold ring-1 ring-sky-500/40'
                      : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200'
                  }`}
                  title="Both background tint and subtle pulse animation"
                >
                  Tint &amp; Pulse
                </button>
                <button
                  type="button"
                  id="effect-tint-only-btn"
                  onClick={() => handleSetEffect('tint_only')}
                  className={`p-1.5 rounded-lg border text-center transition-all ${
                    config.effect === 'tint_only'
                      ? 'bg-sky-500/20 border-sky-500/60 text-sky-200 font-bold ring-1 ring-sky-500/40'
                      : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200'
                  }`}
                  title="Background tint without pulse animation"
                >
                  Tint Only
                </button>
                <button
                  type="button"
                  id="effect-pulse-only-btn"
                  onClick={() => handleSetEffect('pulse_only')}
                  className={`p-1.5 rounded-lg border text-center transition-all ${
                    config.effect === 'pulse_only'
                      ? 'bg-sky-500/20 border-sky-500/60 text-sky-200 font-bold ring-1 ring-sky-500/40'
                      : 'border-slate-700 bg-slate-800/60 text-slate-400 hover:text-slate-200'
                  }`}
                  title="Subtle pulse border glow without heavy background tint"
                >
                  Pulse Only
                </button>
              </div>
            </div>

            {/* Quick Filter: Only show breached rows */}
            <div className="pt-2 border-t border-slate-800">
              <label 
                className="flex items-center space-x-2.5 cursor-pointer select-none"
                onClick={handleToggleOnlyBreached}
              >
                <div className={`w-4 h-4 rounded border flex items-center justify-center transition-colors ${
                  config.onlyShowBreachedRows 
                    ? 'bg-amber-500 border-amber-400 text-slate-950' 
                    : 'border-slate-600 bg-slate-800'
                }`}>
                  {config.onlyShowBreachedRows && <Check className="w-3 h-3 stroke-[3]" />}
                </div>
                <div className="flex-1">
                  <div className="text-slate-200 font-semibold text-[11px]">Filter: Only Show Breached Rows</div>
                  <div className="text-[10px] text-slate-400">Hide nominal events and isolate anomalies</div>
                </div>
              </label>
            </div>
          </div>

          {/* Footer Live Telemetry Summary */}
          <div className="pt-3 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <div className="flex items-center space-x-3">
              <span className="flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>{breachStats.latencyBreached} Latency</span>
              </span>
              <span className="flex items-center space-x-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                <span>{breachStats.errorBreached} Errors</span>
              </span>
            </div>
            <span className="text-slate-500">
              {breachStats.totalBreached} / {breachStats.totalVisible} visible
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
