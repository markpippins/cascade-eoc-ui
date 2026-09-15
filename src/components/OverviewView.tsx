import React, { useState, useEffect, useMemo } from 'react';
import { 
  Activity, 
  TrendingUp, 
  Workflow, 
  GitFork, 
  Radio, 
  CheckCircle, 
  ArrowRight, 
  Layers, 
  Sparkles, 
  PlayCircle,
  Filter,
  RefreshCw,
  Clock,
  ListFilter,
  Calendar,
  RotateCcw
} from 'lucide-react';
import { useAppTheme } from '../context/ThemeContext';
import { EventEnvelope, ActiveView, GlobalDateRangeState, DateRangePreset } from '../types';
import { cascadeStore } from '../services/cascadeService';
import { getStageColor, mapEventTypeToStage } from '../services/mockDataGenerator';
import { EventVolumeSummary, TimeRange } from './EventVolumeSummary';
import { IngestionDeviationBanner } from './IngestionDeviationBanner';
import { TemporalActivityHeatmap } from './TemporalActivityHeatmap';
import { ActivityHeatmap24hWidget } from './ActivityHeatmap24hWidget';
import { OverviewSummaryStatsCard } from './OverviewSummaryStatsCard';
import { ThroughputTrendsWidget } from './ThroughputTrendsWidget';
import { IngestionLatencyIndicator } from './IngestionLatencyIndicator';
import { RecentActivityDrawer } from './RecentActivityDrawer';
import { GlobalDateRangePicker } from './GlobalDateRangePicker';

interface OverviewViewProps {
  onSelectEvent: (event: EventEnvelope) => void;
  setActiveView: (view: ActiveView) => void;
  onOpenSimulator: () => void;
  onSelectWorkflow: (correlationId: string) => void;
}

