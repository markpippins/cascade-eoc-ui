import React, { useState, useMemo, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  X, 
  GitFork, 
  Workflow, 
  Download, 
  ChevronLeft, 
  ChevronRight, 
  ArrowUpRight,
  Sparkles,
  Bot,
  User,
  Server,
  Layers,
  Clock,
  CheckCircle2,
  AlertTriangle,
  AlertOctagon,
  ShieldCheck,
  Activity,
  CheckSquare,
  Tag,
  Flame,
  Zap,
  Cpu,
  RefreshCw,
  SlidersHorizontal,
  Plus,
  ShieldAlert,
  Bug,
  Info,
  Sliders,
  Table,
  Columns,
  BarChart3,
  Fingerprint
} from 'lucide-react';
import { useAppTheme } from '../context/ThemeContext';
import { 
  EventEnvelope, 
  EventFilterState, 
  EventHealthStatus, 
  EventVisualStatus,
  EventSeverityLevel, 
  EventOriginTier, 
  SystemFamily 
} from '../types';
import { cascadeStore } from '../services/cascadeService';
import { 
  getStageColor, 
  mapEventTypeToStage, 
  getEventHealthInfo,
  getEventStatusBadge,
  getEventSeverity,
  getEventOrigin,
  getEventTags,
  ORIGIN_TIERS_INFO,
  SYSTEM_FAMILIES_INFO
} from '../services/mockDataGenerator';
import { EventTimelineDensityView } from './EventTimelineDensityView';
import { ThresholdHighlightControl } from './ThresholdHighlightControl';
import { ColumnVisibilityToggle } from './ColumnVisibilityToggle';
import { 
  loadColumnVisibility, 
  saveColumnVisibility, 
  ColumnVisibilityMap, 
  AVAILABLE_COLUMNS 
} from '../utils/columnVisibility';
import { 
  loadThresholdHighlightConfig, 
  saveThresholdHighlightConfig, 
  evaluateEventThresholdBreach, 
  getRowHighlightClasses, 
  ThresholdHighlightConfig, 
  EventThresholdBreach 
} from '../utils/thresholdHighlighting';

interface EventLedgerViewProps {
  onSelectEvent: (event: EventEnvelope) => void;
  onOpenLineage: (eventId: string) => void;
  onOpenPipeline: (correlationId: string) => void;
  onOpenBatch?: () => void;
  initialSearch?: string;
}

