import React, { useState } from 'react';
import { 
  ShieldAlert, 
  AlertOctagon, 
  Flame, 
  Clock, 
  ArrowRight, 
  Layers, 
  Cpu, 
  Activity, 
  X, 
  Copy, 
  Check, 
  ExternalLink, 
  ChevronRight, 
  Sparkles, 
  RefreshCw, 
  Info, 
  Radio, 
  Zap, 
  CornerDownRight,
  ShieldCheck,
  FileText
} from 'lucide-react';
import { useAppTheme } from '../context/ThemeContext';
import { EventEnvelope } from '../types';
import { 
  BlastRadiusAnalysisResult, 
  BlastRadiusScenario, 
  DownstreamDependent 
} from '../services/dependencyAnalysisService';
import { getStageColor } from '../services/mockDataGenerator';

interface DependencyAnalysisOverlayProps {
  analysis: BlastRadiusAnalysisResult;
  selectedEvent: EventEnvelope | null;
  scenario: BlastRadiusScenario;
  onScenarioChange: (scenario: BlastRadiusScenario) => void;
  onClose: () => void;
  onFocusNodeInGraph: (eventId: string) => void;
  onOpenEnvelope: (event: EventEnvelope) => void;
}

export const DependencyAnalysisOverlay: React.FC<DependencyAnalysisOverlayProps> = ({
  analysis,
  selectedEvent,
  scenario,
  onScenarioChange,
  onClose,
  onFocusNodeInGraph,
  onOpenEnvelope
}) => {
  const { themeClasses, isDark } = useAppTheme();
  const [activeTab, setActiveTab] = useState<'dependents' | 'systems' | 'mitigation'>('dependents');
  const [copied, setCopied] = useState<boolean>(false);
  const [expandedDepth, setExpandedDepth] = useState<number | null>(null);

  const handleCopyReport = () => {
    const reportText = `CASCADE BLAST RADIUS ANALYSIS REPORT
Root Event: ${analysis.rootEventType} (${analysis.rootEventId})
Source: ${analysis.rootSource} | Stage: ${analysis.rootStage}
Simulation Scenario: ${analysis.scenario.toUpperCase()}

RISK ASSESSMENT:
- Risk Score: ${analysis.riskScore}/100 (${analysis.riskTier})
- Total Downstream Blast Radius: ${analysis.totalDownstreamEvents} events across ${analysis.maxPropagationDepth} causal hops
- Direct Dependents: ${analysis.directChildrenCount}
- Impacted Subsystems: ${analysis.affectedSystemsCount}
- Estimated MTTR / Recovery: ${analysis.estimatedRecoveryTimeMin} minutes
- Estimated Cumulative Delay: ${analysis.estimatedCumulativeDelayMs}ms

AFFECTED SYSTEMS:
${analysis.systemSummaries.map(s => `- ${s.system}: ${s.affectedCount} events (${s.criticality.toUpperCase()})`).join('\n')}

RECOMMENDED MITIGATIONS:
${analysis.mitigationRecommendations.map(m => `[${m.priority.toUpperCase()}] ${m.title} -> ${m.action}`).join('\n')}
`;

    navigator.clipboard.writeText(reportText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getRiskColor = (tier: BlastRadiusAnalysisResult['riskTier']) => {
    switch (tier) {
      case 'CRITICAL':
        return {
          badge: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          text: 'text-rose-400',
          bg: 'bg-rose-950/40',
          border: 'border-rose-500/50',
          glow: 'shadow-[0_0_16px_rgba(244,63,94,0.25)]'
        };
      case 'HIGH':
        return {
          badge: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          text: 'text-amber-400',
          bg: 'bg-amber-950/40',
          border: 'border-amber-500/50',
          glow: 'shadow-[0_0_16px_rgba(245,158,11,0.2)]'
        };
      case 'MODERATE':
        return {
          badge: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
          text: 'text-yellow-400',
          bg: 'bg-yellow-950/40',
          border: 'border-yellow-500/50',
          glow: 'shadow-[0_0_16px_rgba(234,179,8,0.15)]'
        };
      default:
        return {
          badge: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          text: 'text-emerald-400',
          bg: 'bg-emerald-950/40',
          border: 'border-emerald-500/50',
          glow: 'shadow-[0_0_16px_rgba(16,185,129,0.15)]'
        };
    }
  };

  const riskColors = getRiskColor(analysis.riskTier);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-in fade-in duration-200">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header Bar */}
        <div className="px-6 py-4 border-b border-slate-800 bg-slate-950/60 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className={`p-2 rounded-xl border ${riskColors.badge}`}>
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white font-mono tracking-tight">
                  Downstream Blast Radius & Dependency Analysis
                </h2>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase border ${riskColors.badge}`}>
                  {analysis.riskTier} RISK
                </span>
              </div>
              <p className="text-xs text-slate-400 font-mono mt-0.5 truncate max-w-xl">
                Causal simulation for <span className="text-sky-300 font-semibold">{analysis.rootEventType}</span> ({analysis.rootEventId.slice(0, 10)}...)
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleCopyReport}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-mono transition-all"
              title="Copy blast radius analysis report"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-slate-400" />}
              <span>{copied ? 'Copied' : 'Copy Report'}</span>
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Simulation Scenario Switcher */}
        <div className="px-6 py-3 border-b border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center space-x-2 text-xs font-mono">
            <span className="text-slate-400 flex items-center space-x-1">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Simulated Condition:</span>
            </span>
            <div className="flex items-center space-x-1 bg-slate-950 p-1 rounded-xl border border-slate-800">
              <button
                onClick={() => onScenarioChange('failure')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  scenario === 'failure'
                    ? 'bg-rose-500 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Hard Failure / Crash
              </button>
              <button
                onClick={() => onScenarioChange('delay_short')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  scenario === 'delay_short'
                    ? 'bg-amber-500 text-slate-950 font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Latency Lag (+2.5s)
              </button>
              <button
                onClick={() => onScenarioChange('delay_long')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  scenario === 'delay_long'
                    ? 'bg-orange-500 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Queue Starvation (+15s)
              </button>
              <button
                onClick={() => onScenarioChange('veto')}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  scenario === 'veto'
                    ? 'bg-purple-500 text-white font-semibold shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Assessment Veto
              </button>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-xs font-mono text-slate-400">
            <span>Transitive closure calculated via forward DAG tree</span>
          </div>
        </div>

        {/* Core KPI Metrics Grid */}
        <div className="p-6 grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-950/40 border-b border-slate-800">
          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60">
            <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block">
              Blast Radius (Events)
            </span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className={`text-2xl font-bold font-mono ${riskColors.text}`}>
                {analysis.totalDownstreamEvents}
              </span>
              <span className="text-[11px] font-mono text-slate-400">
                ({analysis.directChildrenCount} direct)
              </span>
            </div>
            <span className="text-[10px] font-mono text-slate-500 mt-0.5 block">
              Total transitive envelopes
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60">
            <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block">
              Cascade Risk Index
            </span>
            <div className="flex items-baseline space-x-2 mt-1">
              <span className={`text-2xl font-bold font-mono ${riskColors.text}`}>
                {analysis.riskScore}
              </span>
              <span className="text-[11px] font-mono text-slate-400">/ 100</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-1.5 mt-1.5 overflow-hidden">
              <div 
                className={`h-full rounded-full ${
                  analysis.riskScore > 75 ? 'bg-rose-500' : analysis.riskScore > 45 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${analysis.riskScore}%` }}
              />
            </div>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60">
            <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block">
              Propagation Depth
            </span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-2xl font-bold font-mono text-slate-100">
                {analysis.maxPropagationDepth}
              </span>
              <span className="text-xs font-mono text-slate-400">hops</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500 mt-0.5 block">
              {analysis.affectedSystemsCount} microservice domains
            </span>
          </div>

          <div className="p-3.5 rounded-xl border border-slate-800 bg-slate-900/60">
            <span className="text-[10px] font-mono uppercase text-slate-400 tracking-wider block">
              Estimated MTTR
            </span>
            <div className="flex items-baseline space-x-1.5 mt-1">
              <span className="text-2xl font-bold font-mono text-amber-400">
                ~{analysis.estimatedRecoveryTimeMin}
              </span>
              <span className="text-xs font-mono text-slate-400">min</span>
            </div>
            <span className="text-[10px] font-mono text-slate-500 mt-0.5 block">
              +{analysis.estimatedCumulativeDelayMs}ms pipeline lag
            </span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="px-6 border-b border-slate-800 flex items-center space-x-4 bg-slate-900">
          <button
            onClick={() => setActiveTab('dependents')}
            className={`py-3 text-xs font-mono font-semibold border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === 'dependents'
                ? 'border-sky-400 text-sky-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Downstream Dependents ({analysis.allDependents.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('systems')}
            className={`py-3 text-xs font-mono font-semibold border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === 'systems'
                ? 'border-sky-400 text-sky-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <Cpu className="w-3.5 h-3.5" />
            <span>Impacted Subsystems ({analysis.systemSummaries.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('mitigation')}
            className={`py-3 text-xs font-mono font-semibold border-b-2 transition-all flex items-center space-x-2 ${
              activeTab === 'mitigation'
                ? 'border-sky-400 text-sky-300'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            <span>Defense & Mitigations ({analysis.mitigationRecommendations.length})</span>
          </button>
        </div>

        {/* Tab Content Body */}
        <div className="p-6 overflow-y-auto flex-1 custom-scrollbar space-y-4">
          {activeTab === 'dependents' && (
            <div className="space-y-4">
              {analysis.allDependents.length === 0 ? (
                <div className="p-12 text-center text-slate-500 font-mono text-xs border border-dashed border-slate-800 rounded-xl">
                  <ShieldCheck className="w-8 h-8 text-emerald-400 mx-auto mb-2 opacity-80" />
                  <p className="text-slate-300 font-semibold">Zero Downstream Blast Radius</p>
                  <p className="text-slate-500 mt-1">This event is a terminal leaf node in the causal graph with no dependent children.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between text-xs font-mono text-slate-400">
                    <span>Transitive Causal Tree (Depth 1 to {analysis.maxPropagationDepth}):</span>
                    <span>Click any dependent to highlight in DAG</span>
                  </div>

                  {Object.entries(analysis.dependentsByDepth).map(([depthStr, rawDeps]) => {
                    const depthNum = Number(depthStr);
                    const deps = rawDeps as DownstreamDependent[];
                    return (
                      <div key={depthNum} className="space-y-2 border border-slate-800/80 rounded-xl p-3.5 bg-slate-950/30">
                        <div className="flex items-center justify-between">
                          <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-sky-400 flex items-center space-x-1.5">
                            <CornerDownRight className="w-3.5 h-3.5" />
                            <span>Depth +{depthNum} ({deps.length} {deps.length === 1 ? 'event' : 'events'})</span>
                          </span>
                          <span className="text-[10px] font-mono text-slate-500">
                            {depthNum === 1 ? 'Direct Descendants' : `Transitive (${depthNum} Causal Hops)`}
                          </span>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                          {deps.map((dep) => {
                            const stageColor = getStageColor(dep.stage);
                            return (
                              <div
                                key={dep.eventId}
                                onClick={() => onFocusNodeInGraph(dep.eventId)}
                                className="p-3 rounded-lg border border-slate-800 bg-slate-900/80 hover:border-sky-500/60 hover:bg-slate-850 cursor-pointer transition-all space-y-1.5 group"
                              >
                                <div className="flex items-center justify-between">
                                  <span className={`text-[9px] font-mono font-semibold px-2 py-0.5 rounded border ${stageColor.bg}`}>
                                    {dep.stage}
                                  </span>
                                  <span className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded uppercase ${
                                    dep.impactStatus === 'critical_failure' 
                                      ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                                      : dep.impactStatus === 'delayed'
                                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                                      : 'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30'
                                  }`}>
                                    {dep.impactStatus.replace('_', ' ')}
                                  </span>
                                </div>

                                <div className="text-xs font-mono font-bold text-slate-200 group-hover:text-sky-300 truncate">
                                  {dep.eventType}
                                </div>

                                <p className="text-[11px] font-mono text-slate-400 leading-snug">
                                  {dep.impactDescription}
                                </p>

                                <div className="pt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-500">
                                  <span>{dep.source}</span>
                                  <span className="text-sky-400 group-hover:underline flex items-center space-x-0.5">
                                    <span>Focus DAG</span>
                                    <ChevronRight className="w-3 h-3" />
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {activeTab === 'systems' && (
            <div className="space-y-3">
              <div className="text-xs font-mono text-slate-400">
                Microservice boundaries and agent frameworks affected by failure propagation:
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {analysis.systemSummaries.map((sys, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-xs font-bold font-mono text-slate-200">
                        {sys.system}
                      </h4>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                        sys.criticality === 'critical' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                        sys.criticality === 'high' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                        'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                      }`}>
                        {sys.criticality}
                      </span>
                    </div>

                    <div className="flex items-baseline space-x-2 text-xs font-mono">
                      <span className="text-slate-400">Affected Events:</span>
                      <span className="font-bold text-slate-100">{sys.affectedCount} envelopes</span>
                    </div>

                    {sys.roles.length > 0 && (
                      <div className="pt-2 border-t border-slate-800/80">
                        <span className="text-[10px] font-mono text-slate-500 block mb-1">Impacted Actors & Roles:</span>
                        <div className="flex flex-wrap gap-1">
                          {sys.roles.map((r, i) => (
                            <span key={i} className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
                              {r}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'mitigation' && (
            <div className="space-y-4">
              <div className="text-xs font-mono text-slate-400">
                Automated circuit breaker and mitigation policies to prevent cascade degradation:
              </div>

              <div className="space-y-3">
                {analysis.mitigationRecommendations.map((rec, idx) => (
                  <div key={idx} className="p-4 rounded-xl border border-slate-800 bg-slate-950/40 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded uppercase ${
                          rec.priority === 'urgent' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30' :
                          rec.priority === 'high' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' :
                          'bg-sky-500/20 text-sky-300 border border-sky-500/30'
                        }`}>
                          {rec.priority} PRIORITY
                        </span>
                        <h4 className="text-xs font-bold font-mono text-slate-200">
                          {rec.title}
                        </h4>
                      </div>
                      <span className="text-[10px] font-mono text-slate-500">
                        Target: {rec.targetComponent}
                      </span>
                    </div>

                    <p className="text-xs font-mono text-slate-300 leading-relaxed">
                      {rec.action}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer Bar */}
        <div className="px-6 py-3.5 border-t border-slate-800 bg-slate-950 flex items-center justify-between text-xs font-mono text-slate-400">
          <div className="flex items-center space-x-2">
            <Info className="w-3.5 h-3.5 text-sky-400" />
            <span>Impact estimate: {analysis.financialOrComputeImpactEstimate}</span>
          </div>

          <button
            onClick={() => {
              if (selectedEvent) {
                onOpenEnvelope(selectedEvent);
                onClose();
              }
            }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-medium text-xs transition-all"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>View Full Root Envelope</span>
          </button>
        </div>
      </div>
    </div>
  );
};
