import { EventEnvelope, LineageGraphNode, LineageGraphResponse } from '../types';
import { getEventHealthInfo } from './mockDataGenerator';

export type HeatmapMetricMode = 'off' | 'latency' | 'errors' | 'composite';

export type HeatTier = 'cold' | 'moderate' | 'hot' | 'critical';

export interface NodeHeatmapData {
  nodeId: string;
  metricMode: HeatmapMetricMode;
  rawLatencyMs: number;
  errorCount: number;
  anomalyScore: number; // 0.0 - 1.0
  normalizedIntensity: number; // 0.0 - 1.0
  heatTier: HeatTier;
  label: string;
  secondaryLabel: string;
  isBottleneck: boolean;
  hasErrors: boolean;
  diagnosticNotes: string[];
  colors: {
    bg: string;
    border: string;
    text: string;
    glow: string;
    badgeBg: string;
    badgeText: string;
    hex: string;
  };
}

export interface HeatmapSummaryStats {
  mode: HeatmapMetricMode;
  minLatencyMs: number;
  maxLatencyMs: number;
  avgLatencyMs: number;
  totalErrors: number;
  criticalNodesCount: number;
  hotNodesCount: number;
  moderateNodesCount: number;
  coldNodesCount: number;
  criticalHotPathNodeIds: string[];
}

/**
 * Extracts the effective processing latency/duration for an event in milliseconds
 */
export function extractEventLatencyMs(evt: EventEnvelope, parentEvt?: EventEnvelope | null): number {
  const p = evt.payload || {};

  if (typeof p.execution_time_ms === 'number' && p.execution_time_ms > 0) {
    return p.execution_time_ms;
  }
  if (typeof p.duration_ms === 'number' && p.duration_ms > 0) {
    return p.duration_ms;
  }
  if (typeof p.latency_ms === 'number' && p.latency_ms > 0) {
    return p.latency_ms;
  }

  // Derive from event timestamp vs parent timestamp if both available
  if (parentEvt && parentEvt.event_timestamp && evt.event_timestamp) {
    const delta = new Date(evt.event_timestamp).getTime() - new Date(parentEvt.event_timestamp).getTime();
    if (delta > 0 && delta < 600000) {
      return delta;
    }
  }

  // Derive from received_at vs event_timestamp
  if (evt.received_at && evt.event_timestamp) {
    const delta = new Date(evt.received_at).getTime() - new Date(evt.event_timestamp).getTime();
    if (delta > 0 && delta < 60000) {
      return delta;
    }
  }

  // Fallback realistic baseline depending on stage
  if (evt.event_type.includes('harness')) return 45000;
  if (evt.event_type.includes('assessment') || evt.event_type.includes('evaluate')) return 1800;
  if (evt.event_type.includes('sec') || evt.event_type.includes('feasibility')) return 1200;
  if (evt.event_type.includes('candidate')) return 450;
  return 65;
}

/**
 * Extracts error count and anomaly score for an event
 */
