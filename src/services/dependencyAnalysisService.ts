import { EventEnvelope, LineageGraphNode, LineageGraphEdge, SystemFamily, LifecycleStage } from '../types';
import { cascadeStore } from './cascadeService';
import { mapEventTypeToStage, getSystemFamily, getEventSeverity, getEventOrigin } from './mockDataGenerator';

export type BlastRadiusScenario = 'failure' | 'delay_short' | 'delay_long' | 'veto';

export interface DownstreamDependent {
  eventId: string;
  eventType: string;
  source: string;
  systemFamily: SystemFamily | string;
  stage: LifecycleStage;
  depth: number;
  causationParentId: string;
  severity: string;
  timeLagMs: number;
  aggregateId: string;
  aggregateType: string;
  impactStatus: 'blocked' | 'delayed' | 'critical_failure' | 'orphaned';
  impactDescription: string;
}

export interface SystemImpactSummary {
  system: string;
  affectedCount: number;
  criticality: 'critical' | 'high' | 'medium' | 'low';
  roles: string[];
}

export interface BlastRadiusAnalysisResult {
  rootEventId: string;
  rootEventType: string;
  rootSource: string;
  rootStage: LifecycleStage;
  scenario: BlastRadiusScenario;
  
  // Blast Radius Core Metrics
  totalDownstreamEvents: number;
  directChildrenCount: number;
  maxPropagationDepth: number;
  affectedSystemsCount: number;
  riskScore: number; // 0 - 100
  riskTier: 'CRITICAL' | 'HIGH' | 'MODERATE' | 'LOW';
  
  // Simulated Consequences
  estimatedCumulativeDelayMs: number;
  estimatedRecoveryTimeMin: number;
  blockedPipelinesCount: number;
  atRiskSubscribersCount: number;
  financialOrComputeImpactEstimate: string;

  // Breakdown & Collections
  affectedNodeIds: Set<string>;
  affectedEdgeKeys: Set<string>;
  dependentsByDepth: Record<number, DownstreamDependent[]>;
  allDependents: DownstreamDependent[];
  stageDistribution: Record<string, number>;
  systemSummaries: SystemImpactSummary[];
  
  // Actionable Mitigations
  mitigationRecommendations: {
    priority: 'urgent' | 'high' | 'medium';
    title: string;
    action: string;
    targetComponent: string;
  }[];
}

/**
 * Calculates the downstream transitive closure and blast radius metrics for an event.
 */
