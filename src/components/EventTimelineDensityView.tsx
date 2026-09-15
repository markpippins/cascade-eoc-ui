import React, { useState, useMemo, useRef } from 'react';
import { 
  Clock, 
  Activity, 
  Layers, 
  Cpu, 
  ShieldAlert, 
  AlertOctagon, 
  AlertTriangle, 
  Info, 
  Bug, 
  Sparkles, 
  Filter, 
  ArrowUpRight, 
  GitFork, 
  Workflow, 
  ChevronLeft, 
  ChevronRight, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  Minimize2, 
  Sliders, 
  Flame, 
  CheckCircle2, 
  Calendar,
  Eye,
  RefreshCw,
  Search
} from 'lucide-react';
import { useAppTheme } from '../context/ThemeContext';
import { EventEnvelope, EventSeverityLevel, EventOriginTier, LifecycleStage } from '../types';
import { 
  getEventSeverity, 
  getEventOrigin, 
  getEventTags, 
  mapEventTypeToStage, 
  getStageColor,
  ORIGIN_TIERS_INFO,
  EventSeverityInfo,
  OriginTierInfo
} from '../services/mockDataGenerator';

interface EventTimelineDensityViewProps {
  events: EventEnvelope[];
  totalCount: number;
  onSelectEvent: (event: EventEnvelope) => void;
  onOpenLineage: (eventId: string) => void;
  onOpenPipeline: (correlationId: string) => void;
  onTimeSliceSelect?: (since: string, until: string) => void;
  onClearTimeFilter?: () => void;
  activeTimeSlice?: { since?: string; until?: string };
}

type GroupingMode = 'origin' | 'stage' | 'severity';

interface TimeBucket {
  index: number;
  startTime: number;
  endTime: number;
  startIso: string;
  endIso: string;
  label: string;
  subLabel: string;
  total: number;
  critical: number;
  error: number;
  warning: number;
  info: number;
  debug: number;
  events: EventEnvelope[];
  velocity: number; // events / min
  isPeak: boolean;
  dominantSource: string;
  dominantType: string;
}

