import React, { useState } from 'react';
import { 
  Workflow, 
  Sparkles, 
  CheckCircle, 
  Layers, 
  Activity, 
  TrendingUp, 
  FileText, 
  Code, 
  GitPullRequest, 
  Play, 
  ArrowRight,
  ShieldAlert,
  Clock,
  Zap,
  GitFork,
  Cpu,
  ShieldCheck,
  CheckCircle2,
  AlertTriangle,
  ArrowLeftRight,
  RotateCcw
} from 'lucide-react';
import { useAppTheme } from '../context/ThemeContext';
import { EventEnvelope, LifecycleStage } from '../types';
import { cascadeStore } from '../services/cascadeService';
import { getStageColor, mapEventTypeToStage, getEventHealthInfo } from '../services/mockDataGenerator';
import { PipelineFlowGraph } from './PipelineFlowGraph';
import { PipelineCompareView } from './PipelineCompareView';
import { EmptyState } from './EmptyState';

interface PipelineTraceViewProps {
  initialCorrelationId?: string;
  onSelectEvent: (event: EventEnvelope) => void;
  onOpenSimulator: () => void;
}

export type TraceDisplayTab = 'flow_graph' | 'stage_cards' | 'parallel_matrix' | 'compare';

export const PipelineTraceView: React.FC<PipelineTraceViewProps> = ({
  initialCorrelationId,
  onSelectEvent,
  onOpenSimulator
}) => {
  const { themeClasses, isSteel, isDark } = useAppTheme();

  const workflows = cascadeStore.getCorrelationWorkflows();
  const [selectedCorrelationId, setSelectedCorrelationId] = useState<string>(
    initialCorrelationId || workflows[0]?.correlation_id || ''
  );
  const [activeTab, setActiveTab] = useState<TraceDisplayTab>('flow_graph');

  // If no workflows exist at all in the system
  if (workflows.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto custom-scrollbar">
        <EmptyState
          type="pipeline"
          title="No SDLC Correlation Traces Found"
          description="No end-to-end SDLC correlation workflows have been ingested or tracked in the immutable Cascade event store yet."
          hints={[
            {
              label: '7-Stage Pipeline Progression',
              detail: 'Traces link audio harvests, candidate discoveries, multi-dimension assessments, requirements, architecture plans, dev harness sandboxes, and verified deployments.',
              badge: 'SDLC Matrix'
            },
            {
              label: 'Causal Lineage & Blast Radius',
              detail: 'Each event envelope contains a causation_id pointing back to its parent and a correlation_id binding the end-to-end execution chain.',
              badge: 'Causal Graph'
            }
          ]}
          actions={[
            {
              label: 'Launch Telemetry Simulator',
              icon: Play,
              variant: 'primary',
              onClick: onOpenSimulator
            }
          ]}
        />
      </div>
    );
  }

  // Retrieve events for this workflow
  const workflowEvents = cascadeStore.getEvents({
    correlation_id: selectedCorrelationId,
    limit: 100,
    offset: 0
  }).events.sort((a, b) => new Date(a.event_timestamp).getTime() - new Date(b.event_timestamp).getTime());

  const stages: { stage: LifecycleStage; name: string; icon: React.FC<{ className?: string }> }[] = [
    { stage: 'harvest', name: '1. Ingestion Harvest', icon: Layers },
    { stage: 'candidate', name: '2. Candidate Discovery', icon: Sparkles },
    { stage: 'assessment', name: '3. Evaluation & Ripple', icon: CheckCircle },
    { stage: 'requirement', name: '4. Intent & Requirement', icon: FileText },
    { stage: 'planning', name: '5. Architecture Plan', icon: Workflow },
    { stage: 'harness', name: '6. Dev Harness Sandbox', icon: Code },
    { stage: 'deployment', name: '7. Verified Deployment', icon: TrendingUp }
  ];

  // Group workflow events by lifecycle stage
  const eventsByStage: Record<LifecycleStage, EventEnvelope[]> = {
    harvest: [],
    candidate: [],
    assessment: [],
    requirement: [],
    planning: [],
    harness: [],
    deployment: [],
    scheduler: [],
    timeclock: [],
    nebula: [],
    lease: [],
    registry: [],
    voyager: [],
    execution: [],
    circuit: [],
    substance: [],
    mcp: [],
    wrp: []
  };

  workflowEvents.forEach(evt => {
    const stg = mapEventTypeToStage(evt.event_type);
    eventsByStage[stg].push(evt);
  });

  const selectedWf = workflows.find(w => w.correlation_id === selectedCorrelationId);

  // Extract parallel subtasks for the Parallel Matrix tab
  const parallelSubtasks = workflowEvents.filter(
    evt => Boolean(
      evt.payload?.parallel_track ||
      evt.payload?.subtask_name ||
      evt.event_type.includes('.feasibility.') ||
      evt.event_type.includes('.security.') ||
      evt.event_type.includes('.codegen.') ||
      evt.event_type.includes('.tests.')
    )
  );

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto custom-scrollbar">
      {/* Workflow Selector Header */}
      <div className={`p-4 rounded-xl border ${themeClasses.border} ${themeClasses.bgCard} shadow-sm space-y-3`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
              <Workflow className="w-4 h-4 text-sky-400" />
              <span>End-to-End Lifecycle Trace & Visual Dependency Flow</span>
            </h2>
            <p className={`text-xs ${themeClasses.textMuted}`}>
              Full causal provenance from raw meeting transcript to candidate greenlight, parallel sub-task synthesis, test verification, and deployment.
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <select
              value={selectedCorrelationId}
              onChange={(e) => setSelectedCorrelationId(e.target.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono border ${themeClasses.border} ${themeClasses.inputBg} ${themeClasses.textPrimary} max-w-sm truncate`}
            >
              {workflows.map(wf => (
                <option key={wf.correlation_id} value={wf.correlation_id}>
                  {wf.title} ({wf.count} events)
                </option>
              ))}
            </select>

            <button
              onClick={() => setActiveTab('compare')}
              className={`px-3 py-1.5 rounded-lg border text-xs font-semibold transition-all flex items-center space-x-1.5 ${
                activeTab === 'compare'
                  ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-sm'
                  : `${themeClasses.bgMuted} text-amber-300 hover:bg-amber-500/10 border-amber-500/30`
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5" />
              <span>Compare Traces</span>
            </button>

            <button
              onClick={onOpenSimulator}
              className="px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs transition-all flex items-center space-x-1"
            >
              <Play className="w-3 h-3" />
              <span>Simulate New Trace</span>
            </button>
          </div>
        </div>

        {selectedWf && activeTab !== 'compare' && (
          <div className={`p-3 rounded-lg border ${themeClasses.borderSubtle} ${themeClasses.bgMuted} flex flex-wrap items-center justify-between gap-3 text-xs font-mono`}>
            <div>
              <span className="text-slate-500">Active Workflow: </span>
              <strong className="text-slate-200">{selectedWf.title}</strong>
            </div>
            <div className="flex items-center space-x-4 text-slate-400">
              <span>Correlation: <strong className="text-indigo-400">{selectedWf.correlation_id.slice(0, 16)}...</strong></span>
              <span>Events: <strong className="text-slate-200">{workflowEvents.length}</strong></span>
              <span>Parallel Sub-tasks: <strong className="text-sky-300">{parallelSubtasks.length}</strong></span>
              <span>Status: <strong className="text-emerald-400 uppercase">{selectedWf.stage}</strong></span>
            </div>
          </div>
        )}

        {/* View Mode Navigation Tabs */}
        <div className={`pt-2 border-t ${themeClasses.borderSubtle} flex items-center justify-between`}>
          <div className="flex items-center space-x-2 flex-wrap gap-y-2">
            <button
              onClick={() => setActiveTab('flow_graph')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all flex items-center space-x-1.5 ${
                activeTab === 'flow_graph'
                  ? 'bg-sky-500 text-white shadow-sm ring-1 ring-sky-400/50'
                  : `${themeClasses.bgCard} text-slate-400 hover:text-slate-200 border ${themeClasses.border}`
              }`}
            >
              <Workflow className="w-3.5 h-3.5" />
              <span>Visual Flow & Dependencies (D3.js)</span>
            </button>

            <button
              onClick={() => setActiveTab('stage_cards')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all flex items-center space-x-1.5 ${
                activeTab === 'stage_cards'
                  ? 'bg-sky-500 text-white shadow-sm ring-1 ring-sky-400/50'
                  : `${themeClasses.bgCard} text-slate-400 hover:text-slate-200 border ${themeClasses.border}`
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Stage Swimlanes ({stages.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('parallel_matrix')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all flex items-center space-x-1.5 ${
                activeTab === 'parallel_matrix'
                  ? 'bg-sky-500 text-white shadow-sm ring-1 ring-sky-400/50'
                  : `${themeClasses.bgCard} text-slate-400 hover:text-slate-200 border ${themeClasses.border}`
              }`}
            >
              <Zap className="w-3.5 h-3.5 text-indigo-400" />
              <span>Parallel Tasks Matrix ({parallelSubtasks.length})</span>
            </button>

            <button
              onClick={() => setActiveTab('compare')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all flex items-center space-x-1.5 ${
                activeTab === 'compare'
                  ? 'bg-amber-500 text-slate-950 font-bold shadow-sm ring-1 ring-amber-400/50'
                  : `${themeClasses.bgCard} text-amber-300 hover:text-amber-200 border ${themeClasses.border}`
              }`}
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-amber-400" />
              <span>Compare Traces (Regressions)</span>
            </button>
          </div>
        </div>
      </div>

      {/* Tab 1: Interactive D3 Visual Flow Graph */}
      {activeTab === 'flow_graph' && (
        <PipelineFlowGraph
          events={workflowEvents}
          onSelectEvent={onSelectEvent}
          workflowTitle={selectedWf?.title}
          correlationId={selectedCorrelationId}
        />
      )}

      {/* Tab 2: 7-Stage Horizontal / Vertical Swimlanes */}
      {activeTab === 'stage_cards' && (
        <div className="space-y-4">
          {stages.map((stgInfo, idx) => {
            const stgEvents = eventsByStage[stgInfo.stage];
            const hasEvents = stgEvents.length > 0;
            const color = getStageColor(stgInfo.stage);
            const Icon = stgInfo.icon;

            return (
              <div
                key={stgInfo.stage}
                className={`rounded-xl border ${hasEvents ? color.border : themeClasses.borderSubtle} ${themeClasses.bgCard} shadow-md overflow-hidden transition-all`}
              >
                {/* Stage Header */}
                <div className={`p-3 px-4 border-b ${themeClasses.borderSubtle} ${themeClasses.headerBg} flex items-center justify-between`}>
                  <div className="flex items-center space-x-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${color.bg}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <span className="font-bold text-xs text-slate-200 font-mono">
                      {stgInfo.name}
                    </span>
                    <span className={`text-[10px] font-mono px-2 py-0.2 rounded font-semibold ${hasEvents ? color.badge : 'bg-slate-800 text-slate-500'}`}>
                      {stgEvents.length} Envelopes
                    </span>
                  </div>

                  <div className="text-[11px] font-mono text-slate-400">
                    {hasEvents ? 'COMPLETED' : 'PENDING STAGE'}
                  </div>
                </div>

                {/* Stage Content */}
                <div className="p-4">
                  {stgEvents.length === 0 ? (
                    <EmptyState
                      type="pipeline_stage"
                      compact={true}
                      bordered={false}
                      title={`No Envelopes in ${stgInfo.name}`}
                      description="This workflow has not emitted any events in this lifecycle phase yet."
                      hints={[
                        {
                          label: 'Stage Triggers',
                          detail: 'Events transition sequentially through NATS subject patterns as orchestrators progress.',
                          badge: 'Lifecycle'
                        }
                      ]}
                    />
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {stgEvents.map(evt => {
                        const health = getEventHealthInfo(evt);

                        return (
                          <div
                            key={evt.event_id}
                            onClick={() => onSelectEvent(evt)}
                            className={`p-3.5 rounded-lg border ${themeClasses.borderSubtle} ${themeClasses.bgMuted} hover:border-sky-400 hover:bg-slate-800/80 transition-all cursor-pointer group flex flex-col justify-between`}
                          >
                            <div>
                              <div className="flex items-center justify-between mb-1.5">
                                <span className="text-[10px] font-mono font-bold text-sky-400">
                                  {evt.source}
                                </span>
                                <span className="text-[10px] font-mono text-slate-500">
                                  Seq #{evt.sequence_number}
                                </span>
                              </div>

                              <div className="flex items-center justify-between gap-2">
                                <div className="text-xs font-mono font-bold text-slate-100 group-hover:text-sky-300 transition-colors truncate">
                                  {evt.event_type}
                                </div>
                                <div className={`inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[9px] font-mono border ${health.badgeClass}`}>
                                  <span className={`w-1.5 h-1.5 rounded-full ${health.dotClass}`} />
                                  <span>{health.label}</span>
                                </div>
                              </div>

                              {/* Dynamic Stage Highlights */}
                              {evt.payload?.transcript_preview && (
                                <div className="text-[11px] text-slate-300 mt-2 line-clamp-2 italic bg-slate-900/60 p-2 rounded border border-slate-800">
                                  "{evt.payload.transcript_preview}"
                                </div>
                              )}

                              {evt.payload?.title && !evt.payload?.transcript_preview && (
                                <div className="text-[11px] text-slate-300 mt-1 font-semibold">
                                  {evt.payload.title}
                                </div>
                              )}

                              {evt.payload?.subtask_name && (
                                <div className="mt-1 text-[11px] text-indigo-300 font-sans flex items-center space-x-1">
                                  <Zap className="w-3 h-3 text-indigo-400" />
                                  <span>{evt.payload.subtask_name}</span>
                                </div>
                              )}

                              {evt.payload?.cpf !== undefined && (
                                <div className="mt-2 flex items-center space-x-2 text-[10px] font-mono">
                                  <span className="text-slate-400">CPF Score:</span>
                                  <span className="px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-bold">
                                    {evt.payload.cpf}
                                  </span>
                                  {evt.payload.risk_level && (
                                    <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300">
                                      {evt.payload.risk_level} Risk
                                    </span>
                                  )}
                                </div>
                              )}

                              {evt.payload?.tests_passed !== undefined && (
                                <div className="mt-2 text-[10px] font-mono text-emerald-400 flex items-center space-x-2">
                                  <span>✓ {evt.payload.tests_passed} tests passed</span>
                                  <span>({evt.payload.coverage_delta || '+3.4%'})</span>
                                </div>
                              )}

                              {evt.payload?.pull_request_url && (
                                <div className="mt-2 text-[10px] font-mono text-sky-400 flex items-center space-x-1 truncate">
                                  <GitPullRequest className="w-3 h-3" />
                                  <span className="truncate">{evt.payload.pull_request_url}</span>
                                </div>
                              )}
                            </div>

                            <div className="mt-3 pt-2 border-t border-slate-800/60 flex items-center justify-between text-[10px] font-mono text-slate-500">
                              <span>{new Date(evt.event_timestamp).toLocaleTimeString()}</span>
                              <span className="text-sky-400 group-hover:text-sky-300">Inspect Envelope →</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tab 3: Parallel Tasks & Worker Execution Matrix */}
      {activeTab === 'parallel_matrix' && (
        <div className={`p-5 rounded-xl border ${themeClasses.border} ${themeClasses.bgCard} shadow-sm space-y-4`}>
          <div>
            <h3 className="text-sm font-bold text-slate-100 font-mono flex items-center space-x-2">
              <Zap className="w-4 h-4 text-indigo-400" />
              <span>Concurrent Worker Sub-Tasks & Concurrency Matrix</span>
            </h3>
            <p className={`text-xs ${themeClasses.textMuted} mt-0.5`}>
              Inspect the parallel sub-tasks spawned by coordinator agents during assessment and dev harness execution.
            </p>
          </div>

          {parallelSubtasks.length === 0 ? (
            <EmptyState
              type="pipeline_parallel"
              compact={true}
              bordered={false}
              title="No Concurrent Worker Sub-Tasks"
              description="Coordinator agents executed this workflow along a single primary execution thread without spawning parallel worker sub-tasks."
              hints={[
                {
                  label: 'Parallel Execution Tracks',
                  detail: 'Orchestrators fan out parallel assessment runs (feasibility, security, codegen, regression testing) for complex features.',
                  badge: 'Concurrency Engine'
                }
              ]}
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs font-mono">
                <thead className={`border-b ${themeClasses.border} ${themeClasses.headerBg} text-[10px] uppercase text-slate-400`}>
                  <tr>
                    <th className="py-2.5 px-3">Sub-Task Name</th>
                    <th className="py-2.5 px-3">Parallel Track</th>
                    <th className="py-2.5 px-3">Worker Agent / Tool</th>
                    <th className="py-2.5 px-3">Causal Parent</th>
                    <th className="py-2.5 px-3">Status</th>
                    <th className="py-2.5 px-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className={`divide-y ${themeClasses.borderSubtle}`}>
                  {parallelSubtasks.map(task => {
                    const health = getEventHealthInfo(task);
                    const parentEvent = task.causation_id ? cascadeStore.getEventById(task.causation_id) : null;

                    return (
                      <tr key={task.event_id} className="hover:bg-slate-800/40 transition-colors">
                        <td className="py-3 px-3 font-semibold text-slate-200">
                          <div>{task.payload?.subtask_name || task.event_type}</div>
                          <div className="text-[10px] text-slate-500 font-normal">{task.event_type}</div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold text-[10px] border border-indigo-500/30">
                            {task.payload?.parallel_track || 'Parallel Worker'}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-slate-300">
                          <div className="flex items-center space-x-1">
                            <Cpu className="w-3 h-3 text-sky-400" />
                            <span>{task.actor_id}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3 text-slate-400">
                          {parentEvent ? (
                            <span className="text-slate-300 underline cursor-pointer" onClick={() => onSelectEvent(parentEvent)}>
                              {parentEvent.event_type}
                            </span>
                          ) : (
                            <span className="text-slate-600">Root / Direct</span>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <span className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] font-bold border ${health.badgeClass}`}>
                            <span className={`w-1.5 h-1.5 rounded-full ${health.dotClass}`} />
                            <span>{health.label}</span>
                          </span>
                        </td>
                        <td className="py-3 px-3 text-right">
                          <button
                            onClick={() => onSelectEvent(task)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-sky-500 hover:text-white text-slate-300 transition-colors text-[11px]"
                          >
                            Inspect →
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Side-by-Side Trace Comparison & Regression Engine */}
      {activeTab === 'compare' && (
        <PipelineCompareView
          initialBaselineId={selectedCorrelationId}
          initialTargetId={workflows.find(w => w.correlation_id !== selectedCorrelationId)?.correlation_id || selectedCorrelationId}
          onSelectEvent={onSelectEvent}
        />
      )}
    </div>
  );
};

