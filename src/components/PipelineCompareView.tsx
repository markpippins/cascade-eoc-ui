import React, { useState, useMemo } from 'react';
import { 
  Workflow, 
  ArrowRight, 
  ArrowLeftRight, 
  TrendingUp, 
  TrendingDown, 
  Clock, 
  AlertTriangle, 
  CheckCircle2, 
  Code, 
  Layers, 
  Sparkles, 
  FileText, 
  CheckCircle, 
  Zap, 
  Cpu, 
  Filter, 
  ExternalLink,
  Copy,
  Check,
  ChevronDown,
  ChevronUp,
  Sliders
} from 'lucide-react';
import { useAppTheme } from '../context/ThemeContext';
import { EventEnvelope, LifecycleStage } from '../types';
import { cascadeStore } from '../services/cascadeService';
import { getStageColor, mapEventTypeToStage, getEventHealthInfo } from '../services/mockDataGenerator';
import { formatDurationLabel } from '../services/heatmapService';

interface PipelineCompareViewProps {
  initialBaselineId?: string;
  initialTargetId?: string;
  onSelectEvent: (event: EventEnvelope) => void;
}

interface WorkflowItem {
  correlation_id: string;
  title: string;
  count: number;
  stage: LifecycleStage;
  firstSeen: string;
}

interface StageComparisonData {
  stage: LifecycleStage;
  name: string;
  icon: React.FC<{ className?: string }>;
  eventsA: EventEnvelope[];
  eventsB: EventEnvelope[];
  durationA_ms: number;
  durationB_ms: number;
  durationDelta_ms: number;
  percentChange: number; // positive = regression (slower), negative = improvement (faster)
  status: 'regressed' | 'improved' | 'identical';
  errorsA: number;
  errorsB: number;
  errorDelta: number;
  subtasksA: number;
  subtasksB: number;
}