export function extractEventErrorsAndAnomalies(evt: EventEnvelope): {
  errorCount: number;
  anomalyScore: number;
  notes: string[];
} {
  const p = evt.payload || {};
  const health = getEventHealthInfo(evt);
  let errorCount = 0;
  let anomalyScore = 0;
  const notes: string[] = [];

  // Sandbox tests failed
  if (typeof p.tests_failed === 'number' && p.tests_failed > 0) {
    errorCount += p.tests_failed;
    anomalyScore += Math.min(0.6, p.tests_failed * 0.2);
    notes.push(`${p.tests_failed} sandbox unit/integration test assertion(s) failed`);
  }

  // Security findings / vulnerabilities
  if (typeof p.findings_count === 'number' && p.findings_count > 0) {
    errorCount += p.findings_count;
    anomalyScore += Math.min(0.5, p.findings_count * 0.25);
    notes.push(`${p.findings_count} security vulnerability finding(s) detected`);
  }

  // Syscall violations
  if (typeof p.syscall_violations === 'number' && p.syscall_violations > 0) {
    errorCount += p.syscall_violations;
    anomalyScore += 0.4;
    notes.push(`${p.syscall_violations} gVisor sandbox syscall isolation violations`);
  }

  // Risk Score
  if (typeof p.risk_score === 'number' && p.risk_score > 0.5) {
    anomalyScore += (p.risk_score - 0.5) * 0.8;
    notes.push(`High risk triage assessment score (${(p.risk_score * 100).toFixed(0)}%)`);
  } else if (p.risk_level === 'High') {
    anomalyScore += 0.35;
    notes.push('Flagged with High Risk profile during triage');
  }

  // Explicit health status failed/warning
  if (health.status === 'failed') {
    errorCount = Math.max(errorCount, 1);
    anomalyScore = Math.max(anomalyScore, 0.8);
    notes.push(`Health status: FAILED (${health.reason})`);
  } else if (health.status === 'warning') {
    anomalyScore = Math.max(anomalyScore, 0.35);
    notes.push(`Health status: WARNING (${health.reason})`);
  }

  return {
    errorCount,
    anomalyScore: Math.min(1.0, anomalyScore),
    notes
  };
}

/**
 * Returns color palette & styling based on normalized heat intensity (0.0 to 1.0)
 */
export function getHeatTierColors(intensity: number): {
  tier: HeatTier;
  bg: string;
  border: string;
  text: string;
  glow: string;
  badgeBg: string;
  badgeText: string;
  hex: string;
} {
  if (intensity >= 0.75) {
    return {
      tier: 'critical',
      bg: 'bg-rose-950/70',
      border: 'border-rose-500',
      text: 'text-rose-300',
      glow: 'shadow-[0_0_15px_rgba(244,63,94,0.5)] ring-1 ring-rose-500/60',
      badgeBg: 'bg-rose-500/30 border border-rose-500/50',
      badgeText: 'text-rose-200',
      hex: '#f43f5e'
    };
  }
  if (intensity >= 0.50) {
    return {
      tier: 'hot',
      bg: 'bg-amber-950/60',
      border: 'border-amber-500',
      text: 'text-amber-300',
      glow: 'shadow-[0_0_12px_rgba(245,158,11,0.4)] ring-1 ring-amber-500/50',
      badgeBg: 'bg-amber-500/30 border border-amber-500/50',
      badgeText: 'text-amber-200',
      hex: '#f59e0b'
    };
  }
  if (intensity >= 0.25) {
    return {
      tier: 'moderate',
      bg: 'bg-yellow-950/40',
      border: 'border-yellow-500/70',
      text: 'text-yellow-300',
      glow: 'shadow-[0_0_8px_rgba(234,179,8,0.25)]',
      badgeBg: 'bg-yellow-500/20 border border-yellow-500/40',
      badgeText: 'text-yellow-200',
      hex: '#eab308'
    };
  }
  return {
    tier: 'cold',
    bg: 'bg-slate-900/80',
    border: 'border-slate-700/80',
    text: 'text-emerald-300',
    glow: '',
    badgeBg: 'bg-emerald-500/15 border border-emerald-500/30',
    badgeText: 'text-emerald-300',
    hex: '#10b981'
  };
}

/**
 * Computes complete heatmap metadata for all nodes in the Lineage Graph
 */