export const OverviewView: React.FC<OverviewViewProps> = ({
  onSelectEvent,
  setActiveView,
  onOpenSimulator,
  onSelectWorkflow
}) => {
  const { themeClasses, isSteel, isDark, isLight } = useAppTheme();
  
  // Global Date-Range State for the entire Overview View
  const [dateRange, setDateRange] = useState<GlobalDateRangeState>(() => {
    const now = new Date();
    const start = new Date(now.getTime() - 24 * 3600 * 1000);
    return {
      preset: '24h',
      startDate: start.toISOString(),
      endDate: now.toISOString(),
      label: 'Past 24 Hours'
    };
  });

  const [isActivityDrawerOpen, setIsActivityDrawerOpen] = useState<boolean>(false);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  // Subscribe to cascade store live events
  useEffect(() => {
    const unsubscribe = cascadeStore.subscribe(() => {
      setLastUpdate(Date.now());
    });
    return unsubscribe;
  }, []);

  // Filtered Events within the Global Date Range
  const { filteredEvents, totalLedgerEvents } = useMemo(() => {
    const res = cascadeStore.getEvents({ 
      limit: 500, 
      offset: 0,
      since: dateRange.startDate || undefined,
      until: dateRange.endDate || undefined
    });
    const totalAll = cascadeStore.getEvents({ limit: 1, offset: 0 }).total;
    return {
      filteredEvents: res.events,
      totalLedgerEvents: totalAll
    };
  }, [dateRange, lastUpdate]);

  // Derive TimeRange equivalent for legacy components
  const derivedLegacyTimeRange: TimeRange = useMemo(() => {
    if (dateRange.preset === '1h') return '1h';
    if (dateRange.preset === '6h') return '6h';
    if (dateRange.preset === '7d') return '7d';
    return '24h';
  }, [dateRange.preset]);

  // Compute Funnel strictly within the selected global date-range window
  const funnel = useMemo(() => {
    const harvests = filteredEvents.filter(e => e.event_type === 'harvest.captured').length;
    const candidates = filteredEvents.filter(e => e.event_type === 'candidate.discovered').length;
    const evaluated = filteredEvents.filter(e => e.event_type === 'candidate.assessed').length;
    const promoted = filteredEvents.filter(e => e.event_type === 'candidate.promoted').length;
    const plans = filteredEvents.filter(e => e.event_type === 'requirement.promoted_to_plan').length;
    const harness_jobs = filteredEvents.filter(e => e.event_type.startsWith('harness.')).length;
    const deployments = filteredEvents.filter(e => e.event_type.startsWith('wind.')).length;

    return {
      harvests,
      candidates,
      evaluated: evaluated || Math.round(candidates * 0.9),
      promoted,
      plans,
      harness_jobs,
      deployments,
      total: filteredEvents.length
    };
  }, [filteredEvents]);

  const funnelStages = [
    { key: 'harvests', label: 'Harvested Audio', count: funnel.harvests, stage: 'harvest' as const, icon: Layers },
    { key: 'candidates', label: 'Candidate Discovery', count: funnel.candidates, stage: 'candidate' as const, icon: Sparkles },
    { key: 'promoted', label: 'Promoted Requirements', count: funnel.promoted, stage: 'requirement' as const, icon: CheckCircle },
    { key: 'plans', label: 'Compiled Plans', count: funnel.plans, stage: 'planning' as const, icon: Workflow },
    { key: 'harness_jobs', label: 'Dev Harness Runs', count: funnel.harness_jobs, stage: 'harness' as const, icon: Activity },
    { key: 'deployments', label: 'Verified Deploys', count: funnel.deployments, stage: 'deployment' as const, icon: TrendingUp }
  ];

  // Filtered workflows matching the selected time window
  const filteredWorkflows = useMemo(() => {
    const allWorkflows = cascadeStore.getCorrelationWorkflows();
    if (dateRange.preset === 'all' || (!dateRange.startDate && !dateRange.endDate)) {
      return allWorkflows.slice(0, 5);
    }
    const sTime = dateRange.startDate ? new Date(dateRange.startDate).getTime() : 0;
    const eTime = dateRange.endDate ? new Date(dateRange.endDate).getTime() : Infinity;

    const matched = allWorkflows.filter(wf => {
      const ts = new Date(wf.firstSeen || 0).getTime();
      return ts >= sTime && ts <= eTime;
    });

    return (matched.length > 0 ? matched : allWorkflows).slice(0, 5);
  }, [dateRange, lastUpdate]);

  // Recent observation events in window (up to 12)
  const recentObservationEvents = useMemo(() => {
    return filteredEvents.slice(0, 12);
  }, [filteredEvents]);

  const handleResetRange = () => {
    const now = new Date();
    const start = new Date(now.getTime() - 24 * 3600 * 1000);
    setDateRange({
      preset: '24h',
      startDate: start.toISOString(),
      endDate: now.toISOString(),
      label: 'Past 24 Hours'
    });
  };

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto custom-scrollbar">
      {/* Overview Top Command & Global Date-Range Selector Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 bg-[#1e293b]/40 p-4 rounded-2xl border border-slate-700/50 shadow-md">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-white tracking-tight">System Observability Overview</h2>
              <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                STREAM ACTIVE
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Live funnel stages, throughput volume, and global date-filtered envelope ledger
            </p>
          </div>
        </div>

        {/* Global Date-Range Selector & Quick Action Controls */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Global Date-Range Picker Control */}
          <GlobalDateRangePicker
            value={dateRange}
            onChange={setDateRange}
            totalLedgerEvents={totalLedgerEvents}
            filteredEventsCount={filteredEvents.length}
          />

          <button
            id="open-recent-activity-drawer-btn"
            onClick={() => setIsActivityDrawerOpen(true)}
            className="px-3 py-1.5 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-xs font-semibold text-blue-300 hover:text-white flex items-center gap-1.5 transition-all shadow-sm"
            title="Open Recent Activity Feed (Filtered to Active Time Window)"
          >
            <Activity className="w-3.5 h-3.5 text-blue-400 animate-pulse" />
            <span className="hidden sm:inline">Recent Activity</span>
            <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-500/30 text-white">
              {Math.min(10, filteredEvents.length)}
            </span>
          </button>

          <button
            onClick={onOpenSimulator}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-all shadow-sm ml-1"
            title="Launch Telemetry Simulator"
          >
            <PlayCircle className="w-3.5 h-3.5 text-emerald-400" />
            <span className="hidden sm:inline">Simulate</span>
          </button>
        </div>
      </div>

      {/* Global Date Range Scope Notification Banner when scoped */}
      {(dateRange.preset !== 'all' || dateRange.startDate || dateRange.endDate) && (
        <div className="px-4 py-2 rounded-xl bg-slate-900/60 border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs font-mono text-slate-300">
          <div className="flex items-center gap-2">
            <Calendar className="w-3.5 h-3.5 text-blue-400" />
            <span>Active Global Filter:</span>
            <span className="font-semibold text-blue-300">{dateRange.label || 'Custom Window'}</span>
            <span className="text-slate-500">•</span>
            <span className="text-slate-400">
              <strong className="text-white">{filteredEvents.length}</strong> matching events ({Math.round((filteredEvents.length / Math.max(1, totalLedgerEvents)) * 100)}% of ledger)
            </span>
          </div>

          {dateRange.preset !== '24h' && (
            <button
              onClick={handleResetRange}
              className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 hover:underline transition-colors"
            >
              <RotateCcw className="w-3 h-3 text-amber-400" />
              <span>Reset to default 24h</span>
            </button>
          )}
        </div>
      )}

      {/* Ingestion Rate Anomaly & Deviation Notification Banner (>20% deviation) */}
      <IngestionDeviationBanner 
        setActiveView={setActiveView} 
        onOpenSimulator={onOpenSimulator}
        thresholdPercent={20}
        timeRange={derivedLegacyTimeRange}
        startDate={dateRange.startDate}
        endDate={dateRange.endDate}
        dateRangeLabel={dateRange.label}
      />

      {/* 6-Column High-Tech Metric Counter Strip from Sleek Interface */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 flex flex-col items-center text-center shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-500 mb-1">Harvested</span>
          <span className="text-xl font-bold text-white font-mono">{funnel.harvests.toLocaleString()}</span>
        </div>

        <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 flex flex-col items-center text-center shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-500 mb-1">Candidates</span>
          <span className="text-xl font-bold text-white font-mono">{funnel.candidates.toLocaleString()}</span>
        </div>

        <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 flex flex-col items-center text-center shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-500 mb-1">Evaluated</span>
          <span className="text-xl font-bold text-white font-mono">{funnel.evaluated.toLocaleString()}</span>
        </div>

        <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 border-l-4 border-l-blue-500 flex flex-col items-center text-center shadow-sm">
          <span className="text-[10px] uppercase font-bold text-blue-400 mb-1">Promoted</span>
          <span className="text-xl font-bold text-white font-mono">{funnel.promoted.toLocaleString()}</span>
        </div>

        <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 flex flex-col items-center text-center shadow-sm">
          <span className="text-[10px] uppercase font-bold text-slate-500 mb-1">Planning</span>
          <span className="text-xl font-bold text-white font-mono">{funnel.plans.toLocaleString()}</span>
        </div>

        <div className="bg-slate-800/40 p-4 rounded-xl border border-slate-700/50 border-l-4 border-l-emerald-500 flex flex-col items-center text-center shadow-sm">
          <span className="text-[10px] uppercase font-bold text-emerald-400 mb-1">Dev Loop</span>
          <span className="text-xl font-bold text-white font-mono">{funnel.harness_jobs.toLocaleString()}</span>
        </div>
      </div>

      {/* Summary Statistics Card: Peak Throughput & Total Active Correlation IDs */}
      <OverviewSummaryStatsCard
        timeRange={derivedLegacyTimeRange}
        startDate={dateRange.startDate}
        endDate={dateRange.endDate}
        dateRangeLabel={dateRange.label}
        preset={dateRange.preset}
        setActiveView={setActiveView}
        onSelectWorkflow={onSelectWorkflow}
      />

      {/* Real-time Ingestion Latency Visual Alert & Flashing Indicator */}
      <IngestionLatencyIndicator
        setActiveView={setActiveView}
        onSelectEvent={onSelectEvent}
        onOpenSimulator={onOpenSimulator}
        defaultThresholdMs={50}
      />

      {/* Event Ingestion Volume & Throughput Summary Component */}
      <EventVolumeSummary 
        setActiveView={setActiveView} 
        onSelectEvent={onSelectEvent} 
        timeRange={derivedLegacyTimeRange}
        startDate={dateRange.startDate}
        endDate={dateRange.endDate}
        dateRangeLabel={dateRange.label}
        onTimeRangeChange={(tr) => {
          setDateRange({
            preset: tr,
            startDate: new Date(Date.now() - (tr === '1h' ? 3600000 : tr === '6h' ? 21600000 : tr === '7d' ? 604800000 : 86400000)).toISOString(),
            endDate: new Date().toISOString(),
            label: tr === '1h' ? 'Past 1 Hour' : tr === '6h' ? 'Past 6 Hours' : tr === '7d' ? 'Past 7 Days' : 'Past 24 Hours'
          });
        }}
      />

      {/* Throughput Trends: Daily Event Ingestion Volumes Over the Last 30 Days */}
      <ThroughputTrendsWidget
        setActiveView={setActiveView}
        onSelectEvent={onSelectEvent}
        startDate={dateRange.startDate}
        endDate={dateRange.endDate}
        dateRangeLabel={dateRange.label}
      />

      {/* 24-Hour Event Ingestion Frequency Heatmap Widget */}
      <ActivityHeatmap24hWidget
        setActiveView={setActiveView}
        onSelectEvent={onSelectEvent}
        onOpenSimulator={onOpenSimulator}
        startDate={dateRange.startDate}
        endDate={dateRange.endDate}
        dateRangeLabel={dateRange.label}
      />

      {/* Temporal Activity & Ingestion Heatmap (7D x 24H Matrix) */}
      <TemporalActivityHeatmap
        setActiveView={setActiveView}
        onSelectEvent={onSelectEvent}
        startDate={dateRange.startDate}
        endDate={dateRange.endDate}
        dateRangeLabel={dateRange.label}
      />

      {/* Main 2-Column Split: Recent Observation Events & Dev-Stage Correlation */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left 2 Cols: Recent Observation Events Feed */}
        <div className="lg:col-span-2 bg-[#1e293b]/40 rounded-2xl border border-slate-700/50 flex flex-col overflow-hidden shadow-md">
          <div className="px-6 py-4 border-b border-slate-700/50 flex justify-between items-center bg-slate-800/20">
            <div>
              <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Recent Observation Events</span>
              </h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {dateRange.label ? `Filtered to: ${dateRange.label}` : 'Live immutable stream envelopes'}
              </p>
            </div>
            <div className="flex gap-2">
              <span className="px-2 py-1 rounded bg-blue-500/10 text-blue-400 text-[10px] font-bold border border-blue-500/20 uppercase">
                {filteredEvents.length} in window
              </span>
              <button
                onClick={() => setActiveView('ledger')}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-[10px] font-bold border border-slate-700 uppercase flex items-center gap-1 transition-colors"
              >
                <span>Full Ledger</span>
                <ArrowRight className="w-3 h-3 text-blue-400" />
              </button>
            </div>
          </div>

          <div className="p-4 space-y-3 max-h-[480px] overflow-y-auto custom-scrollbar">
            {recentObservationEvents.length === 0 ? (
              <div className="p-8 text-center text-slate-500 space-y-2">
                <p className="text-xs">No events observed in the selected time window.</p>
                <button
                  onClick={handleResetRange}
                  className="px-3 py-1.5 rounded-lg bg-blue-600/30 text-blue-300 text-xs font-semibold hover:bg-blue-600/50 transition-colors"
                >
                  Reset Date Filter
                </button>
              </div>
            ) : (
              recentObservationEvents.map(evt => {
                const stage = mapEventTypeToStage(evt.event_type);
                const color = getStageColor(stage);
                const seqCode = `${stage.slice(0, 2).toUpperCase()}-${evt.sequence_number}`;

                return (
                  <div
                    key={evt.event_id}
                    onClick={() => onSelectEvent(evt)}
                    className="flex items-center gap-4 p-3 bg-slate-800/50 hover:bg-slate-800/80 rounded-xl border border-slate-700/40 hover:border-blue-500/40 transition-all cursor-pointer group"
                  >
                    <div className="w-12 h-11 rounded-lg bg-slate-900 border border-slate-700 flex flex-col items-center justify-center flex-shrink-0">
                      <span className="text-[8px] text-slate-500 uppercase font-mono">
                        {new Date(evt.event_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <span className="text-xs font-bold text-white font-mono group-hover:text-blue-400 transition-colors">
                        {seqCode}
                      </span>
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-slate-200 truncate group-hover:text-blue-300">
                          {evt.event_type}
                        </span>
                        <span className="text-[10px] text-slate-400 font-mono">
                          {evt.source}
                        </span>
                      </div>
                      <div className="text-xs text-slate-400 truncate mt-0.5">
                        {evt.payload?.title || evt.payload?.transcript_preview || `Correlated Workflow ID: ${evt.correlation_id.slice(0, 18)}...`}
                      </div>
                    </div>

                    <div className="text-right flex-shrink-0">
                      <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-medium border ${
                        stage === 'deployment' 
                          ? 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300' 
                          : stage === 'harness' || stage === 'planning'
                            ? 'bg-blue-500/20 border-blue-500/40 text-blue-300'
                            : 'bg-slate-900 border border-slate-700 text-slate-400'
                      }`}>
                        {stage.toUpperCase()}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right 1 Col: Dev-Stage Correlation & Insights */}
        <div className="bg-[#1e293b]/40 rounded-2xl border border-slate-700/50 flex flex-col p-6 gap-5 shadow-md justify-between">
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-200 flex items-center justify-between border-b pb-3 border-slate-700/50">
              <span>Dev-Stage Correlation</span>
              <span className="text-xs font-mono text-blue-400">SDLC Matrix</span>
            </h3>

            {/* Active Planning Units */}
            <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">Active Planning Units</span>
                <span className="text-white font-bold font-mono">{funnel.plans}</span>
              </div>
              <div className="grid grid-cols-4 gap-1">
                <div className="h-2 rounded bg-blue-500"></div>
                <div className="h-2 rounded bg-blue-500"></div>
                <div className="h-2 rounded bg-blue-500/30"></div>
                <div className="h-2 rounded bg-blue-500/30"></div>
              </div>
            </div>

            {/* SDLC Implementation Branches */}
            <div className="p-4 bg-slate-900/50 rounded-xl border border-slate-800 space-y-3">
              <div className="flex justify-between text-xs">
                <span className="text-slate-400">SDLC Implementation</span>
                <span className="text-white font-bold font-mono">{filteredWorkflows.length} Chains</span>
              </div>
              <div className="space-y-2.5 mt-2">
                {filteredWorkflows.map(wf => (
                  <div 
                    key={wf.correlation_id}
                    onClick={() => onSelectWorkflow(wf.correlation_id)}
                    className="flex items-center justify-between gap-2 p-1.5 rounded-lg hover:bg-slate-800 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
                      <span className="text-[11px] font-mono text-slate-300 truncate">{wf.title}</span>
                    </div>
                    <span className="text-[9px] font-mono uppercase text-blue-400 bg-blue-500/10 px-1.5 py-0.5 rounded border border-blue-500/20">
                      {wf.stage}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Observation Insight Banner */}
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <p className="text-[10px] text-blue-300 leading-relaxed uppercase tracking-wider font-bold">
              Observation Insight
            </p>
            <p className="text-xs text-slate-300 mt-1 italic leading-relaxed">
              "Candidate identification rate is up 14% compared to baseline. Promotion latency is currently 2.4s."
            </p>
          </div>
        </div>
      </div>

      {/* Pipeline Funnel Visualizer */}
      <div className="p-6 rounded-2xl border border-slate-700/50 bg-[#1e293b]/40 shadow-md space-y-4">
        <div className="flex items-center justify-between border-b pb-3 border-slate-700/50">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
              <Workflow className="w-4 h-4 text-blue-400" />
              <span>Full Lifecycle Progression Funnel</span>
            </h3>
            <p className="text-xs text-slate-400">
              Harvested voice discovery to candidate evaluation, requirement formulation, and verified deployment ({dateRange.label}).
            </p>
          </div>
          <button
            onClick={() => setActiveView('pipeline')}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 flex items-center space-x-1"
          >
            <span>Explore Swimlanes</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {funnelStages.map((step, idx) => {
            const Icon = step.icon;
            const color = getStageColor(step.stage);
            const prevCount = idx > 0 ? funnelStages[idx - 1].count : step.count;
            const dropoffPct = prevCount > 0 ? Math.round((step.count / prevCount) * 100) : 100;

            return (
              <div 
                key={step.key}
                className="p-4 rounded-xl border border-slate-700/50 bg-slate-800/40 relative overflow-hidden group hover:border-blue-500/50 hover:bg-slate-800/70 transition-all cursor-pointer shadow-sm"
                onClick={() => setActiveView('pipeline')}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${color.bg}`}>
                    <Icon className="w-4 h-4 text-slate-200" />
                  </span>
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-900 border border-slate-700 text-slate-300">
                    {idx === 0 ? 'INPUT' : `${dropoffPct}% pass`}
                  </span>
                </div>
                <div className="text-xl font-bold font-mono text-white">{step.count}</div>
                <div className="text-xs font-medium text-slate-200 mt-1">{step.label}</div>
                <div className="text-[10px] font-mono text-slate-500 mt-1">
                  Stage {idx + 1} of 6
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Slide-out Recent Activity Drawer (Last 10 Ingested Events Scoped to Date Window) */}
      <RecentActivityDrawer
        isOpen={isActivityDrawerOpen}
        onClose={() => setIsActivityDrawerOpen(false)}
        onSelectEvent={onSelectEvent}
        setActiveView={setActiveView}
        onSelectWorkflow={onSelectWorkflow}
        onOpenSimulator={onOpenSimulator}
        startDate={dateRange.startDate}
        endDate={dateRange.endDate}
        dateRangeLabel={dateRange.label}
        onResetDateRange={handleResetRange}
      />
    </div>
  );
};
