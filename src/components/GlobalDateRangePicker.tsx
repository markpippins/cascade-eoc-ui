import React, { useState, useEffect, useRef, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  Clock, 
  Check, 
  X, 
  ChevronDown, 
  RotateCcw, 
  Filter, 
  ArrowRight, 
  Sparkles, 
  CalendarRange, 
  Zap, 
  Radio, 
  SlidersHorizontal,
  Info
} from 'lucide-react';
import { DateRangePreset, GlobalDateRangeState } from '../types';
import { cascadeStore } from '../services/cascadeService';

interface GlobalDateRangePickerProps {
  value: GlobalDateRangeState;
  onChange: (range: GlobalDateRangeState) => void;
  className?: string;
  totalLedgerEvents?: number;
  filteredEventsCount?: number;
}

interface PresetOption {
  id: DateRangePreset;
  label: string;
  short: string;
  durationMs: number | null;
  description: string;
}

const PRESET_OPTIONS: PresetOption[] = [
  { id: '15m', label: 'Past 15 Minutes', short: '15m', durationMs: 15 * 60 * 1000, description: 'High frequency real-time inspection' },
  { id: '1h', label: 'Past 1 Hour', short: '1h', durationMs: 60 * 60 * 1000, description: 'Immediate operational telemetry' },
  { id: '6h', label: 'Past 6 Hours', short: '6h', durationMs: 6 * 3600 * 1000, description: 'Recent workflow run cycle' },
  { id: '12h', label: 'Past 12 Hours', short: '12h', durationMs: 12 * 3600 * 1000, description: 'Half-day rolling window' },
  { id: '24h', label: 'Past 24 Hours', short: '24h', durationMs: 24 * 3600 * 1000, description: 'Standard 24-hour baseline' },
  { id: '3d', label: 'Past 3 Days', short: '3d', durationMs: 3 * 24 * 3600 * 1000, description: 'Multi-day sprint tracking' },
  { id: '7d', label: 'Past 7 Days', short: '7d', durationMs: 7 * 24 * 3600 * 1000, description: 'Full weekly trend view' },
  { id: '30d', label: 'Past 30 Days', short: '30d', durationMs: 30 * 24 * 3600 * 1000, description: 'Monthly historical view' },
  { id: 'all', label: 'All Time', short: 'All', durationMs: null, description: 'Complete ledger history' }
];