export const EventTimelineDensityView: React.FC<EventTimelineDensityViewProps> = ({
  events,
  totalCount,
  onSelectEvent,
  onOpenLineage,
  onOpenPipeline,
  onTimeSliceSelect,
  onClearTimeFilter,
  activeTimeSlice
}) => {
  const { themeClasses } = useAppTheme();

  const [groupingMode, setGroupingMode] = useState<GroupingMode>('origin');
  const [bucketCount, setBucketCount] = useState<number>(36);
  const [selectedBucketIndex, setSelectedBucketIndex] = useState<number | null>(null);
  const [hoveredEvent, setHoveredEvent] = useState<EventEnvelope | null>(null);
  const [hoveredBucket, setHoveredBucket] = useState<TimeBucket | null>(null);
  const [selectedLaneId, setSelectedLaneId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Compute overall min and max timestamps
  const { minTime, maxTime, timeSpanMs } = useMemo(() => {
    if (events.length === 0) {
      const now = Date.now();
      return { minTime: now - 3600000, maxTime: now, timeSpanMs: 3600000 };
    }

    let min = Infinity;
    let max = -Infinity;

    events.forEach(e => {
      const t = new Date(e.event_timestamp).getTime();
      if (!isNaN(t)) {
        if (t < min) min = t;
        if (t > max) max = t;
      }
    });

    if (min === Infinity || max === -Infinity || min === max) {
      const now = Date.now();
      return { minTime: now - 3600000, maxTime: now, timeSpanMs: 3600000 };
    }

    // Add 2% padding on edges for visual elegance
    const span = max - min;
    const pad = Math.max(span * 0.03, 60000); // at least 1 min padding
    return {
      minTime: min - pad,
      maxTime: max + pad,
      timeSpanMs: (max + pad) - (min - pad)
    };
  }, [events]);

  // Compute time buckets for density histogram
  const { buckets, maxBucketTotal, peakBucketIndex, totalDensityEvents } = useMemo(() => {
    if (events.length === 0 || timeSpanMs <= 0) {
      return { buckets: [], maxBucketTotal: 0, peakBucketIndex: -1, totalDensityEvents: 0 };
    }

    const bucketDuration = timeSpanMs / bucketCount;
    const bucketList: TimeBucket[] = [];

    for (let i = 0; i < bucketCount; i++) {
      const bStart = minTime + (i * bucketDuration);
      const bEnd = bStart + bucketDuration;
      const startDate = new Date(bStart);
      const endDate = new Date(bEnd);

      const timeLabel = startDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
      const dateLabel = startDate.toLocaleDateString([], { month: 'short', day: 'numeric' });

      bucketList.push({
        index: i,
        startTime: bStart,
        endTime: bEnd,
        startIso: startDate.toISOString(),
        endIso: endDate.toISOString(),
        label: timeLabel,
        subLabel: dateLabel,
        total: 0,
        critical: 0,
        error: 0,
        warning: 0,
        info: 0,
        debug: 0,
        events: [],
        velocity: 0,
        isPeak: false,
        dominantSource: '',
        dominantType: ''
      });
    }

    let maxTotal = 0;
    let peakIdx = -1;

    events.forEach(evt => {
      const t = new Date(evt.event_timestamp).getTime();
      if (isNaN(t)) return;

      let bIdx = Math.floor(((t - minTime) / timeSpanMs) * bucketCount);
      if (bIdx < 0) bIdx = 0;
      if (bIdx >= bucketCount) bIdx = bucketCount - 1;

      const bucket = bucketList[bIdx];
      if (!bucket) return;

      bucket.events.push(evt);
      bucket.total++;

      const sev = getEventSeverity(evt);
      if (sev.level === 'critical') bucket.critical++;
      else if (sev.level === 'error') bucket.error++;
      else if (sev.level === 'warning') bucket.warning++;
      else if (sev.level === 'info') bucket.info++;
      else if (sev.level === 'debug') bucket.debug++;

      if (bucket.total > maxTotal) {
        maxTotal = bucket.total;
        peakIdx = bIdx;
      }
    });

    // Calculate velocities & dominant metadata
    bucketList.forEach(b => {
      const durationMins = Math.max(bucketDuration / 60000, 0.1);
      b.velocity = parseFloat((b.total / durationMins).toFixed(1));
      if (peakIdx !== -1 && b.index === peakIdx && b.total > 0) {
        b.isPeak = true;
      }

      if (b.events.length > 0) {
        const srcCounts: Record<string, number> = {};
        const typeCounts: Record<string, number> = {};
        b.events.forEach(e => {
          srcCounts[e.source] = (srcCounts[e.source] || 0) + 1;
          typeCounts[e.event_type] = (typeCounts[e.event_type] || 0) + 1;
        });

        b.dominantSource = Object.entries(srcCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
        b.dominantType = Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
      }
    });

    return {
      buckets: bucketList,
      maxBucketTotal: maxTotal,
      peakBucketIndex: peakIdx,
      totalDensityEvents: events.length
    };
  }, [events, minTime, maxTime, timeSpanMs, bucketCount]);

  // Swimlane definitions based on active grouping mode
  const swimlanes = useMemo(() => {
    interface LaneDefinition {
      id: string;
      title: string;
      subtitle: string;
      color: string;
      bgClass: string;
      borderClass: string;
      events: Array<{
        envelope: EventEnvelope;
        leftPct: number;
        severity: EventSeverityInfo;
        origin: OriginTierInfo;
        stage: LifecycleStage;
      }>;
    }

    if (groupingMode === 'origin') {
      const tiers: Record<EventOriginTier, LaneDefinition> = {
        'rover-ingest': {
          id: 'rover-ingest',
          title: 'Rover Audio & Ingest',
          subtitle: 'rover.* / audio harvesters',
          color: 'text-emerald-400',
          bgClass: 'bg-emerald-500/10',
          borderClass: 'border-emerald-500/30',
          events: []
        },
        'harness-devloop': {
          id: 'harness-devloop',
          title: 'Dev Harness Loop',
          subtitle: 'harness-srv / runners',
          color: 'text-rose-400',
          bgClass: 'bg-rose-500/10',
          borderClass: 'border-rose-500/30',
          events: []
        },
        'nexus-kernel': {
          id: 'nexus-kernel',
          title: 'Nexus Kernel & WRP',
          subtitle: 'nexus / conduit / breakers',
          color: 'text-cyan-400',
          bgClass: 'bg-cyan-500/10',
          borderClass: 'border-cyan-500/30',
          events: []
        },
        'nebula-cloud': {
          id: 'nebula-cloud',
          title: 'Nebula & Substance',
          subtitle: 'nebula.* / state records',
          color: 'text-purple-400',
          bgClass: 'bg-purple-500/10',
          borderClass: 'border-purple-500/30',
          events: []
        },
        'mcp-gateway': {
          id: 'mcp-gateway',
          title: 'MCP Tool Gateway',
          subtitle: 'mcp.* / tool calls',
          color: 'text-amber-400',
          bgClass: 'bg-amber-500/10',
          borderClass: 'border-amber-500/30',
          events: []
        },
        'voyager-fs': {
          id: 'voyager-fs',
          title: 'Voyager FS & Registry',
          subtitle: 'voyager.* / registry',
          color: 'text-teal-400',
          bgClass: 'bg-teal-500/10',
          borderClass: 'border-teal-500/30',
          events: []
        },
        'execution-drift': {
          id: 'execution-drift',
          title: 'Execution Drift Watcher',
          subtitle: 'execution-srv / reconcilers',
          color: 'text-yellow-400',
          bgClass: 'bg-yellow-500/10',
          borderClass: 'border-yellow-500/30',
          events: []
        },
        'all': {
          id: 'all',
          title: 'Other Origins',
          subtitle: 'system daemons',
          color: 'text-slate-400',
          bgClass: 'bg-slate-500/10',
          borderClass: 'border-slate-500/30',
          events: []
        }
      };

      events.forEach(e => {
        const t = new Date(e.event_timestamp).getTime();
        if (isNaN(t)) return;
        const leftPct = Math.min(Math.max(((t - minTime) / timeSpanMs) * 100, 1), 99);
        const origin = getEventOrigin(e);
        const targetTier = tiers[origin.tier] ? origin.tier : 'all';

        tiers[targetTier].events.push({
          envelope: e,
          leftPct,
          severity: getEventSeverity(e),
          origin,
          stage: mapEventTypeToStage(e.event_type)
        });
      });

      return Object.values(tiers).filter(l => l.id !== 'all' || l.events.length > 0);
    }

    if (groupingMode === 'stage') {
      const stages: Partial<Record<LifecycleStage, LaneDefinition>> = {
        harvest: {
          id: 'harvest',
          title: 'Harvest & Ingest',
          subtitle: 'Audio stream transcription & capture',
          color: 'text-emerald-400',
          bgClass: 'bg-emerald-500/10',
          borderClass: 'border-emerald-500/30',
          events: []
        },
        candidate: {
          id: 'candidate',
          title: 'Candidate Discovery',
          subtitle: 'SDLC opportunity evaluation & triage',
          color: 'text-blue-400',
          bgClass: 'bg-blue-500/10',
          borderClass: 'border-blue-500/30',
          events: []
        },
        assessment: {
          id: 'assessment',
          title: 'Assessment & Ripple',
          subtitle: 'Blast radius & architecture evaluation',
          color: 'text-indigo-400',
          bgClass: 'bg-indigo-500/10',
          borderClass: 'border-indigo-500/30',
          events: []
        },
        requirement: {
          id: 'requirement',
          title: 'Requirement & Spec',
          subtitle: 'Structured specifications & validation criteria',
          color: 'text-amber-400',
          bgClass: 'bg-amber-500/10',
          borderClass: 'border-amber-500/30',
          events: []
        },
        planning: {
          id: 'planning',
          title: 'Planning & DAG',
          subtitle: 'Task decomposition & dependency scheduling',
          color: 'text-violet-400',
          bgClass: 'bg-violet-500/10',
          borderClass: 'border-violet-500/30',
          events: []
        },
        harness: {
          id: 'harness',
          title: 'Dev Harness Loop',
          subtitle: 'Autonomous coder sandboxes & test suite execution',
          color: 'text-rose-400',
          bgClass: 'bg-rose-500/10',
          borderClass: 'border-rose-500/30',
          events: []
        },
        deployment: {
          id: 'deployment',
          title: 'Production Deploy & Wind',
          subtitle: 'Verification checks, release promotions, live health',
          color: 'text-cyan-400',
          bgClass: 'bg-cyan-500/10',
          borderClass: 'border-cyan-500/30',
          events: []
        }
      };

      events.forEach(e => {
        const t = new Date(e.event_timestamp).getTime();
        if (isNaN(t)) return;
        const leftPct = Math.min(Math.max(((t - minTime) / timeSpanMs) * 100, 1), 99);
        const stage = mapEventTypeToStage(e.event_type);
        if (stages[stage]) {
          stages[stage]!.events.push({
            envelope: e,
            leftPct,
            severity: getEventSeverity(e),
            origin: getEventOrigin(e),
            stage
          });
        }
      });

      return Object.values(stages).filter((l): l is LaneDefinition => Boolean(l) && l.events.length > 0);
    }

    // Grouping by Severity
    const severities: Record<EventSeverityLevel, LaneDefinition> = {
      critical: {
        id: 'critical',
        title: 'Critical Severity',
        subtitle: 'Fatal failures, tripped circuit breakers, panics',
        color: 'text-red-400',
        bgClass: 'bg-red-500/10',
        borderClass: 'border-red-500/30',
        events: []
      },
      error: {
        id: 'error',
        title: 'Error Level',
        subtitle: 'Test failures, rejected candidates, rejected args',
        color: 'text-rose-400',
        bgClass: 'bg-rose-500/10',
        borderClass: 'border-rose-500/30',
        events: []
      },
      warning: {
        id: 'warning',
        title: 'Warning Level',
        subtitle: 'Drifts detected, lease exhaustions, high latency',
        color: 'text-amber-400',
        bgClass: 'bg-amber-500/10',
        borderClass: 'border-amber-500/30',
        events: []
      },
      info: {
        id: 'info',
        title: 'Info Operations',
        subtitle: 'Promotions, migrations, successful commits & deploys',
        color: 'text-blue-400',
        bgClass: 'bg-blue-500/10',
        borderClass: 'border-blue-500/30',
        events: []
      },
      debug: {
        id: 'debug',
        title: 'Debug & Trace',
        subtitle: 'File topology scans, heartbeat telemetry, cache pings',
        color: 'text-slate-400',
        bgClass: 'bg-slate-500/10',
        borderClass: 'border-slate-500/30',
        events: []
      }
    };

    events.forEach(e => {
      const t = new Date(e.event_timestamp).getTime();
      if (isNaN(t)) return;
      const leftPct = Math.min(Math.max(((t - minTime) / timeSpanMs) * 100, 1), 99);
      const sev = getEventSeverity(e);
      if (severities[sev.level]) {
        severities[sev.level].events.push({
          envelope: e,
          leftPct,
          severity: sev,
          origin: getEventOrigin(e),
          stage: mapEventTypeToStage(e.event_type)
        });
      }
    });

    return Object.values(severities);
  }, [events, groupingMode, minTime, maxTime, timeSpanMs]);

  const selectedBucket = selectedBucketIndex !== null ? buckets[selectedBucketIndex] : null;

  // Formatter for time labels
  const formatIso = (iso: string) => {
    try {
      const d = new Date(iso);
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
    } catch {
      return iso;
    }
  };

  return (
    <div className="space-y-4">
      {/* Timeline Controls & Settings Header */}
      <div className={`p-4 rounded-xl border ${themeClasses.border} ${themeClasses.bgCard} shadow-sm space-y-3`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          {/* Left: Section Title & Time Range Bounds */}
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-sky-500/10 border border-sky-500/30 text-sky-400">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sm text-slate-100 font-mono">Event Ingestion Chrono-Density Timeline</span>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-500/15 text-sky-300 font-mono border border-sky-500/30 font-semibold">
                  {totalDensityEvents} envelopes mapped
                </span>
              </div>
              <div className="text-[11px] text-slate-400 font-mono flex items-center space-x-2 mt-0.5">
                <span className="text-slate-500">Span:</span>
                <span className="text-slate-300 font-semibold">{new Date(minTime).toLocaleTimeString()}</span>
                <span className="text-slate-600">→</span>
                <span className="text-slate-300 font-semibold">{new Date(maxTime).toLocaleTimeString()}</span>
                <span className="text-slate-500">({Math.round(timeSpanMs / 60000)} min range)</span>
              </div>
            </div>
          </div>

          {/* Right: Grouping Selector, Granularity, & Slice Reset */}
          <div className="flex flex-wrap items-center gap-2 font-mono text-xs">
            {/* Grouping Mode Pill Toggle */}
            <div className="flex items-center space-x-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800">
              <span className="text-[10px] uppercase text-slate-500 font-bold px-1.5">Group:</span>
              <button
                onClick={() => setGroupingMode('origin')}
                className={`px-2 py-1 rounded text-xs transition-all ${
                  groupingMode === 'origin'
                    ? 'bg-sky-500/20 text-sky-300 font-semibold border border-sky-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Origin Tier
              </button>
              <button
                onClick={() => setGroupingMode('stage')}
                className={`px-2 py-1 rounded text-xs transition-all ${
                  groupingMode === 'stage'
                    ? 'bg-emerald-500/20 text-emerald-300 font-semibold border border-emerald-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                SDLC Stage
              </button>
              <button
                onClick={() => setGroupingMode('severity')}
                className={`px-2 py-1 rounded text-xs transition-all ${
                  groupingMode === 'severity'
                    ? 'bg-rose-500/20 text-rose-300 font-semibold border border-rose-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Severity
              </button>
            </div>

            {/* Resolution Buckets */}
            <div className="flex items-center space-x-1 bg-slate-900/90 p-1 rounded-lg border border-slate-800">
              <span className="text-[10px] uppercase text-slate-500 font-bold px-1.5">Buckets:</span>
              <button
                onClick={() => setBucketCount(24)}
                className={`px-2 py-0.5 rounded text-[11px] ${bucketCount === 24 ? 'bg-slate-700 text-white font-bold' : 'text-slate-400'}`}
              >
                24
              </button>
              <button
                onClick={() => setBucketCount(36)}
                className={`px-2 py-0.5 rounded text-[11px] ${bucketCount === 36 ? 'bg-slate-700 text-white font-bold' : 'text-slate-400'}`}
              >
                36
              </button>
              <button
                onClick={() => setBucketCount(48)}
                className={`px-2 py-0.5 rounded text-[11px] ${bucketCount === 48 ? 'bg-slate-700 text-white font-bold' : 'text-slate-400'}`}
              >
                48
              </button>
            </div>

            {/* Active Time Slice reset if set */}
            {selectedBucket && (
              <button
                onClick={() => {
                  setSelectedBucketIndex(null);
                  if (onClearTimeFilter) onClearTimeFilter();
                }}
                className="px-2.5 py-1 rounded-lg bg-rose-500/15 border border-rose-500/30 text-rose-300 hover:bg-rose-500/25 transition-all text-xs font-semibold flex items-center space-x-1"
              >
                <span>Reset Slice Focus</span>
              </button>
            )}
          </div>
        </div>

        {/* 1. HORIZONTAL EVENT DENSITY HISTOGRAM STRIP */}
        <div className="space-y-1 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-300 uppercase tracking-wider text-[10px]">Temporal Density Histogram</span>
              <span className="text-slate-500 text-[10px]">(Click any column to isolate slice)</span>
            </div>
            <div className="flex items-center space-x-3 text-[10px]">
              <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-red-400" /><span>Critical</span></span>
              <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-rose-400" /><span>Error</span></span>
              <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-amber-400" /><span>Warning</span></span>
              <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-blue-400" /><span>Info</span></span>
              <span className="flex items-center space-x-1"><span className="w-2 h-2 rounded-full bg-slate-400" /><span>Debug</span></span>
            </div>
          </div>

          {/* Histogram Canvas Bars */}
          <div className="h-20 bg-slate-950/70 rounded-xl border border-slate-800/90 p-2 flex items-end gap-1 relative overflow-hidden group">
            {/* Background Grid Lines */}
            <div className="absolute inset-0 flex flex-col justify-between p-2 pointer-events-none opacity-20">
              <div className="border-b border-dashed border-slate-500 w-full" />
              <div className="border-b border-dashed border-slate-500 w-full" />
              <div className="border-b border-dashed border-slate-500 w-full" />
            </div>

            {buckets.map((b) => {
              const heightPct = maxBucketTotal > 0 ? Math.max((b.total / maxBucketTotal) * 100, b.total > 0 ? 8 : 2) : 2;
              const isSelected = selectedBucketIndex === b.index;
              const isHovered = hoveredBucket?.index === b.index;

              // Compute stacked segments height percentages
              const critH = b.total > 0 ? (b.critical / b.total) * 100 : 0;
              const errH = b.total > 0 ? (b.error / b.total) * 100 : 0;
              const warnH = b.total > 0 ? (b.warning / b.total) * 100 : 0;
              const infoH = b.total > 0 ? (b.info / b.total) * 100 : 0;
              const dbgH = b.total > 0 ? (b.debug / b.total) * 100 : 0;

              return (
                <div
                  key={b.index}
                  onClick={() => {
                    if (selectedBucketIndex === b.index) {
                      setSelectedBucketIndex(null);
                      if (onClearTimeFilter) onClearTimeFilter();
                    } else {
                      setSelectedBucketIndex(b.index);
                      if (onTimeSliceSelect) {
                        onTimeSliceSelect(b.startIso, b.endIso);
                      }
                    }
                  }}
                  onMouseEnter={() => setHoveredBucket(b)}
                  onMouseLeave={() => setHoveredBucket(null)}
                  className={`flex-1 h-full flex flex-col justify-end cursor-pointer relative transition-all rounded-t-sm ${
                    isSelected
                      ? 'ring-2 ring-sky-400 bg-sky-500/20'
                      : isHovered
                      ? 'bg-slate-800/80 ring-1 ring-slate-600'
                      : 'hover:bg-slate-900/60'
                  }`}
                >
                  {/* Peak Marker Badge */}
                  {b.isPeak && (
                    <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-amber-400 shadow-[0_0_6px_rgba(245,158,11,0.9)] animate-pulse pointer-events-none" />
                  )}

                  {/* Stacked Histogram Bar */}
                  <div
                    style={{ height: `${heightPct}%` }}
                    className={`w-full rounded-t flex flex-col overflow-hidden transition-all duration-300 ${
                      b.total === 0 ? 'bg-slate-800/20' : ''
                    }`}
                  >
                    {critH > 0 && <div style={{ height: `${critH}%` }} className="w-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]" />}
                    {errH > 0 && <div style={{ height: `${errH}%` }} className="w-full bg-rose-500" />}
                    {warnH > 0 && <div style={{ height: `${warnH}%` }} className="w-full bg-amber-500" />}
                    {infoH > 0 && <div style={{ height: `${infoH}%` }} className="w-full bg-blue-500" />}
                    {dbgH > 0 && <div style={{ height: `${dbgH}%` }} className="w-full bg-slate-500" />}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Time Axis Markers Under Histogram */}
          <div className="flex justify-between text-[10px] font-mono text-slate-500 px-1 pt-0.5">
            <span>{new Date(minTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span>{new Date(minTime + (timeSpanMs * 0.25)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span>{new Date(minTime + (timeSpanMs * 0.5)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span>{new Date(minTime + (timeSpanMs * 0.75)).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span>{new Date(maxTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        {/* Hovered or Selected Bucket Details Card */}
        {(hoveredBucket || selectedBucket) && (
          <div className="p-3 rounded-lg bg-slate-900/90 border border-sky-500/30 font-mono text-xs space-y-2 animate-fadeIn">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
              <div className="flex items-center space-x-2">
                <span className="font-bold text-sky-300">
                  Time Window: {formatIso((hoveredBucket || selectedBucket)!.startIso)} – {formatIso((hoveredBucket || selectedBucket)!.endIso)}
                </span>
                {(hoveredBucket || selectedBucket)!.isPeak && (
                  <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/40 flex items-center space-x-1">
                    <Flame className="w-2.5 h-2.5" />
                    <span>Peak Ingestion Burst</span>
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-3 text-slate-300 text-[11px]">
                <span>
                  Density: <strong className="text-white">{(hoveredBucket || selectedBucket)!.total}</strong> envelopes
                </span>
                <span>
                  Velocity: <strong className="text-white">{(hoveredBucket || selectedBucket)!.velocity}</strong> evt/min
                </span>
              </div>
            </div>

            {/* Severity Distribution Pills */}
            <div className="flex flex-wrap items-center gap-2 text-[10px]">
              {(hoveredBucket || selectedBucket)!.critical > 0 && (
                <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/40 font-bold">
                  {(hoveredBucket || selectedBucket)!.critical} Critical
                </span>
              )}
              {(hoveredBucket || selectedBucket)!.error > 0 && (
                <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 font-bold">
                  {(hoveredBucket || selectedBucket)!.error} Error
                </span>
              )}
              {(hoveredBucket || selectedBucket)!.warning > 0 && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                  {(hoveredBucket || selectedBucket)!.warning} Warning
                </span>
              )}
              {(hoveredBucket || selectedBucket)!.info > 0 && (
                <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold">
                  {(hoveredBucket || selectedBucket)!.info} Info
                </span>
              )}
              {(hoveredBucket || selectedBucket)!.debug > 0 && (
                <span className="px-2 py-0.5 rounded bg-slate-500/20 text-slate-300 border border-slate-500/40 font-bold">
                  {(hoveredBucket || selectedBucket)!.debug} Debug
                </span>
              )}

              {(hoveredBucket || selectedBucket)!.dominantSource && (
                <span className="text-slate-400 ml-auto truncate max-w-xs">
                  Dominant: <strong className="text-sky-300">{(hoveredBucket || selectedBucket)!.dominantSource}</strong> ({(hoveredBucket || selectedBucket)!.dominantType})
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. MULTI-SWIMLANE HORIZONTAL CHRONOLOGICAL TRACK */}
      <div className={`rounded-xl border ${themeClasses.border} ${themeClasses.bgCard} shadow-md overflow-hidden font-mono`}>
        {/* Track Header */}
        <div className={`p-3 border-b ${themeClasses.border} ${themeClasses.headerBg} flex items-center justify-between text-xs`}>
          <div className="flex items-center space-x-2">
            <span className="font-bold text-slate-200">
              Temporal Streams ({swimlanes.length} {groupingMode === 'origin' ? 'Origins' : groupingMode === 'stage' ? 'Stages' : 'Severities'})
            </span>
            <span className="text-[10px] text-slate-500">
              Hover over markers for envelope diagnostics & causation links
            </span>
          </div>

          <div className="flex items-center space-x-3 text-[11px] text-slate-400">
            <span>{new Date(minTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
            <span className="text-slate-600">┈┈┈┈┈┈┈┈┈</span>
            <span>{new Date(maxTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
        </div>

        {/* Lanes List */}
        <div className="divide-y divide-slate-800/60 overflow-x-auto">
          {swimlanes.map((lane) => {
            const isLaneSelected = selectedLaneId === lane.id;

            return (
              <div 
                key={lane.id}
                className={`p-3 transition-colors ${
                  isLaneSelected ? 'bg-slate-800/40' : 'hover:bg-slate-900/30'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                  {/* Lane Label / Metadata (Fixed Left Column) */}
                  <div className="w-56 shrink-0 space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className={`font-bold text-xs ${lane.color}`}>
                        {lane.title}
                      </span>
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-semibold border border-slate-700">
                        {lane.events.length}
                      </span>
                    </div>
                    <div className="text-[10px] text-slate-500 truncate" title={lane.subtitle}>
                      {lane.subtitle}
                    </div>
                  </div>

                  {/* Horizontal Timeline Track Bar */}
                  <div className="flex-1 h-10 bg-slate-950/80 rounded-lg border border-slate-800/80 relative flex items-center px-2 group/track">
                    {/* Time Grid Lines */}
                    <div className="absolute inset-0 flex justify-between px-4 pointer-events-none opacity-10">
                      <div className="border-r border-slate-400 h-full" />
                      <div className="border-r border-slate-400 h-full" />
                      <div className="border-r border-slate-400 h-full" />
                      <div className="border-r border-slate-400 h-full" />
                    </div>

                    {/* Active Selected Bucket Slice Highlight Overlay */}
                    {selectedBucket && (
                      <div
                        style={{
                          left: `${((selectedBucket.startTime - minTime) / timeSpanMs) * 100}%`,
                          width: `${((selectedBucket.endTime - selectedBucket.startTime) / timeSpanMs) * 100}%`
                        }}
                        className="absolute inset-y-0 bg-sky-500/20 border-x border-sky-500/50 pointer-events-none z-0"
                      />
                    )}

                    {/* Event Beads / Markers */}
                    {lane.events.length === 0 ? (
                      <div className="w-full text-center text-[10px] text-slate-600 italic">
                        No events recorded in this temporal window
                      </div>
                    ) : (
                      lane.events.map(({ envelope, leftPct, severity, origin, stage }) => {
                        const isHovered = hoveredEvent?.event_id === envelope.event_id;
                        const isCritical = severity.level === 'critical';
                        const isError = severity.level === 'error';

                        return (
                          <div
                            key={envelope.event_id}
                            style={{ left: `${leftPct}%` }}
                            onClick={(e) => {
                              e.stopPropagation();
                              onSelectEvent(envelope);
                            }}
                            onMouseEnter={() => setHoveredEvent(envelope)}
                            onMouseLeave={() => setHoveredEvent(null)}
                            className={`absolute -translate-x-1/2 cursor-pointer z-10 transition-transform ${
                              isHovered ? 'scale-150 z-30' : 'hover:scale-125'
                            }`}
                          >
                            {/* Bead Circle */}
                            <div
                              className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center transition-all ${
                                isCritical
                                  ? 'bg-red-500 border-white shadow-[0_0_10px_rgba(239,68,68,0.9)] animate-pulse'
                                  : isError
                                  ? 'bg-rose-500 border-rose-200 shadow-[0_0_8px_rgba(244,63,94,0.7)]'
                                  : severity.level === 'warning'
                                  ? 'bg-amber-400 border-amber-200'
                                  : severity.level === 'info'
                                  ? 'bg-blue-400 border-blue-200'
                                  : 'bg-slate-400 border-slate-300'
                              }`}
                            >
                              <span className="text-[7px] font-black text-slate-950 select-none">
                                {envelope.sequence_number % 10}
                              </span>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 3. HOVERED EVENT DIAGNOSTIC FLYOUT DRAWER */}
      {hoveredEvent && (
        <div className={`p-4 rounded-xl border border-sky-500/50 bg-slate-900/95 shadow-xl font-mono text-xs space-y-2 animate-fadeIn`}>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-2">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-200 text-sm">
                Seq #{hoveredEvent.sequence_number}
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 border border-slate-700 text-sky-300">
                {hoveredEvent.event_type}
              </span>
              <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${getEventSeverity(hoveredEvent).badgeClass}`}>
                {getEventSeverity(hoveredEvent).label}
              </span>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={() => onOpenLineage(hoveredEvent.event_id)}
                className="px-2 py-1 rounded bg-sky-500/15 border border-sky-500/30 text-sky-300 hover:bg-sky-500/25 flex items-center space-x-1 text-[11px]"
              >
                <GitFork className="w-3 h-3" />
                <span>Lineage DAG</span>
              </button>
              {hoveredEvent.correlation_id && (
                <button
                  onClick={() => onOpenPipeline(hoveredEvent.correlation_id!)}
                  className="px-2 py-1 rounded bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 hover:bg-indigo-500/25 flex items-center space-x-1 text-[11px]"
                >
                  <Workflow className="w-3 h-3" />
                  <span>Workflow</span>
                </button>
              )}
              <button
                onClick={() => onSelectEvent(hoveredEvent)}
                className="px-2.5 py-1 rounded bg-sky-500 text-slate-950 font-bold hover:bg-sky-400 transition-all text-[11px]"
              >
                Open Full Envelope →
              </button>
            </div>
          </div>

          {/* Quick Details Matrix */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-[11px] text-slate-300">
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Timestamp</span>
              <span className="text-slate-200 font-semibold">{hoveredEvent.event_timestamp}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Source Origin</span>
              <span className="text-sky-300 font-semibold truncate block">{hoveredEvent.source}</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Actor</span>
              <span className="text-slate-200 font-semibold capitalize">{hoveredEvent.actor_type} ({hoveredEvent.actor_id})</span>
            </div>
            <div>
              <span className="text-slate-500 block text-[10px] uppercase">Causation ID</span>
              <span className="text-amber-400 font-semibold truncate block">
                {hoveredEvent.causation_id ? hoveredEvent.causation_id.slice(0, 8) + '...' : 'Root Envelope'}
              </span>
            </div>
          </div>

          {/* Payload Title or Summary if present */}
          {hoveredEvent.payload?.title && (
            <div className="text-[11px] text-slate-300 bg-slate-950/60 p-2 rounded border border-slate-800/80">
              <span className="text-slate-500 font-semibold">Title:</span> {hoveredEvent.payload.title}
            </div>
          )}
          {hoveredEvent.payload?.error && (
            <div className="text-[11px] text-rose-300 bg-rose-950/30 p-2 rounded border border-rose-800/50">
              <span className="text-rose-400 font-bold">Error:</span> {String(hoveredEvent.payload.error)}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
