import { 
  EventEnvelope, 
  AssessmentResolution, 
  Subscriber, 
  LifecycleStage,
  SystemFamily,
  SystemFamilyInfo,
  CascadeAnalytics,
  LineageGraphResponse,
  LineageChainItem,
  ReducedChildEvent,
  EventHealthInfo,
  EventSeverityLevel,
  EventOriginTier,
  EventVisualStatus,
  EventStatusBadgeInfo
} from '../types';

// Helper to generate UUIDs
export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * 12 Canonical System Families + 1 Core Lifecycle Metadata Catalog
 */
export const SYSTEM_FAMILIES_INFO: Record<SystemFamily, SystemFamilyInfo> = {
  lifecycle: {
    id: 'lifecycle',
    name: 'Pipeline Lifecycle',
    domain: 'lifecycle',
    natsSubjectPrefix: 'nexus.cascade.v1.*',
    description: 'End-to-end autonomous pipeline progression (Harvest -> Candidate -> Assessment -> Requirement -> Plan -> Harness -> Deploy).',
    tableOrChannel: 'cascade.events',
    badgeClass: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
    borderClass: 'border-indigo-500',
    textClass: 'text-indigo-400',
    dotClass: 'bg-indigo-400'
  },
  scheduler: {
    id: 'scheduler',
    name: 'Agent Scheduler',
    domain: 'tackle',
    natsSubjectPrefix: 'nexus.tackle.v1.scheduler.*',
    description: 'Agent scheduling ticks, due entries, task execution launches, cron evaluations, and interactive skips.',
    tableOrChannel: 'tackle.agent_scheduler',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    borderClass: 'border-amber-500',
    textClass: 'text-amber-400',
    dotClass: 'bg-amber-400'
  },
  timeclock: {
    id: 'timeclock',
    name: 'Agent Timeclock',
    domain: 'timeclock',
    natsSubjectPrefix: 'nexus.timeclock.v1.*',
    description: 'Agent session clock-in / clock-out compliance, session timeouts, and R13 governance audit records.',
    tableOrChannel: 'tackle.agent_timeclock',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    borderClass: 'border-emerald-500',
    textClass: 'text-emerald-400',
    dotClass: 'bg-emerald-400'
  },
  nebula: {
    id: 'nebula',
    name: 'Nebula Agent Records',
    domain: 'nebula',
    natsSubjectPrefix: 'nexus.nebula.v1.agent_record.*',
    description: 'Cross-role agent records, architectural notes, inspections, analyses, and push signal notifications.',
    tableOrChannel: 'nebula.agent_records',
    badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    borderClass: 'border-purple-500',
    textClass: 'text-purple-400',
    dotClass: 'bg-purple-400'
  },
  harness: {
    id: 'harness',
    name: 'Harness Runtime',
    domain: 'harness',
    natsSubjectPrefix: 'nexus.harness.v1.run.*',
    description: 'Autonomous worker process spawning, INTERACTIVE guards, execution receipts, and watchdog kills.',
    tableOrChannel: 'harness-srv',
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    borderClass: 'border-rose-500',
    textClass: 'text-rose-400',
    dotClass: 'bg-rose-400'
  },
  lease: {
    id: 'lease',
    name: 'Role Leases & Accounting',
    domain: 'tackle',
    natsSubjectPrefix: 'nexus.tackle.v1.lease.*',
    description: 'Role lease dispenser, unit consumption accounting, budget exhaustion stops, and stale sweeps.',
    tableOrChannel: 'tackle.role_leases',
    badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    borderClass: 'border-cyan-500',
    textClass: 'text-cyan-400',
    dotClass: 'bg-cyan-400'
  },
  registry: {
    id: 'registry',
    name: 'Registry & Broker',
    domain: 'registry',
    natsSubjectPrefix: 'nexus.registry.v1.service.*',
    description: 'Service registry status changes, health check failures, threshold crossings, and broker outcomes.',
    tableOrChannel: 'registry.status_events',
    badgeClass: 'bg-blue-500/20 text-blue-300 border-blue-500/40',
    borderClass: 'border-blue-500',
    textClass: 'text-blue-400',
    dotClass: 'bg-blue-400'
  },
  voyager: {
    id: 'voyager',
    name: 'Voyager Filesystem',
    domain: 'fs',
    natsSubjectPrefix: 'nexus.fs.v1.*',
    description: 'Filesystem observation epochs, entity fingerprint drifts, topology signals, and semantic assets.',
    tableOrChannel: 'voyager.file_observation',
    badgeClass: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    borderClass: 'border-teal-500',
    textClass: 'text-teal-400',
    dotClass: 'bg-teal-400'
  },
  execution: {
    id: 'execution',
    name: 'Execution Drift',
    domain: 'execution',
    natsSubjectPrefix: 'nexus.execution.v1.drift.*',
    description: 'Execution-srv consistency sweeps: unreleased leases, orphan attempts, receipt mismatches, and DB guards.',
    tableOrChannel: 'execution-srv',
    badgeClass: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    borderClass: 'border-yellow-500',
    textClass: 'text-yellow-400',
    dotClass: 'bg-yellow-400'
  },
  circuit: {
    id: 'circuit',
    name: 'Circuit Breaker',
    domain: 'conduit',
    natsSubjectPrefix: 'nexus.conduit.v1.circuit.*',
    description: 'Conduit & PEB role circuit breaker trips, resets, pause/resumes, and automatic work requeueing.',
    tableOrChannel: 'conduit.circuit_breaker',
    badgeClass: 'bg-orange-500/20 text-orange-300 border-orange-500/40',
    borderClass: 'border-orange-500',
    textClass: 'text-orange-400',
    dotClass: 'bg-orange-400'
  },
  substance: {
    id: 'substance',
    name: 'Substance Segments',
    domain: 'substance',
    natsSubjectPrefix: 'nexus.substance.v1.segment.*',
    description: 'Nebula segment set creations, member expirations, and temporal segment history sweeps.',
    tableOrChannel: 'nebula.segments_history',
    badgeClass: 'bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/40',
    borderClass: 'border-fuchsia-500',
    textClass: 'text-fuchsia-400',
    dotClass: 'bg-fuchsia-400'
  },
  mcp: {
    id: 'mcp',
    name: 'MCP Tool Servers',
    domain: 'mcp',
    natsSubjectPrefix: 'nexus.mcp.v1.*',
    description: 'MCP tool server lifecycles, JSON-RPC call outcomes, DSL argument errors, timeouts, and aggregators.',
    tableOrChannel: 'mcp-servers',
    badgeClass: 'bg-violet-500/20 text-violet-300 border-violet-500/40',
    borderClass: 'border-violet-500',
    textClass: 'text-violet-400',
    dotClass: 'bg-violet-400'
  },
  wrp: {
    id: 'wrp',
    name: 'WRP Core Kernel',
    domain: 'wrp',
    natsSubjectPrefix: 'nexus.wrp.v1.*',
    description: 'WRP intent normalization, identity derivation, state DAG mutations, invariant violations, and arbitration.',
    tableOrChannel: 'nexus_core.wrp',
    badgeClass: 'bg-pink-500/20 text-pink-300 border-pink-500/40',
    borderClass: 'border-pink-500',
    textClass: 'text-pink-400',
    dotClass: 'bg-pink-400'
  }
};

/**
 * Determine System Family from Event Type
 */
export function getSystemFamily(eventType: string): SystemFamily {
  const t = eventType.toLowerCase();
  if (t.startsWith('scheduler.')) return 'scheduler';
  if (t.startsWith('timeclock.')) return 'timeclock';
  if (t.startsWith('nebula.') || t.startsWith('agent_record.')) return 'nebula';
  if (t.startsWith('harness.') || t.startsWith('admission.')) return 'harness';
  if (t.startsWith('lease.')) return 'lease';
  if (t.startsWith('registry.') || t.startsWith('service_broker.')) return 'registry';
  if (t.startsWith('voyager.') || t.startsWith('fs.')) return 'voyager';
  if (t.startsWith('execution.')) return 'execution';
  if (t.startsWith('circuit_breaker.') || t.startsWith('conduit.') || t.startsWith('work.requeued')) return 'circuit';
  if (t.startsWith('substance.')) return 'substance';
  if (t.startsWith('mcp.')) return 'mcp';
  if (t.startsWith('wrp.')) return 'wrp';
  return 'lifecycle';
}

/**
 * Determine Canonical NATS Subject from Event Type
 */
export function getNatsSubject(eventType: string): string {
  const family = getSystemFamily(eventType);
  switch (family) {
    case 'scheduler':
      return `nexus.tackle.v1.scheduler.${eventType.replace('scheduler.', '')}`;
    case 'timeclock':
      return `nexus.timeclock.v1.${eventType.replace('timeclock.', '')}`;
    case 'nebula':
      return `nexus.nebula.v1.agent_record.${eventType.replace('nebula.', '')}`;
    case 'harness':
      return `nexus.harness.v1.run.${eventType.replace('harness.', '')}`;
    case 'lease':
      return `nexus.tackle.v1.lease.${eventType.replace('lease.', '')}`;
    case 'registry':
      return `nexus.registry.v1.service.${eventType.replace('registry.', '').replace('service_broker.', '')}`;
    case 'voyager':
      return `nexus.fs.v1.${eventType.replace('voyager.', '')}`;
    case 'execution':
      return `nexus.execution.v1.drift.${eventType.replace('execution.', '')}`;
    case 'circuit':
      return `nexus.conduit.v1.circuit.${eventType.replace('circuit_breaker.', '').replace('conduit.', '')}`;
    case 'substance':
      return `nexus.substance.v1.segment.${eventType.replace('substance.', '')}`;
    case 'mcp':
      return `nexus.mcp.v1.${eventType.replace('mcp.', '')}`;
    case 'wrp':
      return `nexus.wrp.v1.${eventType.replace('wrp.', '')}`;
    case 'lifecycle':
    default:
      return `nexus.cascade.v1.${eventType}`;
  }
}

export function mapEventTypeToStage(eventType: string): LifecycleStage {
  if (eventType.startsWith('harvest.')) return 'harvest';
  if (eventType.startsWith('candidate.')) return 'candidate';
  if (eventType.startsWith('evaluation.') || eventType.startsWith('ripple.')) return 'assessment';
  if (eventType.startsWith('intent_record.') || eventType.startsWith('question.') || eventType.startsWith('agenda.')) return 'requirement';
  if (eventType.startsWith('requirement.') || eventType.startsWith('plan.')) return 'planning';
  if (eventType.startsWith('harness.') || eventType.startsWith('admission.')) return 'harness';
  if (eventType.startsWith('wind.') || eventType.startsWith('deploy.') || eventType.startsWith('release.')) return 'deployment';
  
  const family = getSystemFamily(eventType);
  switch (family) {
    case 'scheduler': return 'scheduler';
    case 'timeclock': return 'timeclock';
    case 'nebula': return 'nebula';
    case 'lease': return 'lease';
    case 'registry': return 'registry';
    case 'voyager': return 'voyager';
    case 'execution': return 'execution';
    case 'circuit': return 'circuit';
    case 'substance': return 'substance';
    case 'mcp': return 'mcp';
    case 'wrp': return 'wrp';
    default: return 'candidate';
  }
}

/**
 * Determine event processing health status: Green (Success), Yellow (Warning/Degraded/Pending), Red (Failed/Error/Rejected)
 */