export function computeLineageHeatmap(
  nodes: LineageGraphNode[],
  edges: LineageGraphResponse['edges'],
  getEventById: (id: string) => EventEnvelope | undefined,
  metricMode: HeatmapMetricMode
): {
  nodeHeatMap: Map<string, NodeHeatmapData>;
  summary: HeatmapSummaryStats;
} {
  const nodeHeatMap = new Map<string, NodeHeatmapData>();

  if (nodes.length === 0) {
    return {
      nodeHeatMap,
      summary: {
        mode: metricMode,
        minLatencyMs: 0,
        maxLatencyMs: 0,
        avgLatencyMs: 0,
        totalErrors: 0,
        criticalNodesCount: 0,
        hotNodesCount: 0,
        moderateNodesCount: 0,
        coldNodesCount: 0,
        criticalHotPathNodeIds: []
      }
    };
  }

  // 1. First pass: Gather raw values
  const rawNodeMetrics: {
    nodeId: string;
    latencyMs: number;
    errorCount: number;
    anomalyScore: number;
    notes: string[];
    hasErrors: boolean;
  }[] = [];

  // Map to find parents
  const parentMap = new Map<string, string>();
  edges.forEach(e => parentMap.set(e.target, e.source));

  let totalLatency = 0;
  let minLatency = Infinity;
  let maxLatency = 0;
  let totalErrors = 0;

  nodes.forEach(node => {
    const evt = getEventById(node.id);
    if (!evt) {
      rawNodeMetrics.push({
        nodeId: node.id,
        latencyMs: 10,
        errorCount: 0,
        anomalyScore: 0,
        notes: ['Event data not found in cache'],
        hasErrors: false
      });
      return;
    }

    const parentId = parentMap.get(node.id) || evt.causation_id;
    const parentEvt = parentId ? getEventById(parentId) : null;

    const latencyMs = extractEventLatencyMs(evt, parentEvt);
    const { errorCount, anomalyScore, notes } = extractEventErrorsAndAnomalies(evt);

    totalLatency += latencyMs;
    if (latencyMs < minLatency) minLatency = latencyMs;
    if (latencyMs > maxLatency) maxLatency = latencyMs;
    totalErrors += errorCount;

    rawNodeMetrics.push({
      nodeId: node.id,
      latencyMs,
      errorCount,
      anomalyScore,
      notes,
      hasErrors: errorCount > 0 || anomalyScore >= 0.5
    });
  });

  if (minLatency === Infinity) minLatency = 0;
  const avgLatency = nodes.length > 0 ? totalLatency / nodes.length : 0;

  // 2. Second pass: Calculate normalized intensities
  let criticalCount = 0;
  let hotCount = 0;
  let moderateCount = 0;
  let coldCount = 0;

  rawNodeMetrics.forEach(item => {
    let intensity = 0;

    if (metricMode === 'latency') {
      // Logarithmic scaling for latency to handle large spans (e.g. 50ms to 90,000ms)
      if (maxLatency > minLatency) {
        const logMin = Math.log10(Math.max(1, minLatency));
        const logMax = Math.log10(Math.max(10, maxLatency));
        const logVal = Math.log10(Math.max(1, item.latencyMs));
        intensity = Math.max(0, Math.min(1, (logVal - logMin) / (logMax - logMin)));
      } else {
        intensity = item.latencyMs > 1000 ? 0.8 : 0.2;
      }
    } else if (metricMode === 'errors') {
      // Error & Anomaly mode
      if (item.errorCount > 0) {
        intensity = Math.min(1.0, 0.6 + item.errorCount * 0.15);
      } else {
        intensity = item.anomalyScore;
      }
    } else if (metricMode === 'composite') {
      // Combined Friction Score
      let latIntensity = 0;
      if (maxLatency > minLatency) {
        const logMin = Math.log10(Math.max(1, minLatency));
        const logMax = Math.log10(Math.max(10, maxLatency));
        const logVal = Math.log10(Math.max(1, item.latencyMs));
        latIntensity = Math.max(0, Math.min(1, (logVal - logMin) / (logMax - logMin)));
      }
      const errIntensity = item.errorCount > 0 ? Math.min(1.0, 0.6 + item.errorCount * 0.15) : item.anomalyScore;
      intensity = latIntensity * 0.5 + errIntensity * 0.5;
    } else {
      // 'off' mode: Flat minimal intensity
      intensity = 0.05;
    }

    const colors = getHeatTierColors(intensity);
    if (colors.tier === 'critical') criticalCount++;
    else if (colors.tier === 'hot') hotCount++;
    else if (colors.tier === 'moderate') moderateCount++;
    else coldCount++;

    // Format labels
    let label = '';
    let secondaryLabel = '';

    if (metricMode === 'latency') {
      label = formatDurationLabel(item.latencyMs);
      secondaryLabel = item.latencyMs > avgLatency * 1.5 ? '⚠️ High Latency' : 'Nominal';
    } else if (metricMode === 'errors') {
      label = item.errorCount > 0 ? `${item.errorCount} Error(s)` : `${(item.anomalyScore * 100).toFixed(0)}% Risk`;
      secondaryLabel = item.hasErrors ? '🔴 Fault Detected' : 'Clean';
    } else if (metricMode === 'composite') {
      label = `${(intensity * 100).toFixed(0)} / 100 Heat`;
      secondaryLabel = `${formatDurationLabel(item.latencyMs)} • ${item.errorCount} err`;
    } else {
      label = 'Standard';
      secondaryLabel = formatDurationLabel(item.latencyMs);
    }

    if (item.latencyMs > avgLatency * 2) {
      item.notes.push(`Latency is ${(item.latencyMs / Math.max(1, avgLatency)).toFixed(1)}x higher than graph average (${formatDurationLabel(avgLatency)})`);
    }

    nodeHeatMap.set(item.nodeId, {
      nodeId: item.nodeId,
      metricMode,
      rawLatencyMs: item.latencyMs,
      errorCount: item.errorCount,
      anomalyScore: item.anomalyScore,
      normalizedIntensity: intensity,
      heatTier: colors.tier,
      label,
      secondaryLabel,
      isBottleneck: intensity >= 0.70,
      hasErrors: item.hasErrors,
      diagnosticNotes: item.notes,
      colors
    });
  });

  // 3. Find the Critical Hot Path (the branch with highest friction / cumulative heat)
  const criticalHotPathNodeIds = findCriticalHotPath(nodes, edges, nodeHeatMap);

  return {
    nodeHeatMap,
    summary: {
      mode: metricMode,
      minLatencyMs: minLatency,
      maxLatencyMs: maxLatency,
      avgLatencyMs: avgLatency,
      totalErrors,
      criticalNodesCount: criticalCount,
      hotNodesCount: hotCount,
      moderateNodesCount: moderateCount,
      coldNodesCount: coldCount,
      criticalHotPathNodeIds
    }
  };
}