export function calculateBlastRadius(
  rootEventId: string,
  scenario: BlastRadiusScenario = 'failure',
  allLedgerEvents: EventEnvelope[]
): BlastRadiusAnalysisResult {
  const root = allLedgerEvents.find(e => e.event_id === rootEventId) || allLedgerEvents[0];
  const rootId = root?.event_id || rootEventId;
  const rootType = root?.event_type || 'unknown';
  const rootSource = root?.source || 'system';
  const rootStage = mapEventTypeToStage(rootType);

  const affectedNodeIds = new Set<string>([rootId]);
  const affectedEdgeKeys = new Set<string>();
  const dependents: DownstreamDependent[] = [];
  const dependentsByDepth: Record<number, DownstreamDependent[]> = {};

  // BFS / DFS queue for downstream traversal
  const queue: { id: string; depth: number; parentTime: number }[] = [
    { id: rootId, depth: 0, parentTime: new Date(root?.event_timestamp || Date.now()).getTime() }
  ];
  const visited = new Set<string>([rootId]);

  while (queue.length > 0) {
    const { id: currentParentId, depth, parentTime } = queue.shift()!;

    // Find all direct children
    const directChildren = allLedgerEvents.filter(e => e.causation_id === currentParentId);

    for (const child of directChildren) {
      const childTime = new Date(child.event_timestamp).getTime();
      const timeLagMs = Math.max(0, childTime - parentTime);
      const childStage = mapEventTypeToStage(child.event_type);
      const childSystem = child.system_family || getSystemFamily(child.event_type);
      const severity = getEventSeverity(child).level;

      affectedNodeIds.add(child.event_id);
      affectedEdgeKeys.add(`${currentParentId}->${child.event_id}`);

      let impactStatus: DownstreamDependent['impactStatus'] = 'blocked';
      let impactDescription = 'Downstream action prevented due to missing causal trigger.';

      if (scenario === 'delay_short') {
        impactStatus = 'delayed';
        impactDescription = 'Execution postponed by ~2,500ms pipeline queue lag.';
      } else if (scenario === 'delay_long') {
        impactStatus = 'delayed';
        impactDescription = 'Execution stalled by ~15,000ms upstream buffer starvation.';
      } else if (scenario === 'veto') {
        impactStatus = 'orphaned';
        impactDescription = 'Downstream proposal rejected; branch pruned from release harness.';
      } else {
        if (childStage === 'execution' || childStage === 'harness' || childStage === 'deployment') {
          impactStatus = 'critical_failure';
          impactDescription = 'Autonomous build or rover task fails with fatal upstream dependency error.';
        } else {
          impactStatus = 'blocked';
          impactDescription = 'Candidate progression halted at evaluation gate.';
        }
      }

      const depItem: DownstreamDependent = {
        eventId: child.event_id,
        eventType: child.event_type,
        source: child.source,
        systemFamily: childSystem,
        stage: childStage,
        depth: depth + 1,
        causationParentId: currentParentId,
        severity,
        timeLagMs,
        aggregateId: child.aggregate_id,
        aggregateType: child.aggregate_type,
        impactStatus,
        impactDescription
      };

      dependents.push(depItem);

      if (!dependentsByDepth[depth + 1]) {
        dependentsByDepth[depth + 1] = [];
      }
      dependentsByDepth[depth + 1].push(depItem);

      if (!visited.has(child.event_id) && depth < 12) {
        visited.add(child.event_id);
        queue.push({
          id: child.event_id,
          depth: depth + 1,
          parentTime: childTime
        });
      }
    }
  }

  // Calculate Metrics
  const totalDownstream = dependents.length;
  const directChildrenCount = dependents.filter(d => d.depth === 1).length;
  const maxPropagationDepth = dependents.reduce((max, d) => Math.max(max, d.depth), 0);

  // System breakdowns
  const systemMap = new Map<string, { count: number; roles: Set<string>; hasCritical: boolean }>();
  const stageDistribution: Record<string, number> = {};

  dependents.forEach(dep => {
    // Stage counts
    stageDistribution[dep.stage] = (stageDistribution[dep.stage] || 0) + 1;

    // System counts
    const sys = String(dep.systemFamily || 'Core Stream');
    const existing = systemMap.get(sys) || { count: 0, roles: new Set<string>(), hasCritical: false };
    existing.count++;
    if (dep.source) existing.roles.add(dep.source);
    if (dep.impactStatus === 'critical_failure' || dep.severity === 'critical') {
      existing.hasCritical = true;
    }
    systemMap.set(sys, existing);
  });

  const systemSummaries: SystemImpactSummary[] = Array.from(systemMap.entries()).map(([system, data]) => ({
    system,
    affectedCount: data.count,
    criticality: (data.hasCritical ? 'critical' : data.count > 3 ? 'high' : data.count > 1 ? 'medium' : 'low') as 'critical' | 'high' | 'medium' | 'low',
    roles: Array.from(data.roles)
  })).sort((a, b) => b.affectedCount - a.affectedCount);

  // Scenario-specific calculations
  const delayMultiplier = scenario === 'delay_long' ? 15000 : scenario === 'delay_short' ? 2500 : 0;
  const estimatedCumulativeDelayMs = (maxPropagationDepth * delayMultiplier) + (totalDownstream * 350);
  const blockedPipelinesCount = dependents.filter(d => d.stage === 'execution' || d.stage === 'harness' || d.stage === 'candidate').length;
  const atRiskSubscribersCount = Math.min(8, Math.max(1, Math.ceil(totalDownstream * 0.75)));
  const estimatedRecoveryTimeMin = Math.max(1, Math.round((totalDownstream * 1.8) + (maxPropagationDepth * 2.5)));

  // Risk Score Formula:
  // (Downstream Nodes * 6) + (Depth * 12) + (Systems * 10) + (Stage weights)
  let rawRisk = (totalDownstream * 7) + (maxPropagationDepth * 11) + (systemSummaries.length * 9);
  if (rootStage === 'candidate' || rootStage === 'harvest') rawRisk += 25;
  if (rootType.includes('harvested') || rootType.includes('approved')) rawRisk += 20;
  if (scenario === 'failure') rawRisk += 15;


  const riskScore = Math.min(100, Math.max(12, Math.round(rawRisk)));

  let riskTier: BlastRadiusAnalysisResult['riskTier'] = 'LOW';
  if (riskScore >= 75) riskTier = 'CRITICAL';
  else if (riskScore >= 50) riskTier = 'HIGH';
  else if (riskScore >= 30) riskTier = 'MODERATE';

  const financialOrComputeImpactEstimate = riskScore > 75 
    ? 'High Compute & Autonomous Agent Idle Wastage (>250k tokens)'
    : riskScore > 50 
    ? 'Moderate Dev Harness Rebuild & Execution Retries (~80k tokens)'
    : 'Minimal isolated re-evaluation overhead (<10k tokens)';

  // Mitigations
  const mitigationRecommendations: BlastRadiusAnalysisResult['mitigationRecommendations'] = [];

  if (scenario === 'failure') {
    mitigationRecommendations.push({
      priority: 'urgent',
      title: 'Configure Idempotent Retry & Dead Letter Queue (DLQ)',
      action: 'Wrap downstream consumer offsets in an exponential backoff circuit breaker.',
      targetComponent: rootSource
    });
    if (totalDownstream > 2) {
      mitigationRecommendations.push({
        priority: 'high',
        title: 'Cascade Fallback Branching',
        action: 'Inject synthetic placeholder candidate to unblock downstream execution workers.',
        targetComponent: 'tackle.candidate_discovery'
      });
    }
  } else if (scenario === 'veto') {
    mitigationRecommendations.push({
      priority: 'high',
      title: 'Prune Orphaned Work Units',
      action: 'Revoke active rover lease tokens and cancel queued test matrix jobs.',
      targetComponent: 'tackle.role_leases'
    });
  } else {
    mitigationRecommendations.push({
      priority: 'medium',
      title: 'Backpressure Throttling & Priority Queueing',
      action: 'Increase prefetch buffer window to absorb upstream jitter without dropping packets.',
      targetComponent: 'nats.jetstream'
    });
  }

  return {
    rootEventId: rootId,
    rootEventType: rootType,
    rootSource,
    rootStage,
    scenario,
    totalDownstreamEvents: totalDownstream,
    directChildrenCount,
    maxPropagationDepth,
    affectedSystemsCount: systemSummaries.length,
    riskScore,
    riskTier,
    estimatedCumulativeDelayMs,
    estimatedRecoveryTimeMin,
    blockedPipelinesCount,
    atRiskSubscribersCount,
    financialOrComputeImpactEstimate,
    affectedNodeIds,
    affectedEdgeKeys,
    dependentsByDepth,
    allDependents: dependents,
    stageDistribution,
    systemSummaries,
    mitigationRecommendations
  };
}