export function getEventHealthInfo(event: EventEnvelope): EventHealthInfo {
  const p = event.payload || {};
  const eventType = (event.event_type || '').toLowerCase();
  const statusStr = String(p.status || '').toUpperCase();
  const outcomeStr = String(p.outcome || '').toLowerCase();
  const healthVerif = String(p.health_verification || '').toUpperCase();
  const errorMsg = p.error || p.error_message || p.failure_reason;

  // 1. Red Check: Failed / Error / Rejected / Test Failures
  if (
    p.health_status === 'failed' ||
    eventType.endsWith('.failed') ||
    eventType.endsWith('.error') ||
    eventType.includes('rejected') ||
    statusStr === 'FAILED' ||
    statusStr === 'ERROR' ||
    statusStr === 'REJECTED' ||
    healthVerif === 'FAILED' ||
    outcomeStr === 'rejected' ||
    Boolean(errorMsg) ||
    (typeof p.tests_failed === 'number' && p.tests_failed > 0)
  ) {
    const reason = errorMsg || 
      (p.tests_failed > 0 ? `${p.tests_failed} sandbox tests failed` : '') ||
      (outcomeStr === 'rejected' ? 'Candidate rejected during review' : '') ||
      (healthVerif === 'FAILED' ? 'Canary health verification failed' : 'Event processing encountered errors');

    return {
      status: 'failed',
      label: outcomeStr === 'rejected' ? 'Rejected' : (statusStr || 'Failed'),
      badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25',
      dotClass: 'bg-rose-400',
      glowClass: 'shadow-[0_0_8px_rgba(244,63,94,0.6)]',
      reason
    };
  }

  // 2. Yellow Check: Warning / Degraded / Escalated / Pending / Needs Clarification
  if (
    p.health_status === 'warning' ||
    statusStr === 'WARNING' ||
    statusStr === 'DEGRADED' ||
    statusStr === 'PENDING' ||
    statusStr === 'IN_PROGRESS' ||
    healthVerif === 'DEGRADED' ||
    outcomeStr === 'escalated' ||
    outcomeStr === 'needs_clarification' ||
    eventType.includes('question.') ||
    eventType.endsWith('.started') ||
    (p.risk_level === 'High' && eventType.includes('candidate')) ||
    (typeof p.latency_ms === 'number' && p.latency_ms > 45)
  ) {
    const reason = (outcomeStr === 'escalated' ? 'Escalated to human architect' : '') ||
      (outcomeStr === 'needs_clarification' ? 'Requires clarifying requirements' : '') ||
      (statusStr === 'DEGRADED' || healthVerif === 'DEGRADED' ? 'Subsystem operating in degraded mode' : '') ||
      (eventType.endsWith('.started') ? 'Async operation in progress' : '') ||
      (p.risk_level === 'High' ? 'High risk flagged during triage' : 'Review recommended or pending completion');

    return {
      status: 'warning',
      label: outcomeStr === 'escalated' ? 'Escalated' : outcomeStr === 'needs_clarification' ? 'Clarify' : (statusStr === 'DEGRADED' ? 'Degraded' : 'Warning'),
      badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25',
      dotClass: 'bg-amber-400',
      glowClass: 'shadow-[0_0_8px_rgba(251,191,36,0.6)]',
      reason
    };
  }

  // 3. Green Check: Clean Success / Healthy / Verified
  return {
    status: 'success',
    label: outcomeStr === 'greenlit' ? 'Greenlit' : (statusStr === 'SUCCESS' || statusStr === 'DEPLOYED_SUCCESS' ? 'Success' : 'Healthy'),
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25',
    dotClass: 'bg-emerald-400',
    glowClass: 'shadow-[0_0_8px_rgba(52,211,153,0.6)]',
    reason: p.tests_passed ? `All ${p.tests_passed} tests passed cleanly` : 'Processed successfully without defects'
  };
}

/**
 * Determine scannable visual status badge: 'Success', 'Pending', 'Failure', or 'Warning'
 * based on the event's comprehensive envelope and payload metadata.
 */
export function getEventStatusBadge(event: EventEnvelope): EventStatusBadgeInfo {
  const p = event.payload || {};
  const eventType = (event.event_type || '').toLowerCase();
  const statusStr = String(p.status || '').toUpperCase();
  const outcomeStr = String(p.outcome || '').toLowerCase();
  const healthVerif = String(p.health_verification || '').toUpperCase();
  const execStatus = String(p.execution_status || p.state || p.build_status || '').toUpperCase();
  const errorMsg = p.error || p.error_message || p.failure_reason;
  const reviewFlagStatus = event.review_flag?.status;

  // 1. Failure Check: Failed, Error, Rejected, Cancelled, Aborted, or Test Failures
  if (
    p.health_status === 'failed' ||
    statusStr === 'FAILED' ||
    statusStr === 'ERROR' ||
    statusStr === 'REJECTED' ||
    statusStr === 'CANCELLED' ||
    statusStr === 'ABORTED' ||
    statusStr === 'VETOED' ||
    execStatus === 'FAILED' ||
    execStatus === 'ERROR' ||
    healthVerif === 'FAILED' ||
    outcomeStr === 'rejected' ||
    outcomeStr === 'veto' ||
    Boolean(errorMsg) ||
    (typeof p.tests_failed === 'number' && p.tests_failed > 0) ||
    eventType.endsWith('.failed') ||
    eventType.endsWith('.error') ||
    eventType.includes('rejected') ||
    eventType.includes('veto') ||
    eventType.endsWith('.drift') ||
    eventType.includes('circuit_breaker.tripped') ||
    eventType.includes('circuit.tripped')
  ) {
    let sublabel = 'Failed';
    let reason = errorMsg || 'Event processing encountered failure';

    if (typeof p.tests_failed === 'number' && p.tests_failed > 0) {
      sublabel = `${p.tests_failed} test${p.tests_failed > 1 ? 's' : ''} failed`;
      reason = `${p.tests_failed} sandbox validation tests failed`;
    } else if (outcomeStr === 'rejected' || statusStr === 'REJECTED') {
      sublabel = 'Rejected';
      reason = p.rejection_reason || 'Candidate rejected during evaluation';
    } else if (eventType.includes('drift')) {
      sublabel = 'Drift Detected';
      reason = 'Execution drift detected against expected baseline';
    } else if (eventType.includes('tripped')) {
      sublabel = 'Circuit Tripped';
      reason = 'Circuit breaker tripped due to error spike';
    } else if (errorMsg) {
      sublabel = typeof errorMsg === 'string' && errorMsg.length < 24 ? errorMsg : 'Error';
      reason = String(errorMsg);
    } else if (healthVerif === 'FAILED') {
      sublabel = 'Health Failed';
      reason = 'Canary health verification failed';
    }

    return {
      status: 'Failure',
      label: 'Failure',
      sublabel,
      badgeClass: 'bg-rose-500/15 text-rose-300 border-rose-500/30 hover:bg-rose-500/25',
      dotClass: 'bg-rose-400',
      glowClass: 'shadow-[0_0_8px_rgba(244,63,94,0.4)]',
      reason,
      metadataKey: errorMsg ? 'error' : p.tests_failed ? 'tests_failed' : 'status',
      metadataValue: errorMsg || p.tests_failed || statusStr || 'FAILED'
    };
  }

  // 2. Pending Check: In-flight, Queued, In Progress, Review Needed, Clarifying
  if (
    statusStr === 'PENDING' ||
    statusStr === 'IN_PROGRESS' ||
    statusStr === 'RUNNING' ||
    statusStr === 'QUEUED' ||
    statusStr === 'SCHEDULED' ||
    statusStr === 'AWAITING' ||
    statusStr === 'WAITING' ||
    execStatus === 'PENDING' ||
    execStatus === 'IN_PROGRESS' ||
    execStatus === 'RUNNING' ||
    execStatus === 'QUEUED' ||
    outcomeStr === 'needs_clarification' ||
    outcomeStr === 'escalated' ||
    reviewFlagStatus === 'pending' ||
    reviewFlagStatus === 'in_review' ||
    eventType.endsWith('.started') ||
    eventType.endsWith('.pending') ||
    eventType.endsWith('.queued') ||
    eventType.endsWith('.requested') ||
    eventType.endsWith('.waiting') ||
    eventType.includes('question.')
  ) {
    let sublabel = 'Pending';
    let reason = 'Asynchronous lifecycle task is pending or currently in progress';

    if (statusStr === 'IN_PROGRESS' || execStatus === 'IN_PROGRESS' || eventType.endsWith('.started')) {
      sublabel = 'In Progress';
      reason = 'Task is actively executing in autonomous worker';
    } else if (statusStr === 'RUNNING' || execStatus === 'RUNNING') {
      sublabel = 'Running';
      reason = 'Daemon process or worker is running';
    } else if (statusStr === 'QUEUED' || execStatus === 'QUEUED' || eventType.endsWith('.queued')) {
      sublabel = 'Queued';
      reason = 'Task queued in execution stream';
    } else if (outcomeStr === 'needs_clarification') {
      sublabel = 'Clarifying';
      reason = 'Awaiting human architectural clarification';
    } else if (outcomeStr === 'escalated') {
      sublabel = 'Escalated';
      reason = 'Escalated for senior review';
    } else if (reviewFlagStatus === 'in_review') {
      sublabel = 'In Review';
      reason = 'Audit review currently in progress';
    }

    return {
      status: 'Pending',
      label: 'Pending',
      sublabel,
      badgeClass: 'bg-amber-500/15 text-amber-300 border-amber-500/30 hover:bg-amber-500/25',
      dotClass: 'bg-amber-400 animate-pulse',
      glowClass: 'shadow-[0_0_8px_rgba(245,158,11,0.4)]',
      reason,
      metadataKey: p.status ? 'status' : outcomeStr ? 'outcome' : 'event_type',
      metadataValue: p.status || p.outcome || eventType
    };
  }

  // 3. Warning Check: Degraded subsystems or warning indicators
  if (
    p.health_status === 'warning' ||
    statusStr === 'WARNING' ||
    statusStr === 'DEGRADED' ||
    healthVerif === 'DEGRADED' ||
    (typeof p.latency_ms === 'number' && p.latency_ms > 45) ||
    (p.risk_level === 'High' && eventType.includes('candidate'))
  ) {
    let sublabel = 'Degraded';
    let reason = 'Subsystem operating under warning or degraded threshold';

    if (p.risk_level === 'High') {
      sublabel = 'High Risk';
      reason = 'High architectural risk tagged on candidate';
    } else if (typeof p.latency_ms === 'number' && p.latency_ms > 45) {
      sublabel = `${p.latency_ms}ms Latency`;
      reason = `Latency elevated (${p.latency_ms}ms threshold breached)`;
    } else if (statusStr === 'DEGRADED' || healthVerif === 'DEGRADED') {
      sublabel = 'Degraded';
      reason = 'Subsystem operating in fallback degraded mode';
    }

    return {
      status: 'Warning',
      label: 'Warning',
      sublabel,
      badgeClass: 'bg-yellow-500/15 text-yellow-300 border-yellow-500/30 hover:bg-yellow-500/25',
      dotClass: 'bg-yellow-400',
      glowClass: 'shadow-[0_0_8px_rgba(234,179,8,0.4)]',
      reason,
      metadataKey: p.status ? 'status' : 'health_status',
      metadataValue: p.status || p.health_status || 'warning'
    };
  }

  // 4. Success Check: Clean Success, Completed, Passed, Verified, Healthy
  let sublabel = 'Success';
  let reason = 'Event emitted and verified cleanly without errors';

  if (typeof p.tests_passed === 'number' && p.tests_passed > 0) {
    sublabel = `${p.tests_passed} passed`;
    reason = `All ${p.tests_passed} tests completed cleanly`;
  } else if (statusStr === 'DEPLOYED_SUCCESS' || eventType.includes('deployment') || eventType.includes('wind.ticket.completed')) {
    sublabel = 'Deployed';
    reason = 'Artifact deployed and canary health verified';
  } else if (statusStr === 'SUCCESS' || statusStr === 'COMPLETED' || eventType.endsWith('.completed')) {
    sublabel = 'Completed';
    reason = 'Lifecycle step completed successfully';
  } else if (outcomeStr === 'greenlit') {
    sublabel = 'Greenlit';
    reason = 'Candidate greenlit with high confidence score';
  } else if (statusStr === 'promoted_to_requirement' || eventType.endsWith('.promoted')) {
    sublabel = 'Promoted';
    reason = 'Promoted to formalized engineering requirement';
  } else if (healthVerif === 'PASSED') {
    sublabel = 'Verified';
    reason = 'System integrity and health verification passed';
  } else if (eventType.endsWith('.captured')) {
    sublabel = 'Captured';
    reason = 'Transcript harvested and ingested';
  } else if (eventType.endsWith('.discovered')) {
    sublabel = 'Discovered';
    reason = 'Candidate problem statement extracted';
  } else if (eventType.endsWith('.created')) {
    sublabel = 'Created';
    reason = 'Record compiled and committed to state store';
  } else if (eventType.endsWith('.scored')) {
    sublabel = 'Scored';
    reason = 'Evaluation dimension worker scored candidate';
  }

  return {
    status: 'Success',
    label: 'Success',
    sublabel,
    badgeClass: 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30 hover:bg-emerald-500/25',
    dotClass: 'bg-emerald-400',
    glowClass: 'shadow-[0_0_8px_rgba(52,211,153,0.4)]',
    reason,
    metadataKey: p.status ? 'status' : p.tests_passed ? 'tests_passed' : 'outcome',
    metadataValue: p.status || p.tests_passed || outcomeStr || 'SUCCESS'
  };
}