/**
 * Formats millisecond duration into human-readable label
 */
export function formatDurationLabel(ms: number): string {
  if (ms >= 60000) {
    return `${(ms / 60000).toFixed(1)}m`;
  }
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.round(ms)}ms`;
}

/**
 * Finds the chain of nodes that form the critical hotspot path
 */
function findCriticalHotPath(
  nodes: LineageGraphNode[],
  edges: LineageGraphResponse['edges'],
  nodeHeatMap: Map<string, NodeHeatmapData>
): string[] {
  if (nodes.length === 0) return [];

  const childrenMap = new Map<string, string[]>();
  edges.forEach(e => {
    if (!childrenMap.has(e.source)) childrenMap.set(e.source, []);
    childrenMap.get(e.source)!.push(e.target);
  });

  // Find root nodes (depth = 0 or no incoming edges)
  const targets = new Set(edges.map(e => e.target));
  const roots = nodes.filter(n => n.depth === 0 || !targets.has(n.id));
  if (roots.length === 0) return [];

  // Pick root with highest heat or first
  const root = roots.reduce((best, curr) => {
    const currHeat = nodeHeatMap.get(curr.id)?.normalizedIntensity || 0;
    const bestHeat = nodeHeatMap.get(best.id)?.normalizedIntensity || 0;
    return currHeat > bestHeat ? curr : best;
  }, roots[0]);

  const path: string[] = [root.id];
  let currId = root.id;

  while (childrenMap.has(currId) && childrenMap.get(currId)!.length > 0) {
    const children = childrenMap.get(currId)!;
    // pick child with highest heat
    let maxChild = children[0];
    let maxHeat = -1;

    children.forEach(cId => {
      const heat = nodeHeatMap.get(cId)?.normalizedIntensity || 0;
      if (heat > maxHeat) {
        maxHeat = heat;
        maxChild = cId;
      }
    });

    path.push(maxChild);
    currId = maxChild;
  }

  return path;
}
