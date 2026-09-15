import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Activity, 
  Clock, 
  ArrowRight, 
  ExternalLink, 
  Copy, 
  Check, 
  Workflow, 
  GitFork, 
  Layers, 
  Sparkles, 
  CheckCircle, 
  TrendingUp, 
  Radio, 
  X, 
  ChevronRight, 
  ChevronLeft,
  Maximize2, 
  Minimize2,
  Filter, 
  PlayCircle,
  Eye,
  FileCode,
  Shield,
  Bot,
  User,
  Server,
  Zap
} from 'lucide-react';
import { EventEnvelope, ActiveView, LifecycleStage } from '../types';
import { cascadeStore } from '../services/cascadeService';
import { getStageColor, mapEventTypeToStage } from '../services/mockDataGenerator';

interface RecentActivityDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectEvent: (event: EventEnvelope) => void;
  setActiveView: (view: ActiveView) => void;
  onSelectWorkflow: (correlationId: string) => void;
  onOpenSimulator?: () => void;
  startDate?: string | null;
  endDate?: string | null;
  dateRangeLabel?: string;
  onResetDateRange?: () => void;
}

export const RecentActivityDrawer: React.FC<RecentActivityDrawerProps> = ({
  isOpen,
  onClose,
  onSelectEvent,
  setActiveView,
  onSelectWorkflow,
  onOpenSimulator,
  startDate,
  endDate,
  dateRangeLabel,
  onResetDateRange
}) => {
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [stageFilter, setStageFilter] = useState<string>('all');
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());
  const [autoRefresh, setAutoRefresh] = useState<boolean>(true);

  // Subscribe to cascade store live updates
  useEffect(() => {
    const unsubscribe = cascadeStore.subscribe(() => {
      if (autoRefresh) {
        setLastUpdate(Date.now());
      }
    });
    return unsubscribe;
  }, [autoRefresh]);

  // Fetch last 10 chronologically sorted ingested events within date range
  const { recentEvents, totalCount, totalUnfiltered } = useMemo(() => {
    const res = cascadeStore.getEvents({ 
      limit: 100, 
      offset: 0,
      since: startDate || undefined,
      until: endDate || undefined
    });
    let events = res.events;

    if (stageFilter !== 'all') {
      events = events.filter(e => mapEventTypeToStage(e.event_type) === stageFilter);
    }

    return {
      recentEvents: events.slice(0, 10),
      totalCount: res.total,
      totalUnfiltered: cascadeStore.getEvents({ limit: 1, offset: 0 }).total
    };
  }, [stageFilter, lastUpdate, startDate, endDate]);

  const handleCopy = (e: React.MouseEvent, text: string, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const getActorIcon = (type: string) => {
    switch (type) {
      case 'agent':
        return <Bot className="w-3 h-3 text-purple-400" />;
      case 'user':
        return <User className="w-3 h-3 text-emerald-400" />;
      default:
        return <Server className="w-3 h-3 text-sky-400" />;
    }
  };

  const formatRelativeTime = (iso: string) => {
    try {
      const ms = Date.now() - new Date(iso).getTime();
      const secs = Math.floor(ms / 1000);
      if (secs < 5) return 'Just now';
      if (secs < 60) return `${secs}s ago`;
      const mins = Math.floor(secs / 60);
      if (mins < 60) return `${mins}m ago`;
      const hrs = Math.floor(mins / 60);
      if (hrs < 24) return `${hrs}h ago`;
      return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
    } catch {
      return iso;
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop on mobile / small screens */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden"
          />

          {/* Slide-out Drawer Panel */}
          <motion.aside
            id="recent-activity-drawer"
            initial={{ x: '100%', opacity: 0.5 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0.5 }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed top-0 right-0 h-full w-full sm:w-[440px] md:w-[480px] bg-slate-950/95 border-l border-slate-800 shadow-2xl backdrop-blur-xl z-50 flex flex-col font-sans"
          >
            {/* Drawer Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-900/60">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-bold text-slate-100 tracking-tight">Recent Activity Feed</h3>
                    <span className="flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 font-semibold">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                      LIVE
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    Last 10 ingested event envelopes with direct quick-links
                  </p>
                </div>
              </div>

              <button
                id="close-recent-activity-drawer-btn"
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white flex items-center justify-center transition-colors border border-slate-700"
                title="Close Recent Activity Feed"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Quick Filter & Streaming Status Bar */}
            <div className="px-4 py-2.5 bg-slate-900/40 border-b border-slate-800/80 flex items-center justify-between gap-2 text-xs font-mono">
              <div className="flex items-center gap-1.5 overflow-x-auto custom-scrollbar py-0.5">
                <Filter className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                {['all', 'harvest', 'candidate', 'requirement', 'planning', 'harness', 'deployment'].map(st => (
                  <button
                    key={st}
                    onClick={() => setStageFilter(st)}
                    className={`px-2 py-0.5 rounded-md text-[10px] font-semibold whitespace-nowrap transition-all uppercase ${
                      stageFilter === st
                        ? 'bg-blue-600 text-white font-bold shadow-sm'
                        : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
                    }`}
                  >
                    {st === 'all' ? 'All (10)' : st}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`p-1.5 rounded-md text-[10px] flex items-center gap-1 border transition-colors ${
                    autoRefresh 
                      ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                      : 'bg-slate-800 border-slate-700 text-slate-400'
                  }`}
                  title={autoRefresh ? 'Live Stream Active' : 'Live Stream Paused'}
                >
                  <Radio className={`w-3 h-3 ${autoRefresh ? 'animate-pulse' : ''}`} />
                </button>
              </div>
            </div>

            {/* Chronological List of Last 10 Ingested Events */}
            <div 
              id="recent-activity-events-feed"
              className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-2.5 custom-scrollbar"
            >
              {/* Active Date-Range Scope Banner */}
              {(startDate || endDate || (dateRangeLabel && dateRangeLabel !== 'All Time')) && (
                <div className="p-2.5 rounded-xl bg-blue-950/60 border border-blue-500/40 text-blue-300 flex items-center justify-between gap-2 text-xs font-mono mb-2 shadow-sm">
                  <div className="flex items-center gap-2 truncate">
                    <Clock className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                    <div className="truncate">
                      <span className="text-slate-400">Window: </span>
                      <span className="font-semibold text-white truncate">{dateRangeLabel || 'Custom Range'}</span>
                      <span className="text-blue-400 ml-1">({totalCount} / {totalUnfiltered} in ledger)</span>
                    </div>
                  </div>
                  {onResetDateRange && (
                    <button
                      onClick={onResetDateRange}
                      className="px-2 py-0.5 rounded text-[10px] text-blue-300 hover:text-white hover:bg-blue-600/30 border border-blue-500/30 flex-shrink-0"
                    >
                      Reset
                    </button>
                  )}
                </div>
              )}

              {recentEvents.length === 0 ? (
                <div className="p-8 text-center text-slate-500 space-y-3">
                  <Activity className="w-8 h-8 mx-auto text-slate-600 animate-pulse" />
                  <p className="text-xs">No events matching the active filter.</p>
                  {onOpenSimulator && (
                    <button
                      onClick={onOpenSimulator}
                      className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors"
                    >
                      <PlayCircle className="w-3.5 h-3.5" />
                      <span>Generate Simulated Events</span>
                    </button>
                  )}
                </div>
              ) : (
                recentEvents.map((evt, idx) => {
                  const stage = mapEventTypeToStage(evt.event_type);
                  const color = getStageColor(stage);
                  const shortEventId = evt.event_id.length > 14 
                    ? `${evt.event_id.slice(0, 8)}...${evt.event_id.slice(-4)}`
                    : evt.event_id;
                  
                  // Extract preview payload details
                  const title = evt.payload?.title || evt.payload?.name || evt.payload?.summary || evt.payload?.requirement_text || evt.payload?.commit_message || evt.payload?.action || evt.payload?.status || null;

                  return (
                    <div
                      key={evt.event_id}
                      onClick={() => onSelectEvent(evt)}
                      className="p-3 rounded-xl bg-slate-900/60 hover:bg-slate-900 border border-slate-800/80 hover:border-blue-500/50 transition-all cursor-pointer group space-y-2 relative shadow-sm hover:shadow-md"
                    >
                      {/* Top Row: Event Index, Type, Stage Badge, Time */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          {/* Chronological Index Marker */}
                          <span className="w-5 h-5 rounded-md bg-slate-800 text-slate-400 font-mono text-[10px] font-bold flex items-center justify-center flex-shrink-0 group-hover:bg-blue-500/20 group-hover:text-blue-300">
                            #{idx + 1}
                          </span>

                          {/* Event Type Name */}
                          <span className="text-xs font-mono font-bold text-slate-200 truncate group-hover:text-blue-400 transition-colors">
                            {evt.event_type}
                          </span>
                        </div>

                        {/* Relative Timestamp */}
                        <div className="flex items-center gap-1 text-[11px] font-mono text-slate-400 whitespace-nowrap flex-shrink-0">
                          <Clock className="w-3 h-3 text-slate-500" />
                          <span title={evt.event_timestamp}>
                            {formatRelativeTime(evt.event_timestamp)}
                          </span>
                        </div>
                      </div>

                      {/* Payload Excerpt Preview (if available) */}
                      {title && (
                        <p className="text-[11px] text-slate-400 line-clamp-1 italic bg-slate-950/50 px-2 py-1 rounded border border-slate-800/60 font-mono">
                          "{title}"
                        </p>
                      )}

                      {/* Metadata Row: Stage Pill, Sequence, Actor, Source */}
                      <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-mono">
                        {/* Stage Badge */}
                        <span className={`px-2 py-0.5 rounded-full font-bold uppercase ${color.bg} ${color.text} border ${color.border}`}>
                          {stage}
                        </span>

                        {/* Actor Badge */}
                        <span className="px-1.5 py-0.5 rounded bg-slate-800/80 text-slate-300 border border-slate-700/60 flex items-center gap-1">
                          {getActorIcon(evt.actor_type)}
                          <span>{evt.actor_type}</span>
                        </span>

                        {/* Sequence Number */}
                        <span className="px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-400 border border-slate-700/40">
                          seq:{evt.sequence_number}
                        </span>

                        {/* Source System */}
                        <span className="px-1.5 py-0.5 rounded bg-slate-800/60 text-slate-400 border border-slate-700/40 truncate max-w-[120px]">
                          {evt.source}
                        </span>
                      </div>

                      {/* Quick-Link Action Bar */}
                      <div className="pt-2 border-t border-slate-800/60 flex items-center justify-between gap-1 text-[10px] font-mono">
                        {/* Event ID with copy */}
                        <div className="flex items-center gap-1 text-slate-400">
                          <span className="text-slate-500">ID:</span>
                          <span className="text-slate-300 font-semibold">{shortEventId}</span>
                          <button
                            onClick={(e) => handleCopy(e, evt.event_id, `evt-${evt.event_id}`)}
                            className="p-1 hover:bg-slate-800 rounded text-slate-400 hover:text-white transition-colors"
                            title="Copy full Event ID"
                          >
                            {copiedId === `evt-${evt.event_id}` ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
                          {/* Trace Workflow Link */}
                          {evt.correlation_id && (
                            <button
                              onClick={() => onSelectWorkflow(evt.correlation_id!)}
                              className="px-2 py-1 rounded bg-blue-500/10 hover:bg-blue-500/20 text-blue-400 hover:text-blue-300 border border-blue-500/30 flex items-center gap-1 transition-colors"
                              title={`Trace Pipeline Workflow (${evt.correlation_id})`}
                            >
                              <Workflow className="w-3 h-3" />
                              <span className="hidden xs:inline">Trace</span>
                            </button>
                          )}

                          {/* Lineage Graph Link */}
                          <button
                            onClick={() => {
                              onSelectEvent(evt);
                              setActiveView('lineage');
                            }}
                            className="px-2 py-1 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-400 hover:text-purple-300 border border-purple-500/30 flex items-center gap-1 transition-colors"
                            title="Open Lineage Ancestry Graph"
                          >
                            <GitFork className="w-3 h-3" />
                            <span className="hidden xs:inline">Lineage</span>
                          </button>

                          {/* Inspect Envelope Modal */}
                          <button
                            onClick={() => onSelectEvent(evt)}
                            className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 flex items-center gap-1 transition-colors"
                            title="Inspect Canonical Event Envelope"
                          >
                            <Eye className="w-3 h-3 text-sky-400" />
                            <span>Envelope</span>
                          </button>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div className="p-3.5 sm:p-4 border-t border-slate-800 bg-slate-900/80 flex items-center justify-between gap-2">
              <div className="text-[11px] font-mono text-slate-400">
                Total ledger: <strong className="text-white font-bold">{totalCount.toLocaleString()}</strong> events
              </div>

              <div className="flex items-center gap-2">
                {onOpenSimulator && (
                  <button
                    onClick={onOpenSimulator}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-slate-300 flex items-center gap-1.5 transition-colors"
                    title="Launch Simulator to Inject Events"
                  >
                    <Zap className="w-3.5 h-3.5 text-amber-400" />
                    <span>Simulate</span>
                  </button>
                )}

                <button
                  onClick={() => setActiveView('ledger')}
                  className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-bold flex items-center gap-1.5 shadow-md shadow-blue-600/30 transition-all"
                  title="View complete Event Ledger view"
                >
                  <span>Open Full Ledger</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
