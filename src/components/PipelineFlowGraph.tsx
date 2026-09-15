import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as d3 from 'd3';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  GitBranch,
  Layers,
  Workflow,
  Sparkles,
  CheckCircle,
  FileText,
  Code,
  TrendingUp,
  Cpu,
  ShieldCheck,
  AlertTriangle,
  Clock,
  Play,
  RotateCcw,
  Zap,
  Split,
  Eye,
  Filter,
  Search,
  Activity
} from 'lucide-react';
import { EventEnvelope, LifecycleStage, EventHealthStatus } from '../types';
import { useAppTheme } from '../context/ThemeContext';
import { getStageColor, mapEventTypeToStage, getEventHealthInfo } from '../services/mockDataGenerator';

export type FlowLayoutMode = 'pipeline' | 'dag' | 'swimlanes';

interface PipelineFlowGraphProps {
  events: EventEnvelope[];
  onSelectEvent: (event: EventEnvelope) => void;
  workflowTitle?: string;
  correlationId?: string;
}

interface FlowNode {
  id: string;
  event: EventEnvelope;
  stage: LifecycleStage;
  label: string;
  source: string;
  actorType: string;
  isParallelSubtask: boolean;
  parallelTrack?: string;
  subtaskName?: string;
  health: {
    status: EventHealthStatus;
    label: string;
    reason: string;
  };
  durationMs?: number;
  stageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
  parents: string[];
  children: string[];
  depth: number;
  lane: number;
}

interface FlowLink {
  sourceId: string;
  targetId: string;
  sourceNode?: FlowNode;
  targetNode?: FlowNode;
  isParallelFork?: boolean;
  isParallelJoin?: boolean;
  isCriticalPath?: boolean;
}

const STAGE_ORDER: LifecycleStage[] = [
  'harvest',
  'candidate',
  'assessment',
  'requirement',
  'planning',
  'harness',
  'deployment'
];

const STAGE_NAMES: Record<LifecycleStage, string> = {
  harvest: '1. Ingestion',
  candidate: '2. Discovery',
  assessment: '3. Assessment',
  requirement: '4. Requirements',
  planning: '5. Architecture',
  harness: '6. Dev Sandbox',
  deployment: '7. Deployment',
  scheduler: 'Scheduler / Cron',
  timeclock: 'Timeclock Clock-in',
  nebula: 'Nebula Records',
  lease: 'Role Leases',
  registry: 'Service Registry',
  voyager: 'Voyager FS',
  execution: 'Execution Engine',
  circuit: 'Circuit Breaker',
  substance: 'Substance Segments',
  mcp: 'MCP Protocol',
  wrp: 'WRP State Kernel'
};

