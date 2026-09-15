import React, { useState, useEffect, useRef } from 'react';
import { 
  Search, 
  PlusCircle, 
  Sparkles, 
  Clock, 
  History,
  X,
  Trash2,
  Tag,
  Filter,
  CornerDownLeft,
  ChevronRight,
  ChevronDown,
  ShieldAlert,
  Bot,
  Layers,
  Settings2,
  RefreshCw,
  Zap,
  Play,
  Pause,
  Sliders,
  Check,
  Activity,
  Radio,
  SlidersHorizontal,
  Timer
} from 'lucide-react';
import { useAppTheme } from '../context/ThemeContext';
import { ActiveView } from '../types';
import { cascadeStore } from '../services/cascadeService';

interface HeaderProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  onOpenSimulator: () => void;
  onQuickSimulate: () => void;
  globalSearch: string;
  setGlobalSearch: (q: string) => void;
}

const RECENT_SEARCHES_STORAGE_KEY = 'cascade_recent_searches_v1';
const DEFAULT_RECENT_SEARCHES = [
  'transcript.harvested',
  'failed',
  'rover-harness',
  'candidate.approved',
  '#security-audit'
];

interface QuickSuggestion {
  query: string;
  label: string;
  category: 'type' | 'status' | 'tag' | 'actor';
  icon?: React.ReactNode;
}

const QUICK_SUGGESTIONS: QuickSuggestion[] = [
  { query: 'transcript.harvested', label: 'transcript.harvested', category: 'type' },
  { query: 'candidate.identified', label: 'candidate.identified', category: 'type' },
  { query: 'failed', label: 'Failed / Degraded events', category: 'status' },
  { query: '#security-audit', label: '#security-audit', category: 'tag' },
  { query: 'rover', label: 'Autonomous Rover Actor', category: 'actor' },
  { query: 'assessment.veto', label: 'assessment.veto', category: 'type' }
];

export interface AutoRefreshIntervalOption {
  label: string;
  value: number;
  tag: string;
  desc: string;
}

export const AUTO_REFRESH_INTERVAL_OPTIONS: AutoRefreshIntervalOption[] = [
  { label: '5s', value: 5000, tag: 'Rapid', desc: 'Sync every 5 seconds' },
  { label: '10s', value: 10000, tag: 'Fast', desc: 'Sync every 10 seconds' },
  { label: '30s', value: 30000, tag: 'Standard', desc: 'Sync every 30 seconds' },
  { label: '1m', value: 60000, tag: 'Batch', desc: 'Sync every 1 minute' },
  { label: '2m', value: 120000, tag: 'Relaxed', desc: 'Sync every 2 minutes' },
  { label: '2s', value: 2000, tag: 'Turbo', desc: 'Sync every 2 seconds' },
];

const POLLING_INTERVAL_OPTIONS = AUTO_REFRESH_INTERVAL_OPTIONS;

