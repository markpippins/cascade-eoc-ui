import React, { useState, useEffect, useMemo } from 'react';
import {
  Layers,
  CheckSquare,
  Square,
  Play,
  Flag,
  AlertTriangle,
  RefreshCw,
  Download,
  Tag,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Filter,
  ArrowRight,
  Sparkles,
  Sliders,
  Terminal,
  ShieldAlert,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
  Eye,
  RotateCcw,
  Zap,
  Activity
} from 'lucide-react';
import { 
  EventEnvelope, 
  EventFilterState, 
  EventReviewFlag, 
  BatchSimulationJob, 
  BatchOperationAudit,
  LifecycleStage,
  SystemFamily,
  ActiveView
} from '../types';
import { cascadeStore } from '../services/cascadeService';
import { 
  getEventHealthInfo, 
  mapEventTypeToStage, 
  getStageColor,
  getSystemFamily,
  SYSTEM_FAMILIES_INFO,
  getNatsSubject
} from '../services/mockDataGenerator';
import { useAppTheme } from '../context/ThemeContext';

interface BatchOperationsViewProps {
  onSelectEvent: (event: EventEnvelope) => void;
  setActiveView: (view: ActiveView) => void;
  initialSelectedIds?: string[];
}

export const BatchOperationsView: React.FC<BatchOperationsViewProps> = ({
  onSelectEvent,
  setActiveView,
  initialSelectedIds = []
}) => {
  const { themeClasses, isDark, isLight, isSteel } = useAppTheme();

  // Active Tab
  const [activeTab, setActiveTab] = useState<'selector' | 'review_queue' | 'audit_log'>('selector');

  // Multi-Selection State
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set(initialSelectedIds));
  
  // Filters for selector
  const [filters, setFilters] = useState<EventFilterState>({
    limit: 100,
    offset: 0,
    health_status: 'all',
    system_family: 'all',
    flagged_status: 'all',
    search: ''
  });

  // Modal / Drawer States
  const [showResimModal, setShowResimModal] = useState<boolean>(false);
  const [showFlagModal, setShowFlagModal] = useState<boolean>(false);
  const [showTagModal, setShowTagModal] = useState<boolean>(false);
  const [showAssessModal, setShowAssessModal] = useState<boolean>(false);
  const [showExportModal, setShowExportModal] = useState<boolean>(false);
  const [showResolveModal, setShowResolveModal] = useState<boolean>(false);

  // Modal Form Inputs
  const [flagForm, setFlagForm] = useState<{
    reason: string;
    category: EventReviewFlag['category'];
    priority: EventReviewFlag['priority'];
    assigned_to: string;
    notes: string;
  }>({
    reason: 'Anomaly detected during pipeline execution',
    category: 'anomaly',
    priority: 'high',
    assigned_to: 'tackle_triage_team',
    notes: ''
  });

  const [resimOptions, setResimOptions] = useState<{
    replay_mode: BatchSimulationJob['options']['replay_mode'];
    speed_multiplier: number;
    delay_ms: number;
    preserve_causation: boolean;
    inject_faults: boolean;
  }>({
    replay_mode: 'mutate_timestamp',
    speed_multiplier: 2,
    delay_ms: 100,
    preserve_causation: true,
    inject_faults: false
  });

  const [tagInput, setTagInput] = useState<string>('quarantine, audit-2026');
  const [assessOutcome, setAssessOutcome] = useState<string>('PROMOTED');
  const [assessNotes, setAssessNotes] = useState<string>('');
  const [resolveNotes, setResolveNotes] = useState<string>('Audited and reconciled in Batch Workbench.');
  const [exportFormat, setExportFormat] = useState<'json' | 'ndjson' | 'csv'>('json');
  const [copiedExport, setCopiedExport] = useState<boolean>(false);

  // Active Job Runner State
  const [activeJob, setActiveJob] = useState<BatchSimulationJob | null>(null);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);

  // Store data query
  const [eventsData, setEventsData] = useState(() => cascadeStore.getEvents(filters));
  const [reviewFlags, setReviewFlags] = useState(() => cascadeStore.getReviewFlags());
  const [batchAudits, setBatchAudits] = useState(() => cascadeStore.getBatchAudits());

  // Refresh from store on changes
  useEffect(() => {
    const unsubscribe = cascadeStore.subscribe(() => {
      setEventsData(cascadeStore.getEvents(filters));
      setReviewFlags(cascadeStore.getReviewFlags());
      setBatchAudits(cascadeStore.getBatchAudits());
      const job = cascadeStore.getActiveBatchJob();
      if (job && job.status === 'running') {
        setActiveJob(job);
      }
    });
    return unsubscribe;
  }, [filters]);

  // Re-query events when filters change
  useEffect(() => {
    setEventsData(cascadeStore.getEvents(filters));
  }, [filters]);

  // Selection handlers
  const handleToggleSelect = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleSelectAllVisible = () => {
    const next = new Set(selectedIds);
    eventsData.events.forEach(e => next.add(e.event_id));
    setSelectedIds(next);
  };

  const handleSelectWarningsAndErrors = () => {
    const next = new Set(selectedIds);
    eventsData.events.forEach(e => {
      const h = getEventHealthInfo(e).status;
      if (h === 'warning' || h === 'failed') {
        next.add(e.event_id);
      }
    });
    setSelectedIds(next);
  };

  const handleSelectFlagged = () => {
    const next = new Set(selectedIds);
    reviewFlags.forEach(f => {
      if (f.status !== 'resolved' && f.status !== 'dismissed') {
        next.add(f.event_id);
      }
    });
    setSelectedIds(next);
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  const selectedEventsList = useMemo(() => {
    const all = cascadeStore.getEvents({ limit: 1000, offset: 0 }).events;
    return all.filter(e => selectedIds.has(e.event_id));
  }, [selectedIds, eventsData]);

  // Execute Re-Simulation
  const handleStartReSimulation = async () => {
    if (selectedIds.size === 0) return;
    setIsSimulating(true);
    setShowResimModal(true);

    try {
      const job = await cascadeStore.runBatchReSimulation(
        Array.from(selectedIds),
        resimOptions,
        (progressJob) => {
          setActiveJob({ ...progressJob });
        }
      );
      setActiveJob(job);
    } catch (err) {
      console.error('Batch simulation error', err);
    } finally {
      setIsSimulating(false);
    }
  };

  // Execute Flagging for Review
  const handleApplyFlag = () => {
    if (selectedIds.size === 0) return;
    cascadeStore.flagEventsForReview(Array.from(selectedIds), flagForm);
    setShowFlagModal(false);
    setReviewFlags(cascadeStore.getReviewFlags());
    setEventsData(cascadeStore.getEvents(filters));
  };

  // Execute Resolve Flags
  const handleApplyResolve = () => {
    if (selectedIds.size === 0) return;
    cascadeStore.resolveReviewFlags(Array.from(selectedIds), resolveNotes);
    setShowResolveModal(false);
    setReviewFlags(cascadeStore.getReviewFlags());
    setEventsData(cascadeStore.getEvents(filters));
  };

  // Execute Unflag
  const handleApplyUnflag = () => {
    if (selectedIds.size === 0) return;
    cascadeStore.unflagEvents(Array.from(selectedIds));
    setReviewFlags(cascadeStore.getReviewFlags());
    setEventsData(cascadeStore.getEvents(filters));
  };

  // Execute Bulk Tagging
  const handleApplyTags = () => {
    if (selectedIds.size === 0) return;
    const tags = tagInput.split(',').map(t => t.trim()).filter(Boolean);
    cascadeStore.batchTagEvents(Array.from(selectedIds), tags, 'add');
    setShowTagModal(false);
    setEventsData(cascadeStore.getEvents(filters));
  };

  // Execute Bulk Assessment
  const handleApplyAssessment = () => {
    if (selectedIds.size === 0) return;
    cascadeStore.batchAssessCandidates(Array.from(selectedIds), assessOutcome, assessNotes);
    setShowAssessModal(false);
    setEventsData(cascadeStore.getEvents(filters));
  };

  // Export Data Content
  const exportContent = useMemo(() => {
    if (exportFormat === 'json') {
      return JSON.stringify(selectedEventsList, null, 2);
    } else if (exportFormat === 'ndjson') {
      return selectedEventsList.map(e => JSON.stringify(e)).join('\n');
    } else {
      // CSV format
      const headers = ['sequence_number', 'event_id', 'event_type', 'source', 'event_timestamp', 'aggregate_type', 'aggregate_id', 'correlation_id', 'health'];
      const rows = selectedEventsList.map(e => [
        e.sequence_number,
        e.event_id,
        e.event_type,
        `"${e.source}"`,
        e.event_timestamp,
        e.aggregate_type || '',
        e.aggregate_id || '',
        e.correlation_id || '',
        getEventHealthInfo(e).status
      ].join(','));
      return [headers.join(','), ...rows].join('\n');
    }
  }, [selectedEventsList, exportFormat]);

  const handleCopyExport = () => {
    navigator.clipboard.writeText(exportContent);
    setCopiedExport(true);
    setTimeout(() => setCopiedExport(false), 2000);
  };

  const handleDownloadExport = () => {
    const blob = new Blob([exportContent], { type: exportFormat === 'json' ? 'application/json' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `cascade-batch-export-${Date.now()}.${exportFormat === 'json' ? 'json' : exportFormat === 'ndjson' ? 'ndjson' : 'csv'}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const pendingReviewCount = reviewFlags.filter(f => f.status === 'pending' || f.status === 'in_review').length;
  const resolvedReviewCount = reviewFlags.filter(f => f.status === 'resolved').length;

  return (
    <div className="p-8 space-y-6 max-w-7xl mx-auto custom-scrollbar relative pb-32">
      {/* Top Banner & KPI Strip */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-700/50 pb-5">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 shadow-md">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-slate-100 tracking-tight">Batch Operations & Review Workbench</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 uppercase">
                  Multi-Envelope Ops
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Bulk select ledger envelopes to trigger distributed re-simulation, flag anomalies for investigation, or audit review queues.
              </p>
            </div>
          </div>
        </div>

        {/* Quick Tabs */}
        <div className="flex items-center bg-slate-900/60 p-1 rounded-xl border border-slate-700/60 self-start md:self-auto">
          <button
            onClick={() => setActiveTab('selector')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
              activeTab === 'selector'
                ? 'bg-blue-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <CheckSquare className="w-3.5 h-3.5" />
            <span>Ledger Selector</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-blue-900/60 text-blue-200 border border-blue-400/30">
              {eventsData.total}
            </span>
          </button>

          <button
            onClick={() => setActiveTab('review_queue')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
              activeTab === 'review_queue'
                ? 'bg-blue-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Flag className="w-3.5 h-3.5 text-amber-400" />
            <span>Review Queue</span>
            {pendingReviewCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold animate-pulse">
                {pendingReviewCount}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('audit_log')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-2 ${
              activeTab === 'audit_log'
                ? 'bg-blue-600 text-white shadow-sm font-semibold'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Terminal className="w-3.5 h-3.5" />
            <span>Job Audits</span>
            <span className="px-1.5 py-0.2 rounded-full text-[10px] font-mono bg-slate-800 text-slate-400">
              {batchAudits.length}
            </span>
          </button>
        </div>
      </div>

      {/* KPI Stats Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/50 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 flex-shrink-0">
            <CheckSquare className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Selected Items</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold font-mono text-white">{selectedIds.size}</span>
              <span className="text-[10px] text-slate-400 font-mono">/ {eventsData.total}</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/50 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 flex-shrink-0">
            <Flag className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Pending Triage</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold font-mono text-amber-400">{pendingReviewCount}</span>
              <span className="text-[10px] text-slate-400 font-mono">flagged</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/50 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 flex-shrink-0">
            <CheckCircle2 className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Resolved Reviews</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold font-mono text-emerald-400">{resolvedReviewCount}</span>
              <span className="text-[10px] text-slate-400 font-mono">audited</span>
            </div>
          </div>
        </div>

        <div className="bg-slate-800/40 p-3.5 rounded-xl border border-slate-700/50 flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 flex-shrink-0">
            <Zap className="w-4 h-4" />
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">Batch Jobs Run</span>
            <div className="flex items-baseline gap-1.5">
              <span className="text-xl font-bold font-mono text-purple-300">{batchAudits.length}</span>
              <span className="text-[10px] text-slate-400 font-mono">operations</span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: LEDGER SELECTOR VIEW                                              */}
      {/* ========================================================================= */}
      {activeTab === 'selector' && (
        <div className="space-y-4">
          {/* Action & Filter Toolbar */}
          <div className="bg-[#1e293b]/40 rounded-2xl border border-slate-700/50 p-4 shadow-sm space-y-3">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
              {/* Search Bar */}
              <div className="relative flex-1 max-w-md">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search envelopes by ID, type, source, payload text..."
                  value={filters.search || ''}
                  onChange={(e) => setFilters(f => ({ ...f, search: e.target.value, offset: 0 }))}
                  className="w-full pl-9 pr-4 py-2 rounded-xl bg-slate-900/70 border border-slate-700 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition-colors"
                />
              </div>

              {/* Quick Select Buttons */}
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <button
                  onClick={handleSelectAllVisible}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors font-medium flex items-center gap-1.5"
                >
                  <CheckSquare className="w-3.5 h-3.5 text-blue-400" />
                  <span>Select Visible ({eventsData.events.length})</span>
                </button>

                <button
                  onClick={handleSelectWarningsAndErrors}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors font-medium flex items-center gap-1.5"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span>Select Warnings/Failures</span>
                </button>

                <button
                  onClick={handleSelectFlagged}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors font-medium flex items-center gap-1.5"
                >
                  <Flag className="w-3.5 h-3.5 text-rose-400" />
                  <span>Select Flagged</span>
                </button>

                {selectedIds.size > 0 && (
                  <button
                    onClick={handleClearSelection}
                    className="px-2.5 py-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 transition-colors font-medium flex items-center gap-1"
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>Clear ({selectedIds.size})</span>
                  </button>
                )}
              </div>
            </div>

            {/* Filter Dropdowns */}
            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-800 text-xs">
              <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Filter className="w-3 h-3 text-blue-400" />
                Filters:
              </span>

              {/* Health Status Filter */}
              <select
                value={filters.health_status || 'all'}
                onChange={(e) => setFilters(f => ({ ...f, health_status: e.target.value as any, offset: 0 }))}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="all">Health: All Envelopes</option>
                <option value="success">Health: Clean (Success)</option>
                <option value="warning">Health: Warning Status</option>
                <option value="failed">Health: Failed Execution</option>
              </select>

              {/* System Family Filter */}
              <select
                value={filters.system_family || 'all'}
                onChange={(e) => setFilters(f => ({ ...f, system_family: e.target.value as any, offset: 0 }))}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="all">System: All 13 Domains</option>
                {Object.values(SYSTEM_FAMILIES_INFO).map(fam => (
                  <option key={fam.id} value={fam.id}>
                    {fam.name} ({fam.domain})
                  </option>
                ))}
              </select>

              {/* Flagged Status Filter */}
              <select
                value={filters.flagged_status || 'all'}
                onChange={(e) => setFilters(f => ({ ...f, flagged_status: e.target.value as any, offset: 0 }))}
                className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
              >
                <option value="all">Review Status: All</option>
                <option value="flagged">Status: Flagged for Review</option>
                <option value="unflagged">Status: Unflagged</option>
                <option value="pending">Status: Pending Triage</option>
                <option value="resolved">Status: Resolved Reviews</option>
              </select>
            </div>
          </div>

          {/* Events Multi-Select Table */}
          <div className="bg-[#1e293b]/40 rounded-2xl border border-slate-700/50 overflow-hidden shadow-md">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-700 bg-slate-900/60 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    <th className="py-3 px-4 w-10 text-center">
                      <button
                        onClick={selectedIds.size === eventsData.events.length && eventsData.events.length > 0 ? handleClearSelection : handleSelectAllVisible}
                        className="text-slate-400 hover:text-white transition-colors"
                      >
                        {selectedIds.size > 0 && selectedIds.size === eventsData.events.length ? (
                          <CheckSquare className="w-4 h-4 text-blue-400" />
                        ) : selectedIds.size > 0 ? (
                          <div className="w-4 h-4 rounded border border-blue-400 bg-blue-500/20 flex items-center justify-center">
                            <div className="w-2 h-0.5 bg-blue-400" />
                          </div>
                        ) : (
                          <Square className="w-4 h-4" />
                        )}
                      </button>
                    </th>
                    <th className="py-3 px-3">Sequence</th>
                    <th className="py-3 px-3">Timestamp</th>
                    <th className="py-3 px-3">Event Type & Topic</th>
                    <th className="py-3 px-3">Source & Domain</th>
                    <th className="py-3 px-3">Payload Summary</th>
                    <th className="py-3 px-3">Review Flag</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60 text-xs font-mono">
                  {eventsData.events.map((evt) => {
                    const isSelected = selectedIds.has(evt.event_id);
                    const health = getEventHealthInfo(evt);
                    const stage = mapEventTypeToStage(evt.event_type);
                    const flag = evt.review_flag;

                    return (
                      <tr
                        key={evt.event_id}
                        onClick={() => handleToggleSelect(evt.event_id)}
                        className={`transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-900/20 border-l-4 border-l-blue-500 hover:bg-blue-900/30'
                            : 'hover:bg-slate-800/50'
                        }`}
                      >
                        {/* Checkbox */}
                        <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => handleToggleSelect(evt.event_id)}
                            className="text-slate-400 hover:text-white"
                          >
                            {isSelected ? (
                              <CheckSquare className="w-4 h-4 text-blue-400" />
                            ) : (
                              <Square className="w-4 h-4 text-slate-600 hover:text-slate-400" />
                            )}
                          </button>
                        </td>

                        {/* Sequence */}
                        <td className="py-3 px-3 text-slate-300 font-bold whitespace-nowrap">
                          #{evt.sequence_number}
                        </td>

                        {/* Timestamp */}
                        <td className="py-3 px-3 text-slate-400 whitespace-nowrap text-[11px]">
                          {new Date(evt.event_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </td>

                        {/* Event Type & Topic */}
                        <td className="py-3 px-3">
                          <div className="font-sans font-semibold text-slate-100 flex items-center gap-2">
                            <span className={`w-2 h-2 rounded-full ${health.dotClass}`} />
                            <span className="truncate max-w-[200px]">{evt.event_type}</span>
                          </div>
                          <div className="text-[10px] text-slate-500 font-mono truncate max-w-[220px]">
                            {evt.nats_subject || getNatsSubject(evt.event_type)}
                          </div>
                        </td>

                        {/* Source & Domain */}
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300 text-[10px]">
                            {evt.source}
                          </span>
                        </td>

                        {/* Payload Summary */}
                        <td className="py-3 px-3 font-sans text-slate-300 text-[11px] max-w-[240px] truncate">
                          {evt.payload?.title || evt.payload?.transcript_preview || evt.payload?.reason || JSON.stringify(evt.payload).slice(0, 50)}
                        </td>

                        {/* Review Flag */}
                        <td className="py-3 px-3 whitespace-nowrap">
                          {flag ? (
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border flex items-center gap-1 w-max ${
                              flag.status === 'resolved'
                                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                                : flag.priority === 'urgent'
                                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 animate-pulse'
                                  : 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                            }`}>
                              <Flag className="w-3 h-3" />
                              <span>{flag.status.toUpperCase()}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-600 font-mono">—</span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-3 text-right" onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => onSelectEvent(evt)}
                            className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition-colors"
                            title="Inspect Envelope"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {eventsData.events.length === 0 && (
              <div className="p-12 text-center text-slate-400 space-y-2">
                <AlertTriangle className="w-8 h-8 mx-auto text-slate-500" />
                <p className="text-sm font-semibold text-slate-300">No ledger envelopes matching current filters</p>
                <p className="text-xs text-slate-500">Try adjusting your search terms or clearing health/system filters.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: FLAGGED REVIEW QUEUE                                               */}
      {/* ========================================================================= */}
      {activeTab === 'review_queue' && (
        <div className="space-y-4">
          <div className="flex justify-between items-center bg-[#1e293b]/40 rounded-2xl border border-slate-700/50 p-4">
            <div>
              <h3 className="font-semibold text-slate-200 flex items-center gap-2">
                <Flag className="w-4 h-4 text-amber-400" />
                <span>Audit & Review Triage Queue</span>
              </h3>
              <p className="text-xs text-slate-400">
                Envelopes marked for manual verification, latency spike diagnosis, or replay test validation.
              </p>
            </div>

            {reviewFlags.length > 0 && (
              <button
                onClick={() => {
                  setSelectedIds(new Set(reviewFlags.map(f => f.event_id)));
                  setShowResolveModal(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Resolve All Flagged</span>
              </button>
            )}
          </div>

          <div className="space-y-3">
            {reviewFlags.map((flag) => {
              const evt = cascadeStore.getEventById(flag.event_id);
              const isSelected = selectedIds.has(flag.event_id);

              return (
                <div
                  key={flag.event_id}
                  className={`p-4 rounded-2xl border transition-all ${
                    flag.status === 'resolved'
                      ? 'bg-slate-900/40 border-slate-800 opacity-75'
                      : flag.priority === 'urgent'
                        ? 'bg-rose-950/20 border-rose-500/40 shadow-sm'
                        : 'bg-slate-800/40 border-slate-700/60 hover:border-slate-600'
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-3">
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => handleToggleSelect(flag.event_id)}
                        className="text-slate-400 hover:text-white"
                      >
                        {isSelected ? (
                          <CheckSquare className="w-4 h-4 text-blue-400" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-600" />
                        )}
                      </button>

                      <span className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase font-bold border ${
                        flag.priority === 'urgent' 
                          ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' 
                          : flag.priority === 'high'
                            ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                            : 'bg-blue-500/20 text-blue-300 border-blue-500/40'
                      }`}>
                        {flag.priority} PRIORITY
                      </span>

                      <span className="text-xs font-semibold text-slate-200">
                        {flag.reason}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-slate-400">
                        Assigned: <span className="text-slate-200 font-semibold">{flag.assigned_to || 'triage'}</span>
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {new Date(flag.flagged_at).toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {evt && (
                    <div className="pt-3 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 font-mono">
                          <span className="text-slate-500">Envelope:</span>
                          <span className="text-blue-400 font-bold">{evt.event_type}</span>
                          <span className="text-slate-500">· Seq #{evt.sequence_number} · Source: {evt.source}</span>
                        </div>
                        {flag.notes && (
                          <p className="text-[11px] text-slate-400 italic">"{flag.notes}"</p>
                        )}
                        {flag.resolution_notes && (
                          <p className="text-[11px] text-emerald-400">Resolution: {flag.resolution_notes}</p>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => {
                            setSelectedIds(new Set([flag.event_id]));
                            setShowResimModal(true);
                          }}
                          className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-blue-400 text-xs font-medium border border-slate-700 flex items-center gap-1"
                        >
                          <RotateCcw className="w-3 h-3" />
                          <span>Re-simulate</span>
                        </button>

                        {flag.status !== 'resolved' ? (
                          <button
                            onClick={() => {
                              setSelectedIds(new Set([flag.event_id]));
                              setShowResolveModal(true);
                            }}
                            className="px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-medium border border-emerald-500/30 flex items-center gap-1"
                          >
                            <Check className="w-3 h-3" />
                            <span>Resolve</span>
                          </button>
                        ) : (
                          <span className="text-[10px] text-emerald-400 font-mono font-semibold flex items-center gap-1">
                            <CheckCircle2 className="w-3.5 h-3.5" /> RESOLVED
                          </span>
                        )}

                        <button
                          onClick={() => onSelectEvent(evt)}
                          className="p-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300"
                        >
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}

            {reviewFlags.length === 0 && (
              <div className="p-12 text-center text-slate-400 space-y-2 bg-[#1e293b]/20 rounded-2xl border border-slate-800">
                <CheckCircle2 className="w-10 h-10 mx-auto text-emerald-400" />
                <p className="text-sm font-semibold text-slate-200">Review Queue is Pristine</p>
                <p className="text-xs text-slate-500">No envelopes currently flagged for manual triage.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: BATCH AUDIT & JOB LOGS                                             */}
      {/* ========================================================================= */}
      {activeTab === 'audit_log' && (
        <div className="space-y-4">
          <div className="bg-[#1e293b]/40 rounded-2xl border border-slate-700/50 p-4">
            <h3 className="font-semibold text-slate-200 flex items-center gap-2">
              <Terminal className="w-4 h-4 text-blue-400" />
              <span>Immutable Batch Job Audit Ledger</span>
            </h3>
            <p className="text-xs text-slate-400">
              Audit trails of all batch re-simulations, bulk review tagging, and multi-envelope mutations.
            </p>
          </div>

          <div className="space-y-3">
            {batchAudits.map((audit) => (
              <div
                key={audit.id}
                className="p-4 rounded-xl border border-slate-800 bg-slate-900/50 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 font-mono">
                    <span className="px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30 uppercase">
                      {audit.action.replace('_', ' ')}
                    </span>
                    <span className="text-white font-semibold">{audit.target_count} Envelopes Targeted</span>
                    <span className="text-slate-500">by {audit.performed_by}</span>
                  </div>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {new Date(audit.timestamp).toLocaleString()}
                  </span>
                </div>

                <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800/80 font-mono text-[11px] text-slate-300 overflow-x-auto">
                  <span className="text-slate-500 font-semibold block mb-1">Execution Details:</span>
                  <pre className="text-xs text-slate-300 leading-relaxed">{JSON.stringify(audit.details, null, 2)}</pre>
                </div>
              </div>
            ))}

            {batchAudits.length === 0 && (
              <div className="p-12 text-center text-slate-400 bg-slate-900/30 rounded-xl border border-slate-800">
                <p className="text-xs font-mono">No batch operations recorded in this session yet.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* FLOATING ACTION BAR (When 1 or more items selected)                       */}
      {/* ========================================================================= */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-40 bg-slate-900/95 border border-blue-500/40 rounded-2xl p-3 shadow-2xl backdrop-blur-xl flex flex-wrap items-center gap-3 max-w-4xl w-[92%] animate-in fade-in slide-in-from-bottom-5 duration-200">
          <div className="flex items-center gap-2 pl-2 pr-3 border-r border-slate-700">
            <span className="w-2.5 h-2.5 rounded-full bg-blue-400 animate-pulse" />
            <span className="text-xs font-mono font-bold text-white whitespace-nowrap">
              {selectedIds.size} <span className="text-slate-400 font-normal">Selected</span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Re-simulate Button */}
            <button
              onClick={() => setShowResimModal(true)}
              className="px-3 py-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Re-Simulate</span>
            </button>

            {/* Flag for Review Button */}
            <button
              onClick={() => setShowFlagModal(true)}
              className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md transition-all active:scale-95"
            >
              <Flag className="w-3.5 h-3.5" />
              <span>Flag for Review</span>
            </button>

            {/* Bulk Tag Button */}
            <button
              onClick={() => setShowTagModal(true)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <Tag className="w-3.5 h-3.5 text-purple-400" />
              <span>Tag</span>
            </button>

            {/* Bulk Assess Button */}
            <button
              onClick={() => setShowAssessModal(true)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              <span>Assess</span>
            </button>

            {/* Export Button */}
            <button
              onClick={() => setShowExportModal(true)}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-cyan-400" />
              <span>Export</span>
            </button>
          </div>

          <div className="ml-auto pl-2 border-l border-slate-700">
            <button
              onClick={handleClearSelection}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
              title="Clear selection"
            >
              <XCircle className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 1: RE-SIMULATION RUNNER & CONFIG                                    */}
      {/* ========================================================================= */}
      {showResimModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            {/* Header */}
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400">
                  <RotateCcw className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Batch Event Re-Simulation Engine</h3>
                  <p className="text-[11px] text-slate-400">Targeting {selectedIds.size} selected envelopes</p>
                </div>
              </div>
              <button
                onClick={() => setShowResimModal(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-5 overflow-y-auto custom-scrollbar text-xs">
              {/* Re-simulation Options */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Replay Timestamp Mode</label>
                  <select
                    value={resimOptions.replay_mode}
                    onChange={(e) => setResimOptions(o => ({ ...o, replay_mode: e.target.value as any }))}
                    disabled={isSimulating}
                    className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                  >
                    <option value="mutate_timestamp">Fresh Timestamps (Continuous Sequence)</option>
                    <option value="replay_identical">Exact Original Timestamps (Backfill Audit)</option>
                  </select>
                </div>

                <div>
                  <label className="text-slate-300 font-semibold block mb-1">Speed Multiplier</label>
                  <div className="flex items-center gap-2">
                    {[1, 2, 5, 10].map(s => (
                      <button
                        key={s}
                        onClick={() => setResimOptions(o => ({ ...o, speed_multiplier: s }))}
                        disabled={isSimulating}
                        className={`flex-1 py-2 rounded-xl border text-xs font-mono font-bold transition-all ${
                          resimOptions.speed_multiplier === s
                            ? 'bg-blue-600 border-blue-500 text-white shadow-sm'
                            : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-white'
                        }`}
                      >
                        {s}x
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-200 font-medium block">Preserve Lineage & Causation</span>
                  <span className="text-[10px] text-slate-400">Link new simulated envelopes as children of original events</span>
                </div>
                <input
                  type="checkbox"
                  checked={resimOptions.preserve_causation}
                  onChange={(e) => setResimOptions(o => ({ ...o, preserve_causation: e.target.checked }))}
                  disabled={isSimulating}
                  className="w-4 h-4 rounded text-blue-600"
                />
              </div>

              <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-xl border border-slate-800">
                <div>
                  <span className="text-slate-200 font-medium block">Fault Injection Testing</span>
                  <span className="text-[10px] text-slate-400">Inject intermittent status errors to test downstream retry & circuit breakers</span>
                </div>
                <input
                  type="checkbox"
                  checked={resimOptions.inject_faults}
                  onChange={(e) => setResimOptions(o => ({ ...o, inject_faults: e.target.checked }))}
                  disabled={isSimulating}
                  className="w-4 h-4 rounded text-rose-600"
                />
              </div>

              {/* Progress Runner & Live Terminal */}
              {activeJob && (
                <div className="space-y-2 pt-2 border-t border-slate-800">
                  <div className="flex justify-between items-center text-xs">
                    <span className="text-slate-300 font-semibold">
                      Status: {activeJob.status.toUpperCase()} ({activeJob.processed} / {activeJob.total})
                    </span>
                    <span className="text-cyan-400 font-mono font-bold">
                      {Math.round((activeJob.processed / (activeJob.total || 1)) * 100)}%
                    </span>
                  </div>

                  {/* Progress Bar */}
                  <div className="w-full h-2 rounded-full bg-slate-800 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-150"
                      style={{ width: `${(activeJob.processed / (activeJob.total || 1)) * 100}%` }}
                    />
                  </div>

                  {/* Live Logs Terminal */}
                  <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 font-mono text-[11px] max-h-40 overflow-y-auto custom-scrollbar space-y-1">
                    {activeJob.logs.map((l, idx) => (
                      <div
                        key={idx}
                        className={`leading-relaxed ${
                          l.level === 'error' ? 'text-rose-400 font-bold' :
                          l.level === 'warn' ? 'text-amber-400' :
                          l.level === 'success' ? 'text-emerald-400' : 'text-slate-400'
                        }`}
                      >
                        <span className="text-slate-600">[{new Date(l.timestamp).toLocaleTimeString()}]</span> {l.message}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex justify-between items-center">
              <button
                onClick={() => setShowResimModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Close
              </button>

              <button
                onClick={handleStartReSimulation}
                disabled={isSimulating}
                className="px-5 py-2 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white text-xs font-bold flex items-center gap-2 shadow-lg disabled:opacity-50"
              >
                {isSimulating ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Executing Batch Simulation...</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5" />
                    <span>Launch Re-Simulation ({selectedIds.size})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 2: FLAG FOR REVIEW                                                  */}
      {/* ========================================================================= */}
      {showFlagModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <div className="flex items-center gap-2">
                <Flag className="w-4 h-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">Flag {selectedIds.size} Envelopes for Review</h3>
              </div>
              <button onClick={() => setShowFlagModal(false)} className="text-slate-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Review Category</label>
                <select
                  value={flagForm.category}
                  onChange={(e) => setFlagForm(f => ({ ...f, category: e.target.value as any }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="anomaly">Anomaly Investigation</option>
                  <option value="latency_spike">Latency Spike (&gt;180ms)</option>
                  <option value="circuit_trip">Circuit Breaker Trip</option>
                  <option value="drift">Schema & Configuration Drift</option>
                  <option value="manual_audit">Operational QA Audit</option>
                  <option value="other">Other / Security Review</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Priority Level</label>
                <div className="grid grid-cols-4 gap-2">
                  {(['low', 'medium', 'high', 'urgent'] as EventReviewFlag['priority'][]).map(p => (
                    <button
                      key={p}
                      onClick={() => setFlagForm(f => ({ ...f, priority: p }))}
                      className={`py-1.5 rounded-lg border text-xs font-mono uppercase font-bold transition-all ${
                        flagForm.priority === p
                          ? p === 'urgent' ? 'bg-rose-600 border-rose-500 text-white' : 'bg-blue-600 border-blue-500 text-white'
                          : 'bg-slate-800 border-slate-700 text-slate-400'
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Reason / Diagnosis</label>
                <input
                  type="text"
                  value={flagForm.reason}
                  onChange={(e) => setFlagForm(f => ({ ...f, reason: e.target.value }))}
                  placeholder="e.g. Unreleased lease for terminal request"
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Assignee</label>
                <input
                  type="text"
                  value={flagForm.assigned_to}
                  onChange={(e) => setFlagForm(f => ({ ...f, assigned_to: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-blue-500 font-mono"
                />
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Operational Notes (Optional)</label>
                <textarea
                  value={flagForm.notes}
                  onChange={(e) => setFlagForm(f => ({ ...f, notes: e.target.value }))}
                  rows={2}
                  placeholder="Notes on context, downstream dependencies, or reproduction steps..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex justify-end gap-2">
              <button
                onClick={() => setShowFlagModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyFlag}
                className="px-5 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
              >
                <Flag className="w-3.5 h-3.5" />
                <span>Flag Envelopes</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 3: RESOLVE REVIEW FLAGS                                             */}
      {/* ========================================================================= */}
      {showResolveModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Resolve {selectedIds.size} Review Flags</h3>
              </div>
              <button onClick={() => setShowResolveModal(false)} className="text-slate-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-300 leading-relaxed">
                Marking flagged items as resolved verifies that anomalies have been reconciled and checked against downstream subscribers.
              </p>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Resolution Summary</label>
                <textarea
                  value={resolveNotes}
                  onChange={(e) => setResolveNotes(e.target.value)}
                  rows={3}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex justify-end gap-2">
              <button
                onClick={() => setShowResolveModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyResolve}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Resolve Flags</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 4: BATCH EXPORT                                                     */}
      {/* ========================================================================= */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <div className="flex items-center gap-2">
                <Download className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Export {selectedEventsList.length} Envelopes</h3>
              </div>
              <button onClick={() => setShowExportModal(false)} className="text-slate-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 overflow-y-auto custom-scrollbar text-xs">
              <div className="flex items-center gap-2">
                {(['json', 'ndjson', 'csv'] as const).map(fmt => (
                  <button
                    key={fmt}
                    onClick={() => setExportFormat(fmt)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-mono uppercase font-bold transition-all ${
                      exportFormat === fmt
                        ? 'bg-blue-600 border-blue-500 text-white'
                        : 'bg-slate-800 border-slate-700 text-slate-400'
                    }`}
                  >
                    {fmt}
                  </button>
                ))}
              </div>

              <div className="bg-slate-950 rounded-xl p-3 border border-slate-800 font-mono text-[11px] max-h-64 overflow-y-auto custom-scrollbar text-slate-300">
                <pre>{exportContent}</pre>
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex justify-between items-center">
              <button
                onClick={handleCopyExport}
                className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 flex items-center gap-1.5"
              >
                {copiedExport ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedExport ? 'Copied to Clipboard' : 'Copy Output'}</span>
              </button>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowExportModal(false)}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
                >
                  Close
                </button>
                <button
                  onClick={handleDownloadExport}
                  className="px-5 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center gap-1.5 shadow-md"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download File</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 5: BULK TAG MODAL                                                   */}
      {/* ========================================================================= */}
      {showTagModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-purple-400" />
                <h3 className="text-sm font-bold text-white">Apply Operational Tags</h3>
              </div>
              <button onClick={() => setShowTagModal(false)} className="text-slate-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <p className="text-slate-300">
                Attach comma-separated operational tags to the {selectedIds.size} selected envelopes.
              </p>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="quarantine, audit-2026, benchmark"
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-blue-500 font-mono"
              />
            </div>

            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex justify-end gap-2">
              <button
                onClick={() => setShowTagModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyTags}
                className="px-5 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md"
              >
                Apply Tags
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL 6: BULK ASSESS CANDIDATES                                           */}
      {/* ========================================================================= */}
      {showAssessModal && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="px-6 py-4 border-b border-slate-800 flex justify-between items-center bg-slate-950/50">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Batch Assess Candidates</h3>
              </div>
              <button onClick={() => setShowAssessModal(false)} className="text-slate-400 hover:text-white">
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 space-y-4 text-xs">
              <div>
                <label className="text-slate-300 font-semibold block mb-1">Assessment Resolution Outcome</label>
                <select
                  value={assessOutcome}
                  onChange={(e) => setAssessOutcome(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                >
                  <option value="PROMOTED">PROMOTED (Advance to Formal Requirement)</option>
                  <option value="DISMISSED">DISMISSED (Noise / Non-Actionable)</option>
                  <option value="RIPPLE_REQUESTED">RIPPLE REQUESTED (Downstream Evaluation)</option>
                </select>
              </div>

              <div>
                <label className="text-slate-300 font-semibold block mb-1">Assessment Notes</label>
                <textarea
                  value={assessNotes}
                  onChange={(e) => setAssessNotes(e.target.value)}
                  rows={2}
                  placeholder="Rationale for batch evaluation outcome..."
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-slate-200 text-xs focus:outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <div className="px-6 py-4 border-t border-slate-800 bg-slate-950/50 flex justify-end gap-2">
              <button
                onClick={() => setShowAssessModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold"
              >
                Cancel
              </button>
              <button
                onClick={handleApplyAssessment}
                className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md"
              >
                Record Batch Assessment
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