export interface EventSeverityInfo {
  level: EventSeverityLevel;
  label: string;
  badgeClass: string;
  dotClass: string;
  textClass: string;
  glowClass: string;
}

/**
 * Determine granular event severity level: CRITICAL, ERROR, WARNING, INFO, DEBUG
 */
export function getEventSeverity(event: EventEnvelope): EventSeverityInfo {
  const p = event.payload || {};
  const eventType = (event.event_type || '').toLowerCase();
  const statusStr = String(p.status || '').toUpperCase();
  const outcomeStr = String(p.outcome || '').toLowerCase();
  const errorMsg = p.error || p.error_message || p.failure_reason;

  // 1. Critical: Circuit breaker tripped, unreleased leases, schema violations, fatal test runs
  if (
    eventType.includes('circuit_breaker.tripped') ||
    eventType.includes('fatal') ||
    eventType.includes('panic') ||
    (typeof p.tests_failed === 'number' && p.tests_failed > 3) ||
    statusStr === 'CRITICAL' ||
    (p.risk_level === 'Critical')
  ) {
    return {
      level: 'critical',
      label: 'CRITICAL',
      badgeClass: 'bg-red-500/20 text-red-300 border-red-500/50 shadow-[0_0_12px_rgba(239,68,68,0.3)]',
      dotClass: 'bg-red-400 animate-ping',
      textClass: 'text-red-400',
      glowClass: 'shadow-[0_0_10px_rgba(239,68,68,0.7)]'
    };
  }

  // 2. Error: General failed operations, rejected candidate, test failures, schema mismatch
  if (
    p.health_status === 'failed' ||
    eventType.endsWith('.failed') ||
    eventType.endsWith('.error') ||
    eventType.includes('rejected') ||
    eventType.includes('arguments_invalid') ||
    statusStr === 'FAILED' ||
    statusStr === 'ERROR' ||
    statusStr === 'REJECTED' ||
    outcomeStr === 'rejected' ||
    Boolean(errorMsg) ||
    (typeof p.tests_failed === 'number' && p.tests_failed > 0)
  ) {
    return {
      level: 'error',
      label: 'ERROR',
      badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      dotClass: 'bg-rose-400',
      textClass: 'text-rose-400',
      glowClass: 'shadow-[0_0_8px_rgba(244,63,94,0.6)]'
    };
  }

  // 3. Warning: Drift detected, lease exhausted, clock skew, degraded thresholds, escalated reviews
  if (
    p.health_status === 'warning' ||
    eventType.includes('drift.detected') ||
    eventType.includes('lease.exhausted') ||
    eventType.includes('requeued') ||
    eventType.includes('mismatch') ||
    statusStr === 'WARNING' ||
    statusStr === 'DEGRADED' ||
    outcomeStr === 'escalated' ||
    outcomeStr === 'needs_clarification' ||
    (typeof p.latency_ms === 'number' && p.latency_ms > 40)
  ) {
    return {
      level: 'warning',
      label: 'WARN',
      badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
      dotClass: 'bg-amber-400',
      textClass: 'text-amber-400',
      glowClass: 'shadow-[0_0_8px_rgba(245,158,11,0.6)]'
    };
  }

  // 4. Debug: Low-level file observation signals, heartbeat pings, cache notifications
  if (
    eventType.includes('topology.signal') ||
    eventType.includes('segment.expired') ||
    eventType.includes('status_changed') ||
    statusStr === 'DEBUG' ||
    eventType.includes('heartbeat')
  ) {
    return {
      level: 'debug',
      label: 'DEBUG',
      badgeClass: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
      dotClass: 'bg-slate-400',
      textClass: 'text-slate-400',
      glowClass: 'shadow-[0_0_6px_rgba(148,163,184,0.4)]'
    };
  }

  // 5. Info: Standard pipeline progressions, plan promotions, state mutations, successful deployments
  return {
    level: 'info',
    label: 'INFO',
    badgeClass: 'bg-blue-500/15 text-blue-300 border-blue-500/30',
    dotClass: 'bg-blue-400',
    textClass: 'text-blue-400',
    glowClass: 'shadow-[0_0_8px_rgba(59,130,246,0.5)]'
  };
}

export interface OriginTierInfo {
  tier: EventOriginTier;
  label: string;
  subsystem: string;
  description: string;
  badgeClass: string;
  borderClass: string;
  textClass: string;
}

export const ORIGIN_TIERS_INFO: Record<EventOriginTier, OriginTierInfo> = {
  all: {
    tier: 'all',
    label: 'All Origins',
    subsystem: 'Full Topology',
    description: 'All system origins across edge ingestion, worker runtimes, and core kernels.',
    badgeClass: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
    borderClass: 'border-slate-500',
    textClass: 'text-slate-400'
  },
  'rover-ingest': {
    tier: 'rover-ingest',
    label: 'Rover Audio & Ingest',
    subsystem: 'rover.* / audio-srv',
    description: 'Edge audio harvesters, audio transcripts, candidate planner, and requirement promoters.',
    badgeClass: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    borderClass: 'border-emerald-500',
    textClass: 'text-emerald-400'
  },
  'harness-devloop': {
    tier: 'harness-devloop',
    label: 'Dev Harness Loop',
    subsystem: 'harness-srv / runners',
    description: 'Autonomous worker execution sandboxes, container runners, and verification tests.',
    badgeClass: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    borderClass: 'border-rose-500',
    textClass: 'text-rose-400'
  },
  'nexus-kernel': {
    tier: 'nexus-kernel',
    label: 'Nexus Kernel & WRP',
    subsystem: 'nexus_core / conduit / tackle',
    description: 'WRP kernel arbitration, Conduit circuit breakers, role lease dispensers, and deployment wind.',
    badgeClass: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
    borderClass: 'border-cyan-500',
    textClass: 'text-cyan-400'
  },
  'nebula-cloud': {
    tier: 'nebula-cloud',
    label: 'Nebula & Storage',
    subsystem: 'nebula.* / substance.*',
    description: 'Cross-role agent records, architectural inspects, and segment state storage.',
    badgeClass: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
    borderClass: 'border-purple-500',
    textClass: 'text-purple-400'
  },
  'voyager-fs': {
    tier: 'voyager-fs',
    label: 'Voyager FS & Registry',
    subsystem: 'voyager.* / registry.*',
    description: 'Filesystem observation epochs, fingerprint drift detection, and service broker discovery.',
    badgeClass: 'bg-teal-500/20 text-teal-300 border-teal-500/40',
    borderClass: 'border-teal-500',
    textClass: 'text-teal-400'
  },
  'mcp-gateway': {
    tier: 'mcp-gateway',
    label: 'MCP Tool Gateway',
    subsystem: 'mcp.* / tool callers',
    description: 'Model Context Protocol tool calls, isolated runner dispatches, and vector indexers.',
    badgeClass: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    borderClass: 'border-amber-500',
    textClass: 'text-amber-400'
  },
  'execution-drift': {
    tier: 'execution-drift',
    label: 'Execution Drift Watcher',
    subsystem: 'execution-srv.*',
    description: 'Consistency sweeps, unreleased role lease sweeps, and orphan request reconcilers.',
    badgeClass: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40',
    borderClass: 'border-yellow-500',
    textClass: 'text-yellow-400'
  }
};

/**
 * Determine Origin Tier from source or event type
 */
export function getEventOrigin(event: EventEnvelope): OriginTierInfo {
  const src = (event.source || '').toLowerCase();
  const type = (event.event_type || '').toLowerCase();

  if (src.startsWith('rover.') || src.includes('audio') || type.startsWith('harvest.') || type.startsWith('candidate.')) {
    return ORIGIN_TIERS_INFO['rover-ingest'];
  }
  if (src.includes('harness') || src.includes('runner') || type.startsWith('harness.')) {
    return ORIGIN_TIERS_INFO['harness-devloop'];
  }
  if (src.includes('nexus') || src.includes('wrp') || src.includes('conduit') || src.includes('circuit') || src.includes('lease') || src.includes('tackle') || src.includes('wind') || type.startsWith('wrp.') || type.startsWith('circuit_breaker.') || type.startsWith('lease.')) {
    return ORIGIN_TIERS_INFO['nexus-kernel'];
  }
  if (src.includes('nebula') || src.includes('substance') || type.startsWith('nebula.') || type.startsWith('substance.')) {
    return ORIGIN_TIERS_INFO['nebula-cloud'];
  }
  if (src.includes('voyager') || src.includes('registry') || src.includes('consul') || type.startsWith('voyager.') || type.startsWith('registry.')) {
    return ORIGIN_TIERS_INFO['voyager-fs'];
  }
  if (src.includes('mcp') || type.startsWith('mcp.')) {
    return ORIGIN_TIERS_INFO['mcp-gateway'];
  }
  if (src.includes('execution') || type.startsWith('execution.')) {
    return ORIGIN_TIERS_INFO['execution-drift'];
  }

  return ORIGIN_TIERS_INFO['rover-ingest'];
}

/**
 * Extract / synthesize comprehensive metadata tags for an event
 */
export function getEventTags(event: EventEnvelope): string[] {
  const tagsSet = new Set<string>();

  // 1. Explicit tags from envelope or payload
  if (Array.isArray(event.tags)) {
    event.tags.forEach(t => tagsSet.add(t.startsWith('#') ? t : `#${t}`));
  }
  if (event.payload && Array.isArray(event.payload.tags)) {
    event.payload.tags.forEach((t: string) => tagsSet.add(t.startsWith('#') ? t : `#${t}`));
  }

  // 2. Inferred Domain & Pipeline Tags
  const type = event.event_type.toLowerCase();
  const payload = event.payload || {};

  if (type.startsWith('harvest.')) {
    tagsSet.add('#audio-stream');
    tagsSet.add('#harvest-v2');
  }
  if (type.startsWith('candidate.')) {
    tagsSet.add('#candidate-discovery');
    tagsSet.add('#sdlc-core');
  }
  if (type.startsWith('requirement.') || type.startsWith('plan.')) {
    tagsSet.add('#plan-compiler');
    tagsSet.add('#sdlc-core');
  }
  if (type.startsWith('harness.')) {
    tagsSet.add('#dev-harness');
    tagsSet.add('#autonomous-loop');
  }
  if (type.startsWith('wind.') || type.startsWith('deploy.')) {
    tagsSet.add('#production-deploy');
    tagsSet.add('#verified-release');
  }
  if (type.includes('circuit_breaker')) {
    tagsSet.add('#circuit-breaker');
    tagsSet.add('#conduit-sentinel');
  }
  if (type.includes('drift')) {
    tagsSet.add('#drift-alert');
    tagsSet.add('#reconciliation');
  }
  if (type.startsWith('mcp.')) {
    tagsSet.add('#mcp-tool');
    tagsSet.add('#agent-call');
  }
  if (type.startsWith('wrp.')) {
    tagsSet.add('#wrp-kernel');
    tagsSet.add('#state-mutation');
  }
  if (type.startsWith('nebula.')) {
    tagsSet.add('#agent-record');
    tagsSet.add('#nebula-cloud');
  }

  // 3. Operational & Health tags
  if (payload.latency_ms && payload.latency_ms > 35) {
    tagsSet.add('#high-latency');
  }
  if (payload.tests_failed && payload.tests_failed > 0) {
    tagsSet.add('#test-failure');
  }
  if (payload.role) {
    tagsSet.add(`#role:${payload.role}`);
  }
  if (event.review_flag) {
    tagsSet.add('#flagged-review');
    tagsSet.add(`#priority:${event.review_flag.priority}`);
  }

  return Array.from(tagsSet);
}