export const EventLedgerView: React.FC<EventLedgerViewProps> = ({
  onSelectEvent,
  onOpenLineage,
  onOpenPipeline,
  onOpenBatch,
  initialSearch = ''
}) => {
  const { themeClasses, isSteel, isDark } = useAppTheme();

  const [viewMode, setViewMode] = useState<'table' | 'timeline' | 'split'>('split');
  const [filters, setFilters] = useState<EventFilterState>({
    type: '',
    source: '',
    aggregate_type: '',
    aggregate_id: '',
    correlation_id: '',
    actor_type: '',
    status: 'all',
    health_status: 'all',
    severity: 'all',
    severities: [],
    event_origin: 'all',
    origin_tier: 'all',
    selected_tags: [],
    metadata_key: '',
    metadata_value: '',
    system_family: 'all',
    nats_subject: '',
    flagged_status: 'all',
    search: initialSearch,
    since: '',
    until: '',
    limit: 50,
    offset: 0
  });

  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [tagInput, setTagInput] = useState('');

  // Synchronize search if header global search updates
  useEffect(() => {
    setFilters(prev => {
      if (prev.search === initialSearch) return prev;
      return {
        ...prev,
        search: initialSearch,
        offset: 0
      };
    });
  }, [initialSearch]);

  // Query events using store API
  const queryResult = useMemo(() => {
    return cascadeStore.getEvents(filters);
  }, [filters, cascadeStore]);

  const { events, total, limit, offset } = queryResult;
  const totalPages = Math.ceil(total / limit) || 1;
  const currentPage = Math.floor(offset / limit) + 1;

  // Threshold-based highlighting configuration state (with persistent storage)
  const [thresholdConfig, setThresholdConfig] = useState<ThresholdHighlightConfig>(loadThresholdHighlightConfig);

  const handleThresholdConfigChange = (newConfig: ThresholdHighlightConfig) => {
    setThresholdConfig(newConfig);
    saveThresholdHighlightConfig(newConfig);
  };

  // Evaluate breach status for each visible event in memory
  const eventBreachMap = useMemo(() => {
    const map = new Map<string, EventThresholdBreach>();
    events.forEach(evt => {
      map.set(evt.event_id, evaluateEventThresholdBreach(evt, thresholdConfig));
    });
    return map;
  }, [events, thresholdConfig]);

  // If user activated "Only show breached rows", filter the displayed rows
  const displayedEvents = useMemo(() => {
    if (!thresholdConfig.enabled || !thresholdConfig.onlyShowBreachedRows) {
      return events;
    }
    return events.filter(evt => eventBreachMap.get(evt.event_id)?.isBreached);
  }, [events, thresholdConfig.enabled, thresholdConfig.onlyShowBreachedRows, eventBreachMap]);

  // Aggregate breach metrics for visible events
  const breachStats = useMemo(() => {
    let totalBreached = 0;
    let latencyBreached = 0;
    let errorBreached = 0;

    events.forEach(evt => {
      const b = eventBreachMap.get(evt.event_id);
      if (b?.isBreached) {
        totalBreached++;
        if (b.isHighLatency) latencyBreached++;
        if (b.hasErrorCode) errorBreached++;
      }
    });

    return {
      totalBreached,
      latencyBreached,
      errorBreached,
      totalVisible: events.length
    };
  }, [events, eventBreachMap]);

  // Breach IDs for quick scrolling / navigation
  const breachedIds = useMemo(() => {
    return displayedEvents
      .filter(evt => eventBreachMap.get(evt.event_id)?.isBreached)
      .map(evt => evt.event_id);
  }, [displayedEvents, eventBreachMap]);

  const [activeBreachIndex, setActiveBreachIndex] = useState<number>(-1);

  const handleJumpToNextBreach = () => {
    if (breachedIds.length === 0) return;
    const nextIdx = (activeBreachIndex + 1) % breachedIds.length;
    setActiveBreachIndex(nextIdx);
    const targetId = breachedIds[nextIdx];
    const el = document.getElementById(`ledger-row-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  const handleJumpToPrevBreach = () => {
    if (breachedIds.length === 0) return;
    const prevIdx = activeBreachIndex <= 0 ? breachedIds.length - 1 : activeBreachIndex - 1;
    setActiveBreachIndex(prevIdx);
    const targetId = breachedIds[prevIdx];
    const el = document.getElementById(`ledger-row-${targetId}`);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  };

  // Column visibility configuration state (with persistent storage)
  const [columnVisibility, setColumnVisibility] = useState<ColumnVisibilityMap>(loadColumnVisibility);

  const handleColumnVisibilityChange = (newVisibility: ColumnVisibilityMap) => {
    setColumnVisibility(newVisibility);
    saveColumnVisibility(newVisibility);
  };

  const visibleColumnCount = useMemo(() => {
    return AVAILABLE_COLUMNS.filter(col => columnVisibility[col.id]).length;
  }, [columnVisibility]);

  // Calculate live global severity & health metrics
  const telemetryStats = useMemo(() => {
    const rawAll = cascadeStore.getEvents({ limit: 1000, offset: 0 }).events;
    let criticalCount = 0;
    let errorCount = 0;
    let warningCount = 0;
    let infoCount = 0;
    let debugCount = 0;

    let successCount = 0;
    let pendingCount = 0;
    let failureCount = 0;
    let warningStatusCount = 0;

    // Collect tag frequencies
    const tagFrequencies: Record<string, number> = {};

    rawAll.forEach(evt => {
      const sev = getEventSeverity(evt);
      if (sev.level === 'critical') criticalCount++;
      else if (sev.level === 'error') errorCount++;
      else if (sev.level === 'warning') warningCount++;
      else if (sev.level === 'info') infoCount++;
      else if (sev.level === 'debug') debugCount++;

      const st = getEventStatusBadge(evt);
      if (st.status === 'Success') successCount++;
      else if (st.status === 'Pending') pendingCount++;
      else if (st.status === 'Failure') failureCount++;
      else if (st.status === 'Warning') warningStatusCount++;

      const eTags = getEventTags(evt);
      eTags.forEach(t => {
        tagFrequencies[t] = (tagFrequencies[t] || 0) + 1;
      });
    });

    const tot = rawAll.length || 1;
    const sortedTags = Object.entries(tagFrequencies)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 14);

    return {
      total: rawAll.length,
      critical: criticalCount,
      error: errorCount,
      warning: warningCount,
      info: infoCount,
      debug: debugCount,
      statusCounts: {
        success: successCount,
        pending: pendingCount,
        failure: failureCount,
        warning: warningStatusCount
      },
      criticalPct: Math.round((criticalCount / tot) * 100),
      errorPct: Math.round((errorCount / tot) * 100),
      warningPct: Math.round((warningCount / tot) * 100),
      infoPct: Math.round((infoCount / tot) * 100),
      debugPct: Math.round((debugCount / tot) * 100),
      popularTags: sortedTags
    };
  }, [events]);

  const handlePageChange = (newPage: number) => {
    const newOffset = (newPage - 1) * limit;
    setFilters(prev => ({ ...prev, offset: newOffset }));
  };

  const handleResetFilters = () => {
    setFilters({
      type: '',
      source: '',
      aggregate_type: '',
      aggregate_id: '',
      correlation_id: '',
      actor_type: '',
      status: 'all',
      health_status: 'all',
      severity: 'all',
      severities: [],
      event_origin: 'all',
      origin_tier: 'all',
      selected_tags: [],
      metadata_key: '',
      metadata_value: '',
      system_family: 'all',
      nats_subject: '',
      flagged_status: 'all',
      search: '',
      since: '',
      until: '',
      limit: 50,
      offset: 0
    });
    setTagInput('');
  };

  const handleAddTag = (tag: string) => {
    const cleanTag = tag.trim().startsWith('#') ? tag.trim() : `#${tag.trim()}`;
    if (!cleanTag || cleanTag === '#') return;
    if (filters.selected_tags?.includes(cleanTag)) return;

    setFilters(prev => ({
      ...prev,
      selected_tags: [...(prev.selected_tags || []), cleanTag],
      offset: 0
    }));
    setTagInput('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFilters(prev => ({
      ...prev,
      selected_tags: (prev.selected_tags || []).filter(t => t !== tagToRemove),
      offset: 0
    }));
  };

  const handleToggleSeverity = (level: EventSeverityLevel) => {
    const current = filters.severities || [];
    const exists = current.includes(level);
    const updated = exists ? current.filter(l => l !== level) : [...current, level];

    setFilters(prev => ({
      ...prev,
      severities: updated,
      severity: updated.length === 1 ? updated[0] : 'all',
      offset: 0
    }));
  };

  const handleTimeSliceSelect = (sinceIso: string, untilIso: string) => {
    setFilters(prev => ({
      ...prev,
      since: sinceIso,
      until: untilIso,
      offset: 0
    }));
  };

  const handleClearTimeFilter = () => {
    setFilters(prev => ({
      ...prev,
      since: '',
      until: '',
      offset: 0
    }));
  };

  const handleApplyPreset = (presetKey: string) => {
    handleResetFilters();
    switch (presetKey) {
      case 'critical_errors':
        setFilters(prev => ({ ...prev, severities: ['critical', 'error'], offset: 0 }));
        break;
      case 'rover_ingest':
        setFilters(prev => ({ ...prev, origin_tier: 'rover-ingest', event_origin: 'rover-ingest', offset: 0 }));
        break;
      case 'harness_devloop':
        setFilters(prev => ({ ...prev, origin_tier: 'harness-devloop', event_origin: 'harness-devloop', offset: 0 }));
        break;
      case 'mcp_gateway':
        setFilters(prev => ({ ...prev, origin_tier: 'mcp-gateway', event_origin: 'mcp-gateway', offset: 0 }));
        break;
      case 'circuits_drifts':
        setFilters(prev => ({ ...prev, search: 'drift tripped breaker', offset: 0 }));
        break;
      case 'flagged_audit':
        setFilters(prev => ({ ...prev, flagged_status: 'flagged', offset: 0 }));
        break;
      case 'audio_pipeline':
        setFilters(prev => ({ ...prev, selected_tags: ['#audio-stream'], offset: 0 }));
        break;
      default:
        break;
    }
  };

  const handleExportJSON = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(events, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `cascade_events_filtered_${Date.now()}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  };

  const getActorIcon = (actorType: string) => {
    switch (actorType) {
      case 'user': return <User className="w-3 h-3 text-blue-400" />;
      case 'agent': return <Bot className="w-3 h-3 text-emerald-400" />;
      default: return <Server className="w-3 h-3 text-amber-400" />;
    }
  };

  const hasActiveFilters = Boolean(
    filters.type || 
    filters.source || 
    filters.aggregate_type || 
    filters.aggregate_id || 
    filters.correlation_id || 
    filters.actor_type || 
    (filters.status && filters.status !== 'all') ||
    (filters.health_status && filters.health_status !== 'all') ||
    (filters.severity && filters.severity !== 'all') ||
    (filters.severities && filters.severities.length > 0) ||
    (filters.origin_tier && filters.origin_tier !== 'all') ||
    (filters.event_origin && filters.event_origin !== 'all') ||
    (filters.selected_tags && filters.selected_tags.length > 0) ||
    filters.metadata_key ||
    filters.metadata_value ||
    (filters.system_family && filters.system_family !== 'all') ||
    filters.nats_subject ||
    (filters.flagged_status && filters.flagged_status !== 'all') ||
    filters.search || 
    filters.since || 
    filters.until
  );

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto">
      {/* Top Granular Severity Metrics Strip (Clickable Filter Toggles) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {/* All Events Card */}
        <button
          onClick={() => setFilters(prev => ({ ...prev, severities: [], severity: 'all', health_status: 'all', offset: 0 }))}
          className={`p-3 rounded-xl border text-left transition-all ${
            (!filters.severities || filters.severities.length === 0) && filters.severity === 'all' && filters.health_status === 'all'
              ? 'bg-sky-500/15 border-sky-500/50 ring-1 ring-sky-500/40 shadow-sm'
              : `${themeClasses.border} ${themeClasses.bgCard} hover:border-slate-600`
          }`}
        >
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>All Ledger</span>
            <Activity className="w-3.5 h-3.5 text-sky-400" />
          </div>
          <div className="mt-1 flex items-baseline space-x-1.5">
            <span className="text-xl font-bold font-mono text-slate-100">{telemetryStats.total}</span>
            <span className="text-[10px] text-slate-400 font-mono">100%</span>
          </div>
        </button>

        {/* Critical Severity Card */}
        <button
          onClick={() => handleToggleSeverity('critical')}
          className={`p-3 rounded-xl border text-left transition-all relative overflow-hidden ${
            filters.severities?.includes('critical') || filters.severity === 'critical'
              ? 'bg-red-500/20 border-red-500/60 ring-1 ring-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.2)]'
              : `${themeClasses.border} ${themeClasses.bgCard} hover:border-red-500/40`
          }`}
        >
          <div className="flex items-center justify-between text-xs font-mono text-red-400">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <span className="font-bold">CRITICAL</span>
            </div>
            <ShieldAlert className="w-3.5 h-3.5 text-red-400" />
          </div>
          <div className="mt-1 flex items-baseline space-x-1.5">
            <span className="text-xl font-bold font-mono text-red-300">{telemetryStats.critical}</span>
            <span className="text-[10px] text-red-400/80 font-mono">{telemetryStats.criticalPct}%</span>
          </div>
        </button>

        {/* Error Severity Card */}
        <button
          onClick={() => handleToggleSeverity('error')}
          className={`p-3 rounded-xl border text-left transition-all ${
            filters.severities?.includes('error') || filters.severity === 'error'
              ? 'bg-rose-500/20 border-rose-500/60 ring-1 ring-rose-500/50 shadow-sm'
              : `${themeClasses.border} ${themeClasses.bgCard} hover:border-rose-500/40`
          }`}
        >
          <div className="flex items-center justify-between text-xs font-mono text-rose-400">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-rose-400" />
              <span className="font-semibold">ERROR</span>
            </div>
            <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="mt-1 flex items-baseline space-x-1.5">
            <span className="text-xl font-bold font-mono text-rose-300">{telemetryStats.error}</span>
            <span className="text-[10px] text-rose-400/80 font-mono">{telemetryStats.errorPct}%</span>
          </div>
        </button>

        {/* Warning Severity Card */}
        <button
          onClick={() => handleToggleSeverity('warning')}
          className={`p-3 rounded-xl border text-left transition-all ${
            filters.severities?.includes('warning') || filters.severity === 'warning'
              ? 'bg-amber-500/20 border-amber-500/60 ring-1 ring-amber-500/50 shadow-sm'
              : `${themeClasses.border} ${themeClasses.bgCard} hover:border-amber-500/40`
          }`}
        >
          <div className="flex items-center justify-between text-xs font-mono text-amber-400">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.6)]" />
              <span className="font-semibold">WARNING</span>
            </div>
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="mt-1 flex items-baseline space-x-1.5">
            <span className="text-xl font-bold font-mono text-amber-300">{telemetryStats.warning}</span>
            <span className="text-[10px] text-amber-400/80 font-mono">{telemetryStats.warningPct}%</span>
          </div>
        </button>

        {/* Info Severity Card */}
        <button
          onClick={() => handleToggleSeverity('info')}
          className={`p-3 rounded-xl border text-left transition-all ${
            filters.severities?.includes('info') || filters.severity === 'info'
              ? 'bg-blue-500/20 border-blue-500/60 ring-1 ring-blue-500/50 shadow-sm'
              : `${themeClasses.border} ${themeClasses.bgCard} hover:border-blue-500/40`
          }`}
        >
          <div className="flex items-center justify-between text-xs font-mono text-blue-400">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-400" />
              <span className="font-semibold">INFO</span>
            </div>
            <Info className="w-3.5 h-3.5 text-blue-400" />
          </div>
          <div className="mt-1 flex items-baseline space-x-1.5">
            <span className="text-xl font-bold font-mono text-blue-300">{telemetryStats.info}</span>
            <span className="text-[10px] text-blue-400/80 font-mono">{telemetryStats.infoPct}%</span>
          </div>
        </button>

        {/* Debug / Trace Card */}
        <button
          onClick={() => handleToggleSeverity('debug')}
          className={`p-3 rounded-xl border text-left transition-all ${
            filters.severities?.includes('debug') || filters.severity === 'debug'
              ? 'bg-slate-500/20 border-slate-400/60 ring-1 ring-slate-400/50 shadow-sm'
              : `${themeClasses.border} ${themeClasses.bgCard} hover:border-slate-500/40`
          }`}
        >
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <div className="flex items-center space-x-1.5">
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span className="font-semibold">DEBUG</span>
            </div>
            <Bug className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="mt-1 flex items-baseline space-x-1.5">
            <span className="text-xl font-bold font-mono text-slate-300">{telemetryStats.debug}</span>
            <span className="text-[10px] text-slate-400/80 font-mono">{telemetryStats.debugPct}%</span>
          </div>
        </button>
      </div>

      {/* Quick Filter Presets Strip */}
      <div className="flex items-center space-x-2 overflow-x-auto pb-1 text-xs font-mono scrollbar-none">
        <span className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold shrink-0 flex items-center space-x-1">
          <Sparkles className="w-3 h-3 text-amber-400" />
          <span>Presets:</span>
        </span>
        <button
          onClick={() => handleApplyPreset('all')}
          className="px-2.5 py-1 rounded-full bg-slate-800/80 hover:bg-slate-700 text-slate-300 border border-slate-700 whitespace-nowrap transition-all"
        >
          Reset All
        </button>
        <button
          onClick={() => handleApplyPreset('critical_errors')}
          className="px-2.5 py-1 rounded-full bg-red-950/40 hover:bg-red-900/50 text-red-300 border border-red-800/50 whitespace-nowrap transition-all flex items-center space-x-1"
        >
          <ShieldAlert className="w-2.5 h-2.5 text-red-400" />
          <span>Critical & Errors</span>
        </button>
        <button
          onClick={() => handleApplyPreset('rover_ingest')}
          className="px-2.5 py-1 rounded-full bg-emerald-950/40 hover:bg-emerald-900/50 text-emerald-300 border border-emerald-800/50 whitespace-nowrap transition-all flex items-center space-x-1"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
          <span>Rover Audio & Ingest</span>
        </button>
        <button
          onClick={() => handleApplyPreset('harness_devloop')}
          className="px-2.5 py-1 rounded-full bg-rose-950/40 hover:bg-rose-900/50 text-rose-300 border border-rose-800/50 whitespace-nowrap transition-all flex items-center space-x-1"
        >
          <Cpu className="w-2.5 h-2.5 text-rose-400" />
          <span>Dev Harness Loop</span>
        </button>
        <button
          onClick={() => handleApplyPreset('mcp_gateway')}
          className="px-2.5 py-1 rounded-full bg-amber-950/40 hover:bg-amber-900/50 text-amber-300 border border-amber-800/50 whitespace-nowrap transition-all flex items-center space-x-1"
        >
          <Zap className="w-2.5 h-2.5 text-amber-400" />
          <span>MCP Tool Gateway</span>
        </button>
        <button
          onClick={() => handleApplyPreset('circuits_drifts')}
          className="px-2.5 py-1 rounded-full bg-cyan-950/40 hover:bg-cyan-900/50 text-cyan-300 border border-cyan-800/50 whitespace-nowrap transition-all flex items-center space-x-1"
        >
          <Flame className="w-2.5 h-2.5 text-cyan-400" />
          <span>Circuit Trips & Drifts</span>
        </button>
        <button
          onClick={() => handleApplyPreset('flagged_audit')}
          className="px-2.5 py-1 rounded-full bg-purple-950/40 hover:bg-purple-900/50 text-purple-300 border border-purple-800/50 whitespace-nowrap transition-all flex items-center space-x-1"
        >
          <CheckSquare className="w-2.5 h-2.5 text-purple-400" />
          <span>Flagged for Review</span>
        </button>
      </div>

      {/* Main Search & Command Header Bar */}
      <div className={`p-4 rounded-xl border ${themeClasses.border} ${themeClasses.bgCard} shadow-sm space-y-3`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Main search input */}
          <div className="relative flex-1">
            <Search className={`w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 ${themeClasses.textMuted}`} />
            <input
              type="text"
              placeholder="Filter by type, source, aggregate, UUID, payload attributes, or full text query..."
              value={filters.search || ''}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value, offset: 0 }))}
              className={`w-full pl-9 pr-8 py-2 rounded-lg text-xs border ${themeClasses.border} ${themeClasses.inputBg} ${themeClasses.textPrimary} focus:outline-none focus:ring-1 focus:ring-sky-500 placeholder:text-slate-500`}
            />
            {filters.search && (
              <button
                onClick={() => setFilters(prev => ({ ...prev, search: '', offset: 0 }))}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${themeClasses.textMuted} hover:text-white`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Quick Action Controls & View Mode Toggle */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Horizontal View Mode Toggle */}
            <div className="flex items-center space-x-0.5 bg-slate-900/90 p-1 rounded-lg border border-slate-800">
              <button
                onClick={() => setViewMode('timeline')}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono font-medium transition-all ${
                  viewMode === 'timeline'
                    ? 'bg-sky-500/25 border border-sky-500/50 text-sky-200 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Visual Horizontal Timeline & Density View"
              >
                <BarChart3 className="w-3.5 h-3.5 text-sky-400" />
                <span className="hidden sm:inline">Timeline</span>
              </button>

              <button
                onClick={() => setViewMode('split')}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono font-medium transition-all ${
                  viewMode === 'split'
                    ? 'bg-emerald-500/25 border border-emerald-500/50 text-emerald-200 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Split View: Horizontal Density Strip + Detailed Ledger Table"
              >
                <Columns className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Split</span>
              </button>

              <button
                onClick={() => setViewMode('table')}
                className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-md text-xs font-mono font-medium transition-all ${
                  viewMode === 'table'
                    ? 'bg-slate-700 text-white shadow-sm border border-slate-600'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
                title="Classic Ledger Table View"
              >
                <Table className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Table</span>
              </button>
            </div>

            {onOpenBatch && (
              <button
                onClick={onOpenBatch}
                className="flex items-center space-x-1.5 px-3 py-2 rounded-lg border border-blue-500/30 bg-blue-500/10 hover:bg-blue-500/20 text-blue-300 text-xs font-semibold transition-all shadow-sm"
                title="Open in Batch Operations & Review Workbench"
              >
                <CheckSquare className="w-3.5 h-3.5" />
                <span className="hidden md:inline">Batch Workbench</span>
              </button>
            )}

            <button
              onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                showAdvancedFilters || hasActiveFilters
                  ? 'bg-sky-500/20 border-sky-500/40 text-sky-300 ring-1 ring-sky-500/30'
                  : `${themeClasses.border} ${themeClasses.bgMuted} ${themeClasses.textSecondary}`
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Advanced Filters</span>
              {hasActiveFilters && <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />}
            </button>

            <button
              onClick={handleExportJSON}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg border ${themeClasses.border} ${themeClasses.bgMuted} ${themeClasses.textSecondary} hover:text-white text-xs font-medium transition-all`}
              title="Export filtered events as JSON"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Export</span>
            </button>
          </div>
        </div>

        {/* Active Filter Badges Bar (Removable chips) */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t border-slate-800/80 text-[11px] font-mono">
            <span className="text-slate-500 font-semibold mr-1">Active:</span>

            {/* Origin tier badge */}
            {filters.origin_tier && filters.origin_tier !== 'all' && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                <span>Origin: {ORIGIN_TIERS_INFO[filters.origin_tier]?.label || filters.origin_tier}</span>
                <button onClick={() => setFilters(prev => ({ ...prev, origin_tier: 'all', event_origin: 'all', offset: 0 }))}>
                  <X className="w-2.5 h-2.5 hover:text-white" />
                </button>
              </span>
            )}

            {/* Severities badge */}
            {filters.severities && filters.severities.length > 0 && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-red-500/15 text-red-300 border border-red-500/30">
                <span>Severity: {filters.severities.join(', ').toUpperCase()}</span>
                <button onClick={() => setFilters(prev => ({ ...prev, severities: [], severity: 'all', offset: 0 }))}>
                  <X className="w-2.5 h-2.5 hover:text-white" />
                </button>
              </span>
            )}

            {/* Selected Tags badges */}
            {filters.selected_tags?.map(t => (
              <span key={t} className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 border border-sky-500/30">
                <Tag className="w-2.5 h-2.5 text-sky-400" />
                <span>{t}</span>
                <button onClick={() => handleRemoveTag(t)}>
                  <X className="w-2.5 h-2.5 hover:text-white" />
                </button>
              </span>
            ))}

            {/* Metadata key/val badge */}
            {filters.metadata_key && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-300 border border-purple-500/30">
                <span>Meta: {filters.metadata_key}{filters.metadata_value ? `=${filters.metadata_value}` : ''}</span>
                <button onClick={() => setFilters(prev => ({ ...prev, metadata_key: '', metadata_value: '', offset: 0 }))}>
                  <X className="w-2.5 h-2.5 hover:text-white" />
                </button>
              </span>
            )}

            {/* Source badge */}
            {filters.source && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-indigo-500/15 text-indigo-300 border border-indigo-500/30">
                <span>Source: {filters.source}</span>
                <button onClick={() => setFilters(prev => ({ ...prev, source: '', offset: 0 }))}>
                  <X className="w-2.5 h-2.5 hover:text-white" />
                </button>
              </span>
            )}

            {/* Actor badge */}
            {filters.actor_type && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-300 border border-cyan-500/30">
                <span>Actor: {filters.actor_type}</span>
                <button onClick={() => setFilters(prev => ({ ...prev, actor_type: '', offset: 0 }))}>
                  <X className="w-2.5 h-2.5 hover:text-white" />
                </button>
              </span>
            )}

            {/* Flagged Status badge */}
            {filters.flagged_status && filters.flagged_status !== 'all' && (
              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30">
                <span>Flag: {filters.flagged_status}</span>
                <button onClick={() => setFilters(prev => ({ ...prev, flagged_status: 'all', offset: 0 }))}>
                  <X className="w-2.5 h-2.5 hover:text-white" />
                </button>
              </span>
            )}

            <button
              onClick={handleResetFilters}
              className="text-xs text-rose-400 hover:text-rose-300 underline underline-offset-2 ml-1"
            >
              Clear all
            </button>
          </div>
        )}

        {/* Advanced Filters Expandable Multi-Section Drawer */}
        {showAdvancedFilters && (
          <div className={`pt-4 border-t ${themeClasses.borderSubtle} space-y-4 animate-fadeIn`}>
            {/* Section 1: Event Origin & Subsystems */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                  <Cpu className="w-3 h-3 text-emerald-400" />
                  <span>Event Origin & Topology Subsystem</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Filter by generating architecture tier</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                {Object.values(ORIGIN_TIERS_INFO).map(info => {
                  const isSelected = (filters.origin_tier === info.tier) || (info.tier === 'all' && (!filters.origin_tier || filters.origin_tier === 'all'));
                  return (
                    <button
                      key={info.tier}
                      onClick={() => setFilters(prev => ({
                        ...prev,
                        origin_tier: info.tier,
                        event_origin: info.tier,
                        offset: 0
                      }))}
                      className={`p-2 rounded-lg border text-left transition-all ${
                        isSelected 
                          ? 'bg-emerald-500/20 border-emerald-500/60 ring-1 ring-emerald-500/40 text-emerald-200' 
                          : 'bg-slate-900/60 border-slate-800 hover:border-slate-700 text-slate-400'
                      }`}
                    >
                      <div className="text-[11px] font-bold truncate">{info.label}</div>
                      <div className="text-[9px] text-slate-500 truncate mt-0.5">{info.subsystem}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 2: Specific Severity Levels & Health Status */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                  <ShieldAlert className="w-3 h-3 text-red-400" />
                  <span>Specific Severity Levels</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Multi-select severity threshold filters</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {(['critical', 'error', 'warning', 'info', 'debug'] as EventSeverityLevel[]).map(sev => {
                  const isChecked = filters.severities?.includes(sev) || filters.severity === sev;
                  const sevInfo = {
                    critical: { label: 'CRITICAL', color: 'bg-red-500/20 text-red-300 border-red-500/50' },
                    error: { label: 'ERROR', color: 'bg-rose-500/20 text-rose-300 border-rose-500/50' },
                    warning: { label: 'WARNING', color: 'bg-amber-500/20 text-amber-300 border-amber-500/50' },
                    info: { label: 'INFO', color: 'bg-blue-500/20 text-blue-300 border-blue-500/50' },
                    debug: { label: 'DEBUG', color: 'bg-slate-500/20 text-slate-300 border-slate-500/50' }
                  }[sev];

                  return (
                    <button
                      key={sev}
                      onClick={() => handleToggleSeverity(sev)}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-all flex items-center space-x-1.5 ${
                        isChecked 
                          ? `${sevInfo.color} ring-1 ring-white/20 shadow-sm` 
                          : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${isChecked ? 'bg-white' : 'bg-slate-600'}`} />
                      <span>{sevInfo.label}</span>
                    </button>
                  );
                })}

                <button
                  onClick={() => setFilters(prev => ({ ...prev, severities: [], severity: 'all', offset: 0 }))}
                  className="px-2.5 py-1.5 rounded-lg border border-slate-800 text-slate-500 hover:text-slate-300 text-xs font-mono transition-all"
                >
                  Clear Severity
                </button>
              </div>
            </div>

            {/* Section 2b: Visual Status Badges (Success / Pending / Failure) */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                  <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                  <span>Event Status Badges</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Filter by execution status & metadata outcome</span>
              </div>

              <div className="flex flex-wrap gap-2">
                {(['all', 'Success', 'Pending', 'Failure', 'Warning'] as const).map(st => {
                  const isSelected = (filters.status || 'all') === st;
                  const stInfo = {
                    all: { label: 'All Statuses', color: 'bg-slate-700 text-white border-slate-600' },
                    Success: { label: 'Success', color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/50' },
                    Pending: { label: 'Pending', color: 'bg-amber-500/20 text-amber-300 border-amber-500/50' },
                    Failure: { label: 'Failure', color: 'bg-rose-500/20 text-rose-300 border-rose-500/50' },
                    Warning: { label: 'Warning', color: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50' }
                  }[st];

                  return (
                    <button
                      key={st}
                      onClick={() => setFilters(prev => ({ ...prev, status: st, offset: 0 }))}
                      className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-all flex items-center space-x-1.5 ${
                        isSelected
                          ? `${stInfo.color} ring-1 ring-white/20 shadow-sm`
                          : 'bg-slate-900/60 border-slate-800 text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      {st === 'Success' && <CheckCircle2 className="w-3 h-3 text-emerald-400" />}
                      {st === 'Pending' && <Clock className="w-3 h-3 text-amber-400" />}
                      {st === 'Failure' && <AlertOctagon className="w-3 h-3 text-rose-400" />}
                      {st === 'Warning' && <AlertTriangle className="w-3 h-3 text-yellow-400" />}
                      <span>{stInfo.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Section 3: Metadata Tags & Payload Attributes */}
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-slate-400 flex items-center space-x-1.5">
                  <Tag className="w-3 h-3 text-sky-400" />
                  <span>Metadata Tags & Attributes</span>
                </span>
                <span className="text-[10px] text-slate-500 font-mono">Select popular tags or query custom payload attributes</span>
              </div>

              {/* Tag Cloud & Custom Tag Input */}
              <div className="flex flex-wrap items-center gap-1.5">
                {telemetryStats.popularTags.map(([tag, count]) => {
                  const isSelected = filters.selected_tags?.includes(tag);
                  return (
                    <button
                      key={tag}
                      onClick={() => isSelected ? handleRemoveTag(tag) : handleAddTag(tag)}
                      className={`px-2.5 py-1 rounded-full text-xs font-mono transition-all flex items-center space-x-1 border ${
                        isSelected
                          ? 'bg-sky-500/25 border-sky-500/60 text-sky-200 ring-1 ring-sky-500/40'
                          : 'bg-slate-900/80 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                      }`}
                    >
                      <span>{tag}</span>
                      <span className="text-[10px] opacity-60">({count})</span>
                    </button>
                  );
                })}

                {/* Custom Tag Input */}
                <div className="flex items-center space-x-1 bg-slate-900 border border-slate-800 rounded-full px-2 py-0.5">
                  <input
                    type="text"
                    placeholder="+ custom tag (e.g. #canary)"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleAddTag(tagInput);
                      }
                    }}
                    className="bg-transparent text-xs font-mono text-slate-200 focus:outline-none placeholder:text-slate-600 w-36"
                  />
                  {tagInput && (
                    <button
                      onClick={() => handleAddTag(tagInput)}
                      className="p-0.5 rounded-full bg-sky-500/20 text-sky-300 hover:bg-sky-500/30"
                    >
                      <Plus className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Section 4: Detailed Input Matrix (Source, Actor, System Family, Payload Key/Value, Review Status) */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-2 border-t border-slate-800/60">
              {/* Source Producer */}
              <div>
                <label className={`block text-[10px] font-mono font-bold uppercase tracking-wider ${themeClasses.textMuted} mb-1`}>
                  Source Producer
                </label>
                <input
                  type="text"
                  placeholder="e.g. rover.planner"
                  value={filters.source || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, source: e.target.value, offset: 0 }))}
                  className={`w-full px-2.5 py-1.5 rounded-md text-xs border ${themeClasses.border} ${themeClasses.inputBg} ${themeClasses.textPrimary}`}
                />
              </div>

              {/* Event Type */}
              <div>
                <label className={`block text-[10px] font-mono font-bold uppercase tracking-wider ${themeClasses.textMuted} mb-1`}>
                  Event Type Pattern
                </label>
                <input
                  type="text"
                  placeholder="e.g. harvest.captured"
                  value={filters.type || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, type: e.target.value, offset: 0 }))}
                  className={`w-full px-2.5 py-1.5 rounded-md text-xs border ${themeClasses.border} ${themeClasses.inputBg} ${themeClasses.textPrimary}`}
                />
              </div>

              {/* System Family */}
              <div>
                <label className={`block text-[10px] font-mono font-bold uppercase tracking-wider ${themeClasses.textMuted} mb-1`}>
                  System Family
                </label>
                <select
                  value={filters.system_family || 'all'}
                  onChange={(e) => setFilters(prev => ({ ...prev, system_family: e.target.value as SystemFamily | 'all', offset: 0 }))}
                  className={`w-full px-2 py-1.5 rounded-md text-xs border ${themeClasses.border} ${themeClasses.inputBg} ${themeClasses.textPrimary}`}
                >
                  <option value="all">All 13 Families</option>
                  {Object.values(SYSTEM_FAMILIES_INFO).map(f => (
                    <option key={f.id} value={f.id}>{f.name}</option>
                  ))}
                </select>
              </div>

              {/* Actor Type */}
              <div>
                <label className={`block text-[10px] font-mono font-bold uppercase tracking-wider ${themeClasses.textMuted} mb-1`}>
                  Actor Type
                </label>
                <select
                  value={filters.actor_type || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, actor_type: e.target.value, offset: 0 }))}
                  className={`w-full px-2 py-1.5 rounded-md text-xs border ${themeClasses.border} ${themeClasses.inputBg} ${themeClasses.textPrimary}`}
                >
                  <option value="">All Actors</option>
                  <option value="agent">agent (autonomous)</option>
                  <option value="system">system (daemon/srv)</option>
                  <option value="user">user (human)</option>
                </select>
              </div>

              {/* Payload Metadata Key */}
              <div>
                <label className={`block text-[10px] font-mono font-bold uppercase tracking-wider ${themeClasses.textMuted} mb-1`}>
                  Payload Field (Key)
                </label>
                <input
                  type="text"
                  placeholder="e.g. role or latency_ms"
                  value={filters.metadata_key || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, metadata_key: e.target.value, offset: 0 }))}
                  className={`w-full px-2.5 py-1.5 rounded-md text-xs border ${themeClasses.border} ${themeClasses.inputBg} ${themeClasses.textPrimary}`}
                />
              </div>

              {/* Payload Metadata Value */}
              <div>
                <label className={`block text-[10px] font-mono font-bold uppercase tracking-wider ${themeClasses.textMuted} mb-1`}>
                  Field Contains (Val)
                </label>
                <input
                  type="text"
                  placeholder="e.g. autonomous_coder"
                  value={filters.metadata_value || ''}
                  onChange={(e) => setFilters(prev => ({ ...prev, metadata_value: e.target.value, offset: 0 }))}
                  className={`w-full px-2.5 py-1.5 rounded-md text-xs border ${themeClasses.border} ${themeClasses.inputBg} ${themeClasses.textPrimary}`}
                />
              </div>
            </div>

            {/* Quick Time Bounds Strip */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800/60 text-xs font-mono">
              <div className="flex items-center space-x-2">
                <span className="text-slate-500 font-semibold">Time Intervals:</span>
                <button
                  onClick={() => {
                    const d = new Date(Date.now() - 15 * 60 * 1000).toISOString();
                    setFilters(prev => ({ ...prev, since: d, until: '', offset: 0 }));
                  }}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                >
                  Last 15m
                </button>
                <button
                  onClick={() => {
                    const d = new Date(Date.now() - 60 * 60 * 1000).toISOString();
                    setFilters(prev => ({ ...prev, since: d, until: '', offset: 0 }));
                  }}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                >
                  Last 1h
                </button>
                <button
                  onClick={() => {
                    const d = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
                    setFilters(prev => ({ ...prev, since: d, until: '', offset: 0 }));
                  }}
                  className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700"
                >
                  Last 24h
                </button>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={handleResetFilters}
                  className="px-3 py-1 rounded bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 transition-all font-semibold"
                >
                  Reset All Filters
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Timeline Density View Mode (when in 'timeline' or 'split' view) */}
      {(viewMode === 'timeline' || viewMode === 'split') && (
        <EventTimelineDensityView
          events={events}
          totalCount={total}
          onSelectEvent={onSelectEvent}
          onOpenLineage={onOpenLineage}
          onOpenPipeline={onOpenPipeline}
          onTimeSliceSelect={handleTimeSliceSelect}
          onClearTimeFilter={handleClearTimeFilter}
          activeTimeSlice={{ since: filters.since, until: filters.until }}
        />
      )}

      {/* Ledger Table View Mode (when in 'table' or 'split' view) */}
      {(viewMode === 'table' || viewMode === 'split') && (
        <>
          {/* Results Meta Header */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-400 px-1 pt-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-300">
                Ledger Data Grid
              </span>
              <span className="text-slate-500">|</span>
              <span>
                Showing <strong className="text-slate-200">{displayedEvents.length}</strong> of <strong className="text-slate-200">{total}</strong> events
              </span>
              {thresholdConfig.enabled && thresholdConfig.onlyShowBreachedRows && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/30 flex items-center space-x-1">
                  <AlertTriangle className="w-2.5 h-2.5 text-amber-400" />
                  <span>Only Breached Rows ({displayedEvents.length})</span>
                  <button 
                    onClick={() => handleThresholdConfigChange({ ...thresholdConfig, onlyShowBreachedRows: false })}
                    className="ml-1 hover:text-white"
                    title="Clear filter and show all events"
                  >
                    ×
                  </button>
                </span>
              )}
              {hasActiveFilters && (
                <span className="text-[10px] px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/30">
                  Filtered View Active
                </span>
              )}

              {/* Quick Status Filter Pills for Fast Scanability */}
              <div className="flex items-center space-x-1 bg-slate-900/80 p-0.5 rounded-lg border border-slate-800 text-xs font-mono ml-1">
                <button
                  onClick={() => setFilters(prev => ({ ...prev, status: 'all', offset: 0 }))}
                  className={`px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                    !filters.status || filters.status === 'all'
                      ? 'bg-slate-700 text-white shadow-xs'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  All ({total})
                </button>
                <button
                  onClick={() => setFilters(prev => ({ ...prev, status: filters.status === 'Success' ? 'all' : 'Success', offset: 0 }))}
                  className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                    filters.status === 'Success'
                      ? 'bg-emerald-500/25 text-emerald-300 border border-emerald-500/50 shadow-xs'
                      : 'text-emerald-400/80 hover:text-emerald-300 hover:bg-emerald-500/10'
                  }`}
                  title="Filter events with Success status"
                >
                  <CheckCircle2 className="w-2.5 h-2.5" />
                  <span>Success ({telemetryStats.statusCounts?.success ?? 0})</span>
                </button>
                <button
                  onClick={() => setFilters(prev => ({ ...prev, status: filters.status === 'Pending' ? 'all' : 'Pending', offset: 0 }))}
                  className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                    filters.status === 'Pending'
                      ? 'bg-amber-500/25 text-amber-300 border border-amber-500/50 shadow-xs'
                      : 'text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10'
                  }`}
                  title="Filter events with Pending status"
                >
                  <Clock className="w-2.5 h-2.5" />
                  <span>Pending ({telemetryStats.statusCounts?.pending ?? 0})</span>
                </button>
                <button
                  onClick={() => setFilters(prev => ({ ...prev, status: filters.status === 'Failure' ? 'all' : 'Failure', offset: 0 }))}
                  className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-semibold transition-all ${
                    filters.status === 'Failure'
                      ? 'bg-rose-500/25 text-rose-300 border border-rose-500/50 shadow-xs'
                      : 'text-rose-400/80 hover:text-rose-300 hover:bg-rose-500/10'
                  }`}
                  title="Filter events with Failure status"
                >
                  <AlertOctagon className="w-2.5 h-2.5" />
                  <span>Failure ({telemetryStats.statusCounts?.failure ?? 0})</span>
                </button>
              </div>

              {/* Threshold Highlighting Control */}
              <ThresholdHighlightControl
                config={thresholdConfig}
                onChangeConfig={handleThresholdConfigChange}
                breachStats={breachStats}
                onJumpToNextBreach={handleJumpToNextBreach}
                onJumpToPrevBreach={handleJumpToPrevBreach}
              />

              {/* Column Visibility Control */}
              <ColumnVisibilityToggle
                visibility={columnVisibility}
                onChange={handleColumnVisibilityChange}
                variant="toolbar"
              />
            </div>

            {/* Page Selector */}
            <div className="flex items-center space-x-2">
              <span className="text-[11px] text-slate-500">
                Page {currentPage} of {totalPages}
              </span>
              <div className="flex items-center space-x-1">
                <button
                  disabled={currentPage <= 1}
                  onClick={() => handlePageChange(currentPage - 1)}
                  className={`p-1 rounded border ${themeClasses.border} ${themeClasses.bgMuted} disabled:opacity-30 disabled:cursor-not-allowed`}
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                </button>
                <button
                  disabled={currentPage >= totalPages}
                  onClick={() => handlePageChange(currentPage + 1)}
                  className={`p-1 rounded border ${themeClasses.border} ${themeClasses.bgMuted} disabled:opacity-30 disabled:cursor-not-allowed`}
                >
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Ledger Table */}
          <div className={`rounded-xl border ${themeClasses.border} ${themeClasses.bgCard} shadow-md overflow-hidden`}>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className={`border-b ${themeClasses.border} ${themeClasses.headerBg} text-[11px] uppercase tracking-wider text-slate-400 select-none`}>
                  <tr>
                    {columnVisibility.timestamp && (
                      <th className="py-3 px-4 font-semibold">Seq / Time</th>
                    )}
                    {columnVisibility.status && (
                      <th className="py-3 px-4 font-semibold min-w-[130px]">Status</th>
                    )}
                    {columnVisibility.severity && (
                      <th className="py-3 px-4 font-semibold">Severity</th>
                    )}
                    {columnVisibility.eventType && (
                      <th className="py-3 px-4 font-semibold">Event Type & Tags</th>
                    )}
                    {columnVisibility.origin && (
                      <th className="py-3 px-4 font-semibold">Origin & Source</th>
                    )}
                    {columnVisibility.traceId && (
                      <th className="py-3 px-4 font-semibold">Trace ID</th>
                    )}
                    {columnVisibility.aggregate && (
                      <th className="py-3 px-4 font-semibold">Aggregate</th>
                    )}
                    {columnVisibility.actor && (
                      <th className="py-3 px-4 font-semibold">Actor</th>
                    )}
                    {columnVisibility.causation && (
                      <th className="py-3 px-4 font-semibold">Causation Parent</th>
                    )}
                    {columnVisibility.actions ? (
                      <th className="py-3 px-4 font-semibold text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <span>Actions</span>
                          <ColumnVisibilityToggle
                            visibility={columnVisibility}
                            onChange={handleColumnVisibilityChange}
                            variant="header"
                          />
                        </div>
                      </th>
                    ) : (
                      <th className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end">
                          <ColumnVisibilityToggle
                            visibility={columnVisibility}
                            onChange={handleColumnVisibilityChange}
                            variant="header"
                          />
                        </div>
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className={`divide-y ${themeClasses.borderSubtle}`}>
                  {displayedEvents.length === 0 ? (
                    <tr>
                      <td colSpan={visibleColumnCount + (!columnVisibility.actions ? 1 : 0)} className="py-14 text-center text-slate-500 space-y-2">
                        <AlertTriangle className="w-6 h-6 text-amber-400 mx-auto opacity-80" />
                        <div className="text-sm font-semibold text-slate-300">
                          {thresholdConfig.enabled && thresholdConfig.onlyShowBreachedRows 
                            ? 'No events breaching threshold on this page' 
                            : 'No matching events in ledger'}
                        </div>
                        <div className="text-xs text-slate-500 max-w-md mx-auto">
                          {thresholdConfig.enabled && thresholdConfig.onlyShowBreachedRows
                            ? `None of the events on this page breach the current ${thresholdConfig.target === 'latency_only' ? `latency (>= ${thresholdConfig.latencyThresholdMs}ms)` : thresholdConfig.target === 'errors_only' ? 'error codes' : `latency (>= ${thresholdConfig.latencyThresholdMs}ms) or error code`} criteria.`
                            : 'Try loosening your filter parameters or resetting the search filter.'}
                        </div>
                        {thresholdConfig.enabled && thresholdConfig.onlyShowBreachedRows ? (
                          <button
                            onClick={() => handleThresholdConfigChange({ ...thresholdConfig, onlyShowBreachedRows: false })}
                            className="mt-2 px-3 py-1.5 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 hover:bg-amber-500/30 transition-all font-mono"
                          >
                            Disable 'Only Breached' Filter
                          </button>
                        ) : (
                          <button
                            onClick={handleResetFilters}
                            className="mt-2 px-3 py-1.5 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30 hover:bg-sky-500/30 transition-all font-mono"
                          >
                            Clear All Filters
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    displayedEvents.map(evt => {
                      const stage = mapEventTypeToStage(evt.event_type);
                      const stageColor = getStageColor(stage);
                      const health = getEventHealthInfo(evt);
                      const statusBadge = getEventStatusBadge(evt);
                      const sev = getEventSeverity(evt);
                      const origin = getEventOrigin(evt);
                      const tags = getEventTags(evt);
                      const breach = eventBreachMap.get(evt.event_id) || evaluateEventThresholdBreach(evt, thresholdConfig);
                      const highlightInfo = getRowHighlightClasses(breach, thresholdConfig, isDark, isSteel);

                      return (
                        <tr 
                          key={evt.event_id} 
                          id={`ledger-row-${evt.event_id}`}
                          className={`${highlightInfo.rowClass ? `${highlightInfo.rowClass} ` : ''}${themeClasses.bgCardHover} transition-colors group cursor-pointer`}
                          onClick={() => onSelectEvent(evt)}
                        >
                          {/* Seq / Time */}
                          {columnVisibility.timestamp && (
                            <td className={`py-3 px-4 whitespace-nowrap ${highlightInfo.borderLeftClass || ''}`}>
                              <div className="flex items-center space-x-1.5">
                                <span className="font-bold text-slate-200">#{evt.sequence_number}</span>
                                {thresholdConfig.enabled && breach.isBreached && (
                                  <span 
                                    className={`inline-flex items-center space-x-1 px-1.5 py-0.2 rounded text-[9px] font-mono font-bold uppercase tracking-wider border shadow-2xs ${breach.badgeClass} ${
                                      highlightInfo.isAnimated ? 'animate-pulse' : ''
                                    }`}
                                    title={breach.primaryReason}
                                  >
                                    {breach.breachType === 'both' ? (
                                      <AlertTriangle className="w-2.5 h-2.5 shrink-0 text-rose-400" />
                                    ) : breach.breachType === 'error' ? (
                                      <ShieldAlert className="w-2.5 h-2.5 shrink-0 text-rose-400" />
                                    ) : (
                                      <Clock className="w-2.5 h-2.5 shrink-0 text-amber-400" />
                                    )}
                                    <span>{breach.badgeLabel}</span>
                                  </span>
                                )}
                              </div>
                              <div className="text-[10px] text-slate-500 flex items-center space-x-1 mt-0.5">
                                <Clock className="w-2.5 h-2.5" />
                                <span>{evt.event_timestamp.slice(11, 19)}</span>
                                {breach.latencyMs > 0 && (
                                  <span 
                                    className={`ml-1 font-mono text-[9px] ${
                                      thresholdConfig.enabled && breach.isHighLatency ? 'text-amber-400 font-semibold' : 'text-slate-500'
                                    }`}
                                    title={`Execution Latency: ${breach.latencyMs}ms (Threshold: ${thresholdConfig.latencyThresholdMs}ms)`}
                                  >
                                    • {breach.latencyMs}ms
                                  </span>
                                )}
                              </div>
                            </td>
                          )}

                          {/* Visual Status Badge based on Metadata */}
                          {columnVisibility.status && (
                            <td className="py-3 px-4 whitespace-nowrap" title={statusBadge.reason}>
                              <div className="space-y-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setFilters(prev => ({
                                      ...prev,
                                      status: prev.status === statusBadge.status ? 'all' : statusBadge.status,
                                      offset: 0
                                    }));
                                  }}
                                  className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-bold border transition-all shadow-xs cursor-pointer ${statusBadge.badgeClass}`}
                                  title={`Status: ${statusBadge.status} (${statusBadge.reason}) • Click to filter`}
                                >
                                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusBadge.dotClass}`} />
                                  {statusBadge.status === 'Success' && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />}
                                  {statusBadge.status === 'Pending' && <Clock className="w-3.5 h-3.5 shrink-0 text-amber-400 animate-pulse" />}
                                  {statusBadge.status === 'Failure' && <AlertOctagon className="w-3.5 h-3.5 shrink-0 text-rose-400" />}
                                  {statusBadge.status === 'Warning' && <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-yellow-400" />}
                                  <span className="tracking-wide">{statusBadge.label}</span>
                                </button>

                                {/* Metadata Context Sublabel */}
                                {statusBadge.sublabel && (
                                  <div 
                                    className="text-[10px] text-slate-400 font-mono truncate max-w-[130px] pl-0.5" 
                                    title={statusBadge.reason}
                                  >
                                    {statusBadge.sublabel}
                                  </div>
                                )}
                              </div>
                            </td>
                          )}

                          {/* Granular Severity Badge */}
                          {columnVisibility.severity && (
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-mono font-bold border transition-all ${sev.badgeClass}`}>
                                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${sev.dotClass}`} />
                                <span>{sev.label}</span>
                              </div>
                            </td>
                          )}

                          {/* Event Type & Metadata Tags */}
                          {columnVisibility.eventType && (
                            <td className="py-3 px-4">
                              <div className="flex items-center space-x-2">
                                <span className={`px-2 py-0.5 rounded text-[10px] font-semibold uppercase tracking-wider border ${stageColor.bg}`}>
                                  {stage}
                                </span>
                                <span className="font-bold text-slate-100 group-hover:text-sky-400 transition-colors">
                                  {evt.event_type}
                                </span>
                              </div>

                              {/* Title or error summary */}
                              {evt.payload?.title && (
                                <div className="text-[10px] text-slate-400 truncate max-w-xs mt-0.5">
                                  {evt.payload.title}
                                </div>
                              )}
                              {health.status === 'failed' && health.reason && (
                                <div className="text-[10px] text-rose-400 truncate max-w-xs mt-0.5 font-sans">
                                  {health.reason}
                                </div>
                              )}

                              {/* Clickable Metadata Tags Chips */}
                              {tags.length > 0 && (
                                <div className="flex flex-wrap gap-1 mt-1.5" onClick={(e) => e.stopPropagation()}>
                                  {tags.slice(0, 3).map(t => (
                                    <button
                                      key={t}
                                      onClick={() => handleAddTag(t)}
                                      className={`text-[9px] px-1.5 py-0.2 rounded border transition-all ${
                                        filters.selected_tags?.includes(t)
                                          ? 'bg-sky-500/25 border-sky-500/50 text-sky-200'
                                          : 'bg-slate-800/80 border-slate-700/60 text-slate-400 hover:text-sky-300 hover:border-slate-600'
                                      }`}
                                      title={`Click to filter by tag ${t}`}
                                    >
                                      {t}
                                    </button>
                                  ))}
                                  {tags.length > 3 && (
                                    <span className="text-[9px] text-slate-500 px-1 py-0.2">
                                      +{tags.length - 3}
                                    </span>
                                  )}
                                </div>
                              )}
                            </td>
                          )}

                          {/* Origin & Source */}
                          {columnVisibility.origin && (
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="space-y-0.5">
                                <div className="flex items-center space-x-1">
                                  <span className={`text-[10px] px-1.5 py-0.2 rounded font-semibold border ${origin.badgeClass}`}>
                                    {origin.label.split(' ')[0]}
                                  </span>
                                </div>
                                <div className="text-sky-400 font-semibold text-[11px] truncate max-w-[130px]" title={evt.source}>
                                  {evt.source}
                                </div>
                              </div>
                            </td>
                          )}

                          {/* Trace ID */}
                          {columnVisibility.traceId && (
                            <td className="py-3 px-4 whitespace-nowrap">
                              {evt.correlation_id || evt.payload?.trace_id || evt.payload?.traceId ? (
                                <div className="space-y-0.5">
                                  <div 
                                    className="flex items-center space-x-1.5 cursor-pointer group/trace"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (evt.correlation_id) {
                                        onOpenPipeline(evt.correlation_id);
                                      }
                                    }}
                                    title={`Trace / Correlation ID: ${evt.correlation_id || evt.payload?.trace_id || evt.payload?.traceId}\nClick to view workflow swimlane`}
                                  >
                                    <Fingerprint className="w-3.5 h-3.5 text-indigo-400 shrink-0 group-hover/trace:text-indigo-300" />
                                    <span className="text-[11px] font-mono font-medium text-indigo-300 group-hover/trace:text-indigo-200 group-hover/trace:underline">
                                      {(evt.correlation_id || evt.payload?.trace_id || evt.payload?.traceId || '').slice(0, 12)}…
                                    </span>
                                  </div>
                                  {evt.payload?.span_id && (
                                    <div className="text-[9px] text-slate-500 font-mono truncate max-w-[100px]">
                                      span:{evt.payload.span_id.slice(0, 8)}
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-600 font-mono">—</span>
                              )}
                            </td>
                          )}

                          {/* Aggregate */}
                          {columnVisibility.aggregate && (
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="text-slate-300">{evt.aggregate_type || '—'}</div>
                              {evt.aggregate_id && (
                                <div className="text-[10px] text-slate-500 truncate max-w-[100px]" title={evt.aggregate_id}>
                                  {evt.aggregate_id.slice(0, 8)}...
                                </div>
                              )}
                            </td>
                          )}

                          {/* Actor */}
                          {columnVisibility.actor && (
                            <td className="py-3 px-4 whitespace-nowrap">
                              <div className="flex items-center space-x-1 text-slate-300 capitalize">
                                {getActorIcon(evt.actor_type)}
                                <span>{evt.actor_type}</span>
                              </div>
                            </td>
                          )}

                          {/* Causation Parent */}
                          {columnVisibility.causation && (
                            <td className="py-3 px-4 whitespace-nowrap">
                              {evt.causation_id ? (
                                <div className="flex items-center space-x-1 text-amber-400 text-[11px]">
                                  <ArrowUpRight className="w-3 h-3" />
                                  <span className="truncate max-w-[120px]" title={evt.caused_by_event_type || evt.causation_id}>
                                    {evt.caused_by_event_type || 'parent'}
                                  </span>
                                </div>
                              ) : (
                                <span className="text-[10px] text-slate-600">root</span>
                              )}
                            </td>
                          )}

                          {/* Actions */}
                          {columnVisibility.actions ? (
                            <td className="py-3 px-4 text-right whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                              <div className="flex items-center justify-end space-x-1.5">
                                <button
                                  onClick={() => onOpenLineage(evt.event_id)}
                                  className="p-1.5 rounded-lg hover:bg-sky-500/20 text-slate-400 hover:text-sky-300 transition-all"
                                  title="Trace in Lineage DAG"
                                >
                                  <GitFork className="w-3.5 h-3.5" />
                                </button>

                                {evt.correlation_id && (
                                  <button
                                    onClick={() => onOpenPipeline(evt.correlation_id!)}
                                    className="p-1.5 rounded-lg hover:bg-indigo-500/20 text-slate-400 hover:text-indigo-300 transition-all"
                                    title="View full workflow swimlane"
                                  >
                                    <Workflow className="w-3.5 h-3.5" />
                                  </button>
                                )}

                                <button
                                  onClick={() => onSelectEvent(evt)}
                                  className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-semibold transition-all"
                                >
                                  Envelope
                                </button>
                              </div>
                            </td>
                          ) : (
                            <td className="py-3 px-3 text-right"></td>
                          )}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
};