// Helper to format ISO to datetime-local input string: YYYY-MM-DDTHH:mm
const toLocalInputFormat = (isoString: string | null): string => {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';
  const pad = (n: number) => n.toString().padStart(2, '0');
  const year = date.getFullYear();
  const month = pad(date.getMonth() + 1);
  const day = pad(date.getDate());
  const hours = pad(date.getHours());
  const minutes = pad(date.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

// Helper to format Date to human readable string
const formatDateTimeLabel = (isoString: string | null): string => {
  if (!isoString) return 'Start';
  const d = new Date(isoString);
  if (isNaN(d.getTime())) return isoString;
  return d.toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
};

export const GlobalDateRangePicker: React.FC<GlobalDateRangePickerProps> = ({
  value,
  onChange,
  className = '',
  totalLedgerEvents,
  filteredEventsCount
}) => {
  const [isOpen, setIsOpen] = useState<boolean>(false);
  const [customStart, setCustomStart] = useState<string>(
    toLocalInputFormat(value.startDate || new Date(Date.now() - 24 * 3600 * 1000).toISOString())
  );
  const [customEnd, setCustomEnd] = useState<string>(
    toLocalInputFormat(value.endDate || new Date().toISOString())
  );
  const [validationError, setValidationError] = useState<string | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);

  // Sync custom inputs when value prop changes
  useEffect(() => {
    if (value.startDate) {
      setCustomStart(toLocalInputFormat(value.startDate));
    }
    if (value.endDate) {
      setCustomEnd(toLocalInputFormat(value.endDate));
    }
  }, [value.startDate, value.endDate]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const handleSelectPreset = (preset: DateRangePreset) => {
    const opt = PRESET_OPTIONS.find(p => p.id === preset);
    if (!opt) return;

    if (preset === 'all') {
      onChange({
        preset: 'all',
        startDate: null,
        endDate: null,
        label: 'All Time'
      });
      setIsOpen(false);
      return;
    }

    if (opt.durationMs) {
      const now = new Date();
      const start = new Date(now.getTime() - opt.durationMs);
      onChange({
        preset,
        startDate: start.toISOString(),
        endDate: now.toISOString(),
        label: opt.label
      });
      setIsOpen(false);
    }
  };

  const handleApplyCustomRange = () => {
    if (!customStart || !customEnd) {
      setValidationError('Please select both start and end dates.');
      return;
    }

    const start = new Date(customStart);
    const end = new Date(customEnd);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setValidationError('Invalid date format.');
      return;
    }

    if (start.getTime() > end.getTime()) {
      setValidationError('Start date must be before end date.');
      return;
    }

    setValidationError(null);

    const startFormatted = formatDateTimeLabel(start.toISOString());
    const endFormatted = formatDateTimeLabel(end.toISOString());

    onChange({
      preset: 'custom',
      startDate: start.toISOString(),
      endDate: end.toISOString(),
      label: `${startFormatted} – ${endFormatted}`
    });

    setIsOpen(false);
  };

  const handleSetEndToNow = () => {
    const nowLocal = toLocalInputFormat(new Date().toISOString());
    setCustomEnd(nowLocal);
    setValidationError(null);
  };

  const handleSetQuickWindow = (hoursAgo: number) => {
    const now = new Date();
    const start = new Date(now.getTime() - hoursAgo * 3600 * 1000);
    setCustomStart(toLocalInputFormat(start.toISOString()));
    setCustomEnd(toLocalInputFormat(now.toISOString()));
    setValidationError(null);
  };

  const handleResetToDefault = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    handleSelectPreset('24h');
  };

  // Compute duration summary
  const customDurationSummary = useMemo(() => {
    if (!customStart || !customEnd) return null;
    const start = new Date(customStart).getTime();
    const end = new Date(customEnd).getTime();
    if (isNaN(start) || isNaN(end) || start > end) return null;

    const diffMs = end - start;
    const diffSecs = Math.floor(diffMs / 1000);
    const diffMins = Math.floor(diffSecs / 60);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffDays > 0) {
      const remHours = diffHours % 24;
      return `${diffDays}d ${remHours}h span`;
    }
    if (diffHours > 0) {
      const remMins = diffMins % 60;
      return `${diffHours}h ${remMins}m span`;
    }
    return `${diffMins}m span`;
  }, [customStart, customEnd]);

  // Preview event count in custom window
  const previewMatchCount = useMemo(() => {
    if (!customStart || !customEnd) return null;
    try {
      const s = new Date(customStart).toISOString();
      const e = new Date(customEnd).toISOString();
      const res = cascadeStore.getEvents({ limit: 500, offset: 0, since: s, until: e });
      return res.total;
    } catch {
      return null;
    }
  }, [customStart, customEnd, isOpen]);

  const isFiltered = value.preset !== 'all';
  const isCustom = value.preset === 'custom';

  return (
    <div ref={containerRef} className={`relative inline-block text-left ${className}`}>
      {/* Main Bar Trigger Container */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-900/90 p-1 rounded-xl border border-slate-700/80 shadow-md">
        {/* Preset Quick Tabs */}
        <div className="flex items-center space-x-1" role="tablist" aria-label="Quick Date Range Presets">
          {(['1h', '6h', '24h', '7d'] as DateRangePreset[]).map(pId => {
            const isSelected = value.preset === pId;
            const opt = PRESET_OPTIONS.find(p => p.id === pId);
            return (
              <button
                key={pId}
                id={`quick-preset-btn-${pId}`}
                onClick={() => handleSelectPreset(pId)}
                role="tab"
                aria-selected={isSelected}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-mono font-medium transition-all flex items-center gap-1 ${
                  isSelected
                    ? 'bg-blue-600 text-white font-bold shadow-[0_0_12px_rgba(37,99,235,0.4)] border border-blue-400/40'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/60'
                }`}
                title={opt?.description || opt?.label}
              >
                <span>{pId}</span>
              </button>
            );
          })}
        </div>

        {/* Custom / Popover Button */}
        <button
          id="global-date-range-popover-trigger"
          onClick={() => setIsOpen(!isOpen)}
          aria-expanded={isOpen}
          aria-haspopup="dialog"
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 border ${
            isCustom
              ? 'bg-blue-950/80 border-blue-500/70 text-blue-300 shadow-[0_0_12px_rgba(59,130,246,0.3)] font-semibold'
              : isOpen
                ? 'bg-slate-800 border-slate-600 text-white'
                : 'bg-slate-800/60 border-slate-700/70 text-slate-300 hover:text-white hover:bg-slate-800'
          }`}
          title="Open Custom Date-Range Picker and Extended Presets"
        >
          <CalendarIcon className={`w-3.5 h-3.5 ${isCustom ? 'text-blue-400' : 'text-slate-400'}`} />
          
          <span className="font-mono text-xs truncate max-w-[170px]">
            {isCustom ? value.label : value.preset === 'all' ? 'All Time' : value.label || 'Custom'}
          </span>

          <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isOpen ? 'rotate-180 text-blue-400' : ''}`} />
        </button>

        {/* Reset button if custom or non-default */}
        {value.preset !== '24h' && (
          <button
            id="global-date-range-reset-btn"
            onClick={handleResetToDefault}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 transition-colors"
            title="Reset to Default (Past 24 Hours)"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-400 hover:text-amber-400 transition-colors" />
          </button>
        )}
      </div>

      {/* Floating Popover Dropdown Panel */}
      {isOpen && (
        <div
          id="global-date-range-popover-menu"
          className="absolute right-0 top-full mt-2 w-[340px] sm:w-[480px] z-50 rounded-2xl bg-slate-900/95 backdrop-blur-xl border border-slate-700/90 shadow-2xl shadow-black/80 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="p-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <CalendarRange className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-white uppercase tracking-wider">Global Time Window</h4>
                <p className="text-[11px] text-slate-400">Scope metrics, charts, & activity feeds</p>
              </div>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={handleResetToDefault}
                className="px-2 py-1 rounded-md text-[11px] font-mono text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 flex items-center gap-1 transition-colors"
                title="Reset to 24h default"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset (24h)</span>
              </button>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4 max-h-[80vh] overflow-y-auto custom-scrollbar">
            {/* Quick Presets Grid */}
            <div>
              <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                Quick Presets
              </label>
              <div className="grid grid-cols-3 gap-1.5">
                {PRESET_OPTIONS.map(opt => {
                  const isSelected = value.preset === opt.id;
                  return (
                    <button
                      key={opt.id}
                      id={`popover-preset-btn-${opt.id}`}
                      onClick={() => handleSelectPreset(opt.id)}
                      className={`px-3 py-2 rounded-xl text-left transition-all border flex flex-col justify-between ${
                        isSelected
                          ? 'bg-blue-600/20 border-blue-500/80 text-white shadow-sm'
                          : 'bg-slate-800/40 border-slate-700/60 text-slate-300 hover:bg-slate-800 hover:text-white hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-xs font-semibold">{opt.label}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-blue-400" />}
                      </div>
                      <span className="text-[10px] text-slate-400 font-mono mt-0.5">{opt.short}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Divider */}
            <div className="border-t border-slate-800/80 my-2" />

            {/* Custom Exact Date-Time Selection */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
                  <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400" />
                  <span>Custom Date & Time Range</span>
                </label>
                {customDurationSummary && (
                  <span className="text-[10px] font-mono font-medium px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300">
                    {customDurationSummary}
                  </span>
                )}
              </div>

              {/* Quick Jump Shortcuts */}
              <div className="flex flex-wrap gap-1.5">
                {[
                  { label: 'Past 2h', hours: 2 },
                  { label: 'Past 12h', hours: 12 },
                  { label: 'Past 48h', hours: 48 },
                  { label: 'Past 5 Days', hours: 120 }
                ].map(chip => (
                  <button
                    key={chip.label}
                    onClick={() => handleSetQuickWindow(chip.hours)}
                    className="px-2 py-1 rounded-lg text-[10px] font-mono bg-slate-800/70 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white transition-colors"
                  >
                    {chip.label}
                  </button>
                ))}
                <button
                  onClick={handleSetEndToNow}
                  className="px-2 py-1 rounded-lg text-[10px] font-mono bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 flex items-center gap-1 transition-colors ml-auto"
                >
                  <Zap className="w-2.5 h-2.5 text-emerald-400" />
                  <span>Lock End to Now</span>
                </button>
              </div>

              {/* Start & End Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {/* Start Date */}
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-300 font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>Start Date & Time:</span>
                  </label>
                  <input
                    type="datetime-local"
                    id="custom-range-start-input"
                    value={customStart}
                    onChange={(e) => {
                      setCustomStart(e.target.value);
                      setValidationError(null);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  />
                  <div className="text-[10px] text-slate-400 font-mono pl-1">
                    {formatDateTimeLabel(customStart ? new Date(customStart).toISOString() : null)}
                  </div>
                </div>

                {/* End Date */}
                <div className="space-y-1">
                  <label className="text-[11px] text-slate-300 font-medium flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    <span>End Date & Time:</span>
                  </label>
                  <input
                    type="datetime-local"
                    id="custom-range-end-input"
                    value={customEnd}
                    onChange={(e) => {
                      setCustomEnd(e.target.value);
                      setValidationError(null);
                    }}
                    className="w-full px-3 py-2 rounded-xl bg-slate-950/80 border border-slate-700 text-white font-mono text-xs focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-colors"
                  />
                  <div className="text-[10px] text-slate-400 font-mono pl-1">
                    {formatDateTimeLabel(customEnd ? new Date(customEnd).toISOString() : null)}
                  </div>
                </div>
              </div>

              {/* Validation Warning if start > end */}
              {validationError && (
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
                  <Info className="w-4 h-4 text-rose-400 flex-shrink-0" />
                  <span>{validationError}</span>
                </div>
              )}

              {/* Live matching events preview */}
              {previewMatchCount !== null && (
                <div className="flex items-center justify-between text-[11px] text-slate-400 bg-slate-950/50 p-2.5 rounded-xl border border-slate-800 font-mono">
                  <span className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse" />
                    Matching events in window:
                  </span>
                  <span className="font-bold text-white">
                    {previewMatchCount} events
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Footer Actions */}
          <div className="p-4 border-t border-slate-800 bg-slate-950/80 flex items-center justify-between gap-3">
            <div className="text-[11px] text-slate-400 font-mono truncate hidden sm:block">
              {isCustom ? 'Custom window active' : `Preset: ${value.preset}`}
            </div>

            <div className="flex items-center gap-2 ml-auto">
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-700 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                id="apply-custom-date-range-btn"
                onClick={handleApplyCustomRange}
                className="px-4 py-1.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 border border-blue-400/50 shadow-md shadow-blue-900/30 flex items-center gap-1.5 transition-all"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Apply Window</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