export function getStageColor(stage: LifecycleStage, theme: 'dark' | 'steel' | 'light' = 'dark') {
  switch (stage) {
    case 'harvest':
      return {
        bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        badge: 'bg-emerald-500/20 text-emerald-400',
        dot: 'bg-emerald-400',
        border: 'border-emerald-500',
        text: 'text-emerald-400',
        solid: '#10b981'
      };
    case 'candidate':
      return {
        bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
        badge: 'bg-cyan-500/20 text-cyan-400',
        dot: 'bg-cyan-400',
        border: 'border-cyan-500',
        text: 'text-cyan-400',
        solid: '#06b6d4'
      };
    case 'assessment':
      return {
        bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        badge: 'bg-amber-500/20 text-amber-400',
        dot: 'bg-amber-400',
        border: 'border-amber-500',
        text: 'text-amber-400',
        solid: '#f59e0b'
      };
    case 'requirement':
      return {
        bg: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
        badge: 'bg-indigo-500/20 text-indigo-400',
        dot: 'bg-indigo-400',
        border: 'border-indigo-500',
        text: 'text-indigo-400',
        solid: '#6366f1'
      };
    case 'planning':
      return {
        bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
        badge: 'bg-purple-500/20 text-purple-400',
        dot: 'bg-purple-400',
        border: 'border-purple-500',
        text: 'text-purple-400',
        solid: '#a855f7'
      };
    case 'harness':
      return {
        bg: 'bg-rose-500/10 text-rose-400 border-rose-500/30',
        badge: 'bg-rose-500/20 text-rose-400',
        dot: 'bg-rose-400',
        border: 'border-rose-500',
        text: 'text-rose-400',
        solid: '#f43f5e'
      };
    case 'deployment':
      return {
        bg: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
        badge: 'bg-teal-500/20 text-teal-400',
        dot: 'bg-teal-400',
        border: 'border-teal-500',
        text: 'text-teal-400',
        solid: '#14b8a6'
      };
    case 'scheduler':
      return {
        bg: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        badge: 'bg-amber-500/20 text-amber-400',
        dot: 'bg-amber-400',
        border: 'border-amber-500',
        text: 'text-amber-400',
        solid: '#f59e0b'
      };
    case 'timeclock':
      return {
        bg: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        badge: 'bg-emerald-500/20 text-emerald-400',
        dot: 'bg-emerald-400',
        border: 'border-emerald-500',
        text: 'text-emerald-400',
        solid: '#10b981'
      };
    case 'nebula':
      return {
        bg: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
        badge: 'bg-purple-500/20 text-purple-400',
        dot: 'bg-purple-400',
        border: 'border-purple-500',
        text: 'text-purple-400',
        solid: '#a855f7'
      };
    case 'lease':
      return {
        bg: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
        badge: 'bg-cyan-500/20 text-cyan-400',
        dot: 'bg-cyan-400',
        border: 'border-cyan-500',
        text: 'text-cyan-400',
        solid: '#06b6d4'
      };
    case 'registry':
      return {
        bg: 'bg-blue-500/10 text-blue-400 border-blue-500/30',
        badge: 'bg-blue-500/20 text-blue-400',
        dot: 'bg-blue-400',
        border: 'border-blue-500',
        text: 'text-blue-400',
        solid: '#3b82f6'
      };
    case 'voyager':
      return {
        bg: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
        badge: 'bg-teal-500/20 text-teal-400',
        dot: 'bg-teal-400',
        border: 'border-teal-500',
        text: 'text-teal-400',
        solid: '#14b8a6'
      };
    case 'execution':
      return {
        bg: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
        badge: 'bg-yellow-500/20 text-yellow-400',
        dot: 'bg-yellow-400',
        border: 'border-yellow-500',
        text: 'text-yellow-400',
        solid: '#eab308'
      };
    case 'circuit':
      return {
        bg: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
        badge: 'bg-orange-500/20 text-orange-400',
        dot: 'bg-orange-400',
        border: 'border-orange-500',
        text: 'text-orange-400',
        solid: '#f97316'
      };
    case 'substance':
      return {
        bg: 'bg-fuchsia-500/10 text-fuchsia-400 border-fuchsia-500/30',
        badge: 'bg-fuchsia-500/20 text-fuchsia-400',
        dot: 'bg-fuchsia-400',
        border: 'border-fuchsia-500',
        text: 'text-fuchsia-400',
        solid: '#d946ef'
      };
    case 'mcp':
      return {
        bg: 'bg-violet-500/10 text-violet-400 border-violet-500/30',
        badge: 'bg-violet-500/20 text-violet-400',
        dot: 'bg-violet-400',
        border: 'border-violet-500',
        text: 'text-violet-400',
        solid: '#8b5cf6'
      };
    case 'wrp':
      return {
        bg: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
        badge: 'bg-pink-500/20 text-pink-400',
        dot: 'bg-pink-400',
        border: 'border-pink-500',
        text: 'text-pink-400',
        solid: '#ec4899'
      };
  }
}

// Workflow blueprints to generate realistic interconnected chains
interface WorkflowSeed {
  title: string;
  sourceOrigin: string;
  category: string;
  harvestTranscript: string;
  candidateTitle: string;
  problemStatement: string;
  cpf: number;
  riskLevel: 'Low' | 'Medium' | 'High';
  targetComponent: string;
  planDescription: string;
  branchName: string;
  pullRequestTitle: string;
}

const WORKFLOW_SEEDS: WorkflowSeed[] = [
  {
    title: 'Streaming Latency Optimization & WebSocket Heartbeat',
    sourceOrigin: 'gong.customer_call_acme_corp',
    category: 'Infrastructure / Core Engine',
    harvestTranscript: 'Customer Acme Corp reported 350ms websocket stutter during peak real-time transcript streaming. We need zero-allocation ring buffers and keepalive pings.',
    candidateTitle: 'Refactor WebSocket streaming transport with ring buffers',
    problemStatement: 'High garbage collector pressure causes intermittent 300ms+ audio frame drops during multi-speaker transcription.',
    cpf: 0.94,
    riskLevel: 'Medium',
    targetComponent: 'stream-gateway/v2',
    planDescription: 'Implement non-blocking circular audio buffer with adaptive backpressure and NATS JetStream offset tracking.',
    branchName: 'feat/stream-ring-buffers-keepalive',
    pullRequestTitle: 'perf(stream-srv): Zero-copy ring buffer + heartbeat protocol v2'
  },
  {
    title: 'Automated Candidate Deduplication & Semantic Clustering',
    sourceOrigin: 'slack_huddle.product_triage_eng',
    category: 'Ingestion Pipeline',
    harvestTranscript: 'Rover is discovering 14 redundant candidates for the same backend issue across different customer interviews. We need vector embedding cosine dedup prior to planner evaluation.',
    candidateTitle: 'Integrate semantic similarity pre-filter in candidate discoverer',
    problemStatement: 'Multiple harvests produce duplicate candidates with slightly different phrasing, overloading human and agent review quotas.',
    cpf: 0.88,
    riskLevel: 'Low',
    targetComponent: 'rover.batch_file_candidates',
    planDescription: 'Add Gemini text-embedding-004 cosine similarity check with 0.87 threshold before persisting candidate.discovered envelopes.',
    branchName: 'feat/candidate-semantic-dedup',
    pullRequestTitle: 'feat(rover): semantic candidate deduplication layer with pgvector'
  },
  {
    title: 'Enterprise SSO SAML 2.0 & Okta SCIM Provisioning',
    sourceOrigin: 'zoom.security_compliance_audit',
    category: 'Security & Auth',
    harvestTranscript: 'Enterprise tier customers cannot adopt without automated SCIM v2 user deprovisioning and SAML assertion encryption.',
    candidateTitle: 'Implement SAML 2.0 Identity Provider Bridge and SCIM v2 sync',
    problemStatement: 'Manual user onboarding blocks SOC2 Type II compliance audit for 3 Tier-1 enterprise deals.',
    cpf: 0.96,
    riskLevel: 'High',
    targetComponent: 'auth-service/saml',
    planDescription: 'Deliver IdP metadata parser, encrypted assertion decrypter, and SCIM endpoint /v2/Users with audit logging.',
    branchName: 'sec/saml-scim-enterprise',
    pullRequestTitle: 'feat(auth): SAML 2.0 SP implementation + SCIM 2.0 sync daemon'
  },
  {
    title: 'PostgreSQL Partitioning for Event Ledger Scale',
    sourceOrigin: 'zoom.database_infra_weekly',
    category: 'Database Architecture',
    harvestTranscript: 'Cascade events table is reaching 250M rows. Querying /cascade/analytics with 30d range causes sequential table scan latency spikes.',
    candidateTitle: 'Monthly range partitioning for cascade.events table',
    problemStatement: 'Unpartitioned pg table degrades index efficiency for timestamp range queries beyond 7 days.',
    cpf: 0.91,
    riskLevel: 'Medium',
    targetComponent: 'cascade-srv/storage',
    planDescription: 'Create declarative range partitioning on event_timestamp with automatic pg_partman partition generation.',
    branchName: 'db/cascade-events-partitioning',
    pullRequestTitle: 'perf(db): declarative monthly range partitioning for cascade.events'
  },
  {
    title: 'Multi-Modal Voice Sentiment & Acoustic Stress Detection',
    sourceOrigin: 'user_research.ux_interview_finance',
    category: 'AI Pipeline',
    harvestTranscript: 'User stated: When the trading terminal latency exceeds 1 sec, users speak louder and have higher pitch stress. We can detect urgency from raw audio waveforms.',
    candidateTitle: 'Extract acoustic prosody features in audio harvest pipeline',
    problemStatement: 'Text transcripts lose emotional urgency and speaker stress markers that indicate critical customer churn risk.',
    cpf: 0.79,
    riskLevel: 'Low',
    targetComponent: 'harvest-srv/audio-analyzer',
    planDescription: 'Integrate openSMILE pitch extraction into audio preprocessing worker and stamp acoustic_stress_score into candidate payload.',
    branchName: 'ml/acoustic-stress-classifier',
    pullRequestTitle: 'feat(harvest): acoustic prosody analysis & stress score estimation'
  },
  {
    title: 'Ephemeral Dev Harness Sandboxing with gVisor Containers',
    sourceOrigin: 'incident_retro.sec_sandbox_escape',
    category: 'Dev Harness & Sandbox',
    harvestTranscript: 'Synthetic code generation harness needs strict syscall isolation so agent-generated test suites cannot access host metadata endpoints.',
    candidateTitle: 'Enforce gVisor runsc sandbox for all harness worker test execution',
    problemStatement: 'Unsandboxed test runner executions risk privilege escalation and host resource starvation.',
    cpf: 0.95,
    riskLevel: 'High',
    targetComponent: 'harness-srv/runtime',
    planDescription: 'Wrap docker execution engine with gVisor runsc runtimeClass and enforce 128MB memory / 1 CPU hard cgroup limits.',
    branchName: 'harness/gvisor-sandbox-isolation',
    pullRequestTitle: 'sec(harness): gVisor runsc containment for autonomous agent runs'
  }
];

