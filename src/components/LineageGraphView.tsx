import React, { useState, useMemo, useRef } from 'react';
import { 
  GitFork, 
  ArrowRight, 
  ArrowLeft, 
  ZoomIn, 
  ZoomOut, 
  Maximize2, 
  RefreshCw, 
  Layers, 
  Clock, 
  Sparkles,
  ExternalLink,
  ChevronRight,
  Filter,
  Flame,
  AlertTriangle,
  Zap,
  Activity,
  ShieldAlert,
  Sliders,
  TrendingUp,
  Info,
  CheckCircle2,
  AlertOctagon,
  CornerDownRight,
  ShieldCheck,
  Cpu
} from 'lucide-react';
import { useAppTheme } from '../context/ThemeContext';
import { EventEnvelope, LineageGraphNode } from '../types';
import { cascadeStore } from '../services/cascadeService';
import { getStageColor, mapEventTypeToStage } from '../services/mockDataGenerator';
import { 
  computeLineageHeatmap, 
  HeatmapMetricMode, 
  NodeHeatmapData, 
  formatDurationLabel,
  HeatTier 
} from '../services/heatmapService';
import { 
  calculateBlastRadius, 
  BlastRadiusScenario, 
  BlastRadiusAnalysisResult 
} from '../services/dependencyAnalysisService';
import { DependencyAnalysisOverlay } from './DependencyAnalysisOverlay';
import { EmptyState } from './EmptyState';
import { Play, RotateCcw } from 'lucide-react';

interface LineageGraphViewProps {
  initialEventId?: string;
  onSelectEvent: (event: EventEnvelope) => void;
}

