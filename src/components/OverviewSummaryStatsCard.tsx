import React, { useMemo } from 'react';
import { 
  TrendingUp, 
  Zap, 
  GitBranch, 
  Activity, 
  Clock, 
  Flame, 
  CheckCircle2, 
  ArrowUpRight, 
  Layers, 
  Sparkles,
  Workflow,
  BarChart3
} from 'lucide-react';
import { ActiveView } from '../types';
import { cascadeStore } from '../services/cascadeService';
import { mapEventTypeToStage, getStageColor } from '../services/mockDataGenerator';

interface OverviewSummaryStatsCardProps {
  timeRange?: '1h' | '6h' | '24h' | '7d';
  startDate?: string | null;
  endDate?: string | null;
  dateRangeLabel?: string;
  preset?: string;
  setActiveView?: (view: ActiveView) => void;
  onSelectWorkflow?: (correlationId: string) => void;
}

export const OverviewSummaryStatsCard: React.FC<OverviewSummaryStatsCardProps> = ({
  timeRange = '24h',
  startDate,
  endDate,
  dateRangeLabel,
  preset,
  setActiveView,
  onSelectWorkflow
}) => {
  const allEvents = cascadeStore.getEvents({ limit: 500, offset: 0 }).events;
  const workflows = cascadeStore.getCorrelationWorkflows();

  // Compute peak throughput and active correlation IDs stats
  const stats = useMemo(() => {
    const now = Date.now();
    let durationMs = 24 * 3600 * 1000;
    let windowLabel = dateRangeLabel || 'Past 24 Hours';
    let bucketIntervalMinutes = 60;
    let startTime = now - durationMs;
    let endTime = now;

    if (startDate && endDate) {
      startTime = new Date(startDate).getTime();
      endTime = new Date(endDate).getTime();
      durationMs = Math.max(60000, endTime - startTime);
      windowLabel = dateRangeLabel || 'Selected Range';
      
      // Choose appropriate bucket size based on duration
      const durationHours = durationMs / (3600 * 1000);
      if (durationHours <= 1) bucketIntervalMinutes = 2;
      else if (durationHours <= 6) bucketIntervalMinutes = 10;
      else if (durationHours <= 24) bucketIntervalMinutes = 30;
      else if (durationHours <= 72) bucketIntervalMinutes = 120;
      else bucketIntervalMinutes = 360;
    } else if (timeRange === '1h' || preset === '1h') {
      durationMs = 60 * 60 * 1000;
      windowLabel = 'Past 1 Hour';
      bucketIntervalMinutes = 2;
      startTime = now - durationMs;
    } else if (timeRange === '6h' || preset === '6h') {
      durationMs = 6 * 3600 * 1000;
      windowLabel = 'Past 6 Hours';
      bucketIntervalMinutes = 10;
      startTime = now - durationMs;
    } else if (timeRange === '24h' || preset === '24h') {
      durationMs = 24 * 3600 * 1000;
      windowLabel = 'Past 24 Hours';
      bucketIntervalMinutes = 60;
      startTime = now - durationMs;
    } else if (timeRange === '7d' || preset === '7d') {
      durationMs = 7 * 24 * 3600 * 1000;
      windowLabel = 'Past 7 Days';
      bucketIntervalMinutes = 360;
      startTime = now - durationMs;
    } else if (preset === '15m') {
      durationMs = 15 * 60 * 1000;
      windowLabel = 'Past 15 Minutes';
      bucketIntervalMinutes = 1;
      startTime = now - durationMs;
    } else if (preset === 'all') {
      durationMs = 30 * 24 * 3600 * 1000;
      windowLabel = 'All Time';
      bucketIntervalMinutes = 720;
      startTime = 0;
      endTime = now + 86400000;
    }

    const windowEvents = allEvents.filter(e => {
      const ts = new Date(e.event_timestamp).getTime();
      return ts >= startTime && ts <= endTime;
    });

    const targetEvents = windowEvents.length > 0 ? windowEvents : allEvents;
    const totalCount = targetEvents.length;

    // 1. Calculate Peak Throughput across dynamic time slices
    const bucketIntervalMs = bucketIntervalMinutes * 60 * 1000;
    const bucketCounts = new Map<number, { count: number; timestamp: number }>();

    targetEvents.forEach(evt => {
      const ts = new Date(evt.event_timestamp).getTime();
      const bucketKey = Math.floor(ts / bucketIntervalMs) * bucketIntervalMs;
      const current = bucketCounts.get(bucketKey) || { count: 0, timestamp: bucketKey };
      current.count += 1;
      bucketCounts.set(bucketKey, current);
    });

    let peakBucketCount = 0;
    let peakTimestamp = now;

    bucketCounts.forEach(({ count, timestamp }) => {
      if (count > peakBucketCount) {
        peakBucketCount = count;
        peakTimestamp = timestamp;
      }
    });

    // Peak rate calculations
    const peakRatePerMin = bucketIntervalMinutes > 0 
      ? Math.max(1, Math.round((peakBucketCount / bucketIntervalMinutes) * 10) / 10)
      : peakBucketCount;
    const peakRatePerSec = Math.max(0.1, Math.round((peakRatePerMin / 60) * 100) / 100);

    const totalMinutesInWindow = Math.max(1, durationMs / (60 * 1000));
    const avgRatePerMin = Math.round((totalCount / totalMinutesInWindow) * 100) / 100;
    const peakToAvgRatio = avgRatePerMin > 0 ? Math.round((peakRatePerMin / avgRatePerMin) * 10) / 10 : 1;

    const peakTimeFormatted = new Date(peakTimestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });

    // 2. Calculate Total & Active Correlation IDs
    const correlationMap = new Map<string, {
      correlation_id: string;
      eventsCount: number;
      lastEventType: string;
      lastTimestamp: string;
      firstTimestamp: string;
      isTerminal: boolean;
      stage: string;
    }>();

    allEvents.forEach(evt => {
      if (!evt.correlation_id) return;
      const existing = correlationMap.get(evt.correlation_id);
      const stage = mapEventTypeToStage(evt.event_type);
      const isTerminal = evt.event_type.startsWith('wind.') || evt.event_type === 'harness.completed';

      if (!existing) {
        correlationMap.set(evt.correlation_id, {
          correlation_id: evt.correlation_id,
          eventsCount: 1,
          lastEventType: evt.event_type,
          lastTimestamp: evt.event_timestamp,
          firstTimestamp: evt.event_timestamp,
          isTerminal,
          stage
        });
      } else {
        existing.eventsCount += 1;
        if (new Date(evt.event_timestamp) > new Date(existing.lastTimestamp)) {
          existing.lastEventType = evt.event_type;
          existing.lastTimestamp = evt.event_timestamp;
          existing.stage = stage;
          existing.isTerminal = isTerminal;
        }
        if (new Date(evt.event_timestamp) < new Date(existing.firstTimestamp)) {
          existing.firstTimestamp = evt.event_timestamp;
        }
      }
    });

    const allCorrelations = Array.from(correlationMap.values());
    const totalCorrelationIds = allCorrelations.length;
    // Active correlations are non-terminal workflows or ones touched recently
    const activeCorrelations = allCorrelations.filter(c => !c.isTerminal || c.stage !== 'deployment');
    const completedCorrelations = allCorrelations.filter(c => c.isTerminal || c.stage === 'deployment');

    // Stage breakdown for active workflows
    const stageCounts: Record<string, number> = {
      harvest: 0,
      candidate: 0,
      requirement: 0,
      planning: 0,
      harness: 0,
      deployment: 0
    };

    activeCorrelations.forEach(c => {
      stageCounts[c.stage] = (stageCounts[c.stage] || 0) + 1;
    });

    const avgCausalDepth = allCorrelations.length > 0 
      ? (allCorrelations.reduce((sum, c) => sum + c.eventsCount, 0) / allCorrelations.length).toFixed(1)
      : '3.4';

    return {
      windowLabel,
      totalCount,
      peakBucketCount,
      peakRatePerMin,
      peakRatePerSec,
      avgRatePerMin,
      peakToAvgRatio,
      peakTimeFormatted,
      totalCorrelationIds: Math.max(totalCorrelationIds, workflows.length),
      activeCorrelationIds: Math.max(activeCorrelations.length, Math.ceil(workflows.length * 0.7)),
      completedCorrelationCount: completedCorrelations.length,
      activeRatePercent: Math.round(((activeCorrelations.length || 7) / (totalCorrelationIds || 10)) * 100),
      stageCounts,
      avgCausalDepth,
      activeWorkflows: workflows.slice(0, 3)
    };
  }, [allEvents, workflows, timeRange]);

  return (
    <div 
      id="overview-summary-statistics-card"
      className="p-5 rounded-2xl border border-slate-700/50 bg-[#1e293b]/40 shadow-lg space-y-4"
    >
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Zap className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-100">Telemetry & Lineage Summary</h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-400 font-semibold">
                {stats.windowLabel}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Live envelope velocity metrics and distributed causal workflow tracking
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {setActiveView && (
            <button
              onClick={() => setActiveView('pipeline')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-slate-300 flex items-center gap-1.5 transition-colors"
            >
              <Workflow className="w-3.5 h-3.5 text-blue-400" />
              <span>Causal Workflows</span>
              <ArrowUpRight className="w-3 h-3 text-slate-400" />
            </button>
          )}
        </div>
      </div>

      {/* Main 2 Core Metrics Highlight Cards (Peak Throughput & Active Correlation IDs) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Card 1: Peak Event Throughput */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-amber-500/30 relative overflow-hidden flex flex-col justify-between group hover:border-amber-500/50 transition-all shadow-sm">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                <Flame className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider font-bold text-amber-400 block font-mono">
                  Peak Event Throughput
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  Maximum burst rate in window
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-amber-500/10 border border-amber-500/30 text-amber-300">
              Peak at {stats.peakTimeFormatted}
            </span>
          </div>

          {/* Metric Value Display */}
          <div className="my-3 flex items-baseline gap-3">
            <div className="text-3xl font-extrabold text-white font-mono tracking-tight">
              {stats.peakRatePerMin}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-amber-300 font-mono">events / min</span>
              <span className="text-[10px] text-slate-400 font-mono">({stats.peakRatePerSec} evts/sec)</span>
            </div>
          </div>

          {/* Sub-metrics strip */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800 text-xs font-mono">
            <div className="p-2 rounded bg-slate-800/40 border border-slate-700/40">
              <span className="text-[9px] uppercase text-slate-400 block">Avg Rate</span>
              <span className="text-white font-bold">{stats.avgRatePerMin}/m</span>
            </div>
            <div className="p-2 rounded bg-slate-800/40 border border-slate-700/40">
              <span className="text-[9px] uppercase text-slate-400 block">Burst Spike</span>
              <span className="text-amber-400 font-bold">{stats.peakToAvgRatio}x avg</span>
            </div>
            <div className="p-2 rounded bg-slate-800/40 border border-slate-700/40">
              <span className="text-[9px] uppercase text-slate-400 block">Window Peak</span>
              <span className="text-slate-200 font-bold">{stats.peakBucketCount} evts</span>
            </div>
          </div>
        </div>

        {/* Card 2: Total Active Correlation IDs */}
        <div className="p-4 rounded-xl bg-slate-900/60 border border-blue-500/30 relative overflow-hidden flex flex-col justify-between group hover:border-blue-500/50 transition-all shadow-sm">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl pointer-events-none" />

          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <GitBranch className="w-4 h-4" />
              </div>
              <div>
                <span className="text-[11px] uppercase tracking-wider font-bold text-blue-400 block font-mono">
                  Active Correlation IDs
                </span>
                <span className="text-[10px] text-slate-400 font-mono">
                  In-flight distributed causal graphs
                </span>
              </div>
            </div>
            <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              {stats.activeRatePercent}% Active
            </span>
          </div>

          {/* Metric Value Display */}
          <div className="my-3 flex items-baseline gap-3">
            <div className="text-3xl font-extrabold text-white font-mono tracking-tight">
              {stats.activeCorrelationIds}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-semibold text-blue-300 font-mono">Active Correlated Chains</span>
              <span className="text-[10px] text-slate-400 font-mono">({stats.totalCorrelationIds} Total in Ledger)</span>
            </div>
          </div>

          {/* Sub-metrics strip */}
          <div className="grid grid-cols-3 gap-2 pt-3 border-t border-slate-800 text-xs font-mono">
            <div className="p-2 rounded bg-slate-800/40 border border-slate-700/40">
              <span className="text-[9px] uppercase text-slate-400 block">Total Chains</span>
              <span className="text-white font-bold">{stats.totalCorrelationIds} IDs</span>
            </div>
            <div className="p-2 rounded bg-slate-800/40 border border-slate-700/40">
              <span className="text-[9px] uppercase text-slate-400 block">Avg DAG Depth</span>
              <span className="text-blue-400 font-bold">{stats.avgCausalDepth} levels</span>
            </div>
            <div className="p-2 rounded bg-slate-800/40 border border-slate-700/40">
              <span className="text-[9px] uppercase text-slate-400 block">Completed</span>
              <span className="text-emerald-400 font-bold">{stats.completedCorrelationCount} Deploys</span>
            </div>
          </div>
        </div>
      </div>

      {/* Active Workflows Quick Selector Strip */}
      {stats.activeWorkflows.length > 0 && (
        <div className="p-3 rounded-xl bg-slate-900/40 border border-slate-800/80 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
          <div className="flex items-center gap-2 text-xs font-mono text-slate-400">
            <Activity className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
            <span className="font-semibold text-slate-300">Live Correlated Workflows:</span>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {stats.activeWorkflows.map(wf => (
              <button
                key={wf.correlation_id}
                onClick={() => onSelectWorkflow && onSelectWorkflow(wf.correlation_id)}
                className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-[11px] font-mono text-slate-300 hover:text-white flex items-center gap-1.5 transition-colors group"
                title={`Correlation ID: ${wf.correlation_id}`}
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span className="truncate max-w-[140px] font-medium">{wf.title}</span>
                <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-slate-900 text-blue-300 border border-slate-700 font-mono">
                  {wf.stage.slice(0, 4)}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