export function generateInitialLedger(): {
  events: EventEnvelope[];
  assessments: AssessmentResolution[];
  subscribers: Subscriber[];
} {
  const events: EventEnvelope[] = [];
  const assessments: AssessmentResolution[] = [];
  let seqCounter = 17500;

  const now = Date.now();

  // Generate complete end-to-end chains for each workflow seed
  WORKFLOW_SEEDS.forEach((seed, index) => {
    const correlationId = generateUUID();
    const harvestId = generateUUID();
    const candidateId = generateUUID();
    const reqId = generateUUID();
    const planId = generateUUID();
    const harnessJobId = generateUUID();
    const ticketId = generateUUID();

    // Stagger timestamps across past 48 hours
    const baseTime = now - (WORKFLOW_SEEDS.length - index) * 3600 * 1000 * 6;

    // 1. Harvest Event
    const harvestTimestamp = new Date(baseTime).toISOString();
    const harvestEventId = generateUUID();
    const harvestEvent: EventEnvelope = {
      event_id: harvestEventId,
      event_type: 'harvest.captured',
      source: 'rover.batch_harvest_to_db',
      event_timestamp: harvestTimestamp,
      payload: {
        harvest_id: harvestId,
        source_origin: seed.sourceOrigin,
        category: seed.category,
        title: seed.title,
        transcript_preview: seed.harvestTranscript,
        duration_seconds: 1420 + Math.floor(Math.random() * 800),
        speaker_count: 2 + Math.floor(Math.random() * 3),
        word_count: 3200 + Math.floor(Math.random() * 1500),
        audio_codec: 'opus_16khz',
        storage_uri: `gs://nexus-harvests/transcripts/${harvestId}.json`
      },
      aggregate_type: 'harvest',
      aggregate_id: harvestId,
      actor_type: 'agent',
      actor_id: 'rover.audio_harvester_v2',
      correlation_id: correlationId,
      causation_id: null,
      caused_by_event_type: null,
      sequence_number: String(++seqCounter),
      received_at: new Date(baseTime + 12).toISOString()
    };
    events.push(harvestEvent);

    // 2. Candidate Discovered Event
    const candTime = baseTime + 45000;
    const candEventId = generateUUID();
    const candEvent: EventEnvelope = {
      event_id: candEventId,
      event_type: 'candidate.discovered',
      source: 'rover.batch_file_candidates',
      event_timestamp: new Date(candTime).toISOString(),
      payload: {
        harvest_id: harvestId,
        candidate_id: candidateId,
        title: seed.candidateTitle,
        problem_statement: seed.problemStatement,
        cpf: seed.cpf,
        evidence_quote: `"...${seed.harvestTranscript.slice(0, 80)}..."`,
        suggested_priority: seed.cpf > 0.9 ? 'P0' : seed.cpf > 0.8 ? 'P1' : 'P2',
        risk_level: seed.riskLevel
      },
      aggregate_type: 'harvest_candidate',
      aggregate_id: candidateId,
      actor_type: 'agent',
      actor_id: 'rover.candidate_extractor',
      correlation_id: correlationId,
      causation_id: harvestEventId,
      caused_by_event_type: 'harvest.captured',
      sequence_number: String(++seqCounter),
      received_at: new Date(candTime + 15).toISOString()
    };
    events.push(candEvent);

    // 3. Evaluation Started
    const evalStartTime = candTime + 30000;
    const evalStartEventId = generateUUID();
    events.push({
      event_id: evalStartEventId,
      event_type: 'evaluation.started',
      source: 'rover.architect_process_todo',
      event_timestamp: new Date(evalStartTime).toISOString(),
      payload: {
        candidate_id: candidateId,
        evaluator_model: 'gemini-3.7-flash',
        dimensions: ['feasibility', 'business_value', 'technical_debt', 'security_risk', 'alignment'],
        target_component: seed.targetComponent
      },
      aggregate_type: 'harvest_candidate',
      aggregate_id: candidateId,
      actor_type: 'system',
      actor_id: 'cascade.evaluator_daemon',
      correlation_id: correlationId,
      causation_id: candEventId,
      caused_by_event_type: 'candidate.discovered',
      sequence_number: String(++seqCounter),
      received_at: new Date(evalStartTime + 20).toISOString()
    });

    // 3a. Parallel Sub-task A: Dimension Feasibility Scoring
    const subtaskFeasId = generateUUID();
    events.push({
      event_id: subtaskFeasId,
      event_type: 'evaluation.feasibility.scored',
      source: 'rover.dimension_worker_1',
      event_timestamp: new Date(evalStartTime + 15000).toISOString(),
      payload: {
        candidate_id: candidateId,
        subtask_name: 'Feasibility & ROI Estimation',
        parallel_track: 'Track-A: Feasibility Engine',
        score: 0.93,
        duration_ms: 1240,
        status: 'SUCCESS'
      },
      aggregate_type: 'harvest_candidate',
      aggregate_id: candidateId,
      actor_type: 'agent',
      actor_id: 'rover.feasibility_agent',
      correlation_id: correlationId,
      causation_id: evalStartEventId,
      caused_by_event_type: 'evaluation.started',
      sequence_number: String(++seqCounter),
      received_at: new Date(evalStartTime + 15020).toISOString()
    });

    // 3b. Parallel Sub-task B: Security & Vulnerability Scan
    const subtaskSecId = generateUUID();
    events.push({
      event_id: subtaskSecId,
      event_type: 'evaluation.security.audited',
      source: 'sec-scanner.v2',
      event_timestamp: new Date(evalStartTime + 22000).toISOString(),
      payload: {
        candidate_id: candidateId,
        subtask_name: 'Static Security & Threat Model Scan',
        parallel_track: 'Track-B: Security Scanner',
        risk_score: seed.riskLevel === 'High' ? 0.72 : 0.18,
        findings_count: seed.riskLevel === 'High' ? 2 : 0,
        status: seed.riskLevel === 'High' ? 'WARNING' : 'SUCCESS'
      },
      aggregate_type: 'harvest_candidate',
      aggregate_id: candidateId,
      actor_type: 'agent',
      actor_id: 'rover.security_sentinel',
      correlation_id: correlationId,
      causation_id: evalStartEventId,
      caused_by_event_type: 'evaluation.started',
      sequence_number: String(++seqCounter),
      received_at: new Date(evalStartTime + 22015).toISOString()
    });

    // 4. Candidate Assessed & Greenlit (Joins parallel evaluation subtasks)
    const assessTime = evalStartTime + 75000;
    const assessEventId = generateUUID();
    const assessEvent: EventEnvelope = {
      event_id: assessEventId,
      event_type: 'candidate.assessed',
      source: 'rover.planner',
      event_timestamp: new Date(assessTime).toISOString(),
      payload: {
        candidate_id: candidateId,
        cpf: seed.cpf,
        outcome: 'greenlit',
        confidence: 0.88 + (Math.random() * 0.1),
        rationale_summary: `Candidate meets strategic threshold (CPF: ${seed.cpf}). High alignment with ${seed.category}.`,
        feasibility_score: 0.92,
        business_value: 0.95,
        technical_debt_impact: seed.riskLevel === 'High' ? 0.45 : 0.85,
        joined_subtasks: [subtaskFeasId, subtaskSecId]
      },
      aggregate_type: 'harvest_candidate',
      aggregate_id: candidateId,
      actor_type: 'agent',
      actor_id: 'rover.planner',
      correlation_id: correlationId,
      causation_id: evalStartEventId,
      caused_by_event_type: 'evaluation.started',
      sequence_number: String(++seqCounter),
      received_at: new Date(assessTime + 22).toISOString()
    };
    events.push(assessEvent);

    // Create matching Assessment Resolution
    assessments.push({
      resolution_id: generateUUID(),
      event_id: assessEventId,
      outcome: 'greenlit',
      confidence: 0.91,
      rationale: {
        summary: `Strategic review confirmed high architectural ROI for ${seed.candidateTitle}.`,
        strengths: [
          'Direct customer revenue blocker addressed',
          'Well-isolated component boundary',
          'High testability via dev harness sandbox'
        ],
        risks: seed.riskLevel === 'High' ? ['Requires zero-downtime migration', 'Requires security sign-off'] : ['Minor regression test coverage expansion'],
        dependencies: [seed.targetComponent, 'nexus.kernel.v1'],
        estimated_complexity: seed.riskLevel === 'High' ? 'High' : 'Medium',
        target_component: seed.targetComponent,
        dimension_scores: {
          feasibility: 0.92,
          business_value: 0.96,
          technical_debt: 0.85,
          security_risk: 0.94,
          alignment: 0.98
        }
      },
      dimensions_used: 5,
      dimensions_total: 5,
      resolved_at: new Date(assessTime).toISOString(),
      event_type: 'candidate.assessed',
      source: 'rover.planner',
      payload: assessEvent.payload
    });

    // 5. Ripple Analysis & Intent Record Created
    const rippleTime = assessTime + 40000;
    const rippleEventId = generateUUID();
    events.push({
      event_id: rippleEventId,
      event_type: 'ripple.assessed',
      source: 'rover.planner',
      event_timestamp: new Date(rippleTime).toISOString(),
      payload: {
        candidate_id: candidateId,
        impact_radius: 'localized',
        affected_services: [seed.targetComponent, 'api-gateway', 'audit-logger'],
        schema_changes_required: seed.riskLevel === 'High',
        breaking_change: false
      },
      aggregate_type: 'requirement',
      aggregate_id: reqId,
      actor_type: 'agent',
      actor_id: 'rover.impact_analyzer',
      correlation_id: correlationId,
      causation_id: assessEventId,
      caused_by_event_type: 'candidate.assessed',
      sequence_number: String(++seqCounter),
      received_at: new Date(rippleTime + 18).toISOString()
    });

    const promoTime = rippleTime + 35000;
    const promoEventId = generateUUID();
    events.push({
      event_id: promoEventId,
      event_type: 'candidate.promoted',
      source: 'rover.candidate_promote',
      event_timestamp: new Date(promoTime).toISOString(),
      payload: {
        candidate_id: candidateId,
        requirement_id: reqId,
        status: 'promoted_to_requirement',
        title: seed.candidateTitle,
        assigned_squad: 'Core Platform Engineering',
        cpf: seed.cpf
      },
      aggregate_type: 'harvest_candidate',
      aggregate_id: candidateId,
      actor_type: 'agent',
      actor_id: 'rover.candidate_promote',
      correlation_id: correlationId,
      causation_id: rippleEventId,
      caused_by_event_type: 'ripple.assessed',
      sequence_number: String(++seqCounter),
      received_at: new Date(promoTime + 14).toISOString()
    });

    const intentTime = promoTime + 20000;
    const intentEventId = generateUUID();
    events.push({
      event_id: intentEventId,
      event_type: 'intent_record.created',
      source: 'rover.candidate_promote',
      event_timestamp: new Date(intentTime).toISOString(),
      payload: {
        requirement_id: reqId,
        intent_type: 'ARCHITECTURAL_ENHANCEMENT',
        statement: seed.planDescription,
        acceptance_criteria: [
          'End-to-end integration tests execute in < 2.5s',
          'Zero memory leakage under continuous 10k RPS load',
          'Telemetry metrics published to /cascade/analytics'
        ]
      },
      aggregate_type: 'intent_record',
      aggregate_id: generateUUID(),
      actor_type: 'agent',
      actor_id: 'rover.intent_compiler',
      correlation_id: correlationId,
      causation_id: promoEventId,
      caused_by_event_type: 'candidate.promoted',
      sequence_number: String(++seqCounter),
      received_at: new Date(intentTime + 24).toISOString()
    });

    // 6. Plan Promotion
    const planTime = intentTime + 60000;
    const planEventId = generateUUID();
    events.push({
      event_id: planEventId,
      event_type: 'requirement.promoted_to_plan',
      source: 'rover.req_compiler',
      event_timestamp: new Date(planTime).toISOString(),
      payload: {
        requirement_id: reqId,
        plan_id: planId,
        sprint_target: 'Sprint 2026.34',
        plan_title: `Implementation Plan: ${seed.candidateTitle}`,
        work_breakdown_items: 4,
        target_repo: 'nexus/core-services',
        branch_name: seed.branchName
      },
      aggregate_type: 'requirement',
      aggregate_id: reqId,
      actor_type: 'agent',
      actor_id: 'rover.req_compiler',
      correlation_id: correlationId,
      causation_id: intentEventId,
      caused_by_event_type: 'intent_record.created',
      sequence_number: String(++seqCounter),
      received_at: new Date(planTime + 30).toISOString()
    });

    // 7. Dev Harness Run
    const harnessStartTime = planTime + 90000;
    const harnessStartId = generateUUID();
    events.push({
      event_id: harnessStartId,
      event_type: 'harness.started',
      source: 'harness-srv.run-autonomous',
      event_timestamp: new Date(harnessStartTime).toISOString(),
      payload: {
        plan_id: planId,
        job_id: harnessJobId,
        runner_image: 'ghcr.io/nexus/harness-runner:v3.4.1',
        sandbox_type: 'gvisor_isolated',
        branch: seed.branchName,
        task_instruction: seed.planDescription
      },
      aggregate_type: 'harness_job',
      aggregate_id: harnessJobId,
      actor_type: 'system',
      actor_id: 'harness-srv',
      correlation_id: correlationId,
      causation_id: planEventId,
      caused_by_event_type: 'requirement.promoted_to_plan',
      sequence_number: String(++seqCounter),
      received_at: new Date(harnessStartTime + 10).toISOString()
    });

    // 7a. Parallel Sub-task: Autonomous Code Synthesis & Patch Generation
    const subtaskCodeGenId = generateUUID();
    events.push({
      event_id: subtaskCodeGenId,
      event_type: 'harness.codegen.synthesized',
      source: 'harness-srv.codegen_agent',
      event_timestamp: new Date(harnessStartTime + 45000).toISOString(),
      payload: {
        job_id: harnessJobId,
        subtask_name: 'Synthetic Code Synthesis',
        parallel_track: 'Track-1: LLM Code Generator',
        files_modified: 4,
        lines_added: 280 + Math.floor(Math.random() * 80),
        status: 'SUCCESS'
      },
      aggregate_type: 'harness_job',
      aggregate_id: harnessJobId,
      actor_type: 'agent',
      actor_id: 'harness-srv.codegen_agent_7',
      correlation_id: correlationId,
      causation_id: harnessStartId,
      caused_by_event_type: 'harness.started',
      sequence_number: String(++seqCounter),
      received_at: new Date(harnessStartTime + 45015).toISOString()
    });

    // 7b. Parallel Sub-task: Sandbox Test Suite Execution
    const subtaskTestRunId = generateUUID();
    events.push({
      event_id: subtaskTestRunId,
      event_type: 'harness.tests.executed',
      source: 'harness-srv.runner',
      event_timestamp: new Date(harnessStartTime + 95000).toISOString(),
      payload: {
        job_id: harnessJobId,
        subtask_name: 'Ephemeral Unit & Integration Matrix',
        parallel_track: 'Track-2: Test Matrix Runner',
        tests_passed: 42,
        tests_failed: 0,
        coverage_pct: 94.8,
        status: 'SUCCESS'
      },
      aggregate_type: 'harness_job',
      aggregate_id: harnessJobId,
      actor_type: 'system',
      actor_id: 'harness-srv.runner_pool_4',
      correlation_id: correlationId,
      causation_id: harnessStartId,
      caused_by_event_type: 'harness.started',
      sequence_number: String(++seqCounter),
      received_at: new Date(harnessStartTime + 95020).toISOString()
    });

    // 7c. Parallel Sub-task: gVisor Runtime Security & Cgroup Audit
    const subtaskIsoAuditId = generateUUID();
    events.push({
      event_id: subtaskIsoAuditId,
      event_type: 'harness.security.isolated',
      source: 'harness-srv.gvisor_guard',
      event_timestamp: new Date(harnessStartTime + 60000).toISOString(),
      payload: {
        job_id: harnessJobId,
        subtask_name: 'gVisor Syscall Isolation & Memory Ceiling',
        parallel_track: 'Track-3: Sandbox Guard',
        peak_memory_mb: 84,
        syscall_violations: 0,
        status: 'SUCCESS'
      },
      aggregate_type: 'harness_job',
      aggregate_id: harnessJobId,
      actor_type: 'system',
      actor_id: 'harness-srv.gvisor_guard',
      correlation_id: correlationId,
      causation_id: harnessStartId,
      caused_by_event_type: 'harness.started',
      sequence_number: String(++seqCounter),
      received_at: new Date(harnessStartTime + 60010).toISOString()
    });

    // 8. Harness Completed / Code Synthesized (Joins all parallel harness subtasks)
    const harnessEndTime = harnessStartTime + 180000;
    const harnessEndId = generateUUID();
    events.push({
      event_id: harnessEndId,
      event_type: 'harness.completed',
      source: 'harness-srv.run-autonomous',
      event_timestamp: new Date(harnessEndTime).toISOString(),
      payload: {
        job_id: harnessJobId,
        status: 'SUCCESS',
        duration_ms: 178420,
        tests_passed: 42,
        tests_failed: 0,
        coverage_delta: '+3.4%',
        code_diff_lines: { added: 312, deleted: 48 },
        pull_request_url: `https://github.com/nexus/core-services/pull/${100 + index}`,
        joined_subtasks: [subtaskCodeGenId, subtaskTestRunId, subtaskIsoAuditId]
      },
      aggregate_type: 'harness_job',
      aggregate_id: harnessJobId,
      actor_type: 'agent',
      actor_id: 'harness-srv.codegen_agent_7',
      correlation_id: correlationId,
      causation_id: harnessStartId,
      caused_by_event_type: 'harness.started',
      sequence_number: String(++seqCounter),
      received_at: new Date(harnessEndTime + 16).toISOString()
    });

    // 9. Deployment / Wind Ticket Completed
    const deployTime = harnessEndTime + 120000;
    events.push({
      event_id: generateUUID(),
      event_type: 'wind.ticket.completed',
      source: 'wind-srv',
      event_timestamp: new Date(deployTime).toISOString(),
      payload: {
        ticket_id: ticketId,
        pull_request_title: seed.pullRequestTitle,
        merge_commit: generateUUID().substring(0, 8),
        deployment_environment: 'staging-cluster-us-west',
        health_verification: 'PASSED',
        rollout_duration_sec: 45
      },
      aggregate_type: 'deployment',
      aggregate_id: ticketId,
      actor_type: 'system',
      actor_id: 'wind-srv.continuous_deployer',
      correlation_id: correlationId,
      causation_id: harnessEndId,
      caused_by_event_type: 'harness.completed',
      sequence_number: String(++seqCounter),
      received_at: new Date(deployTime + 12).toISOString()
    });
  });

  // Generate comprehensive initial events across all 12 System Families
  const systemFamilySeedPool: Array<{
    type: string;
    source: string;
    aggregate_type: string;
    actor_type: 'user' | 'agent' | 'system';
    actor_id: string;
    payload: Record<string, any>;
  }> = [
    // 1. Scheduler Family (tackle.agent_scheduler)
    {
      type: 'scheduler.entry.due',
      source: 'tackle.agent_scheduler',
      aggregate_type: 'scheduler_entry',
      actor_type: 'system',
      actor_id: 'tackle.cron_runner',
      payload: {
        entry: { id: 'sched-101', role: 'architect', task_slug: 'nightly_architecture_audit', schedule_type: 'cron', cron_expr: '0 2 * * *' },
        event_ids: [generateUUID(), generateUUID()],
        status: 'SUCCESS'
      }
    },
    {
      type: 'scheduler.agent.launched',
      source: 'tackle.agent_scheduler',
      aggregate_type: 'scheduler_entry',
      actor_type: 'system',
      actor_id: 'tackle.spawner',
      payload: {
        entry: { id: 'sched-102', role: 'coder', task_slug: 'synthesis_worker_pool' },
        pid: 48192,
        model_id: 'gemini-2.5-pro',
        harness: 'gvisor-sandbox-us-west',
        status: 'SUCCESS'
      }
    },
    {
      type: 'scheduler.agent.launch_failed',
      source: 'tackle.agent_scheduler',
      aggregate_type: 'scheduler_entry',
      actor_type: 'system',
      actor_id: 'tackle.spawner',
      payload: {
        entry: { id: 'sched-103', role: 'reviewer', task_slug: 'code_review_queue' },
        error: 'ResourceExhausted: Max concurrent gVisor containers (32/32) reached',
        exit_code: 137,
        status: 'FAILED'
      }
    },
    {
      type: 'scheduler.skip.interactive_hosted',
      source: 'tackle.agent_scheduler',
      aggregate_type: 'scheduler_entry',
      actor_type: 'system',
      actor_id: 'tackle.scheduler_guard',
      payload: {
        entry: { id: 'sched-104', role: 'interactive_shell', task_slug: 'user_live_session' },
        role: 'interactive_shell',
        reason: 'Skipped autonomous trigger: role is bound to an active interactive hosted UI user session',
        status: 'WARNING'
      }
    },
    {
      type: 'scheduler.skip.no_work',
      source: 'tackle.agent_scheduler',
      aggregate_type: 'scheduler_entry',
      actor_type: 'system',
      actor_id: 'tackle.scheduler_guard',
      payload: {
        entry: { id: 'sched-105', role: 'planner', task_slug: 'agenda_backlog_drain' },
        role: 'planner',
        backlog_count: 0,
        status: 'SUCCESS'
      }
    },
    {
      type: 'scheduler.cron.invalid',
      source: 'tackle.agent_scheduler',
      aggregate_type: 'scheduler_entry',
      actor_type: 'system',
      actor_id: 'tackle.cron_parser',
      payload: {
        entry: { id: 'sched-106', role: 'gardener', task_slug: 'cache_sweep' },
        cron_expr: '*/99 * * * *',
        error: 'InvalidCronExpression: Minute field out of bounds (99 > 59)',
        status: 'FAILED'
      }
    },

    // 2. Timeclock Family (tackle.agent_timeclock)
    {
      type: 'timeclock.clocked_in',
      source: 'tackle.agent_timeclock',
      aggregate_type: 'timeclock_session',
      actor_type: 'agent',
      actor_id: 'architect_agent_01',
      payload: {
        role: 'architect',
        model: 'gemini-2.5-pro',
        session_id: `tc-${generateUUID().substring(0, 8)}`,
        clock_in: new Date(now - 3600000).toISOString(),
        status: 'SUCCESS'
      }
    },
    {
      type: 'timeclock.clocked_out',
      source: 'tackle.agent_timeclock',
      aggregate_type: 'timeclock_session',
      actor_type: 'agent',
      actor_id: 'planner_agent_04',
      payload: {
        role: 'planner',
        model: 'gemini-2.5-flash',
        session_id: `tc-${generateUUID().substring(0, 8)}`,
        clock_out: new Date(now - 1800000).toISOString(),
        duration_s: 1845,
        status: 'SUCCESS'
      }
    },
    {
      type: 'timeclock.session.timed_out',
      source: 'tackle.agent_timeclock',
      aggregate_type: 'timeclock_session',
      actor_type: 'system',
      actor_id: 'tackle.timeclock_watchdog',
      payload: {
        role: 'coder',
        model: 'gemini-2.5-pro',
        session_id: `tc-${generateUUID().substring(0, 8)}`,
        timeout_minutes: 120,
        forced_clock_out: true,
        status: 'WARNING'
      }
    },

    // 3. Nebula Agent Records Family (nebula.agent_records)
    {
      type: 'nebula.agent_record.created',
      source: 'nebula.agent_records',
      aggregate_type: 'agent_record',
      actor_type: 'agent',
      actor_id: 'architect_agent_01',
      payload: {
        record_id: `rec-${generateUUID().substring(0, 8)}`,
        recordType: 'ARCHITECTURE_DECISION_RECORD',
        role: 'architect',
        level: 'CRITICAL',
        visibilityScope: 'GLOBAL',
        tags: ['streaming', 'ring-buffer', 'nats-jetstream'],
        plan_ref: 'plan-stream-buffers-v2',
        status: 'SUCCESS'
      }
    },
    {
      type: 'nebula.agent_record.updated',
      source: 'nebula.agent_records',
      aggregate_type: 'agent_record',
      actor_type: 'agent',
      actor_id: 'qa_agent_03',
      payload: {
        record_id: `rec-arch-092`,
        changed_fields: ['verification_status', 'approved_by', 'checksum'],
        status: 'SUCCESS'
      }
    },
    {
      type: 'nebula.agent_record.rejected',
      source: 'nebula.agent_records',
      aggregate_type: 'agent_record',
      actor_type: 'system',
      actor_id: 'nebula.policy_validator',
      payload: {
        role: 'candidate_discoverer',
        reason: 'Record schema validation failed: missing mandatory field `rationale_summary`',
        status: 'FAILED'
      }
    },

    // 4. Harness Runtime Family (harness-srv)
    {
      type: 'harness.run.started',
      source: 'harness-srv',
      aggregate_type: 'harness_run',
      actor_type: 'system',
      actor_id: 'harness-srv.spawner',
      payload: {
        session_id: `sess-${generateUUID().substring(0, 8)}`,
        bundle_id: 'bundle-sha256-f98210bc',
        pid: 59102,
        role: 'autonomous_coder',
        status: 'IN_PROGRESS'
      }
    },
    {
      type: 'harness.run.completed',
      source: 'harness-srv',
      aggregate_type: 'harness_run',
      actor_type: 'agent',
      actor_id: 'harness-srv.worker_2',
      payload: {
        session_id: `sess-${generateUUID().substring(0, 8)}`,
        receipt: { sha256: generateUUID(), files_written: 14, exit_code: 0 },
        summary: 'All 38 integration assertions passed cleanly',
        tests_passed: 38,
        status: 'SUCCESS'
      }
    },
    {
      type: 'harness.run.refused',
      source: 'harness-srv',
      aggregate_type: 'harness_run',
      actor_type: 'system',
      actor_id: 'harness-srv.guard',
      payload: {
        session_id: `sess-${generateUUID().substring(0, 8)}`,
        bundle_id: 'bundle-interactive-shell',
        role: 'interactive_shell',
        reason: 'interactive_with_lease: Harness execution refused because interactive roles must execute synchronously under user control',
        status: 'WARNING'
      }
    },
    {
      type: 'harness.run.watchdog_killed',
      source: 'harness-srv',
      aggregate_type: 'harness_run',
      actor_type: 'system',
      actor_id: 'harness-srv.watchdog',
      payload: {
        session_id: `sess-long-loop`,
        pid: 30192,
        timeout_ms: 300000,
        exit_signal: 'SIGKILL',
        error_message: 'Harness watchdog killed worker process exceeding 300000ms execution cap',
        status: 'FAILED'
      }
    },

    // 5. Role Leases Family (tackle.role_leases)
    {
      type: 'lease.issued',
      source: 'tackle.role_leases',
      aggregate_type: 'role_lease',
      actor_type: 'system',
      actor_id: 'tackle.lease_dispenser',
      payload: {
        lease_id: `lease-${generateUUID().substring(0, 8)}`,
        role: 'autonomous_coder',
        channel: 'codegen-backlog',
        model: 'gemini-2.5-pro',
        budget_units: 5000,
        window_start: new Date(now - 120000).toISOString(),
        window_end: new Date(now + 3480000).toISOString(),
        status: 'SUCCESS'
      }
    },
    {
      type: 'lease.consumed',
      source: 'tackle.role_leases',
      aggregate_type: 'role_lease',
      actor_type: 'agent',
      actor_id: 'codegen_worker_7',
      payload: {
        lease_id: `lease-current-01`,
        role: 'autonomous_coder',
        channel: 'codegen-backlog',
        consumed_units: 320,
        remaining: 4680,
        work_ref: 'plan-stream-buffers-v2',
        status: 'SUCCESS'
      }
    },
    {
      type: 'lease.exhausted',
      source: 'tackle.role_leases',
      aggregate_type: 'role_lease',
      actor_type: 'system',
      actor_id: 'tackle.lease_dispenser',
      payload: {
        lease_id: `lease-heavy-run`,
        role: 'candidate_discoverer',
        consumed_units: 10000,
        budget_units: 10000,
        reason: 'Monthly allocated LLM token budget limit reached for role',
        status: 'WARNING'
      }
    },
    {
      type: 'lease.consume_denied',
      source: 'tackle.role_leases',
      aggregate_type: 'role_lease',
      actor_type: 'system',
      actor_id: 'tackle.lease_dispenser',
      payload: {
        lease_id: `lease-stale-04`,
        role: 'planner',
        reason: 'Lease window expired prior to commit; token consumption rejected',
        status: 'FAILED'
      }
    },

    // 6. Registry & Service Broker Family (registry.status_events)
    {
      type: 'registry.service.registered',
      source: 'registry.status_events',
      aggregate_type: 'service_registry',
      actor_type: 'system',
      actor_id: 'service-mesh.consul',
      payload: {
        service_name: 'stream-gateway-v2',
        service_id: 'srv-stream-gw-01',
        url: 'http://stream-gateway-v2.internal:8080',
        interval: '5s',
        status: 'SUCCESS'
      }
    },
    {
      type: 'registry.service.status_changed',
      source: 'registry.status_events',
      aggregate_type: 'service_registry',
      actor_type: 'system',
      actor_id: 'service-mesh.health_checker',
      payload: {
        service_name: 'redis-cache-cluster',
        old_state: 'PASSING',
        new_state: 'DEGRADED',
        reason: 'P99 response time exceeded 250ms threshold (285ms)',
        response_time_ms: 285,
        status: 'WARNING'
      }
    },
    {
      type: 'registry.service.health_check_failed',
      source: 'registry.status_events',
      aggregate_type: 'service_registry',
      actor_type: 'system',
      actor_id: 'service-mesh.health_checker',
      payload: {
        service_name: 'vector-indexer-daemon',
        error_message: 'HTTP 503: pgvector disk space watermark threshold (>92%) crossed',
        response_time_ms: 1240,
        status: 'FAILED'
      }
    },
    {
      type: 'service_broker.call_failed',
      source: 'registry.service_broker',
      aggregate_type: 'service_registry',
      actor_type: 'system',
      actor_id: 'service_broker',
      payload: {
        service: 'voyager-fs-daemon',
        method: 'POST /v1/epoch/scan',
        status: 'FAILED',
        error: 'Upstream connection reset by peer (ECONNRESET)'
      }
    },

    // 7. Voyager Filesystem Family (fs / voyager)
    {
      type: 'voyager.epoch.started',
      source: 'voyager.file_observation',
      aggregate_type: 'voyager_epoch',
      actor_type: 'system',
      actor_id: 'voyager.daemon',
      payload: {
        epoch_id: `epoch-${generateUUID().substring(0, 8)}`,
        root_path: '/workspace/nexus-core',
        files_scanned: 1840,
        status: 'IN_PROGRESS'
      }
    },
    {
      type: 'voyager.drift.detected',
      source: 'voyager.file_observation',
      aggregate_type: 'voyager_drift',
      actor_type: 'system',
      actor_id: 'voyager.drift_analyzer',
      payload: {
        entity: 'src/services/streamGateway.ts',
        old_fingerprint: 'sha256-a19e0b',
        new_fingerprint: 'sha256-9b882c',
        magnitude: 'MAJOR',
        delta_bytes: 4920,
        status: 'WARNING'
      }
    },
    {
      type: 'voyager.topology.signal',
      source: 'voyager.topology',
      aggregate_type: 'voyager_topology',
      actor_type: 'system',
      actor_id: 'voyager.semantic_grapher',
      payload: {
        signal_id: `sig-${generateUUID().substring(0, 8)}`,
        epoch_id: 'epoch-current',
        structure_type: 'DAG_EDGE_DISCOVERY',
        structure_scope: 'MODULE_DEPENDENCIES',
        observation_ids: [generateUUID(), generateUUID()],
        status: 'SUCCESS'
      }
    },
    {
      type: 'voyager.asset.upserted',
      source: 'voyager.assets',
      aggregate_type: 'voyager_asset',
      actor_type: 'agent',
      actor_id: 'voyager.indexer',
      payload: {
        asset_id: `asset-ts-${generateUUID().substring(0, 8)}`,
        revision_id: 'rev-481',
        content_hash: 'sha256-4c9103ba88',
        status: 'SUCCESS'
      }
    },

    // 8. Execution Drift Family (execution-srv)
    {
      type: 'execution.drift.detected',
      source: 'execution-srv',
      aggregate_type: 'execution_drift',
      actor_type: 'system',
      actor_id: 'execution-srv.reconciler',
      payload: {
        kind: 'unreleased_lease_for_terminal_request',
        request_id: `req-${generateUUID().substring(0, 8)}`,
        lease_id: `lease-${generateUUID().substring(0, 8)}`,
        reconciliation_action: 'AUTO_REVOKE_LEASE_AND_REFUND_BUDGET',
        status: 'WARNING'
      }
    },
    {
      type: 'execution.drift.detected',
      source: 'execution-srv',
      aggregate_type: 'execution_drift',
      actor_type: 'system',
      actor_id: 'execution-srv.reconciler',
      payload: {
        kind: 'receipt_request_mismatch',
        request_id: `req-mismatch-89`,
        lease_id: `lease-orphan-12`,
        error_detail: 'Harness execution receipt checksum does not match requested artifact hash',
        status: 'FAILED'
      }
    },
    {
      type: 'execution.consistency.rejected',
      source: 'execution-srv',
      aggregate_type: 'execution_drift',
      actor_type: 'system',
      actor_id: 'execution-srv.db_guard',
      payload: {
        table: 'execution_attempts',
        reason: 'Invariant violation: attempt status marked COMPLETED without corresponding receipt envelope',
        status: 'FAILED'
      }
    },

    // 9. Circuit Breaker Family (conduit.circuit_breaker)
    {
      type: 'circuit_breaker.tripped',
      source: 'conduit.circuit_breaker',
      aggregate_type: 'circuit_breaker',
      actor_type: 'system',
      actor_id: 'conduit.sentinel',
      payload: {
        scope: 'role',
        role: 'candidate_discoverer',
        tripped_at: new Date(now - 140000).toISOString(),
        retry_after: 300,
        error: 'Consecutive API RateLimitExceeded (HTTP 429) > 5 within 60s',
        detail: 'Backing off candidate discovery workers for 5 minutes',
        source: 'gemini-embedding-api',
        status: 'FAILED'
      }
    },
    {
      type: 'work.requeued',
      source: 'conduit.circuit_breaker',
      aggregate_type: 'circuit_breaker',
      actor_type: 'system',
      actor_id: 'conduit.requeuer',
      payload: {
        plan_id: 'plan-stream-buffers-v2',
        role: 'candidate_discoverer',
        session_id: `sess-retry-01`,
        error: 'Circuit open; work task safely requeued to JetStream dead-letter buffer',
        source: 'conduit.circuit_breaker',
        status: 'WARNING'
      }
    },
    {
      type: 'circuit_breaker.reset',
      source: 'conduit.circuit_breaker',
      aggregate_type: 'circuit_breaker',
      actor_type: 'system',
      actor_id: 'conduit.sentinel',
      payload: {
        scope: 'role',
        role: 'candidate_discoverer',
        reset_by: 'health_check_probe_success',
        status: 'SUCCESS'
      }
    },

    // 10. Substance Segments Family (nebula.segments_history)
    {
      type: 'substance.segment.expired',
      source: 'nebula.segments_history',
      aggregate_type: 'substance_segment',
      actor_type: 'system',
      actor_id: 'substance.janitor',
      payload: {
        segment_id: `seg-${generateUUID().substring(0, 8)}`,
        segment_set_ids: ['set-candidate-archive-2026', 'set-transcripts-q2'],
        expired_at: new Date(now - 60000).toISOString(),
        freed_bytes: 1849200,
        status: 'SUCCESS'
      }
    },
    {
      type: 'substance.segment_set.created',
      source: 'nebula.segments_history',
      aggregate_type: 'substance_segment',
      actor_type: 'agent',
      actor_id: 'architect_agent_01',
      payload: {
        segment_set_id: `set-${generateUUID().substring(0, 8)}`,
        name: 'streaming-audio-benchmark-traces',
        metadata: { retention_days: 90, compress_gzip: true },
        status: 'SUCCESS'
      }
    },

    // 11. MCP Tool Server Family (mcp-servers)
    {
      type: 'mcp.server.started',
      source: 'mcp.postgres_schema_server',
      aggregate_type: 'mcp_server',
      actor_type: 'system',
      actor_id: 'mcp.daemon_manager',
      payload: {
        server: 'postgres-schema-inspector',
        version: '1.4.2',
        transport: 'stdio',
        tools_registered: ['inspect_tables', 'explain_query', 'vacuum_analyze'],
        status: 'SUCCESS'
      }
    },
    {
      type: 'mcp.call.completed',
      source: 'mcp.postgres_schema_server',
      aggregate_type: 'mcp_server',
      actor_type: 'agent',
      actor_id: 'coder_agent_02',
      payload: {
        server: 'postgres-schema-inspector',
        tool: 'explain_query',
        duration_ms: 24,
        status: 'SUCCESS'
      }
    },
    {
      type: 'mcp.call.arguments_invalid',
      source: 'mcp.git_vcs_server',
      aggregate_type: 'mcp_server',
      actor_type: 'agent',
      actor_id: 'candidate_discoverer',
      payload: {
        server: 'git-vcs-tool',
        tool: 'cherry_pick_commit',
        error_class: 'SchemaValidationError',
        details: 'Field `commit_sha` must be 40 hexadecimal characters, received `null`',
        status: 'FAILED'
      }
    },
    {
      type: 'mcp.call.timed_out',
      source: 'mcp.docker_runner_server',
      aggregate_type: 'mcp_server',
      actor_type: 'system',
      actor_id: 'mcp.rpc_client',
      payload: {
        server: 'docker-isolated-runner',
        tool: 'build_container_image',
        timeout_ms: 120000,
        status: 'FAILED'
      }
    },
    {
      type: 'mcp.aggregator.initialized',
      source: 'mcp.aggregator_router',
      aggregate_type: 'mcp_server',
      actor_type: 'system',
      actor_id: 'mcp.aggregator',
      payload: {
        server: 'central-mcp-gateway',
        tools_count: 48,
        connected_servers: 6,
        status: 'SUCCESS'
      }
    },

    // 12. WRP Core Kernel Family (nexus_core.wrp)
    {
      type: 'wrp.identity.derived',
      source: 'nexus_core.wrp',
      aggregate_type: 'wrp_kernel',
      actor_type: 'system',
      actor_id: 'wrp.identity_resolver',
      payload: {
        entity_key: 'workflow:stream-ring-buffers-v2:harness:job-41',
        scope: 'CLUSTER_GLOBAL',
        hash: 'wrp-id-882190',
        status: 'SUCCESS'
      }
    },
    {
      type: 'wrp.state.mutated',
      source: 'nexus_core.wrp',
      aggregate_type: 'wrp_kernel',
      actor_type: 'agent',
      actor_id: 'wrp.state_machine',
      payload: {
        version_id: 'v-290',
        parents: ['v-289'],
        source_event_id: generateUUID(),
        edge_type: 'TRANSITION_VERIFIED',
        status: 'SUCCESS'
      }
    },
    {
      type: 'wrp.kernel.invariant_violated',
      source: 'nexus_core.wrp',
      aggregate_type: 'wrp_kernel',
      actor_type: 'system',
      actor_id: 'wrp.kernel_auditor',
      payload: {
        version: 'v-291',
        error: 'DAG Cycle Detected: node v-291 declares descendant v-288 as causal parent',
        mitigation: 'REVERT_TO_SNAPSHOT_v289',
        status: 'FAILED'
      }
    },
    {
      type: 'wrp.replay.mismatch',
      source: 'nexus_core.wrp',
      aggregate_type: 'wrp_kernel',
      actor_type: 'system',
      actor_id: 'wrp.deterministic_verifier',
      payload: {
        fingerprint_1: 'sha256-1039aa',
        fingerprint_2: 'sha256-1039ff',
        deltas: ['timestamp_drift_ms', 'random_seed_divergence'],
        status: 'WARNING'
      }
    },
    {
      type: 'wrp.arbitration.selected',
      source: 'nexus_core.wrp',
      aggregate_type: 'wrp_kernel',
      actor_type: 'system',
      actor_id: 'wrp.arbiter',
      payload: {
        event: 'lease.consume_request',
        lease_id: 'lease-current-01',
        score: 0.982,
        decision: 'GRANTED_EXECUTION_LOCK',
        status: 'SUCCESS'
      }
    }
  ];

  // Append all System Family events to the ledger
  systemFamilySeedPool.forEach((seedItem, sIdx) => {
    const t = now - Math.floor((sIdx + 1) * 320000);
    events.push({
      event_id: generateUUID(),
      event_type: seedItem.type,
      source: seedItem.source,
      event_timestamp: new Date(t).toISOString(),
      payload: seedItem.payload,
      aggregate_type: seedItem.aggregate_type,
      aggregate_id: generateUUID(),
      actor_type: seedItem.actor_type,
      actor_id: seedItem.actor_id,
      correlation_id: generateUUID(),
      causation_id: null,
      caused_by_event_type: null,
      sequence_number: String(++seqCounter),
      received_at: new Date(t + 8).toISOString(),
      nats_subject: getNatsSubject(seedItem.type),
      system_family: getSystemFamily(seedItem.type)
    });
  });

  // Stamp nats_subject and system_family across all earlier workflow events
  events.forEach(evt => {
    if (!evt.nats_subject) {
      evt.nats_subject = getNatsSubject(evt.event_type);
    }
    if (!evt.system_family) {
      evt.system_family = getSystemFamily(evt.event_type);
    }
  });

  // Sort events by sequence / timestamp descending
  events.sort((a, b) => Number(b.sequence_number) - Number(a.sequence_number));

  // Registered NATS stream subscribers across all canonical system subjects
  const subscribers: Subscriber[] = [
    {
      subject_pattern: 'nexus.cascade.v1.*',
      handler_name: 'projection_updater',
      description: 'Materializes live entity views from raw cascade event ledger.',
      enabled: true,
      created_at: '2026-08-01T00:00:00.000Z',
      last_processed: new Date(now - 14000).toISOString(),
      processed_ids: [events[0]?.event_id || generateUUID(), events[1]?.event_id || generateUUID()],
      last_processed_at: new Date(now - 12000).toISOString(),
      lag: 4
    },
    {
      subject_pattern: 'nexus.tackle.v1.scheduler.*',
      handler_name: 'scheduler_telemetry_aggregator',
      description: 'Ingests agent scheduler ticks, launches, and interactive hosted skips.',
      enabled: true,
      created_at: '2026-08-03T10:00:00.000Z',
      last_processed: new Date(now - 9000).toISOString(),
      processed_ids: [],
      last_processed_at: new Date(now - 7000).toISOString(),
      lag: 0
    },
    {
      subject_pattern: 'nexus.timeclock.v1.*',
      handler_name: 'r13_timeclock_audit_daemon',
      description: 'Audits agent session clock-in / clock-out times and enforces timeout rules.',
      enabled: true,
      created_at: '2026-08-04T08:00:00.000Z',
      last_processed: new Date(now - 16000).toISOString(),
      processed_ids: [],
      last_processed_at: new Date(now - 14000).toISOString(),
      lag: 2
    },
    {
      subject_pattern: 'nexus.nebula.v1.agent_record.*',
      handler_name: 'nebula_push_inbox_dispatcher',
      description: 'Dispatches architectural decisions and agent record updates to connected workers.',
      enabled: true,
      created_at: '2026-08-05T12:00:00.000Z',
      last_processed: new Date(now - 28000).toISOString(),
      processed_ids: [],
      last_processed_at: new Date(now - 25000).toISOString(),
      lag: 1
    },
    {
      subject_pattern: 'nexus.harness.v1.run.*',
      handler_name: 'harness_metrics_aggregator',
      description: 'Tracks sandbox execution times, memory ceilings, and test pass/fail ratios.',
      enabled: true,
      created_at: '2026-08-06T14:15:00.000Z',
      last_processed: new Date(now - 8000).toISOString(),
      processed_ids: [],
      last_processed_at: new Date(now - 6000).toISOString(),
      lag: 0
    },
    {
      subject_pattern: 'nexus.tackle.v1.lease.*',
      handler_name: 'role_lease_accounting_daemon',
      description: 'Monitors unit consumption accounting, budget stops, and stale sweeps.',
      enabled: true,
      created_at: '2026-08-07T11:00:00.000Z',
      last_processed: new Date(now - 20000).toISOString(),
      processed_ids: [],
      last_processed_at: new Date(now - 18000).toISOString(),
      lag: 3
    },
    {
      subject_pattern: 'nexus.registry.v1.service.*',
      handler_name: 'service_mesh_circuit_monitor',
      description: 'Watches service health check failures, latency thresholds, and flap events.',
      enabled: true,
      created_at: '2026-08-08T09:00:00.000Z',
      last_processed: new Date(now - 12000).toISOString(),
      processed_ids: [],
      last_processed_at: new Date(now - 10000).toISOString(),
      lag: 1
    },
    {
      subject_pattern: 'nexus.fs.v1.*',
      handler_name: 'voyager_topology_indexer',
      description: 'Parses filesystem observation epochs and calculates DAG drift metrics.',
      enabled: true,
      created_at: '2026-08-09T08:30:00.000Z',
      last_processed: new Date(now - 45000).toISOString(),
      processed_ids: [],
      last_processed_at: new Date(now - 40000).toISOString(),
      lag: 5
    },
    {
      subject_pattern: 'nexus.execution.v1.drift.*',
      handler_name: 'execution_drift_reconciler',
      description: 'Reconciles unreleased leases, orphan attempts, and receipt request mismatches.',
      enabled: true,
      created_at: '2026-08-10T16:00:00.000Z',
      last_processed: new Date(now - 30000).toISOString(),
      processed_ids: [],
      last_processed_at: new Date(now - 28000).toISOString(),
      lag: 0
    },
    {
      subject_pattern: 'nexus.conduit.v1.circuit.*',
      handler_name: 'conduit_circuit_trip_handler',
      description: 'Trips circuit breakers, throttles queues, and routes failed jobs to dead-letter buffers.',
      enabled: true,
      created_at: '2026-08-11T12:00:00.000Z',
      last_processed: new Date(now - 15000).toISOString(),
      processed_ids: [],
      last_processed_at: new Date(now - 12000).toISOString(),
      lag: 0
    },
    {
      subject_pattern: 'nexus.mcp.v1.*',
      handler_name: 'mcp_gateway_telemetry_listener',
      description: 'Aggregates JSON-RPC tool invocations, schema validation errors, and timeout events.',
      enabled: true,
      created_at: '2026-08-12T10:00:00.000Z',
      last_processed: new Date(now - 5000).toISOString(),
      processed_ids: [],
      last_processed_at: new Date(now - 4000).toISOString(),
      lag: 0
    },
    {
      subject_pattern: 'nexus.wrp.v1.*',
      handler_name: 'wrp_state_dag_validator',
      description: 'Verifies WRP state DAG mutations, validates kernel invariants, and triggers deterministic re-runs.',
      enabled: true,
      created_at: '2026-08-13T14:00:00.000Z',
      last_processed: new Date(now - 22000).toISOString(),
      processed_ids: [],
      last_processed_at: new Date(now - 20000).toISOString(),
      lag: 2
    }
  ];

  return { events, assessments, subscribers };
}