export const Header: React.FC<HeaderProps> = ({
  activeView,
  setActiveView,
  onOpenSimulator,
  onQuickSimulate,
  globalSearch,
  setGlobalSearch
}) => {
  const { themeClasses, isSteel, isDark } = useAppTheme();
  const [isStreaming, setIsStreaming] = useState<boolean>(() => cascadeStore.getIsStreaming());
  const [pollingInterval, setPollingInterval] = useState<number>(() => cascadeStore.getPollingInterval());
  const [secondsRemaining, setSecondsRemaining] = useState<number>(() => Math.ceil(cascadeStore.getPollingInterval() / 1000));
  const [recentPulse, setRecentPulse] = useState<boolean>(false);
  const [lastEventTime, setLastEventTime] = useState<string>('just now');
  const [isManualRefreshing, setIsManualRefreshing] = useState<boolean>(false);

  // Settings popover state
  const [isSettingsOpen, setIsSettingsOpen] = useState<boolean>(false);
  const settingsContainerRef = useRef<HTMLDivElement>(null);

  // Search dropdown state
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [recentSearches, setRecentSearches] = useState<string[]>(() => {
    try {
      const stored = localStorage.getItem(RECENT_SEARCHES_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // ignore
    }
    return DEFAULT_RECENT_SEARCHES;
  });

  const searchContainerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Sync recent searches to localStorage
  const saveRecentSearches = (searches: string[]) => {
    setRecentSearches(searches);
    try {
      localStorage.setItem(RECENT_SEARCHES_STORAGE_KEY, JSON.stringify(searches));
    } catch {
      // ignore storage error
    }
  };

  const addSearchToRecent = (query: string) => {
    const trimmed = query.trim();
    if (!trimmed) return;
    const filtered = recentSearches.filter(s => s.toLowerCase() !== trimmed.toLowerCase());
    const updated = [trimmed, ...filtered].slice(0, 8);
    saveRecentSearches(updated);
  };

  const removeRecentSearch = (e: React.MouseEvent, itemToRemove: string) => {
    e.stopPropagation();
    const updated = recentSearches.filter(s => s !== itemToRemove);
    saveRecentSearches(updated);
  };

  const clearAllRecentSearches = (e: React.MouseEvent) => {
    e.stopPropagation();
    saveRecentSearches([]);
  };

  const handleSelectSearch = (query: string) => {
    setGlobalSearch(query);
    addSearchToRecent(query);
    setIsSearchOpen(false);
    if (activeView !== 'ledger') {
      setActiveView('ledger');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (globalSearch.trim().length > 0) {
        addSearchToRecent(globalSearch);
        setIsSearchOpen(false);
        if (activeView !== 'ledger') {
          setActiveView('ledger');
        }
      }
    } else if (e.key === 'Escape') {
      setIsSearchOpen(false);
      searchInputRef.current?.blur();
    }
  };

  // Close dropdowns on click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as Node;
      if (searchContainerRef.current && !searchContainerRef.current.contains(target)) {
        setIsSearchOpen(false);
      }
      if (settingsContainerRef.current && !settingsContainerRef.current.contains(target)) {
        setIsSettingsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const unsubscribe = cascadeStore.subscribe(() => {
      const streaming = cascadeStore.getIsStreaming();
      const interval = cascadeStore.getPollingInterval();
      setIsStreaming(streaming);
      setPollingInterval(interval);
      if (streaming) {
        setRecentPulse(true);
        setSecondsRemaining(Math.ceil(interval / 1000));
        setLastEventTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
        const timer = setTimeout(() => setRecentPulse(false), 1200);
        return () => clearTimeout(timer);
      }
    });
    return unsubscribe;
  }, []);

  // Countdown timer for automatic refresh
  useEffect(() => {
    if (!isStreaming) return;
    const timer = setInterval(() => {
      setSecondsRemaining((prev) => {
        if (prev <= 1) {
          return Math.ceil(pollingInterval / 1000);
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [isStreaming, pollingInterval]);

  const handleToggleAutoRefresh = () => {
    const nextState = cascadeStore.toggleLiveStreaming();
    setIsStreaming(nextState);
    if (nextState) {
      setSecondsRemaining(Math.ceil(pollingInterval / 1000));
    }
  };

  const handleChangeInterval = (intervalMs: number) => {
    cascadeStore.setPollingInterval(intervalMs);
    setPollingInterval(intervalMs);
    setSecondsRemaining(Math.ceil(intervalMs / 1000));
  };

  const handleManualSync = () => {
    setIsManualRefreshing(true);
    cascadeStore.syncEventsNow();
    setLastEventTime(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    setSecondsRemaining(Math.ceil(pollingInterval / 1000));
    setTimeout(() => {
      setIsManualRefreshing(false);
    }, 600);
  };

  const viewTitles: Record<ActiveView, { title: string; subtitle: string }> = {
    overview: {
      title: 'Workflow Telemetry & Funnel Overview',
      subtitle: 'Real-time observability across harvested transcripts, candidate discovery, and software execution'
    },
    ledger: {
      title: 'Cascade Event Ledger Explorer',
      subtitle: 'Immutable event stream query console with JSON envelope inspection and causation links'
    },
    batch: {
      title: 'Batch Operations & Review Workbench',
      subtitle: 'Multi-envelope selection, distributed re-simulation replay, review triage queue, and bulk actions'
    },
    lineage: {
      title: 'Graph-Style Causation Lineage (DAG)',
      subtitle: 'Interactive backward and forward causal tree walking across full ingestion lifecycle'
    },
    pipeline: {
      title: 'End-to-End Lifecycle Phase Swimlanes',
      subtitle: 'Trace workflows from voice transcripts to candidate greenlight, plans, dev harness & deployments'
    },
    assessments: {
      title: 'Cascade Assessment & Resolution Matrix',
      subtitle: 'Multi-dimensional evaluation resolutions, confidence scoring, and strategic rationale'
    },
    subscribers: {
      title: 'NATS Stream Consumers & Processing Offsets',
      subtitle: 'Subscriber health, processing offsets, dedup window, and consumer backlog lag'
    },
    simulator: {
      title: 'Ingestion & Autonomous Execution Studio',
      subtitle: 'Harvest new meeting transcripts or simulate autonomous rover & dev harness pipelines'
    },
    api_explorer: {
      title: 'REST API & OpenAPI Specification Sandbox',
      subtitle: 'Live interactive query tester for all 12 cascade-srv endpoints'
    }
  };

  const currentViewInfo = viewTitles[activeView] || { title: 'Cascade Console', subtitle: '' };

  // Filtered recent searches if user has typed something
  const filteredRecent = globalSearch.trim().length > 0
    ? recentSearches.filter(s => s.toLowerCase().includes(globalSearch.toLowerCase().trim()))
    : recentSearches;

  const currentIntervalOption = POLLING_INTERVAL_OPTIONS.find(o => o.value === pollingInterval) || {
    label: `${pollingInterval / 1000}s`,
    value: pollingInterval,
    tag: 'Custom',
    desc: `${pollingInterval / 1000}s`
  };

  return (
    <header className="h-20 px-8 border-b border-slate-700/30 bg-[#0f172a]/90 backdrop-blur-md flex items-center justify-between sticky top-0 z-30">
      {/* Breadcrumb / Title */}
      <div className="flex flex-col">
        <div className="flex items-center space-x-2">
          <span className="text-xs font-mono font-semibold uppercase tracking-wider text-blue-400">
            CASCADE // {activeView.toUpperCase()}
          </span>
          <span className="text-xs text-slate-500">/</span>
          <h1 className="text-xl font-bold text-white tracking-tight">{currentViewInfo.title}</h1>
        </div>
        <p className="text-xs text-slate-400 truncate max-w-xl">
          {currentViewInfo.subtitle}
        </p>
      </div>

      {/* Right Controls */}
      <div className="flex items-center space-x-3">
        {/* Auto-Refresh Control Hub with Quick Interval Selector & Settings Popover */}
        <div ref={settingsContainerRef} className="relative" id="header-auto-refresh-hub">
          <div className="flex items-center space-x-1.5 bg-slate-900/90 border border-slate-700/70 p-1 rounded-xl shadow-sm">
            {/* Toggle-able Auto-Refresh Status Button */}
            <button
              id="header-auto-refresh-toggle"
              data-testid="header-ingestion-status"
              onClick={handleToggleAutoRefresh}
              title={isStreaming ? `Auto-Refresh is ON (${currentIntervalOption.label}). Click to pause.` : "Auto-Refresh is OFF. Click to enable automatic sync."}
              className={`flex items-center px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all duration-300 gap-2 ${
                isStreaming
                  ? 'bg-emerald-950/40 text-emerald-300 hover:bg-emerald-900/50 border border-emerald-500/30'
                  : 'bg-slate-800/60 text-slate-400 hover:bg-slate-700/60 hover:text-slate-300 border border-slate-700/40'
              }`}
            >
              <span className="relative flex h-2 w-2 items-center justify-center">
                {isStreaming ? (
                  <>
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 duration-1000" />
                    <span className={`relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-400 ${
                      recentPulse ? 'scale-125' : ''
                    } transition-all`} />
                  </>
                ) : (
                  <span className="inline-flex rounded-full h-1.5 w-1.5 bg-slate-500" />
                )}
              </span>

              <div className="flex items-center gap-1.5 text-[11px] select-none">
                <span className="text-slate-300 font-medium hidden sm:inline">Auto-Refresh:</span>
                <span className={`font-semibold tracking-wider ${isStreaming ? 'text-emerald-300' : 'text-slate-400'}`}>
                  {isStreaming ? 'ON' : 'OFF'}
                </span>
              </div>
            </button>

            {/* Interval Selector Trigger Button */}
            <button
              id="header-auto-refresh-interval-btn"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`flex items-center space-x-1 px-2 py-1.5 rounded-lg text-xs font-mono transition-all border ${
                isSettingsOpen 
                  ? 'bg-sky-500/20 text-sky-200 border-sky-500/50 shadow-sm' 
                  : 'bg-slate-800/40 text-slate-300 border-slate-700/40 hover:bg-slate-800 hover:border-slate-600'
              }`}
              title="Set Auto-Refresh interval (e.g. 5s, 30s, 1m)"
            >
              <Clock className="w-3 h-3 text-sky-400" />
              <span className="font-bold text-sky-300 text-[11px]">{currentIntervalOption.label}</span>
              <ChevronDown className={`w-3 h-3 text-slate-400 transition-transform ${isSettingsOpen ? 'rotate-180 text-sky-300' : ''}`} />
            </button>

            {/* Dynamic Countdown Pill (when Auto-Refresh is active) */}
            {isStreaming && (
              <div 
                id="header-auto-refresh-countdown"
                className="hidden md:flex items-center space-x-1 px-2 py-1 rounded-lg bg-sky-500/10 border border-sky-500/20 text-[10px] font-mono text-sky-300 select-none"
                title={`Next automatic event sync in ${secondsRemaining}s`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-sky-400 animate-pulse" />
                <span>Next: {secondsRemaining}s</span>
              </div>
            )}

            {/* Quick Manual Sync Button */}
            <button
              id="header-sync-now-btn"
              data-testid="header-manual-refresh-btn"
              onClick={handleManualSync}
              disabled={isManualRefreshing}
              className={`p-1.5 rounded-lg text-slate-400 hover:text-sky-300 hover:bg-slate-800/80 transition-all ${
                isManualRefreshing ? 'text-sky-400 bg-sky-500/10' : ''
              }`}
              title="Sync event data from cascadeService now"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isManualRefreshing ? 'animate-spin text-sky-400' : ''}`} />
            </button>

            {/* Settings Trigger Icon */}
            <button
              id="header-polling-settings-btn"
              onClick={() => setIsSettingsOpen(!isSettingsOpen)}
              className={`p-1.5 rounded-lg transition-all ${
                isSettingsOpen 
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40 shadow-sm' 
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80'
              }`}
              title="Configure Auto-Refresh interval and background sync settings"
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Auto-Refresh Settings Popover Panel */}
          {isSettingsOpen && (
            <div 
              id="header-auto-refresh-panel"
              data-testid="header-polling-settings-panel"
              className="absolute right-0 top-full mt-2 w-88 sm:w-96 bg-slate-900/98 border border-slate-700/80 rounded-2xl shadow-2xl backdrop-blur-xl z-50 p-4 font-sans animate-in fade-in slide-in-from-top-2 duration-150"
            >
              {/* Header Title */}
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div className="flex items-center space-x-2.5">
                  <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-400 border border-sky-500/20">
                    <RefreshCw className={`w-4 h-4 ${isStreaming ? 'animate-spin duration-3000' : ''}`} />
                  </div>
                  <div>
                    <h3 className="text-xs font-bold text-white font-mono uppercase tracking-wide">
                      Auto-Refresh Settings
                    </h3>
                    <p className="text-[10px] text-slate-400">
                      Automatic event data synchronization
                    </p>
                  </div>
                </div>

                <button
                  onClick={() => setIsSettingsOpen(false)}
                  className="p-1 rounded-md text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Master Auto-Refresh Toggle Switch */}
              <div className="py-3.5 border-b border-slate-800">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5 pr-3">
                    <div className="text-xs font-semibold text-slate-200 flex items-center space-x-1.5">
                      <span>Enable Auto-Refresh</span>
                      {isStreaming && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      )}
                    </div>
                    <p className="text-[11px] text-slate-400 leading-snug">
                      Automatically sync new telemetry envelopes, pipeline states, and event updates from cascadeService without manual intervention.
                    </p>
                  </div>

                  {/* Master Toggle Switch */}
                  <button
                    id="auto-refresh-master-switch"
                    data-testid="auto-polling-toggle-switch"
                    type="button"
                    role="switch"
                    aria-checked={isStreaming}
                    onClick={handleToggleAutoRefresh}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                      isStreaming ? 'bg-emerald-500' : 'bg-slate-700'
                    }`}
                  >
                    <span
                      aria-hidden="true"
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                        isStreaming ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              </div>

              {/* Refresh Interval Selector Grid */}
              <div className="py-3.5 border-b border-slate-800 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200 font-mono flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-sky-400" />
                    <span>Sync Interval</span>
                  </span>
                  <span className="text-[10px] text-sky-300 font-mono font-medium">
                    {currentIntervalOption.desc}
                  </span>
                </div>

                {/* Interval Pill Selector Grid */}
                <div className="grid grid-cols-3 gap-1.5 pt-1">
                  {AUTO_REFRESH_INTERVAL_OPTIONS.map((opt) => {
                    const isSelected = pollingInterval === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => handleChangeInterval(opt.value)}
                        className={`flex flex-col items-center justify-center p-2 rounded-xl border text-center transition-all ${
                          isSelected
                            ? 'bg-sky-500/20 border-sky-500/60 text-white shadow-[0_0_12px_rgba(56,189,248,0.2)]'
                            : 'bg-slate-800/40 border-slate-800 text-slate-400 hover:bg-slate-800 hover:text-slate-200 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center space-x-1">
                          <span className="text-xs font-mono font-bold">{opt.label}</span>
                          {isSelected && <Check className="w-3 h-3 text-sky-400" />}
                        </div>
                        <span className="text-[9px] text-slate-400 mt-0.5">{opt.tag}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Live Sync Status & Metadata */}
              <div className="py-3 border-b border-slate-800 space-y-2 text-[11px] font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Sync Status:</span>
                  <span className={`font-semibold flex items-center space-x-1 ${isStreaming ? 'text-emerald-300' : 'text-slate-400'}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${isStreaming ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                    <span>{isStreaming ? `Active (${currentIntervalOption.label})` : 'Paused (Manual Only)'}</span>
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Next Auto-Sync:</span>
                  <span className="text-sky-300 font-semibold">
                    {isStreaming ? `in ${secondsRemaining}s` : 'Disabled'}
                  </span>
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-slate-400">Last Synced:</span>
                  <span className="text-slate-200 font-semibold">{lastEventTime}</span>
                </div>
              </div>

              {/* Manual Refresh & Quick Emit Actions */}
              <div className="pt-3 flex items-center space-x-2">
                <button
                  id="auto-refresh-popover-sync-now"
                  onClick={handleManualSync}
                  disabled={isManualRefreshing}
                  className="flex-1 flex items-center justify-center space-x-2 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 transition-all group"
                >
                  <RefreshCw className={`w-3.5 h-3.5 text-sky-400 group-hover:rotate-180 transition-transform ${
                    isManualRefreshing ? 'animate-spin text-sky-400' : ''
                  }`} />
                  <span>{isManualRefreshing ? 'Syncing...' : 'Sync Now'}</span>
                </button>

                <button
                  onClick={() => {
                    onQuickSimulate();
                    setIsSettingsOpen(false);
                  }}
                  className="px-3 py-2 rounded-xl bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 text-xs font-medium border border-amber-500/30 transition-all flex items-center space-x-1.5"
                  title="Emit synthetic event"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Emit</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Global Search Component with Recent Searches Dropdown */}
        <div ref={searchContainerRef} className="relative w-56 sm:w-72 md:w-80">
          <div className="relative">
            <Search className={`w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${
              isSearchOpen ? 'text-sky-400' : 'text-slate-400'
            }`} />
            
            <input
              ref={searchInputRef}
              id="global-search-input"
              type="text"
              placeholder="Search events, types, UUIDs, #tags..."
              value={globalSearch}
              onFocus={() => setIsSearchOpen(true)}
              onClick={() => setIsSearchOpen(true)}
              onKeyDown={handleKeyDown}
              onChange={(e) => {
                setGlobalSearch(e.target.value);
                if (!isSearchOpen) setIsSearchOpen(true);
                if (activeView !== 'ledger' && e.target.value.trim().length > 0) {
                  setActiveView('ledger');
                }
              }}
              className={`w-full pl-8 ${globalSearch ? 'pr-8' : 'pr-3'} py-2 rounded-xl text-xs font-mono border transition-all ${
                isSearchOpen 
                  ? 'border-sky-500/60 bg-slate-900 text-slate-100 shadow-[0_0_16px_rgba(56,189,248,0.15)] ring-1 ring-sky-500/30' 
                  : 'border-slate-700/60 bg-slate-900/80 text-slate-200 hover:border-slate-600 focus:outline-none placeholder:text-slate-500'
              }`}
            />

            {/* Clear Input Button */}
            {globalSearch && (
              <button
                type="button"
                onClick={() => {
                  setGlobalSearch('');
                  searchInputRef.current?.focus();
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-md hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
                title="Clear search query"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Recent Searches & Suggestions Dropdown */}
          {isSearchOpen && (
            <div 
              id="global-search-dropdown"
              className="absolute left-0 right-0 top-full mt-1.5 bg-slate-900/98 border border-slate-700/80 rounded-xl shadow-2xl backdrop-blur-xl z-50 overflow-hidden font-sans animate-in fade-in slide-in-from-top-1 duration-150"
              style={{ minWidth: '320px' }}
            >
              {/* Recent Searches Section */}
              <div className="p-2 border-b border-slate-800">
                <div className="flex items-center justify-between px-2 py-1 text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">
                  <div className="flex items-center space-x-1.5 text-sky-400">
                    <History className="w-3.5 h-3.5" />
                    <span>Recent Searches</span>
                  </div>
                  {recentSearches.length > 0 && (
                    <button
                      onClick={clearAllRecentSearches}
                      className="text-[10px] text-slate-500 hover:text-rose-400 transition-colors font-sans normal-case tracking-normal hover:underline"
                    >
                      Clear history
                    </button>
                  )}
                </div>

                {filteredRecent.length === 0 ? (
                  <div className="py-3 px-2 text-center text-xs text-slate-500 font-mono">
                    {globalSearch.trim() ? (
                      <span>No matching recent searches</span>
                    ) : (
                      <span>No recent searches yet</span>
                    )}
                  </div>
                ) : (
                  <div className="space-y-0.5 mt-1">
                    {filteredRecent.map((item, idx) => (
                      <div
                        key={idx}
                        onClick={() => handleSelectSearch(item)}
                        className="group flex items-center justify-between px-2.5 py-1.5 rounded-lg hover:bg-slate-800/80 text-xs text-slate-300 hover:text-white cursor-pointer transition-colors"
                      >
                        <div className="flex items-center space-x-2 min-w-0 flex-1">
                          <Clock className="w-3 h-3 text-slate-500 group-hover:text-sky-400 shrink-0 transition-colors" />
                          <span className="font-mono text-xs truncate group-hover:text-sky-200">
                            {item}
                          </span>
                          {item.startsWith('#') ? (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-sky-500/20 text-sky-300 font-mono">tag</span>
                          ) : item.includes('.') ? (
                            <span className="text-[9px] px-1.5 py-0.2 rounded bg-indigo-500/20 text-indigo-300 font-mono">event</span>
                          ) : null}
                        </div>

                        <div className="flex items-center space-x-1 pl-2 shrink-0">
                          <button
                            onClick={(e) => removeRecentSearch(e, item)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-rose-500/20 hover:text-rose-300 text-slate-500 transition-all"
                            title="Remove from recent searches"
                          >
                            <X className="w-3 h-3" />
                          </button>
                          <ChevronRight className="w-3 h-3 text-slate-600 group-hover:text-slate-400 transition-colors" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Quick Preset Queries & Tags */}
              <div className="p-2 bg-slate-950/50">
                <div className="flex items-center space-x-1.5 px-2 py-1 text-[11px] font-mono font-semibold uppercase tracking-wider text-slate-400">
                  <Sparkles className="w-3 h-3 text-amber-400" />
                  <span>Popular Telemetry Filters</span>
                </div>
                <div className="grid grid-cols-2 gap-1 mt-1 px-1">
                  {QUICK_SUGGESTIONS.map((sug, i) => (
                    <button
                      key={i}
                      onClick={() => handleSelectSearch(sug.query)}
                      className="flex items-center space-x-1.5 px-2 py-1.5 rounded-lg bg-slate-800/40 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-left transition-all group"
                    >
                      {sug.category === 'tag' ? (
                        <Tag className="w-3 h-3 text-emerald-400 shrink-0" />
                      ) : sug.category === 'status' ? (
                        <ShieldAlert className="w-3 h-3 text-rose-400 shrink-0" />
                      ) : sug.category === 'actor' ? (
                        <Bot className="w-3 h-3 text-purple-400 shrink-0" />
                      ) : (
                        <Layers className="w-3 h-3 text-sky-400 shrink-0" />
                      )}
                      <span className="text-[11px] font-mono text-slate-300 group-hover:text-white truncate">
                        {sug.label}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Footer navigation hint */}
              <div className="px-3 py-1.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between text-[10px] text-slate-500 font-mono">
                <div className="flex items-center space-x-2">
                  <span className="flex items-center space-x-0.5">
                    <span className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">↵</span>
                    <span>to search</span>
                  </span>
                  <span>•</span>
                  <span className="flex items-center space-x-0.5">
                    <span className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-slate-400">esc</span>
                    <span>to dismiss</span>
                  </span>
                </div>
                <span className="text-slate-400">Cascade Ledger</span>
              </div>
            </div>
          )}
        </div>

        {/* Ingest New Harvest Action */}
        <button
          onClick={onOpenSimulator}
          className="flex items-center space-x-1.5 px-4 py-2 rounded-xl bg-blue-500 hover:bg-blue-400 text-white text-xs font-semibold shadow-[0_0_15px_rgba(59,130,246,0.3)] transition-all"
        >
          <PlusCircle className="w-3.5 h-3.5" />
          <span>Harvest Transcript</span>
        </button>
      </div>
    </header>
  );
};

