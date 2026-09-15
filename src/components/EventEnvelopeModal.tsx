import React, { useState } from 'react';
import { 
  X, 
  Copy, 
  Check, 
  GitFork, 
  ArrowUpRight, 
  ArrowDownRight, 
  CornerDownRight, 
  Clock, 
  User, 
  Bot, 
  Server, 
  Box, 
  ExternalLink,
  Workflow,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2
} from 'lucide-react';
import { EventEnvelope } from '../types';
import { useAppTheme } from '../context/ThemeContext';
import { cascadeStore } from '../services/cascadeService';
import { getStageColor, mapEventTypeToStage, getEventHealthInfo, getEventStatusBadge } from '../services/mockDataGenerator';

interface EventEnvelopeModalProps {
  event: EventEnvelope | null;
  onClose: () => void;
  onSelectEvent: (id: string) => void;
  onOpenLineage: (eventId: string) => void;
  onOpenPipeline: (correlationId: string) => void;
}

export const EventEnvelopeModal: React.FC<EventEnvelopeModalProps> = ({
  event,
  onClose,
  onSelectEvent,
  onOpenLineage,
  onOpenPipeline
}) => {
  const { themeClasses, isDark, isSteel } = useAppTheme();
  const [copied, setCopied] = useState(false);

  if (!event) return null;

  const stage = mapEventTypeToStage(event.event_type);
  const stageColor = getStageColor(stage);
  const health = getEventHealthInfo(event);
  const statusBadge = getEventStatusBadge(event);
  const childrenData = cascadeStore.getEventChildren(event.event_id);
  const parentEvent = event.causation_id ? cascadeStore.getEventById(event.causation_id) : null;

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(event, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const getActorIcon = (actorType: string) => {
    switch (actorType) {
      case 'user': return <User className="w-3.5 h-3.5 text-blue-400" />;
      case 'agent': return <Bot className="w-3.5 h-3.5 text-emerald-400" />;
      default: return <Server className="w-3.5 h-3.5 text-amber-400" />;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
      <div className={`w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl border ${themeClasses.border} ${themeClasses.bgCard} shadow-2xl overflow-hidden`}>
        {/* Modal Header */}
        <div className={`p-4 border-b ${themeClasses.border} flex items-center justify-between ${themeClasses.headerBg}`}>
          <div className="flex items-center space-x-3">
            <span className={`px-2.5 py-1 rounded-md text-xs font-mono font-semibold uppercase tracking-wider border ${stageColor.bg}`}>
              {stage}
            </span>
            <div className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-mono font-bold border ${statusBadge.badgeClass}`} title={`Status: ${statusBadge.status} (${statusBadge.reason})`}>
              <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${statusBadge.dotClass}`} />
              {statusBadge.status === 'Success' && <CheckCircle2 className="w-3.5 h-3.5 shrink-0 text-emerald-400" />}
              {statusBadge.status === 'Pending' && <Clock className="w-3.5 h-3.5 shrink-0 text-amber-400 animate-pulse" />}
              {statusBadge.status === 'Failure' && <AlertOctagon className="w-3.5 h-3.5 shrink-0 text-rose-400" />}
              {statusBadge.status === 'Warning' && <AlertTriangle className="w-3.5 h-3.5 shrink-0 text-yellow-400" />}
              <span>{statusBadge.label}</span>
            </div>
            <div className={`inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-semibold border ${health.badgeClass}`}>
              <span className={`w-2 h-2 rounded-full shrink-0 ${health.dotClass} ${health.glowClass} animate-pulse`} />
              <span>{health.label}</span>
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-bold font-mono text-slate-100">{event.event_type}</h3>
                <span className={`text-xs px-2 py-0.5 rounded font-mono ${themeClasses.bgMuted} ${themeClasses.textMuted}`}>
                  Seq #{event.sequence_number}
                </span>
              </div>
              <p className={`text-xs font-mono ${themeClasses.textMuted}`}>ID: {event.event_id}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => onOpenLineage(event.event_id)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-sky-500/20 hover:bg-sky-500/30 text-sky-300 border border-sky-500/30 text-xs font-medium transition-all"
              title="Visualize in Lineage DAG graph"
            >
              <GitFork className="w-3.5 h-3.5" />
              <span>Trace Lineage</span>
            </button>

            {event.correlation_id && (
              <button
                onClick={() => onOpenPipeline(event.correlation_id!)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 hover:bg-indigo-500/30 text-indigo-300 border border-indigo-500/30 text-xs font-medium transition-all"
                title="View full workflow swimlane"
              >
                <Workflow className="w-3.5 h-3.5" />
                <span>View Pipeline</span>
              </button>
            )}

            <button
              onClick={handleCopyJSON}
              className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg border ${themeClasses.border} ${themeClasses.bgMuted} ${themeClasses.textPrimary} hover:text-white text-xs font-medium transition-all`}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied' : 'Copy Envelope'}</span>
            </button>

            <button
              onClick={onClose}
              className={`p-1.5 rounded-lg hover:bg-slate-700/50 ${themeClasses.textMuted} hover:text-white transition-all`}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          {/* Metadata Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className={`p-3 rounded-lg border ${themeClasses.borderSubtle} ${themeClasses.bgMuted}`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${themeClasses.textMuted} mb-1 flex items-center space-x-1`}>
                <Clock className="w-3 h-3" />
                <span>Timestamp (UTC)</span>
              </div>
              <div className="text-xs font-mono text-slate-200 truncate" title={event.event_timestamp}>
                {new Date(event.event_timestamp).toLocaleString()}
              </div>
              <div className={`text-[10px] font-mono ${themeClasses.textMuted} truncate`}>
                rcvd: {event.received_at.slice(11, 23)}
              </div>
            </div>

            <div className={`p-3 rounded-lg border ${themeClasses.borderSubtle} ${themeClasses.bgMuted}`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${themeClasses.textMuted} mb-1`}>
                Producer Source
              </div>
              <div className="text-xs font-mono font-semibold text-sky-400 truncate" title={event.source}>
                {event.source}
              </div>
            </div>

            <div className={`p-3 rounded-lg border ${themeClasses.borderSubtle} ${themeClasses.bgMuted}`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${themeClasses.textMuted} mb-1 flex items-center space-x-1`}>
                <Box className="w-3 h-3" />
                <span>Aggregate Entity</span>
              </div>
              <div className="text-xs font-mono text-slate-200">
                {event.aggregate_type || '—'}
              </div>
              <div className={`text-[10px] font-mono ${themeClasses.textMuted} truncate`} title={event.aggregate_id || ''}>
                {event.aggregate_id ? `${event.aggregate_id.slice(0, 13)}...` : 'none'}
              </div>
            </div>

            <div className={`p-3 rounded-lg border ${themeClasses.borderSubtle} ${themeClasses.bgMuted}`}>
              <div className={`text-[10px] font-bold uppercase tracking-wider ${themeClasses.textMuted} mb-1 flex items-center space-x-1`}>
                {getActorIcon(event.actor_type)}
                <span>Actor</span>
              </div>
              <div className="text-xs font-mono text-slate-200 capitalize">
                {event.actor_type}
              </div>
              <div className={`text-[10px] font-mono ${themeClasses.textMuted} truncate`}>
                {event.actor_id || 'system'}
              </div>
            </div>
          </div>

          {/* Health Details Diagnostic Card */}
          <div className={`p-3 rounded-lg border ${health.badgeClass} flex items-center justify-between`}>
            <div className="flex items-center space-x-2.5">
              <span className={`w-2.5 h-2.5 rounded-full ${health.dotClass} ${health.glowClass} animate-pulse shrink-0`} />
              <div>
                <div className="text-xs font-mono font-bold uppercase tracking-wider flex items-center space-x-1.5">
                  <span>Processing Status: {health.label}</span>
                </div>
                <div className="text-xs text-slate-300 font-sans mt-0.5">
                  {health.reason || 'Event successfully ingested and validated in cascade ledger.'}
                </div>
              </div>
            </div>
            <div className="text-[10px] font-mono px-2 py-0.5 rounded bg-black/30 text-slate-400">
              LEDGER VERIFIED
            </div>
          </div>

          {/* Causation & Lineage Relationship Bar */}
          <div className={`p-4 rounded-xl border ${themeClasses.borderSubtle} ${themeClasses.codeBg} space-y-3`}>
            <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-300 flex items-center space-x-2">
              <GitFork className="w-4 h-4 text-sky-400" />
              <span>Causation & Workflow Correlation</span>
            </h4>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs font-mono">
              {/* Parent causation */}
              <div className="space-y-1">
                <div className={`text-[11px] ${themeClasses.textMuted} flex items-center space-x-1`}>
                  <ArrowUpRight className="w-3.5 h-3.5 text-amber-400" />
                  <span>Immediate Causation Parent (caused_by)</span>
                </div>
                {event.causation_id ? (
                  <button
                    onClick={() => onSelectEvent(event.causation_id!)}
                    className="w-full text-left p-2.5 rounded-lg bg-slate-800/60 hover:bg-slate-800 border border-slate-700/60 hover:border-amber-500/50 transition-all group"
                  >
                    <div className="flex items-center justify-between text-amber-300 font-semibold">
                      <span>{event.caused_by_event_type || 'parent_event'}</span>
                      <CornerDownRight className="w-3.5 h-3.5 opacity-60 group-hover:opacity-100" />
                    </div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">{event.causation_id}</div>
                  </button>
                ) : (
                  <div className={`p-2.5 rounded-lg border ${themeClasses.borderSubtle} ${themeClasses.bgMuted} ${themeClasses.textMuted}`}>
                    Root Event (No causation parent)
                  </div>
                )}
              </div>

              {/* Correlation ID */}
              <div className="space-y-1">
                <div className={`text-[11px] ${themeClasses.textMuted} flex items-center space-x-1`}>
                  <Workflow className="w-3.5 h-3.5 text-indigo-400" />
                  <span>Workflow Correlation ID</span>
                </div>
                {event.correlation_id ? (
                  <div className="p-2.5 rounded-lg bg-slate-800/60 border border-slate-700/60 flex items-center justify-between">
                    <span className="text-indigo-300 truncate">{event.correlation_id}</span>
                    <button
                      onClick={() => onOpenPipeline(event.correlation_id!)}
                      className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 hover:bg-indigo-500/30"
                    >
                      Filter Workflow
                    </button>
                  </div>
                ) : (
                  <div className={`p-2.5 rounded-lg border ${themeClasses.borderSubtle} ${themeClasses.bgMuted} ${themeClasses.textMuted}`}>
                    No correlation grouping
                  </div>
                )}
              </div>
            </div>

            {/* Triggered Children list */}
            {childrenData.children.length > 0 && (
              <div className="pt-2 border-t border-slate-800/80 space-y-2">
                <div className={`text-[11px] ${themeClasses.textMuted} flex items-center space-x-1`}>
                  <ArrowDownRight className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Triggered Children Events ({childrenData.children.length})</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  {childrenData.children.map(child => (
                    <button
                      key={child.event_id}
                      onClick={() => onSelectEvent(child.event_id)}
                      className="p-2 rounded-lg bg-slate-800/40 hover:bg-slate-800 border border-slate-700/40 hover:border-emerald-500/50 flex items-center justify-between text-left transition-all group"
                    >
                      <div>
                        <div className="text-xs font-mono font-semibold text-emerald-300">{child.event_type}</div>
                        <div className="text-[10px] font-mono text-slate-400">{child.source} · {child.event_timestamp.slice(11, 19)}</div>
                      </div>
                      <CornerDownRight className="w-3.5 h-3.5 text-slate-500 group-hover:text-emerald-400" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Formatted Payload Viewer */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold font-mono uppercase tracking-wider text-slate-300">
                Event Payload (`payload: jsonb`)
              </h4>
              <span className={`text-[11px] font-mono ${themeClasses.textMuted}`}>
                {Object.keys(event.payload).length} keys
              </span>
            </div>

            <div className={`p-4 rounded-xl border ${themeClasses.borderSubtle} ${themeClasses.codeBg} font-mono text-xs overflow-x-auto max-h-72 custom-scrollbar`}>
              <pre className="text-emerald-300/90 leading-relaxed">
                {JSON.stringify(event.payload, null, 2)}
              </pre>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className={`p-3 px-6 border-t ${themeClasses.border} ${themeClasses.headerBg} flex items-center justify-between text-xs font-mono ${themeClasses.textMuted}`}>
          <span>Canonical envelope conforming to cascade.events ledger</span>
          <button
            onClick={onClose}
            className={`px-4 py-1.5 rounded-lg border ${themeClasses.border} ${themeClasses.bgCard} ${themeClasses.textPrimary} hover:text-white transition-all`}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