export const PipelineCompareView: React.FC<PipelineCompareViewProps> = ({
  initialBaselineId,
  initialTargetId,
  onSelectEvent
}) => {
  const { themeClasses } = useAppTheme();
  const workflows = cascadeStore.getCorrelationWorkflows();

  // Pick sensible defaults if not passed
  const defaultBaseline = initialBaselineId || workflows[0]?.correlation_id || '';
  const defaultTarget = initialTargetId || (workflows.length > 1 ? workflows[1].correlation_id : defaultBaseline);

  const [baselineId, setBaselineId] = useState<string>(defaultBaseline);
  const [targetId, setTargetId] = useState<string>(defaultTarget);
  const [filterRegressionsOnly, setFilterRegressionsOnly] = useState<boolean>(false);
  const [viewMode, setViewMode] = useState<'matrix' | 'side_by_side' | 'event_diff'>('matrix');
  const [copiedReport, setCopiedReport] = useState<boolean>(false);

  // Fetch events for Trace A (Baseline)
  const eventsA = useMemo(() => {
    return cascadeStore.getEvents({
      correlation_id: baselineId,
      limit: 100,
      offset: 0
    }).events.sort((a, b) => new Date(a.event_timestamp).getTime() - new Date(b.event_timestamp).getTime());
  }, [baselineId, cascadeStore]);

  // Fetch events for Trace B (Target)
  const eventsB = useMemo(() => {
    return cascadeStore.getEvents({
      correlation_id: targetId,
      limit: 100,
      offset: 0
    }).events.sort((a, b) => new Date(a.event_timestamp).getTime() - new Date(b.event_timestamp).getTime());
  }, [targetId, cascadeStore]);

  const workflowA = workflows.find(w => w.correlation_id === baselineId);
  const workflowB = workflows.find(w => w.correlation_id === targetId);

  // Helper to extract duration from events array
  const calculateTraceDurationMs = (events: EventEnvelope[]): number => {
    if (events.length === 0) return 0;
    if (events.length === 1) return 150;
    const start = new Date(events[0].event_timestamp).getTime();
    const end = new Date(events[events.length - 1].event_timestamp).getTime();
    const timespan = Math.max(0, end - start);

    let sumPayloadDuration = 0;
    events.forEach(e => {
      const p = e.payload || {};
      if (typeof p.execution_time_ms === 'number') sumPayloadDuration += p.execution_time_ms;
      else if (typeof p.duration_ms === 'number') sumPayloadDuration += p.duration_ms;
      else if (typeof p.latency_ms === 'number') sumPayloadDuration += p.latency_ms;
    });

    return Math.max(timespan, sumPayloadDuration, events.length * 80);
  };

  const totalDurationA = calculateTraceDurationMs(eventsA);
  const totalDurationB = calculateTraceDurationMs(eventsB);
  const totalDurationDelta = totalDurationB - totalDurationA;
  const totalPercentChange = totalDurationA > 0 ? (totalDurationDelta / totalDurationA) * 100 : 0;

  // Stages configuration
  const stageDefs: { stage: LifecycleStage; name: string; icon: React.FC<{ className?: string }> }[] = [
    { stage: 'harvest', name: '1. Ingestion Harvest', icon: Layers },
    { stage: 'candidate', name: '2. Candidate Discovery', icon: Sparkles },
    { stage: 'assessment', name: '3. Evaluation & Ripple', icon: CheckCircle },
    { stage: 'requirement', name: '4. Intent & Requirement', icon: FileText },
    { stage: 'planning', name: '5. Architecture Plan', icon: Workflow },
    { stage: 'harness', name: '6. Dev Harness Sandbox', icon: Code },
    { stage: 'deployment', name: '7. Verified Deployment', icon: TrendingUp }
  ];

  // Helper to calculate stage duration
  const getStageMetrics = (events: EventEnvelope[]): { durationMs: number; errors: number; subtasks: number } => {
    if (events.length === 0) return { durationMs: 0, errors: 0, subtasks: 0 };
    
    let sumPayloadDuration = 0;
    let errors = 0;
    let subtasks = 0;

    events.forEach(evt => {
      const p = evt.payload || {};
      if (typeof p.execution_time_ms === 'number') sumPayloadDuration += p.execution_time_ms;
      else if (typeof p.duration_ms === 'number') sumPayloadDuration += p.duration_ms;
      else if (typeof p.latency_ms === 'number') sumPayloadDuration += p.latency_ms;

      const health = getEventHealthInfo(evt);
      if (health.status === 'failed' || (typeof p.tests_failed === 'number' && p.tests_failed > 0)) {
        errors++;
      }
      if (p.parallel_track || p.subtask_name || evt.event_type.includes('.feasibility.') || evt.event_type.includes('.security.') || evt.event_type.includes('.codegen.')) {
        subtasks++;
      }
    });

    let timespan = 0;
    if (events.length > 1) {
      const start = new Date(events[0].event_timestamp).getTime();
      const end = new Date(events[events.length - 1].event_timestamp).getTime();
      timespan = Math.max(0, end - start);
    }

    const durationMs = Math.max(timespan, sumPayloadDuration, events.length * 60);
    return { durationMs, errors, subtasks };
  };

  // Compute Stage Comparisons
  const stageComparisons: StageComparisonData[] = useMemo(() => {
    return stageDefs.map(def => {
      const stgEventsA = eventsA.filter(e => mapEventTypeToStage(e.event_type) === def.stage);
      const stgEventsB = eventsB.filter(e => mapEventTypeToStage(e.event_type) === def.stage);

      const metricsA = getStageMetrics(stgEventsA);
      const metricsB = getStageMetrics(stgEventsB);

      const delta = metricsB.durationMs - metricsA.durationMs;
      const pct = metricsA.durationMs > 0 ? (delta / metricsA.durationMs) * 100 : (metricsB.durationMs > 0 ? 100 : 0);

      let status: 'regressed' | 'improved' | 'identical' = 'identical';
      if (pct > 5) status = 'regressed';
      else if (pct < -5) status = 'improved';

      return {
        stage: def.stage,
        name: def.name,
        icon: def.icon,
        eventsA: stgEventsA,
        eventsB: stgEventsB,
        durationA_ms: metricsA.durationMs,
        durationB_ms: metricsB.durationMs,
        durationDelta_ms: delta,
        percentChange: pct,
        status,
        errorsA: metricsA.errors,
        errorsB: metricsB.errors,
        errorDelta: metricsB.errors - metricsA.errors,
        subtasksA: metricsA.subtasks,
        subtasksB: metricsB.subtasks
      };
    });
  }, [eventsA, eventsB]);

  // Overall comparison stats
  const totalErrorsA = stageComparisons.reduce((sum, s) => sum + s.errorsA, 0);
  const totalErrorsB = stageComparisons.reduce((sum, s) => sum + s.errorsB, 0);
  const totalErrorDelta = totalErrorsB - totalErrorsA;

  const regressedStages = stageComparisons.filter(s => s.status === 'regressed');
  const improvedStages = stageComparisons.filter(s => s.status === 'improved');

  // Filtered stages for display
  const displayedStages = filterRegressionsOnly 
    ? stageComparisons.filter(s => s.status === 'regressed' || s.errorDelta > 0)
    : stageComparisons;

  // Swap Baseline and Target
  const handleSwap = () => {
    const temp = baselineId;
    setBaselineId(targetId);
    setTargetId(temp);
  };

  // Copy regression report
  const handleCopyReport = () => {
    const report = [
      `=== CASCADE TRACE PERFORMANCE REGRESSION REPORT ===`,
      `Baseline (Trace A): ${workflowA?.title || baselineId} (${baselineId})`,
      `Target   (Trace B): ${workflowB?.title || targetId} (${targetId})`,
      ``,
      `SUMMARY:`,
      `- Total Duration: ${formatDurationLabel(totalDurationA)} vs ${formatDurationLabel(totalDurationB)} (${totalDurationDelta >= 0 ? '+' : ''}${formatDurationLabel(totalDurationDelta)}, ${totalPercentChange.toFixed(1)}%)`,
      `- Overall Regression Status: ${totalPercentChange > 10 ? '🔴 REGRESSED' : totalPercentChange < -10 ? '🟢 IMPROVED' : '⚪ STABLE'}`,
      `- Total Errors: ${totalErrorsA} vs ${totalErrorsB} (Δ ${totalErrorDelta >= 0 ? '+' : ''}${totalErrorDelta})`,
      `- Regressed Stages: ${regressedStages.map(s => s.name).join(', ') || 'None'}`,
      `- Improved Stages: ${improvedStages.map(s => s.name).join(', ') || 'None'}`,
      ``,
      `STAGE-BY-STAGE BREAKDOWN:`,
      ...stageComparisons.map(s => 
        `• ${s.name}: ${formatDurationLabel(s.durationA_ms)} -> ${formatDurationLabel(s.durationB_ms)} (${s.durationDelta_ms >= 0 ? '+' : ''}${formatDurationLabel(s.durationDelta_ms)}, ${s.percentChange.toFixed(1)}%) [${s.status.toUpperCase()}]`
      )
    ].join('\n');

    navigator.clipboard.writeText(report);
    setCopiedReport(true);
    setTimeout(() => setCopiedReport(false), 2500);
  };

  return (
    <div className="space-y-6">
      {/* Comparison Selector Controls */}
      <div className={`p-4 rounded-xl border ${themeClasses.border} ${themeClasses.bgCard} shadow-sm space-y-4`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-100 flex items-center space-x-2 font-mono">
              <ArrowLeftRight className="w-4 h-4 text-amber-400" />
              <span>Trace Performance Regression & Diff Comparator</span>
            </h3>
            <p className={`text-xs ${themeClasses.textMuted}`}>
              Compare execution timing, parallel worker throughput, and stage latency deltas across two independent correlation IDs.
            </p>
          </div>

          {/* Action buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyReport}
              className={`px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-all flex items-center space-x-1.5 ${
                copiedReport
                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                  : `${themeClasses.bgMuted} ${themeClasses.textPrimary} hover:border-slate-500 border ${themeClasses.borderSubtle}`
              }`}
            >
              {copiedReport ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedReport ? 'Report Copied!' : 'Copy Diff Summary'}</span>
            </button>
          </div>
        </div>

        {/* Dual Selectors with Swap */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
          {/* Baseline Trace A */}
          <div className="md:col-span-5 space-y-1">
            <label className="text-[11px] font-mono font-bold text-sky-400 uppercase tracking-wider flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-sky-400 inline-block" />
              <span>Baseline Trace (A):</span>
            </label>
            <select
              value={baselineId}
              onChange={(e) => setBaselineId(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg text-xs font-mono border ${themeClasses.border} ${themeClasses.inputBg} ${themeClasses.textPrimary} truncate`}
            >
              {workflows.map(wf => (
                <option key={wf.correlation_id} value={wf.correlation_id}>
                  {wf.title} ({wf.count} evts • {wf.stage})
                </option>
              ))}
            </select>
          </div>

          {/* Swap Button */}
          <div className="md:col-span-2 flex justify-center">
            <button
              onClick={handleSwap}
              className={`p-2.5 rounded-xl border ${themeClasses.border} ${themeClasses.bgMuted} hover:bg-slate-800 text-slate-300 hover:text-white transition-all shadow-sm flex items-center space-x-1`}
              title="Swap Baseline and Target Traces"
            >
              <ArrowLeftRight className="w-4 h-4 text-amber-400" />
            </button>
          </div>

          {/* Target Trace B */}
          <div className="md:col-span-5 space-y-1">
            <label className="text-[11px] font-mono font-bold text-amber-400 uppercase tracking-wider flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              <span>Candidate / Target Trace (B):</span>
            </label>
            <select
              value={targetId}
              onChange={(e) => setTargetId(e.target.value)}
              className={`w-full px-3 py-2 rounded-lg text-xs font-mono border ${themeClasses.border} ${themeClasses.inputBg} ${themeClasses.textPrimary} truncate`}
            >
              {workflows.map(wf => (
                <option key={wf.correlation_id} value={wf.correlation_id}>
                  {wf.title} ({wf.count} evts • {wf.stage})
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* View Mode Tabs & Quick Regression Filter */}
        <div className={`pt-2 border-t ${themeClasses.borderSubtle} flex flex-wrap items-center justify-between gap-2`}>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setViewMode('matrix')}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                viewMode === 'matrix'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : `${themeClasses.bgMuted} text-slate-400 hover:text-slate-200`
              }`}
            >
              📊 Regression Matrix & Deltas
            </button>
            <button
              onClick={() => setViewMode('side_by_side')}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                viewMode === 'side_by_side'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : `${themeClasses.bgMuted} text-slate-400 hover:text-slate-200`
              }`}
            >
              📑 Side-by-Side Swimlanes
            </button>
            <button
              onClick={() => setViewMode('event_diff')}
              className={`px-3 py-1 rounded-lg text-xs font-mono font-semibold transition-all ${
                viewMode === 'event_diff'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : `${themeClasses.bgMuted} text-slate-400 hover:text-slate-200`
              }`}
            >
              ⚡ Causal Event Diff
            </button>
          </div>

          <button
            onClick={() => setFilterRegressionsOnly(!filterRegressionsOnly)}
            className={`px-2.5 py-1 rounded-lg text-xs font-mono flex items-center space-x-1.5 border transition-all ${
              filterRegressionsOnly
                ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold'
                : `${themeClasses.bgMuted} text-slate-400 border-transparent`
            }`}
          >
            <Filter className="w-3 h-3 text-rose-400" />
            <span>Show Regressions Only ({regressedStages.length})</span>
          </button>
        </div>
      </div>

      {/* Regression KPI Executive Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Total Latency Delta */}
        <div className={`p-4 rounded-xl border ${totalPercentChange > 10 ? 'border-rose-500/60 bg-rose-950/30' : totalPercentChange < -10 ? 'border-emerald-500/60 bg-emerald-950/30' : themeClasses.border} ${themeClasses.bgCard} shadow-sm space-y-1`}>
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Total End-to-End Latency</span>
            <Clock className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className="text-xl font-bold font-mono text-slate-100">
              {formatDurationLabel(totalDurationB)}
            </span>
            <span className="text-xs font-mono text-slate-500">
              (was {formatDurationLabel(totalDurationA)})
            </span>
          </div>
          <div className="flex items-center space-x-1.5 text-xs font-mono font-bold pt-1">
            {totalPercentChange > 5 ? (
              <span className="text-rose-400 flex items-center space-x-0.5">
                <TrendingUp className="w-3.5 h-3.5 text-rose-400 inline" />
                <span>+{formatDurationLabel(totalDurationDelta)} ({totalPercentChange.toFixed(1)}% SLOWER)</span>
              </span>
            ) : totalPercentChange < -5 ? (
              <span className="text-emerald-400 flex items-center space-x-0.5">
                <TrendingDown className="w-3.5 h-3.5 text-emerald-400 inline" />
                <span>{formatDurationLabel(totalDurationDelta)} ({Math.abs(totalPercentChange).toFixed(1)}% FASTER)</span>
              </span>
            ) : (
              <span className="text-slate-400">≈ Nominal Delta ({totalPercentChange.toFixed(1)}%)</span>
            )}
          </div>
        </div>

        {/* Error / Fault Delta */}
        <div className={`p-4 rounded-xl border ${totalErrorDelta > 0 ? 'border-rose-500/60 bg-rose-950/30' : themeClasses.border} ${themeClasses.bgCard} shadow-sm space-y-1`}>
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Execution Errors & Faults</span>
            <AlertTriangle className="w-3.5 h-3.5 text-slate-400" />
          </div>
          <div className="flex items-baseline space-x-2">
            <span className={`text-xl font-bold font-mono ${totalErrorsB > 0 ? 'text-rose-400' : 'text-slate-100'}`}>
              {totalErrorsB}
            </span>
            <span className="text-xs font-mono text-slate-500">
              (was {totalErrorsA})
            </span>
          </div>
          <div className="text-xs font-mono pt-1">
            {totalErrorDelta > 0 ? (
              <span className="text-rose-400 font-bold">+{totalErrorDelta} New Error(s) in Target</span>
            ) : totalErrorDelta < 0 ? (
              <span className="text-emerald-400 font-bold">{Math.abs(totalErrorDelta)} Error(s) Resolved</span>
            ) : (
              <span className="text-slate-400">No Change in Error Count</span>
            )}
          </div>
        </div>

        {/* Regressed Stages Count */}
        <div className={`p-4 rounded-xl border ${themeClasses.border} ${themeClasses.bgCard} shadow-sm space-y-1`}>
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Regressed Stages</span>
            <TrendingUp className="w-3.5 h-3.5 text-rose-400" />
          </div>
          <div className="text-xl font-bold font-mono text-slate-100">
            <span className={regressedStages.length > 0 ? 'text-rose-400' : 'text-emerald-400'}>
              {regressedStages.length}
            </span>
            <span className="text-xs font-normal text-slate-500"> / {stageDefs.length} Stages</span>
          </div>
          <div className="text-xs font-mono text-slate-400 pt-1 truncate">
            {regressedStages.length > 0 
              ? regressedStages.map(s => s.name.split('.')[0]).join(', ')
              : 'All stages faster or equal'}
          </div>
        </div>

        {/* Improved Stages Count */}
        <div className={`p-4 rounded-xl border ${themeClasses.border} ${themeClasses.bgCard} shadow-sm space-y-1`}>
          <div className="flex items-center justify-between text-xs font-mono text-slate-400">
            <span>Improved Stages</span>
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
          </div>
          <div className="text-xl font-bold font-mono text-emerald-400">
            <span>{improvedStages.length}</span>
            <span className="text-xs font-normal text-slate-500"> / {stageDefs.length} Stages</span>
          </div>
          <div className="text-xs font-mono text-slate-400 pt-1 truncate">
            {improvedStages.length > 0 
              ? improvedStages.map(s => s.name.split('.')[0]).join(', ')
              : 'No stage latency reductions'}
          </div>
        </div>
      </div>

      {/* VIEW MODE 1: Regression Matrix & Delta Breakdown */}
      {viewMode === 'matrix' && (
        <div className={`p-5 rounded-xl border ${themeClasses.border} ${themeClasses.bgCard} shadow-sm space-y-4`}>
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-bold font-mono text-slate-100 flex items-center space-x-2">
              <Workflow className="w-4 h-4 text-sky-400" />
              <span>Lifecycle Stage Latency & Health Comparison Matrix</span>
            </h4>
            <span className="text-xs font-mono text-slate-400">
              Comparing 7 end-to-end pipeline phases
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs font-mono">
              <thead className={`border-b ${themeClasses.border} ${themeClasses.headerBg} text-[10px] uppercase text-slate-400`}>
                <tr>
                  <th className="py-3 px-3">Stage / Phase</th>
                  <th className="py-3 px-3 text-sky-400">Trace A (Baseline)</th>
                  <th className="py-3 px-3 text-amber-400">Trace B (Target)</th>
                  <th className="py-3 px-3">Timing Delta</th>
                  <th className="py-3 px-3">Duration Visualizer</th>
                  <th className="py-3 px-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className={`divide-y ${themeClasses.borderSubtle}`}>
                {displayedStages.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 font-mono">
                      No stages match the active regression filter.
                    </td>
                  </tr>
                ) : (
                  displayedStages.map(stg => {
                    const color = getStageColor(stg.stage);
                    const Icon = stg.icon;
                    const maxBarDuration = Math.max(stg.durationA_ms, stg.durationB_ms, 100);
                    const barPctA = Math.max(8, (stg.durationA_ms / maxBarDuration) * 100);
                    const barPctB = Math.max(8, (stg.durationB_ms / maxBarDuration) * 100);

                    return (
                      <tr key={stg.stage} className="hover:bg-slate-800/40 transition-colors">
                        {/* Stage Name */}
                        <td className="py-3 px-3">
                          <div className="flex items-center space-x-2.5">
                            <div className={`w-6 h-6 rounded-md flex items-center justify-center ${color.bg}`}>
                              <Icon className="w-3.5 h-3.5" />
                            </div>
                            <div>
                              <div className="font-bold text-slate-200">{stg.name}</div>
                              <div className="text-[10px] text-slate-500">
                                {stg.eventsA.length} vs {stg.eventsB.length} events
                              </div>
                            </div>
                          </div>
                        </td>

                        {/* Baseline A */}
                        <td className="py-3 px-3 text-slate-200">
                          <div className="font-semibold">{formatDurationLabel(stg.durationA_ms)}</div>
                          <div className="text-[10px] text-slate-400">
                            {stg.errorsA > 0 ? `${stg.errorsA} errors` : '0 errors'} • {stg.subtasksA} tasks
                          </div>
                        </td>

                        {/* Target B */}
                        <td className="py-3 px-3 text-slate-200">
                          <div className="font-semibold">{formatDurationLabel(stg.durationB_ms)}</div>
                          <div className="text-[10px] text-slate-400">
                            {stg.errorsB > 0 ? (
                              <span className="text-rose-400 font-bold">{stg.errorsB} errors</span>
                            ) : '0 errors'} • {stg.subtasksB} tasks
                          </div>
                        </td>

                        {/* Delta */}
                        <td className="py-3 px-3">
                          {stg.status === 'regressed' ? (
                            <span className="text-rose-400 font-bold flex items-center space-x-1">
                              <TrendingUp className="w-3.5 h-3.5 inline" />
                              <span>+{formatDurationLabel(stg.durationDelta_ms)} (+{stg.percentChange.toFixed(0)}%)</span>
                            </span>
                          ) : stg.status === 'improved' ? (
                            <span className="text-emerald-400 font-bold flex items-center space-x-1">
                              <TrendingDown className="w-3.5 h-3.5 inline" />
                              <span>{formatDurationLabel(stg.durationDelta_ms)} ({stg.percentChange.toFixed(0)}%)</span>
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono">
                              {stg.durationDelta_ms >= 0 ? '+' : ''}{formatDurationLabel(stg.durationDelta_ms)} (0%)
                            </span>
                          )}
                        </td>

                        {/* Duration Visualizer */}
                        <td className="py-3 px-3 min-w-[180px]">
                          <div className="space-y-1">
                            {/* Trace A Bar */}
                            <div className="flex items-center space-x-2 text-[9px]">
                              <span className="w-3 text-sky-400 font-bold">A</span>
                              <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                <div className="bg-sky-400 h-full rounded-full" style={{ width: `${barPctA}%` }} />
                              </div>
                              <span className="text-slate-400 w-12 text-right">{formatDurationLabel(stg.durationA_ms)}</span>
                            </div>

                            {/* Trace B Bar */}
                            <div className="flex items-center space-x-2 text-[9px]">
                              <span className="w-3 text-amber-400 font-bold">B</span>
                              <div className="flex-1 bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                <div 
                                  className={`h-full rounded-full ${stg.status === 'regressed' ? 'bg-rose-500' : stg.status === 'improved' ? 'bg-emerald-400' : 'bg-amber-400'}`} 
                                  style={{ width: `${barPctB}%` }} 
                                />
                              </div>
                              <span className="text-slate-400 w-12 text-right">{formatDurationLabel(stg.durationB_ms)}</span>
                            </div>
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td className="py-3 px-3 text-center">
                          {stg.status === 'regressed' ? (
                            <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40 text-[10px] font-bold inline-block">
                              🔴 REGRESSED
                            </span>
                          ) : stg.status === 'improved' ? (
                            <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 text-[10px] font-bold inline-block">
                              🟢 FASTER
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-400 text-[10px] inline-block">
                              ⚪ NOMINAL
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* VIEW MODE 2: Side-by-Side Swimlanes */}
      {viewMode === 'side_by_side' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* Left Column: Trace A */}
          <div className="space-y-4">
            <div className={`p-3.5 rounded-xl border border-sky-500/30 ${themeClasses.bgCard} shadow-sm flex items-center justify-between`}>
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-sky-400" />
                <span className="font-bold text-xs text-sky-400 font-mono uppercase">Trace A (Baseline)</span>
              </div>
              <span className="text-xs font-mono text-slate-300">
                {eventsA.length} envelopes • {formatDurationLabel(totalDurationA)}
              </span>
            </div>

            {stageComparisons.map(stg => {
              const color = getStageColor(stg.stage);
              const Icon = stg.icon;

              return (
                <div key={`traceA-${stg.stage}`} className={`rounded-xl border ${themeClasses.border} ${themeClasses.bgCard} p-4 space-y-3`}>
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center space-x-2">
                      <div className={`w-5 h-5 rounded flex items-center justify-center ${color.bg}`}>
                        <Icon className="w-3 h-3" />
                      </div>
                      <span className="font-bold text-xs text-slate-200 font-mono">{stg.name}</span>
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {stg.eventsA.length} evts ({formatDurationLabel(stg.durationA_ms)})
                    </span>
                  </div>

                  {stg.eventsA.length === 0 ? (
                    <div className="py-2 text-center text-slate-600 text-xs font-mono">No events in this stage</div>
                  ) : (
                    <div className="space-y-2">
                      {stg.eventsA.map(evt => {
                        const health = getEventHealthInfo(evt);
                        return (
                          <div
                            key={evt.event_id}
                            onClick={() => onSelectEvent(evt)}
                            className={`p-2.5 rounded-lg border ${themeClasses.borderSubtle} ${themeClasses.bgMuted} hover:border-sky-400 transition-all cursor-pointer text-xs font-mono flex items-center justify-between`}
                          >
                            <div>
                              <div className="font-bold text-slate-200 truncate max-w-xs">{evt.event_type}</div>
                              <div className="text-[10px] text-slate-500">{evt.source}</div>
                            </div>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] border ${health.badgeClass}`}>
                              {health.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Right Column: Trace B */}
          <div className="space-y-4">
            <div className={`p-3.5 rounded-xl border border-amber-500/30 ${themeClasses.bgCard} shadow-sm flex items-center justify-between`}>
              <div className="flex items-center space-x-2">
                <span className="w-3 h-3 rounded-full bg-amber-400" />
                <span className="font-bold text-xs text-amber-400 font-mono uppercase">Trace B (Target)</span>
              </div>
              <span className="text-xs font-mono text-slate-300">
                {eventsB.length} envelopes • {formatDurationLabel(totalDurationB)}
              </span>
            </div>

            {stageComparisons.map(stg => {
              const color = getStageColor(stg.stage);
              const Icon = stg.icon;
              const isRegressed = stg.status === 'regressed';

              return (
                <div 
                  key={`traceB-${stg.stage}`} 
                  className={`rounded-xl border ${isRegressed ? 'border-rose-500/60 bg-rose-950/20' : themeClasses.border} ${themeClasses.bgCard} p-4 space-y-3`}
                >
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                    <div className="flex items-center space-x-2">
                      <div className={`w-5 h-5 rounded flex items-center justify-center ${color.bg}`}>
                        <Icon className="w-3 h-3" />
                      </div>
                      <span className="font-bold text-xs text-slate-200 font-mono">{stg.name}</span>
                      {isRegressed && (
                        <span className="px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 text-[9px] font-bold border border-rose-500/40">
                          +{formatDurationLabel(stg.durationDelta_ms)}
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] font-mono text-slate-400">
                      {stg.eventsB.length} evts ({formatDurationLabel(stg.durationB_ms)})
                    </span>
                  </div>

                  {stg.eventsB.length === 0 ? (
                    <div className="py-2 text-center text-slate-600 text-xs font-mono">No events in this stage</div>
                  ) : (
                    <div className="space-y-2">
                      {stg.eventsB.map(evt => {
                        const health = getEventHealthInfo(evt);
                        return (
                          <div
                            key={evt.event_id}
                            onClick={() => onSelectEvent(evt)}
                            className={`p-2.5 rounded-lg border ${themeClasses.borderSubtle} ${themeClasses.bgMuted} hover:border-amber-400 transition-all cursor-pointer text-xs font-mono flex items-center justify-between`}
                          >
                            <div>
                              <div className="font-bold text-slate-200 truncate max-w-xs">{evt.event_type}</div>
                              <div className="text-[10px] text-slate-500">{evt.source}</div>
                            </div>
                            <span className={`px-1.5 py-0.5 rounded text-[9px] border ${health.badgeClass}`}>
                              {health.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* VIEW MODE 3: Causal Event Diff */}
      {viewMode === 'event_diff' && (
        <div className={`p-5 rounded-xl border ${themeClasses.border} ${themeClasses.bgCard} shadow-sm space-y-4`}>
          <div>
            <h4 className="text-sm font-bold font-mono text-slate-100 flex items-center space-x-2">
              <Zap className="w-4 h-4 text-indigo-400" />
              <span>Event Progression Sequence Alignment & Structural Diff</span>
            </h4>
            <p className={`text-xs ${themeClasses.textMuted} mt-0.5`}>
              Inspect the ordered causal sequence of event emissions and detect missing steps or added verification barriers.
            </p>
          </div>

          <div className="space-y-2">
            {eventsB.map((evtB, idx) => {
              const evtA = eventsA[idx];
              const healthB = getEventHealthInfo(evtB);
              const healthA = evtA ? getEventHealthInfo(evtA) : null;
              const isMismatch = evtA && evtA.event_type !== evtB.event_type;

              return (
                <div
                  key={evtB.event_id}
                  className={`p-3 rounded-lg border ${isMismatch ? 'border-amber-500/40 bg-amber-950/20' : themeClasses.borderSubtle} ${themeClasses.bgMuted} text-xs font-mono flex flex-col md:flex-row md:items-center justify-between gap-2`}
                >
                  <div className="flex items-center space-x-3">
                    <span className="text-slate-500 w-8">#{idx + 1}</span>
                    <div>
                      <div className="font-bold text-slate-100 flex items-center space-x-2">
                        <span>{evtB.event_type}</span>
                        {isMismatch && (
                          <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 text-[9px] font-bold">
                            Diff vs A: {evtA?.event_type}
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400">{evtB.source}</div>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-0.5 rounded text-[10px] border ${healthB.badgeClass}`}>
                      {healthB.label}
                    </span>
                    <button
                      onClick={() => onSelectEvent(evtB)}
                      className="px-2 py-1 rounded bg-slate-800 hover:bg-sky-500 hover:text-white text-slate-300 transition-colors text-[10px]"
                    >
                      Inspect →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