export const PipelineFlowGraph: React.FC<PipelineFlowGraphProps> = ({
  events,
  onSelectEvent,
  workflowTitle,
  correlationId
}) => {
  const { themeClasses, isDark, isSteel } = useAppTheme();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [layoutMode, setLayoutMode] = useState<FlowLayoutMode>('pipeline');
  const [showSubtasks, setShowSubtasks] = useState<boolean>(true);
  const [highlightCriticalPath, setHighlightCriticalPath] = useState<boolean>(false);
  const [healthFilter, setHealthFilter] = useState<'all' | 'warning_failed' | 'success'>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Zoom transform holder
  const zoomBehaviorRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown> | null>(null);

  // Transform raw events into Node and Edge graph model
  const graphData = useMemo(() => {
    // Sort events chronologically
    const sorted = [...events].sort(
      (a, b) => new Date(a.event_timestamp).getTime() - new Date(b.event_timestamp).getTime()
    );

    const eventMap = new Map<string, EventEnvelope>();
    sorted.forEach(e => eventMap.set(e.event_id, e));

    // Build raw nodes
    const nodeMap = new Map<string, FlowNode>();
    const nodeWidth = 220;
    const nodeHeight = 84;

    sorted.forEach(evt => {
      const stage = mapEventTypeToStage(evt.event_type);
      const stageIndex = STAGE_ORDER.indexOf(stage);
      const isParallel = Boolean(
        evt.payload?.parallel_track ||
        evt.payload?.subtask_name ||
        evt.event_type.includes('.feasibility.') ||
        evt.event_type.includes('.security.') ||
        evt.event_type.includes('.codegen.') ||
        evt.event_type.includes('.tests.')
      );
      const healthInfo = getEventHealthInfo(evt);

      nodeMap.set(evt.event_id, {
        id: evt.event_id,
        event: evt,
        stage,
        label: evt.event_type,
        source: evt.source,
        actorType: evt.actor_type,
        isParallelSubtask: isParallel,
        parallelTrack: evt.payload?.parallel_track,
        subtaskName: evt.payload?.subtask_name || evt.payload?.title,
        health: {
          status: healthInfo.status,
          label: healthInfo.label,
          reason: healthInfo.reason
        },
        durationMs: evt.payload?.duration_ms || (evt.payload?.latency_ms ? evt.payload.latency_ms : undefined),
        stageIndex: stageIndex >= 0 ? stageIndex : 0,
        x: 0,
        y: 0,
        width: nodeWidth,
        height: nodeHeight,
        parents: evt.causation_id && eventMap.has(evt.causation_id) ? [evt.causation_id] : [],
        children: [],
        depth: 0,
        lane: 0
      });
    });

    // Populate children and joined subtasks
    nodeMap.forEach(node => {
      node.parents.forEach(pId => {
        const parent = nodeMap.get(pId);
        if (parent && !parent.children.includes(node.id)) {
          parent.children.push(node.id);
        }
      });

      // Check for joined_subtasks explicitly recorded in parent payload
      if (Array.isArray(node.event.payload?.joined_subtasks)) {
        node.event.payload.joined_subtasks.forEach((subId: string) => {
          if (nodeMap.has(subId)) {
            const sub = nodeMap.get(subId)!;
            if (!sub.children.includes(node.id)) sub.children.push(node.id);
            if (!node.parents.includes(subId)) node.parents.push(subId);
          }
        });
      }
    });

    // Connect sequential stages if causation_id was omitted in seed
    const stagesBuckets: FlowNode[][] = STAGE_ORDER.map(() => []);
    nodeMap.forEach(node => {
      stagesBuckets[node.stageIndex].push(node);
    });

    // Compute causal depths via BFS
    const roots = Array.from(nodeMap.values()).filter(n => n.parents.length === 0);
    const queue: { node: FlowNode; depth: number }[] = roots.map(r => ({ node: r, depth: 0 }));
    const visited = new Set<string>();

    while (queue.length > 0) {
      const { node, depth } = queue.shift()!;
      if (visited.has(node.id)) continue;
      visited.add(node.id);
      node.depth = Math.max(node.depth, depth);

      node.children.forEach(cId => {
        const child = nodeMap.get(cId);
        if (child) queue.push({ node: child, depth: depth + 1 });
      });
    }

    // Build link edges
    const links: FlowLink[] = [];
    const linkKeys = new Set<string>();

    nodeMap.forEach(node => {
      node.children.forEach(cId => {
        const child = nodeMap.get(cId);
        if (child) {
          const key = `${node.id}->${cId}`;
          if (!linkKeys.has(key)) {
            linkKeys.add(key);
            links.push({
              sourceId: node.id,
              targetId: cId,
              sourceNode: node,
              targetNode: child,
              isParallelFork: node.children.filter(id => nodeMap.get(id)?.isParallelSubtask).length > 1,
              isParallelJoin: child.parents.length > 1
            });
          }
        }
      });
    });

    // Fallback: If no links exist, connect adjacent stage primary nodes
    if (links.length === 0 && sorted.length > 1) {
      for (let i = 0; i < sorted.length - 1; i++) {
        const src = nodeMap.get(sorted[i].event_id);
        const tgt = nodeMap.get(sorted[i + 1].event_id);
        if (src && tgt) {
          src.children.push(tgt.id);
          tgt.parents.push(src.id);
          links.push({
            sourceId: src.id,
            targetId: tgt.id,
            sourceNode: src,
            targetNode: tgt
          });
        }
      }
    }

    return {
      nodes: Array.from(nodeMap.values()),
      links,
      nodeMap,
      stagesBuckets
    };
  }, [events]);

  // Compute Layout coordinates based on mode
  const { layoutNodes, layoutLinks, bounds, stageRegions } = useMemo(() => {
    let visibleNodes = graphData.nodes.filter(n => {
      if (!showSubtasks && n.isParallelSubtask) return false;
      if (healthFilter === 'warning_failed' && n.health.status === 'success') return false;
      if (healthFilter === 'success' && n.health.status !== 'success') return false;
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = 
          n.label.toLowerCase().includes(q) ||
          n.source.toLowerCase().includes(q) ||
          (n.subtaskName && n.subtaskName.toLowerCase().includes(q)) ||
          n.stage.toLowerCase().includes(q);
        if (!matches) return false;
      }
      return true;
    });

    const visibleNodeIds = new Set(visibleNodes.map(n => n.id));
    const visibleLinks = graphData.links.filter(
      l => visibleNodeIds.has(l.sourceId) && visibleNodeIds.has(l.targetId)
    );

    const nodeWidth = 230;
    const nodeHeight = 90;
    const paddingX = 70;
    const paddingY = 40;

    const stageRegions: {
      stage: LifecycleStage;
      name: string;
      x: number;
      y: number;
      width: number;
      height: number;
      color: ReturnType<typeof getStageColor>;
      count: number;
    }[] = [];

    if (layoutMode === 'pipeline') {
      // 1. Pipeline Mode: Stage swimlanes (Left-to-Right columns)
      const stageColumnWidth = nodeWidth + paddingX;
      let maxY = 600;

      STAGE_ORDER.forEach((stage, sIdx) => {
        const stgNodes = visibleNodes.filter(n => n.stage === stage);
        const colX = 60 + sIdx * stageColumnWidth;
        const startY = 80;

        // Position nodes inside this stage column vertically
        stgNodes.forEach((node, nIdx) => {
          node.x = colX;
          node.y = startY + nIdx * (nodeHeight + paddingY);
          node.width = nodeWidth;
          node.height = nodeHeight;
          if (node.y + nodeHeight + 80 > maxY) {
            maxY = node.y + nodeHeight + 80;
          }
        });

        const color = getStageColor(stage);
        stageRegions.push({
          stage,
          name: STAGE_NAMES[stage],
          x: colX - 16,
          y: 20,
          width: nodeWidth + 32,
          height: Math.max(maxY - 20, 500),
          color,
          count: stgNodes.length
        });
      });

      const totalWidth = 60 + STAGE_ORDER.length * stageColumnWidth + 40;
      return {
        layoutNodes: visibleNodes,
        layoutLinks: visibleLinks,
        stageRegions,
        bounds: { width: Math.max(totalWidth, 1200), height: Math.max(maxY + 60, 600) }
      };
    } else if (layoutMode === 'dag') {
      // 2. DAG Mode: Topological Rank ordering (Depth based columns)
      const depthBuckets = new Map<number, FlowNode[]>();
      visibleNodes.forEach(node => {
        const d = node.depth;
        if (!depthBuckets.has(d)) depthBuckets.set(d, []);
        depthBuckets.get(d)!.push(node);
      });

      const maxDepth = Math.max(...Array.from(depthBuckets.keys()), 0);
      const colWidth = nodeWidth + 80;
      let maxY = 500;

      for (let d = 0; d <= maxDepth; d++) {
        const nodesAtDepth = depthBuckets.get(d) || [];
        const colX = 60 + d * colWidth;
        const totalHeight = nodesAtDepth.length * (nodeHeight + 35);
        const startY = Math.max(60, 300 - totalHeight / 2);

        nodesAtDepth.forEach((node, idx) => {
          node.x = colX;
          node.y = startY + idx * (nodeHeight + 35);
          node.width = nodeWidth;
          node.height = nodeHeight;
          if (node.y + nodeHeight + 60 > maxY) {
            maxY = node.y + nodeHeight + 60;
          }
        });
      }

      const totalWidth = 60 + (maxDepth + 1) * colWidth + 80;
      return {
        layoutNodes: visibleNodes,
        layoutLinks: visibleLinks,
        stageRegions: [],
        bounds: { width: Math.max(totalWidth, 1200), height: Math.max(maxY + 60, 600) }
      };
    } else {
      // 3. Parallel Swimlanes Mode: Group by worker/actor track horizontally
      const trackNames = [
        'Main Causal Spine',
        'Worker: Feasibility & ROI',
        'Worker: Security Sentinel',
        'Worker: CodeGen Agent',
        'Worker: Sandbox Test Matrix',
        'Deployment Pipeline'
      ];

      const trackYMap = new Map<string, number>();
      trackNames.forEach((t, i) => trackYMap.set(t, 80 + i * (nodeHeight + 35)));

      const timeSpan = visibleNodes.length > 1
        ? new Date(visibleNodes[visibleNodes.length - 1].event.event_timestamp).getTime() -
          new Date(visibleNodes[0].event.event_timestamp).getTime()
        : 1;

      const startTime = visibleNodes.length > 0 ? new Date(visibleNodes[0].event.event_timestamp).getTime() : 0;
      const graphWidth = 1400;

      visibleNodes.forEach(node => {
        let track = 'Main Causal Spine';
        if (node.parallelTrack?.includes('Track-A') || node.label.includes('feasibility')) track = 'Worker: Feasibility & ROI';
        else if (node.parallelTrack?.includes('Track-B') || node.label.includes('security')) track = 'Worker: Security Sentinel';
        else if (node.parallelTrack?.includes('Track-1') || node.label.includes('codegen')) track = 'Worker: CodeGen Agent';
        else if (node.parallelTrack?.includes('Track-2') || node.label.includes('tests')) track = 'Worker: Sandbox Test Matrix';
        else if (node.stage === 'deployment') track = 'Deployment Pipeline';

        const curTime = new Date(node.event.event_timestamp).getTime();
        const ratio = timeSpan > 0 ? (curTime - startTime) / timeSpan : 0.5;

        node.x = 80 + ratio * (graphWidth - 300);
        node.y = trackYMap.get(track) || 80;
        node.width = nodeWidth;
        node.height = nodeHeight;
      });

      return {
        layoutNodes: visibleNodes,
        layoutLinks: visibleLinks,
        stageRegions: [],
        bounds: { width: graphWidth + 100, height: 80 + trackNames.length * (nodeHeight + 35) + 60 }
      };
    }
  }, [graphData, layoutMode, showSubtasks, healthFilter, searchQuery]);

  // Ancestor and descendant causal highlighter
  const highlightedNodes = useMemo(() => {
    if (!hoveredNodeId && !selectedNodeId) return null;
    const targetId = hoveredNodeId || selectedNodeId;
    if (!targetId) return null;

    const ancestors = new Set<string>();
    const descendants = new Set<string>();
    const activeLinks = new Set<string>();

    // BFS Upwards
    const upQueue = [targetId];
    while (upQueue.length > 0) {
      const curId = upQueue.shift()!;
      ancestors.add(curId);
      const node = graphData.nodeMap.get(curId);
      if (node) {
        node.parents.forEach(pId => {
          activeLinks.add(`${pId}->${curId}`);
          if (!ancestors.has(pId)) upQueue.push(pId);
        });
      }
    }

    // BFS Downwards
    const downQueue = [targetId];
    while (downQueue.length > 0) {
      const curId = downQueue.shift()!;
      descendants.add(curId);
      const node = graphData.nodeMap.get(curId);
      if (node) {
        node.children.forEach(cId => {
          activeLinks.add(`${curId}->${cId}`);
          if (!descendants.has(cId)) downQueue.push(cId);
        });
      }
    }

    return {
      targetId,
      all: new Set([...ancestors, ...descendants]),
      ancestors,
      descendants,
      links: activeLinks
    };
  }, [hoveredNodeId, selectedNodeId, graphData]);

  // Setup D3 Zoom & Pan
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    const g = svg.select<SVGGElement>('#flow-graph-canvas');

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.25, 2.5])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });

    svg.call(zoom);
    zoomBehaviorRef.current = zoom;

    // Center/fit initial view
    handleFitView();
  }, [bounds.width, bounds.height, layoutMode]);

  const handleZoomIn = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 1.25);
  };

  const handleZoomOut = () => {
    if (!svgRef.current || !zoomBehaviorRef.current) return;
    d3.select(svgRef.current).transition().duration(250).call(zoomBehaviorRef.current.scaleBy, 0.8);
  };

  const handleFitView = () => {
    if (!svgRef.current || !containerRef.current || !zoomBehaviorRef.current) return;
    const container = containerRef.current;
    const cWidth = container.clientWidth || 900;
    const cHeight = container.clientHeight || 550;

    const scale = Math.min(
      (cWidth - 60) / bounds.width,
      (cHeight - 60) / bounds.height,
      1.0
    );

    const tx = (cWidth - bounds.width * scale) / 2;
    const ty = (cHeight - bounds.height * scale) / 2;

    const transform = d3.zoomIdentity.translate(Math.max(20, tx), Math.max(20, ty)).scale(Math.max(0.35, scale));
    d3.select(svgRef.current).transition().duration(400).call(zoomBehaviorRef.current.transform, transform);
  };

  // Metrics summary
  const stats = useMemo(() => {
    let parallelCount = 0;
    let healthy = 0;
    let warning = 0;
    let failed = 0;

    graphData.nodes.forEach(n => {
      if (n.isParallelSubtask) parallelCount++;
      if (n.health.status === 'success') healthy++;
      else if (n.health.status === 'warning') warning++;
      else if (n.health.status === 'failed') failed++;
    });

    return {
      total: graphData.nodes.length,
      parallelSubtasks: parallelCount,
      healthy,
      warning,
      failed,
      stagesActive: new Set(graphData.nodes.map(n => n.stage)).size
    };
  }, [graphData]);

  // Cubic Bezier Link Path Generator
  const generateLinkPath = (link: FlowLink): string => {
    const src = graphData.nodeMap.get(link.sourceId);
    const tgt = graphData.nodeMap.get(link.targetId);
    if (!src || !tgt) return '';

    const sx = src.x + src.width;
    const sy = src.y + src.height / 2;
    const tx = tgt.x;
    const ty = tgt.y + tgt.height / 2;

    if (tx < sx) {
      // Loopback / wrap around curve
      const midY = (sy + ty) / 2 + 50;
      return `M ${sx} ${sy} C ${sx + 40} ${midY}, ${tx - 40} ${midY}, ${tx} ${ty}`;
    }

    const dx = tx - sx;
    const cp1x = sx + Math.max(dx * 0.45, 25);
    const cp1y = sy;
    const cp2x = tx - Math.max(dx * 0.45, 25);
    const cp2y = ty;

    return `M ${sx} ${sy} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${tx} ${ty}`;
  };

  return (
    <div className="space-y-4">
      {/* Top Controls & View Filter Bar */}
      <div className={`p-4 rounded-xl border ${themeClasses.border} ${themeClasses.bgCard} shadow-sm space-y-3.5`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          {/* Header Title & Subtitle */}
          <div>
            <div className="flex items-center space-x-2">
              <span className="p-1.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-400">
                <Workflow className="w-4 h-4" />
              </span>
              <h3 className="text-sm font-bold text-slate-100 font-mono tracking-tight">
                Causal Dependency Flow & Parallel Sub-Tasks (D3 Engine)
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-sky-500/20 text-sky-300 border border-sky-500/30">
                LIVE DAG
              </span>
            </div>
            <p className={`text-xs ${themeClasses.textMuted} mt-0.5`}>
              Interactive topological vector graph tracing causality forks, parallel worker sub-tasks, and join synchronization.
            </p>
          </div>

          {/* Layout Mode Switcher */}
          <div className="flex items-center space-x-1.5 bg-slate-900/80 p-1 rounded-lg border border-slate-800 self-start lg:self-auto">
            <button
              onClick={() => setLayoutMode('pipeline')}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-all flex items-center space-x-1.5 ${
                layoutMode === 'pipeline'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Stage Pipeline</span>
            </button>
            <button
              onClick={() => setLayoutMode('dag')}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-all flex items-center space-x-1.5 ${
                layoutMode === 'dag'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              <span>Topological DAG</span>
            </button>
            <button
              onClick={() => setLayoutMode('swimlanes')}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-semibold transition-all flex items-center space-x-1.5 ${
                layoutMode === 'swimlanes'
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
              }`}
            >
              <Split className="w-3.5 h-3.5" />
              <span>Worker Swimlanes</span>
            </button>
          </div>
        </div>

        {/* Action Controls & Filtering Bar */}
        <div className={`pt-3 border-t ${themeClasses.borderSubtle} flex flex-wrap items-center justify-between gap-3 text-xs`}>
          {/* Quick Filters */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500" />
              <input
                type="text"
                placeholder="Filter events..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={`pl-8 pr-3 py-1 rounded-lg text-xs font-mono border ${themeClasses.border} ${themeClasses.inputBg} ${themeClasses.textPrimary} w-40 sm:w-52 focus:outline-none focus:border-sky-500`}
              />
            </div>

            {/* Parallel Subtasks Toggle */}
            <button
              onClick={() => setShowSubtasks(!showSubtasks)}
              className={`px-2.5 py-1 rounded-lg border font-mono font-semibold transition-all flex items-center space-x-1.5 ${
                showSubtasks
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 ring-1 ring-indigo-500/30'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700 hover:text-slate-300'
              }`}
            >
              <Zap className="w-3 h-3 text-indigo-400" />
              <span>Parallel Sub-tasks ({stats.parallelSubtasks})</span>
            </button>

            {/* Health Filter */}
            <select
              value={healthFilter}
              onChange={(e) => setHealthFilter(e.target.value as any)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono border ${themeClasses.border} ${themeClasses.inputBg} ${themeClasses.textPrimary}`}
            >
              <option value="all">All Health ({stats.total})</option>
              <option value="warning_failed">⚠️ Warnings & Errors ({stats.warning + stats.failed})</option>
              <option value="success">🟢 Clean Success ({stats.healthy})</option>
            </select>
          </div>

          {/* Graph Zoom Controls */}
          <div className="flex items-center space-x-1 bg-slate-900/80 p-1 rounded-lg border border-slate-800">
            <button
              onClick={handleZoomIn}
              title="Zoom In"
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleZoomOut}
              title="Zoom Out"
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={handleFitView}
              title="Fit to Canvas"
              className="p-1.5 rounded hover:bg-slate-800 text-slate-400 hover:text-slate-200 transition-colors flex items-center space-x-1 text-[11px] font-mono px-2"
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Fit</span>
            </button>
          </div>
        </div>

        {/* Live Metrics Summary Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 pt-1">
          <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400">Total Envelopes</span>
            <span className="text-xs font-bold font-mono text-slate-200">{stats.total}</span>
          </div>
          <div className="p-2 rounded-lg bg-indigo-950/30 border border-indigo-500/20 flex items-center justify-between">
            <span className="text-[11px] font-mono text-indigo-400 flex items-center space-x-1">
              <Zap className="w-3 h-3" />
              <span>Parallel Sub-tasks</span>
            </span>
            <span className="text-xs font-bold font-mono text-indigo-300">{stats.parallelSubtasks}</span>
          </div>
          <div className="p-2 rounded-lg bg-emerald-950/30 border border-emerald-500/20 flex items-center justify-between">
            <span className="text-[11px] font-mono text-emerald-400">Healthy Nodes</span>
            <span className="text-xs font-bold font-mono text-emerald-300">{stats.healthy}</span>
          </div>
          <div className="p-2 rounded-lg bg-amber-950/30 border border-amber-500/20 flex items-center justify-between">
            <span className="text-[11px] font-mono text-amber-400">Warnings/Flags</span>
            <span className="text-xs font-bold font-mono text-amber-300">{stats.warning}</span>
          </div>
          <div className="p-2 rounded-lg bg-slate-900/60 border border-slate-800/80 flex items-center justify-between">
            <span className="text-[11px] font-mono text-slate-400">Lifecycle Stages</span>
            <span className="text-xs font-bold font-mono text-sky-400">{stats.stagesActive} of 7</span>
          </div>
        </div>
      </div>

      {/* Main Interactive D3 Visual Canvas */}
      <div
        ref={containerRef}
        className={`relative w-full h-[580px] rounded-xl border ${themeClasses.border} ${themeClasses.codeBg} overflow-hidden shadow-inner cursor-grab active:cursor-grabbing select-none`}
      >
        <svg
          ref={svgRef}
          className="w-full h-full"
          style={{ background: 'radial-gradient(circle at 50% 50%, rgba(30, 41, 59, 0.4) 0%, rgba(15, 23, 42, 0.8) 100%)' }}
        >
          <defs>
            {/* Arrowhead Markers */}
            <marker
              id="arrowhead-default"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#64748b" />
            </marker>

            <marker
              id="arrowhead-highlight"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 1 L 9 5 L 0 9 z" fill="#38bdf8" />
            </marker>

            <marker
              id="arrowhead-parallel"
              viewBox="0 0 10 10"
              refX="8"
              refY="5"
              markerWidth="6"
              markerHeight="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 1.5 L 8 5 L 0 8.5 z" fill="#818cf8" />
            </marker>

            {/* Grid Pattern for Canvas */}
            <pattern id="grid-dots" width="24" height="24" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="#334155" opacity="0.35" />
            </pattern>

            {/* Glowing Drop Shadows */}
            <filter id="node-glow-sky" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#38bdf8" floodOpacity="0.4" />
            </filter>
            <filter id="node-glow-indigo" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="0" stdDeviation="6" floodColor="#818cf8" floodOpacity="0.4" />
            </filter>
          </defs>

          {/* Background Grid */}
          <rect width="100%" height="100%" fill="url(#grid-dots)" />

          {/* D3 Transformable Container */}
          <g id="flow-graph-canvas">
            {/* Stage Region Background Capsules (in Pipeline Mode) */}
            {stageRegions.map(reg => (
              <g key={reg.stage} className="transition-opacity duration-300">
                <rect
                  x={reg.x}
                  y={reg.y}
                  width={reg.width}
                  height={reg.height}
                  rx="14"
                  fill="rgba(15, 23, 42, 0.5)"
                  stroke={reg.color.solid}
                  strokeWidth="1"
                  strokeDasharray="4 4"
                  opacity="0.35"
                />
                {/* Stage Column Header Label */}
                <rect
                  x={reg.x + 8}
                  y={reg.y + 8}
                  width={reg.width - 16}
                  height="26"
                  rx="6"
                  fill="rgba(30, 41, 59, 0.85)"
                  stroke="rgba(71, 85, 105, 0.4)"
                />
                <text
                  x={reg.x + reg.width / 2}
                  y={reg.y + 25}
                  textAnchor="middle"
                  fill="#e2e8f0"
                  fontSize="11"
                  fontFamily="monospace"
                  fontWeight="bold"
                >
                  {reg.name} ({reg.count})
                </text>
              </g>
            ))}

            {/* Dependency Edge Links */}
            <g id="flow-links">
              {layoutLinks.map((link, idx) => {
                const key = `${link.sourceId}->${link.targetId}`;
                const isHighlighted = highlightedNodes ? highlightedNodes.links.has(key) : false;
                const isDimmed = highlightedNodes ? !isHighlighted : false;
                const pathD = generateLinkPath(link);
                if (!pathD) return null;

                const isParallel = link.isParallelFork || link.isParallelJoin || link.targetNode?.isParallelSubtask;

                return (
                  <g key={key || idx} className="transition-opacity duration-200">
                    {/* Shadow Link Path */}
                    <path
                      d={pathD}
                      fill="none"
                      stroke={isHighlighted ? '#38bdf8' : isParallel ? '#6366f1' : '#475569'}
                      strokeWidth={isHighlighted ? 3 : isParallel ? 2 : 1.5}
                      strokeDasharray={isParallel ? '4 3' : 'none'}
                      opacity={isDimmed ? 0.15 : isHighlighted ? 1 : 0.65}
                      markerEnd={
                        isHighlighted
                          ? 'url(#arrowhead-highlight)'
                          : isParallel
                          ? 'url(#arrowhead-parallel)'
                          : 'url(#arrowhead-default)'
                      }
                    />

                    {/* Flow Particle Animation (for highlighted or parallel links) */}
                    {isHighlighted && (
                      <circle r="3.5" fill="#38bdf8" filter="url(#node-glow-sky)">
                        <animateMotion path={pathD} dur="2s" repeatCount="indefinite" />
                      </circle>
                    )}
                  </g>
                );
              })}
            </g>

            {/* Flow Graph Nodes */}
            <g id="flow-nodes">
              {layoutNodes.map(node => {
                const isSelected = selectedNodeId === node.id;
                const isHovered = hoveredNodeId === node.id;
                const isHighlighted = highlightedNodes ? highlightedNodes.all.has(node.id) : false;
                const isDimmed = highlightedNodes ? !isHighlighted : false;
                const stageColor = getStageColor(node.stage);

                return (
                  <g
                    key={node.id}
                    transform={`translate(${node.x}, ${node.y})`}
                    onClick={() => {
                      setSelectedNodeId(node.id);
                      onSelectEvent(node.event);
                    }}
                    onMouseEnter={() => setHoveredNodeId(node.id)}
                    onMouseLeave={() => setHoveredNodeId(null)}
                    className="cursor-pointer transition-transform duration-150"
                    opacity={isDimmed ? 0.25 : 1}
                  >
                    {/* Node Background Card */}
                    <rect
                      width={node.width}
                      height={node.height}
                      rx="10"
                      fill={
                        isSelected
                          ? 'rgba(30, 58, 138, 0.95)'
                          : isHovered
                          ? 'rgba(30, 41, 59, 0.98)'
                          : node.isParallelSubtask
                          ? 'rgba(15, 23, 42, 0.92)'
                          : 'rgba(15, 23, 42, 0.88)'
                      }
                      stroke={
                        isSelected
                          ? '#38bdf8'
                          : isHovered
                          ? '#7dd3fc'
                          : isHighlighted
                          ? '#38bdf8'
                          : node.isParallelSubtask
                          ? '#818cf8'
                          : stageColor.solid
                      }
                      strokeWidth={isSelected || isHovered ? 2 : node.isParallelSubtask ? 1.5 : 1.2}
                      filter={isHovered || isSelected ? 'url(#node-glow-sky)' : undefined}
                    />

                    {/* Node Header Row: Source & Sequence */}
                    <g transform="translate(10, 16)">
                      {/* Health Dot */}
                      <circle
                        cx="4"
                        cy="-2"
                        r="3.5"
                        fill={
                          node.health.status === 'failed'
                            ? '#f43f5e'
                            : node.health.status === 'warning'
                            ? '#f59e0b'
                            : '#10b981'
                        }
                      />

                      {/* Source Actor Tag */}
                      <text
                        x="14"
                        y="1"
                        fill="#94a3b8"
                        fontSize="9.5"
                        fontFamily="monospace"
                        fontWeight="600"
                      >
                        {node.source.length > 20 ? node.source.slice(0, 18) + '...' : node.source}
                      </text>

                      {/* Parallel Subtask Tag Badge */}
                      {node.isParallelSubtask ? (
                        <g transform="translate(138, -7)">
                          <rect
                            width="62"
                            height="14"
                            rx="3"
                            fill="rgba(99, 102, 241, 0.25)"
                            stroke="rgba(129, 140, 248, 0.5)"
                          />
                          <text
                            x="31"
                            y="10.5"
                            textAnchor="middle"
                            fill="#c7d2fe"
                            fontSize="8"
                            fontFamily="monospace"
                            fontWeight="bold"
                          >
                            ⚡ PARALLEL
                          </text>
                        </g>
                      ) : (
                        <text
                          x={node.width - 24}
                          y="1"
                          textAnchor="end"
                          fill="#64748b"
                          fontSize="9"
                          fontFamily="monospace"
                        >
                          #{node.event.sequence_number}
                        </text>
                      )}
                    </g>

                    {/* Event Type Title */}
                    <g transform="translate(10, 36)">
                      <text
                        fill={isSelected ? '#ffffff' : '#f1f5f9'}
                        fontSize="11.5"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {node.label.length > 24 ? node.label.slice(0, 22) + '...' : node.label}
                      </text>
                    </g>

                    {/* Subtask or Title Highlights */}
                    {node.subtaskName && (
                      <g transform="translate(10, 52)">
                        <text
                          fill="#cbd5e1"
                          fontSize="10"
                          fontFamily="sans-serif"
                        >
                          {node.subtaskName.length > 26 ? node.subtaskName.slice(0, 24) + '...' : node.subtaskName}
                        </text>
                      </g>
                    )}

                    {/* Node Footer Details: Stage & Metric Chips */}
                    <g transform={`translate(10, ${node.height - 12})`}>
                      {/* Health Status Pill */}
                      <rect
                        x="0"
                        y="-10"
                        width={node.health.label.length * 6 + 14}
                        height="13"
                        rx="3"
                        fill={
                          node.health.status === 'failed'
                            ? 'rgba(244, 63, 94, 0.2)'
                            : node.health.status === 'warning'
                            ? 'rgba(245, 158, 11, 0.2)'
                            : 'rgba(16, 185, 129, 0.2)'
                        }
                      />
                      <text
                        x="4"
                        y="0"
                        fill={
                          node.health.status === 'failed'
                            ? '#fda4af'
                            : node.health.status === 'warning'
                            ? '#fde68a'
                            : '#a7f3d0'
                        }
                        fontSize="8.5"
                        fontFamily="monospace"
                        fontWeight="bold"
                      >
                        {node.health.label}
                      </text>

                      {/* Duration / Tests / Timestamp */}
                      <text
                        x={node.width - 24}
                        y="0"
                        textAnchor="end"
                        fill="#94a3b8"
                        fontSize="9"
                        fontFamily="monospace"
                      >
                        {node.durationMs
                          ? `${node.durationMs}ms`
                          : new Date(node.event.event_timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </text>
                    </g>
                  </g>
                );
              })}
            </g>
          </g>
        </svg>

        {/* Interactive Corner Legend */}
        <div className="absolute bottom-3 left-3 p-2.5 rounded-lg bg-slate-900/90 border border-slate-800/90 backdrop-blur-sm text-[10px] font-mono space-y-1.5 pointer-events-none">
          <div className="text-slate-400 font-bold uppercase tracking-wider text-[9px]">Graph Legend</div>
          <div className="flex items-center space-x-3 text-slate-300">
            <span className="flex items-center space-x-1">
              <span className="w-3 h-0.5 bg-slate-500 inline-block" />
              <span>Direct Causation</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-3 h-0.5 bg-indigo-400 border-b border-dashed inline-block" />
              <span>Parallel Fork / Join</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-emerald-400 inline-block" />
              <span>Healthy</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
              <span>Warning</span>
            </span>
            <span className="flex items-center space-x-1">
              <span className="w-2 h-2 rounded-full bg-rose-400 inline-block" />
              <span>Failed</span>
            </span>
          </div>
        </div>

        {/* Hover / Selection Inspector Pill */}
        {(hoveredNodeId || selectedNodeId) && (
          <div className="absolute top-3 right-3 p-3 rounded-xl bg-slate-900/95 border border-sky-500/40 shadow-xl backdrop-blur-md max-w-sm text-xs font-mono text-slate-200 animate-fadeIn pointer-events-none">
            {(() => {
              const activeNode = graphData.nodeMap.get(hoveredNodeId || selectedNodeId!);
              if (!activeNode) return null;
              return (
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-sky-400 font-bold uppercase">{activeNode.stage} Stage</span>
                    <span className="text-[10px] text-slate-400">Seq #{activeNode.event.sequence_number}</span>
                  </div>
                  <div className="font-bold text-slate-100">{activeNode.label}</div>
                  {activeNode.subtaskName && (
                    <div className="text-[11px] text-slate-300 font-sans">{activeNode.subtaskName}</div>
                  )}
                  <div className="text-[10px] text-slate-400 pt-1 border-t border-slate-800 flex items-center justify-between">
                    <span>Source: {activeNode.source}</span>
                    <span>Status: {activeNode.health.label}</span>
                  </div>
                  <div className="text-[9.5px] text-sky-300/80 italic">
                    Click node to inspect complete JSON event envelope
                  </div>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
};