export const LineageGraphView: React.FC<LineageGraphViewProps> = ({
  initialEventId,
  onSelectEvent
}) => {
  const { themeClasses, isSteel, isDark } = useAppTheme();

  // Root / Anchor seed ID
  const allEvents = cascadeStore.getEvents({ limit: 200, offset: 0 }).events;
  const initialRoot = initialEventId || allEvents[0]?.event_id || '';

  const [seedId, setSeedId] = useState<string>(initialRoot);
  const [direction, setDirection] = useState<'forward' | 'backward'>('forward');
  const [maxDepth, setMaxDepth] = useState<number>(6);
  const [zoom, setZoom] = useState<number>(1);
  const [selectedNodeId, setSelectedNodeId] = useState<string>(initialRoot);

  // Heatmap State
  const [heatmapMode, setHeatmapMode] = useState<HeatmapMetricMode>('latency');
  const [filterHotspotsOnly, setFilterHotspotsOnly] = useState<boolean>(false);
  const [highlightHotPath, setHighlightHotPath] = useState<boolean>(true);
  const [selectedHeatTierFilter, setSelectedHeatTierFilter] = useState<HeatTier | 'all'>('all');

  // Dependency Analysis & Blast Radius State
  const [isBlastRadiusOverlayOpen, setIsBlastRadiusOverlayOpen] = useState<boolean>(false);
  const [isBlastRadiusHighlightMode, setIsBlastRadiusHighlightMode] = useState<boolean>(false);
  const [blastScenario, setBlastScenario] = useState<BlastRadiusScenario>('failure');

  // Compute graph data using the Cascade REST endpoint logic
  const graphData = useMemo(() => {
    return cascadeStore.getLineageGraph({
      root: direction === 'forward' ? seedId : undefined,
      anchor: direction === 'backward' ? seedId : undefined,
      maxDepth
    });
  }, [seedId, direction, maxDepth, cascadeStore]);

  // Compute Heatmap statistics and per-node metadata
  const { nodeHeatMap, summary } = useMemo(() => {
    return computeLineageHeatmap(
      graphData.nodes,
      graphData.edges,
      (id) => cascadeStore.getEventById(id),
      heatmapMode
    );
  }, [graphData.nodes, graphData.edges, heatmapMode, cascadeStore]);

  // Compute Blast Radius Analysis for the current focus node
  const activeFocusEventId = selectedNodeId || seedId;
  const blastRadiusAnalysis = useMemo<BlastRadiusAnalysisResult>(() => {
    return calculateBlastRadius(activeFocusEventId, blastScenario, allEvents);
  }, [activeFocusEventId, blastScenario, allEvents]);

  const selectedEvent = selectedNodeId ? cascadeStore.getEventById(selectedNodeId) : null;
  const selectedNodeHeat = selectedNodeId ? nodeHeatMap.get(selectedNodeId) : null;

  // Group nodes by depth levels for hierarchical DAG layout
  const depthColumns = useMemo(() => {
    const cols: Record<number, LineageGraphNode[]> = {};
    graphData.nodes.forEach(node => {
      const heat = nodeHeatMap.get(node.id);

      // Apply hotspot filters if enabled
      if (filterHotspotsOnly && heat && heat.normalizedIntensity < 0.35 && !heat.hasErrors) {
        return;
      }
      if (selectedHeatTierFilter !== 'all' && heat && heat.heatTier !== selectedHeatTierFilter) {
        return;
      }

      if (!cols[node.depth]) cols[node.depth] = [];
      cols[node.depth].push(node);
    });
    return cols;
  }, [graphData.nodes, nodeHeatMap, filterHotspotsOnly, selectedHeatTierFilter]);

  const depths = Object.keys(depthColumns).map(Number).sort((a, b) => a - b);

  if (allEvents.length === 0) {
    return (
      <div className="p-6 max-w-7xl mx-auto custom-scrollbar">
        <EmptyState
          type="lineage"
          title="No Causal Lineage Graph Available"
          description="The Cascade event ledger currently contains zero events. Lineage traversal requires event envelopes with correlation_id and causation_id causal pointers."
          hints={[
            {
              label: 'DAG Tree Traversal',
              detail: 'Cascade computes bidirectional DAG paths (forward downstream impact or backward causal origin) up to depth 12.',
              badge: 'Lineage REST'
            },
            {
              label: 'Blast Radius Analytics',
              detail: 'Simulates failure or delay cascade to compute affected downstream components and stages.',
              badge: 'Resilience'
            }
          ]}
        />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-4 max-w-7xl mx-auto h-[calc(100vh-5rem)] flex flex-col">
      {/* Control Bar */}
      <div className={`p-4 rounded-xl border ${themeClasses.border} ${themeClasses.bgCard} shadow-sm space-y-3`}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center space-x-3 gap-y-2">
            {/* Seed Selector */}
            <div className="flex items-center space-x-2">
              <span className={`text-xs font-mono font-bold uppercase tracking-wider ${themeClasses.textMuted}`}>
                Seed Event:
              </span>
              <select
                value={seedId}
                onChange={(e) => {
                  setSeedId(e.target.value);
                  setSelectedNodeId(e.target.value);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono border ${themeClasses.border} ${themeClasses.inputBg} ${themeClasses.textPrimary} max-w-xs truncate`}
              >
                {allEvents.map(e => (
                  <option key={e.event_id} value={e.event_id}>
                    {e.event_type} (Seq #{e.sequence_number})
                  </option>
                ))}
              </select>
            </div>

            {/* Direction toggle */}
            <div className={`p-1 rounded-lg border ${themeClasses.border} ${themeClasses.bgMuted} flex items-center space-x-1`}>
              <button
                onClick={() => setDirection('forward')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  direction === 'forward'
                    ? 'bg-sky-500 text-white font-semibold shadow-sm'
                    : `${themeClasses.textMuted} hover:text-white`
                }`}
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>Forward (Caused)</span>
              </button>
              <button
                onClick={() => setDirection('backward')}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                  direction === 'backward'
                    ? 'bg-sky-500 text-white font-semibold shadow-sm'
                    : `${themeClasses.textMuted} hover:text-white`
                }`}
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Backward (Causal Chain)</span>
              </button>
            </div>

            {/* Max Depth Selector */}
            <div className="flex items-center space-x-2">
              <span className={`text-xs font-mono ${themeClasses.textMuted}`}>Depth:</span>
              <div className="flex items-center space-x-1">
                {[2, 4, 6, 8, 10].map(d => (
                  <button
                    key={d}
                    onClick={() => setMaxDepth(d)}
                    className={`px-2 py-0.5 rounded text-xs font-mono ${
                      maxDepth === d
                        ? 'bg-sky-500/20 text-sky-300 font-bold border border-sky-500/40'
                        : `${themeClasses.bgMuted} ${themeClasses.textMuted} hover:text-slate-200`
                    }`}
                  >
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Action Cluster: Blast Radius Button & Zoom Controls */}
          <div className="flex items-center space-x-3">
            {/* Dependency & Blast Radius Analysis Button */}
            <button
              id="lineage-blast-radius-overlay-btn"
              onClick={() => setIsBlastRadiusOverlayOpen(true)}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-rose-500/40 bg-rose-950/30 hover:bg-rose-900/40 text-rose-300 text-xs font-mono font-semibold transition-all shadow-[0_0_12px_rgba(244,63,94,0.15)] group"
              title="Open Downstream Blast Radius & Dependency Impact Analysis"
            >
              <AlertOctagon className="w-3.5 h-3.5 text-rose-400 group-hover:rotate-12 transition-transform" />
              <span>Dependency Analysis</span>
              <span className="px-1.5 py-0.2 rounded text-[10px] bg-rose-500/20 text-rose-300 border border-rose-500/30 font-bold">
                {blastRadiusAnalysis.riskScore}/100
              </span>
            </button>

            {/* Zoom Controls */}
            <div className="flex items-center space-x-2">
              <button
                onClick={() => setZoom(prev => Math.min(1.5, prev + 0.1))}
                className={`p-1.5 rounded-lg border ${themeClasses.border} ${themeClasses.bgMuted} ${themeClasses.textSecondary} hover:text-white`}
                title="Zoom In"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <span className="text-xs font-mono text-slate-400 w-10 text-center">
                {Math.round(zoom * 100)}%
              </span>
              <button
                onClick={() => setZoom(prev => Math.max(0.6, prev - 0.1))}
                className={`p-1.5 rounded-lg border ${themeClasses.border} ${themeClasses.bgMuted} ${themeClasses.textSecondary} hover:text-white`}
                title="Zoom Out"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setZoom(1)}
                className={`p-1.5 rounded-lg border ${themeClasses.border} ${themeClasses.bgMuted} ${themeClasses.textSecondary} hover:text-white`}
                title="Reset Zoom"
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Heatmap Mode Selector & Diagnostic Filter Row */}
        <div className={`pt-2.5 border-t ${themeClasses.borderSubtle} flex flex-wrap items-center justify-between gap-3 text-xs`}>
          <div className="flex flex-wrap items-center space-x-2 gap-y-1.5">
            <span className="font-mono font-bold text-slate-300 flex items-center space-x-1.5 mr-1">
              <Flame className="w-4 h-4 text-orange-400" />
              <span>Heatmap Layer:</span>
            </span>

            <button
              onClick={() => setHeatmapMode('latency')}
              className={`px-3 py-1 rounded-lg font-mono font-semibold transition-all flex items-center space-x-1.5 ${
                heatmapMode === 'latency'
                  ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-md ring-1 ring-orange-400/60'
                  : `${themeClasses.bgMuted} ${themeClasses.textMuted} hover:text-slate-200 border ${themeClasses.borderSubtle}`
              }`}
            >
              <Clock className="w-3.5 h-3.5" />
              <span>High Latency (ms)</span>
            </button>

            <button
              onClick={() => setHeatmapMode('errors')}
              className={`px-3 py-1 rounded-lg font-mono font-semibold transition-all flex items-center space-x-1.5 ${
                heatmapMode === 'errors'
                  ? 'bg-gradient-to-r from-rose-500 to-red-600 text-white shadow-md ring-1 ring-rose-400/60'
                  : `${themeClasses.bgMuted} ${themeClasses.textMuted} hover:text-slate-200 border ${themeClasses.borderSubtle}`
              }`}
            >
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>Errors & Anomalies</span>
            </button>

            <button
              onClick={() => setHeatmapMode('composite')}
              className={`px-3 py-1 rounded-lg font-mono font-semibold transition-all flex items-center space-x-1.5 ${
                heatmapMode === 'composite'
                  ? 'bg-gradient-to-r from-purple-500 to-indigo-600 text-white shadow-md ring-1 ring-indigo-400/60'
                  : `${themeClasses.bgMuted} ${themeClasses.textMuted} hover:text-slate-200 border ${themeClasses.borderSubtle}`
              }`}
            >
              <Zap className="w-3.5 h-3.5" />
              <span>Composite Friction</span>
            </button>

            <button
              onClick={() => setHeatmapMode('off')}
              className={`px-2.5 py-1 rounded-lg font-mono text-xs transition-all ${
                heatmapMode === 'off'
                  ? 'bg-slate-700 text-slate-200 font-semibold'
                  : `${themeClasses.bgMuted} ${themeClasses.textMuted} hover:text-slate-200`
              }`}
            >
              Standard (Off)
            </button>
          </div>

          {/* Quick Heatmap & Blast Highlight Toggles */}
          <div className="flex items-center space-x-2">
            {/* Blast Radius Visual Canvas Mode Toggle */}
            <button
              onClick={() => setIsBlastRadiusHighlightMode(!isBlastRadiusHighlightMode)}
              className={`px-2.5 py-1 rounded-lg font-mono text-[11px] flex items-center space-x-1.5 border transition-all ${
                isBlastRadiusHighlightMode
                  ? 'bg-rose-500/20 text-rose-300 border-rose-500/50 font-bold shadow-[0_0_10px_rgba(244,63,94,0.2)]'
                  : `${themeClasses.bgMuted} text-slate-400 border-slate-700/60 hover:text-slate-200`
              }`}
              title="Highlight downstream blast radius directly on the DAG canvas"
            >
              <AlertOctagon className="w-3 h-3 text-rose-400" />
              <span>Blast Radius View</span>
              {isBlastRadiusHighlightMode && (
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              )}
            </button>

            {heatmapMode !== 'off' && (
              <>
                <button
                  onClick={() => setHighlightHotPath(!highlightHotPath)}
                  className={`px-2.5 py-1 rounded-lg font-mono text-[11px] flex items-center space-x-1 border transition-all ${
                    highlightHotPath
                      ? 'bg-orange-500/20 text-orange-300 border-orange-500/40 font-bold'
                      : `${themeClasses.bgMuted} text-slate-400 border-transparent`
                  }`}
                  title="Highlight the primary causal path with maximum latency/friction"
                >
                  <TrendingUp className="w-3 h-3 text-orange-400" />
                  <span>Hot Path</span>
                </button>

                <button
                  onClick={() => setFilterHotspotsOnly(!filterHotspotsOnly)}
                  className={`px-2.5 py-1 rounded-lg font-mono text-[11px] flex items-center space-x-1 border transition-all ${
                    filterHotspotsOnly
                      ? 'bg-rose-500/20 text-rose-300 border-rose-500/40 font-bold'
                      : `${themeClasses.bgMuted} text-slate-400 border-transparent`
                  }`}
                  title="Filter to isolate only nodes with high latency or errors"
                >
                  <Filter className="w-3 h-3 text-rose-400" />
                  <span>Hotspots</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Heatmap Metrics & Distribution Legend Bar */}
      {heatmapMode !== 'off' && (
        <div className={`p-3 px-4 rounded-xl border ${themeClasses.border} ${themeClasses.bgCard} shadow-sm flex flex-wrap items-center justify-between gap-3 text-xs font-mono`}>
          <div className="flex flex-wrap items-center space-x-4">
            <div className="flex items-center space-x-2">
              <span className="text-slate-400">Latency Range:</span>
              <span className="text-emerald-400 font-bold">{formatDurationLabel(summary.minLatencyMs)}</span>
              <span className="text-slate-600">→</span>
              <span className="text-sky-400">avg {formatDurationLabel(summary.avgLatencyMs)}</span>
              <span className="text-slate-600">→</span>
              <span className="text-rose-400 font-bold">{formatDurationLabel(summary.maxLatencyMs)}</span>
            </div>

            <div className="h-4 w-px bg-slate-700 hidden sm:block" />

            <div className="flex items-center space-x-2">
              <span className="text-slate-400">Total Errors:</span>
              <span className={`px-2 py-0.5 rounded font-bold ${summary.totalErrors > 0 ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' : 'bg-emerald-500/20 text-emerald-300'}`}>
                {summary.totalErrors}
              </span>
            </div>
          </div>

          {/* Interactive Heat Gradient Legend */}
          <div className="flex items-center space-x-2">
            <span className="text-[10px] text-slate-400 uppercase tracking-wider">Heat Gradient:</span>
            
            <button
              onClick={() => setSelectedHeatTierFilter(selectedHeatTierFilter === 'cold' ? 'all' : 'cold')}
              className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] border transition-all ${
                selectedHeatTierFilter === 'cold' ? 'ring-1 ring-emerald-400 font-bold' : ''
              } bg-emerald-950/40 border-emerald-500/30 text-emerald-300`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              <span>Cold ({summary.coldNodesCount})</span>
            </button>

            <button
              onClick={() => setSelectedHeatTierFilter(selectedHeatTierFilter === 'moderate' ? 'all' : 'moderate')}
              className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] border transition-all ${
                selectedHeatTierFilter === 'moderate' ? 'ring-1 ring-yellow-400 font-bold' : ''
              } bg-yellow-950/40 border-yellow-500/40 text-yellow-300`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
              <span>Moderate ({summary.moderateNodesCount})</span>
            </button>

            <button
              onClick={() => setSelectedHeatTierFilter(selectedHeatTierFilter === 'hot' ? 'all' : 'hot')}
              className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] border transition-all ${
                selectedHeatTierFilter === 'hot' ? 'ring-1 ring-amber-400 font-bold' : ''
              } bg-amber-950/60 border-amber-500/50 text-amber-300`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>Hot ({summary.hotNodesCount})</span>
            </button>

            <button
              onClick={() => setSelectedHeatTierFilter(selectedHeatTierFilter === 'critical' ? 'all' : 'critical')}
              className={`flex items-center space-x-1 px-2 py-0.5 rounded text-[10px] border transition-all ${
                selectedHeatTierFilter === 'critical' ? 'ring-1 ring-rose-400 font-bold' : ''
              } bg-rose-950/80 border-rose-500/60 text-rose-300 shadow-[0_0_8px_rgba(244,63,94,0.4)]`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400 animate-pulse" />
              <span>Critical ({summary.criticalNodesCount})</span>
            </button>
          </div>
        </div>
      )}

      {/* Main Canvas & Detail Sidebar */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 min-h-0">
        {/* Interactive Graph Canvas */}
        <div className={`lg:col-span-8 rounded-xl border ${themeClasses.border} ${themeClasses.codeBg} p-6 overflow-auto custom-scrollbar relative flex flex-col justify-between`}>
          <div 
            className="flex items-start space-x-12 min-w-max transition-transform duration-200 origin-top-left"
            style={{ transform: `scale(${zoom})` }}
          >
            {depths.length === 0 ? (
              <div className="p-8 text-slate-500 font-mono text-xs">
                No causal graph nodes match the active depth and heatmap filters.
              </div>
            ) : (
              depths.map(depth => {
                const nodesAtDepth = depthColumns[depth] || [];
                return (
                  <div key={depth} className="flex flex-col space-y-4 items-center">
                    {/* Depth Step Label */}
                    <div className={`px-2.5 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${themeClasses.border} ${themeClasses.bgCard} text-slate-400`}>
                      Depth {depth} {depth === 0 && '(Seed Root)'}
                    </div>

                    {/* Nodes in this column */}
                    <div className="space-y-4">
                      {nodesAtDepth.map(node => {
                        const stage = mapEventTypeToStage(node.type);
                        const stageColor = getStageColor(stage);
                        const isSelected = selectedNodeId === node.id;
                        const isSeed = node.id === seedId;
                        const isEpicenter = node.id === activeFocusEventId;
                        const heat = nodeHeatMap.get(node.id);
                        const isHotPath = highlightHotPath && summary.criticalHotPathNodeIds.includes(node.id);

                        // Blast Radius checks
                        const isDownstreamDependent = blastRadiusAnalysis.affectedNodeIds.has(node.id) && !isEpicenter;
                        const isDimmedByBlastRadius = isBlastRadiusHighlightMode && !isEpicenter && !isDownstreamDependent;
                        const dependentData = blastRadiusAnalysis.allDependents.find(d => d.eventId === node.id);

                        // Determine styling based on heatmap & blast radius modes
                        let borderStyle = stageColor.border;
                        let bgStyle = themeClasses.bgCard;
                        let glowStyle = '';

                        if (isBlastRadiusHighlightMode) {
                          if (isEpicenter) {
                            borderStyle = 'border-rose-500 ring-2 ring-rose-400/80';
                            bgStyle = 'bg-rose-950/70';
                            glowStyle = 'shadow-[0_0_20px_rgba(244,63,94,0.4)]';
                          } else if (isDownstreamDependent) {
                            borderStyle = 'border-amber-500/80';
                            bgStyle = 'bg-amber-950/40';
                            glowStyle = 'shadow-[0_0_12px_rgba(245,158,11,0.25)]';
                          }
                        } else if (heatmapMode !== 'off' && heat) {
                          borderStyle = heat.colors.border;
                          bgStyle = heat.colors.bg;
                          glowStyle = heat.colors.glow;
                        }

                        return (
                          <div
                            key={node.id}
                            onClick={() => setSelectedNodeId(node.id)}
                            className={`w-64 p-3.5 rounded-xl border-2 transition-all cursor-pointer shadow-lg relative overflow-hidden ${
                              isDimmedByBlastRadius ? 'opacity-25 hover:opacity-100' : 'opacity-100'
                            } ${
                              isSelected
                                ? 'border-sky-400 bg-sky-950/60 ring-2 ring-sky-500/40'
                                : `${borderStyle} ${bgStyle} ${glowStyle} hover:border-sky-400/80`
                            }`}
                          >
                            {/* Hot Path Indicator Banner */}
                            {isHotPath && (
                              <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500" />
                            )}

                            {/* Corner Badges */}
                            <div className="absolute -top-2 -right-2 flex items-center space-x-1">
                              {isBlastRadiusHighlightMode && isEpicenter && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-rose-500 text-white shadow flex items-center space-x-0.5 animate-pulse">
                                  <AlertOctagon className="w-2.5 h-2.5 inline" />
                                  <span>EPICENTER</span>
                                </span>
                              )}
                              {isBlastRadiusHighlightMode && isDownstreamDependent && dependentData && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500 text-black shadow">
                                  +{dependentData.depth} HOP
                                </span>
                              )}
                              {!isBlastRadiusHighlightMode && isSeed && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-amber-500 text-black shadow">
                                  SEED
                                </span>
                              )}
                              {!isBlastRadiusHighlightMode && isHotPath && (
                                <span className="px-1.5 py-0.2 rounded text-[9px] font-mono font-bold bg-orange-500 text-black shadow flex items-center space-x-0.5">
                                  <Flame className="w-2.5 h-2.5 inline" />
                                  <span>HOT PATH</span>
                                </span>
                              )}
                            </div>

                            {/* Header: Stage + Timestamp / Heat Metric */}
                            <div className="flex items-center justify-between mb-1.5">
                              <span className={`text-[10px] font-mono font-semibold px-2 py-0.5 rounded border ${stageColor.bg}`}>
                                {stage}
                              </span>

                              {isBlastRadiusHighlightMode && isDownstreamDependent && dependentData ? (
                                <div className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30 uppercase">
                                  {dependentData.impactStatus.replace('_', ' ')}
                                </div>
                              ) : heatmapMode !== 'off' && heat ? (
                                <div className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded ${heat.colors.badgeBg} ${heat.colors.badgeText} flex items-center space-x-1`}>
                                  {heat.heatTier === 'critical' && <Flame className="w-3 h-3 text-rose-400 animate-pulse" />}
                                  {heat.heatTier === 'hot' && <Flame className="w-3 h-3 text-amber-400" />}
                                  {heat.heatTier === 'moderate' && <Clock className="w-3 h-3 text-yellow-400" />}
                                  <span>{heat.label}</span>
                                </div>
                              ) : (
                                <span className="text-[10px] font-mono text-slate-400">
                                  {node.timestamp.slice(11, 19)}
                                </span>
                              )}
                            </div>

                            {/* Event Type Name */}
                            <div className="text-xs font-mono font-bold text-slate-100 truncate" title={node.type}>
                              {node.type}
                            </div>

                            {/* Source Actor */}
                            <div className="text-[11px] font-mono text-slate-400 truncate mt-1">
                              {node.source}
                            </div>

                            {/* Heatmap Intensity Progress Bar (when heatmap active and not in blast mode) */}
                            {!isBlastRadiusHighlightMode && heatmapMode !== 'off' && heat && (
                              <div className="mt-2.5 pt-1.5 border-t border-slate-800/80">
                                <div className="flex items-center justify-between text-[10px] font-mono mb-1">
                                  <span className="text-slate-400">
                                    {heatmapMode === 'latency' ? 'Duration / Lag' : heatmapMode === 'errors' ? 'Error Severity' : 'Friction Score'}
                                  </span>
                                  <span className={heat.colors.text}>
                                    {heat.secondaryLabel}
                                  </span>
                                </div>
                                <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                                  <div 
                                    className="h-full rounded-full transition-all"
                                    style={{ 
                                      width: `${Math.max(6, Math.round(heat.normalizedIntensity * 100))}%`,
                                      backgroundColor: heat.colors.hex
                                    }}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Footer */}
                            <div className="mt-2 pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-500">
                              <span>ID: {node.id.slice(0, 8)}...</span>
                              <span className="text-sky-400 group-hover:text-sky-300">Inspect →</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Graph Legend / Edge Counter */}
          <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-xs font-mono text-slate-400">
            <div className="flex items-center space-x-3">
              <span>Nodes: <strong className="text-slate-200">{graphData.nodes.length}</strong></span>
              <span>Causal Edges: <strong className="text-slate-200">{graphData.edges.length}</strong></span>
              <span>Direction: <strong className="text-sky-400">{direction.toUpperCase()}</strong></span>
              {isBlastRadiusHighlightMode ? (
                <span>Blast Radius: <strong className="text-rose-400">{blastRadiusAnalysis.totalDownstreamEvents} Downstream</strong></span>
              ) : heatmapMode !== 'off' && (
                <span>Heatmap: <strong className="text-amber-400 uppercase">{heatmapMode}</strong></span>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-[11px] text-slate-500">Click any node to inspect heat diagnostics and blast radius</span>
            </div>
          </div>
        </div>

        {/* Selected Node Inspector Sidebar */}
        <div className={`lg:col-span-4 rounded-xl border ${themeClasses.border} ${themeClasses.bgCard} p-5 flex flex-col justify-between overflow-y-auto custom-scrollbar space-y-4`}>
          {selectedEvent ? (
            <div className="space-y-4">
              <div className="border-b pb-3 border-slate-800/80">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wider text-slate-400">
                    Selected Node Inspector
                  </span>
                  <button
                    onClick={() => {
                      setSeedId(selectedEvent.event_id);
                    }}
                    className="text-[10px] font-mono px-2 py-0.5 rounded bg-sky-500/20 text-sky-300 hover:bg-sky-500/30"
                  >
                    Set as Seed Root
                  </button>
                </div>
                <h3 className="text-sm font-bold font-mono text-slate-100 mt-1">
                  {selectedEvent.event_type}
                </h3>
                <p className="text-[11px] font-mono text-slate-400">{selectedEvent.source}</p>
              </div>

              {/* Dedicated Blast Radius Analysis Quick Card */}
              <div className="p-4 rounded-xl border border-rose-500/40 bg-rose-950/30 space-y-3 shadow-sm">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono font-bold text-rose-300 flex items-center space-x-1.5">
                    <AlertOctagon className="w-4 h-4 text-rose-400" />
                    <span>Downstream Blast Radius</span>
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${
                    blastRadiusAnalysis.riskTier === 'CRITICAL' ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' :
                    blastRadiusAnalysis.riskTier === 'HIGH' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' :
                    'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  }`}>
                    {blastRadiusAnalysis.riskTier} RISK ({blastRadiusAnalysis.riskScore}/100)
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                  <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Downstream Dependents:</span>
                    <span className="font-bold text-slate-100 text-sm">
                      {blastRadiusAnalysis.totalDownstreamEvents} events ({blastRadiusAnalysis.maxPropagationDepth} hops)
                    </span>
                  </div>

                  <div className="p-2 rounded bg-slate-900/80 border border-slate-800">
                    <span className="text-[10px] text-slate-400 block">Impacted Subsystems:</span>
                    <span className="font-bold text-slate-100 text-sm">
                      {blastRadiusAnalysis.affectedSystemsCount} systems
                    </span>
                  </div>
                </div>

                <p className="text-[11px] font-mono text-slate-300 leading-snug">
                  If this event fails or encounters delay, <strong className="text-rose-300">{blastRadiusAnalysis.totalDownstreamEvents} downstream actions</strong> across {blastRadiusAnalysis.maxPropagationDepth} depth stages will be affected.
                </p>

                <button
                  id="launch-deep-blast-radius-btn"
                  onClick={() => setIsBlastRadiusOverlayOpen(true)}
                  className="w-full py-2 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 text-rose-200 border border-rose-500/40 font-mono font-semibold text-xs transition-all flex items-center justify-center space-x-1.5"
                >
                  <AlertOctagon className="w-3.5 h-3.5 text-rose-400" />
                  <span>Launch Deep Blast Radius Analysis</span>
                </button>
              </div>

              {/* Dedicated Heatmap Diagnostics Panel */}
              {selectedNodeHeat && heatmapMode !== 'off' && !isBlastRadiusHighlightMode && (
                <div className={`p-3.5 rounded-xl border ${selectedNodeHeat.colors.border} ${selectedNodeHeat.colors.bg} space-y-2.5`}>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-mono font-bold text-slate-200 flex items-center space-x-1.5">
                      <Flame className="w-4 h-4 text-orange-400" />
                      <span>Heatmap Diagnostics</span>
                    </span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase ${selectedNodeHeat.colors.badgeBg} ${selectedNodeHeat.colors.badgeText}`}>
                      {selectedNodeHeat.heatTier} Tier
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs font-mono">
                    <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Processing Latency:</span>
                      <span className="font-bold text-slate-100 text-sm">
                        {formatDurationLabel(selectedNodeHeat.rawLatencyMs)}
                      </span>
                    </div>

                    <div className="p-2 rounded bg-slate-900/60 border border-slate-800">
                      <span className="text-[10px] text-slate-400 block">Error / Fault Count:</span>
                      <span className={`font-bold text-sm ${selectedNodeHeat.errorCount > 0 ? 'text-rose-400' : 'text-emerald-400'}`}>
                        {selectedNodeHeat.errorCount}
                      </span>
                    </div>
                  </div>

                  {/* Diagnostic Findings */}
                  {selectedNodeHeat.diagnosticNotes.length > 0 && (
                    <div className="space-y-1 pt-1">
                      <span className="text-[10px] font-mono text-slate-400 uppercase tracking-wider">
                        Diagnostic Findings:
                      </span>
                      <ul className="space-y-1 text-[11px] font-mono text-slate-300">
                        {selectedNodeHeat.diagnosticNotes.map((note, idx) => (
                          <li key={idx} className="flex items-start space-x-1.5">
                            <span className="text-amber-400 mt-0.5">•</span>
                            <span>{note}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Node Metadata */}
              <div className="space-y-2 text-xs font-mono">
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-500">Event ID:</span>
                  <span className="text-slate-300 font-semibold">{selectedEvent.event_id.slice(0, 12)}...</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-500">Sequence #:</span>
                  <span className="text-slate-300 font-semibold">{selectedEvent.sequence_number}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-500">Timestamp:</span>
                  <span className="text-slate-300">{new Date(selectedEvent.event_timestamp).toLocaleTimeString()}</span>
                </div>
                <div className="flex justify-between py-1 border-b border-slate-800/60">
                  <span className="text-slate-500">Causation Parent:</span>
                  <span className="text-amber-400 truncate max-w-[140px]" title={selectedEvent.causation_id || 'none'}>
                    {selectedEvent.caused_by_event_type || selectedEvent.causation_id || 'root'}
                  </span>
                </div>
              </div>

              {/* Payload Peek */}
              <div className="space-y-1">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                  Payload Preview
                </span>
                <div className={`p-3 rounded-lg border ${themeClasses.borderSubtle} ${themeClasses.codeBg} font-mono text-[11px] max-h-44 overflow-y-auto custom-scrollbar`}>
                  <pre className="text-emerald-300/90 leading-relaxed">
                    {JSON.stringify(selectedEvent.payload, null, 2)}
                  </pre>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-2 space-y-2">
                <button
                  onClick={() => onSelectEvent(selectedEvent)}
                  className="w-full py-2 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs shadow-sm transition-all flex items-center justify-center space-x-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>Open Full Event Envelope</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="py-16 text-center text-slate-500 font-mono text-xs">
              Select a node in the DAG to inspect details.
            </div>
          )}
        </div>
      </div>

      {/* Dependency Analysis & Blast Radius Modal Overlay */}
      {isBlastRadiusOverlayOpen && (
        <DependencyAnalysisOverlay
          analysis={blastRadiusAnalysis}
          selectedEvent={selectedEvent}
          scenario={blastScenario}
          onScenarioChange={setBlastScenario}
          onClose={() => setIsBlastRadiusOverlayOpen(false)}
          onFocusNodeInGraph={(eventId) => {
            setSelectedNodeId(eventId);
            setIsBlastRadiusOverlayOpen(false);
          }}
          onOpenEnvelope={(event) => {
            onSelectEvent(event);
            setIsBlastRadiusOverlayOpen(false);
          }}
        />
      )}
    </div>
  );
};

