import { 
  EventEnvelope, 
  AssessmentResolution, 
  Subscriber, 
  CascadeAnalytics, 
  LineageGraphResponse, 
  LineageChainItem,
  ReducedChildEvent,
  EventFilterState,
  CascadeHealth,
  LifecycleStage,
  SystemFamily,
  EventReviewFlag,
  BatchSimulationJob,
  BatchOperationAudit
} from '../types';
import { 
  generateInitialLedger, 
  generateUUID, 
  mapEventTypeToStage, 
  getEventHealthInfo,
  getEventStatusBadge,
  getEventSeverity,
  getEventOrigin,
  getEventTags,
  getNatsSubject,
  getSystemFamily,
  SYSTEM_FAMILIES_INFO
} from './mockDataGenerator';

class CascadeStore {
  private events: EventEnvelope[] = [];
  private assessments: AssessmentResolution[] = [];
  private subscribers: Subscriber[] = [];
  private reviewFlags: Map<string, EventReviewFlag> = new Map();
  private batchAudits: BatchOperationAudit[] = [];
  private activeBatchJob: BatchSimulationJob | null = null;
  private listeners: Set<() => void> = new Set();
  private maxSequence: number = 18000;
  private isLiveStreaming: boolean = true;
  private pollingIntervalMs: number = 5000;
  private streamIntervalId: any = null;
  private lastPolledAt: string = new Date().toISOString();

  constructor() {
    // Load persisted polling preferences if available
    try {
      const storedConfig = localStorage.getItem('cascade_polling_config_v1');
      if (storedConfig) {
        const parsed = JSON.parse(storedConfig);
        if (typeof parsed.enabled === 'boolean') this.isLiveStreaming = parsed.enabled;
        if (typeof parsed.intervalMs === 'number' && parsed.intervalMs >= 500) {
          this.pollingIntervalMs = parsed.intervalMs;
        }
      }
    } catch {
      // ignore
    }

    const initial = generateInitialLedger();
    this.events = initial.events;
    this.assessments = initial.assessments;
    this.subscribers = initial.subscribers;
    this.maxSequence = Math.max(...this.events.map(e => Number(e.sequence_number) || 18000));
    
    // Seed initial review flags for realistic audit workflow demonstration
    const sampleWarnings = this.events.filter(e => {
      const h = getEventHealthInfo(e);
      return h.status === 'warning' || h.status === 'failed';
    }).slice(0, 3);

    sampleWarnings.forEach((evt, idx) => {
      this.reviewFlags.set(evt.event_id, {
        event_id: evt.event_id,
        flagged_at: new Date(Date.now() - (idx + 1) * 1800000).toISOString(),
        flagged_by: 'system.sentinel_auditor',
        reason: idx === 0 ? 'Latency threshold anomaly (>180ms)' : idx === 1 ? 'Circuit breaker trip investigation' : 'Configuration drift detected',
        category: idx === 0 ? 'latency_spike' : idx === 1 ? 'circuit_trip' : 'drift',
        priority: idx === 1 ? 'urgent' : 'high',
        status: 'pending',
        notes: 'Flagged for batch verification and replay sandbox testing.',
        assigned_to: 'tackle_ops_team'
      });
    });

    if (this.isLiveStreaming) {
      this.startLiveStream();
    }
  }

  public subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify() {
    this.listeners.forEach(fn => fn());
  }

  private persistPollingConfig() {
    try {
      localStorage.setItem('cascade_polling_config_v1', JSON.stringify({
        enabled: this.isLiveStreaming,
        intervalMs: this.pollingIntervalMs
      }));
    } catch {
      // ignore
    }
  }

  public toggleLiveStreaming(enable?: boolean): boolean {
    if (enable !== undefined) {
      this.isLiveStreaming = enable;
    } else {
      this.isLiveStreaming = !this.isLiveStreaming;
    }

    this.persistPollingConfig();

    if (this.isLiveStreaming) {
      this.startLiveStream();
    } else {
      if (this.streamIntervalId) {
        clearInterval(this.streamIntervalId);
        this.streamIntervalId = null;
      }
    }
    this.notify();
    return this.isLiveStreaming;
  }

  public setAutomaticPolling(enabled: boolean): void {
    this.toggleLiveStreaming(enabled);
  }

  public setAutoRefresh(enabled: boolean): boolean {
    return this.toggleLiveStreaming(enabled);
  }

  public isAutoRefreshEnabled(): boolean {
    return this.isLiveStreaming;
  }

  public getIsStreaming(): boolean {
    return this.isLiveStreaming;
  }

  public getIsAutomaticPolling(): boolean {
    return this.isLiveStreaming;
  }

  public getPollingInterval(): number {
    return this.pollingIntervalMs;
  }

  public getRefreshInterval(): number {
    return this.pollingIntervalMs;
  }

  public setPollingInterval(intervalMs: number): void {
    this.pollingIntervalMs = Math.max(500, intervalMs);
    this.persistPollingConfig();
    if (this.isLiveStreaming) {
      this.startLiveStream();
    }
    this.notify();
  }

  public setRefreshInterval(intervalMs: number): void {
    this.setPollingInterval(intervalMs);
  }

  public getLastPolledAt(): string {
    return this.lastPolledAt;
  }

  public manualPollNow(): void {
    this.lastPolledAt = new Date().toISOString();
    this.simulateNextRandomEvent();
    this.notify();
  }

  public syncEventsNow(): void {
    this.manualPollNow();
  }

  private startLiveStream() {
    if (this.streamIntervalId) clearInterval(this.streamIntervalId);
    this.streamIntervalId = setInterval(() => {
      if (!this.isLiveStreaming) return;
      this.lastPolledAt = new Date().toISOString();
      this.simulateNextRandomEvent();
    }, this.pollingIntervalMs);
  }

  public simulateNextRandomEvent() {
    const eventGenerators = [
      () => this.emitBackgroundTelemetry(),
      () => this.emitCandidateDiscovery(),
      () => this.emitAssessmentOrRipple(),
      () => this.emitHarnessTelemetry(),
      () => this.emitSchedulerOrLeaseEvent(),
      () => this.emitVoyagerOrExecutionEvent(),
      () => this.emitCircuitOrMcpEvent(),
      () => this.emitWrpOrSubstanceEvent()
    ];
    const gen = eventGenerators[Math.floor(Math.random() * eventGenerators.length)];
    gen();
  }

  private emitSchedulerOrLeaseEvent() {
    this.maxSequence++;
    const now = new Date().toISOString();
    const isScheduler = Math.random() > 0.5;

    if (isScheduler) {
      const types = [
        { type: 'scheduler.entry.due', role: 'architect', status: 'SUCCESS' },
        { type: 'scheduler.agent.launched', role: 'coder', status: 'SUCCESS' },
        { type: 'scheduler.skip.no_work', role: 'reviewer', status: 'SUCCESS' },
        { type: 'scheduler.skip.interactive_hosted', role: 'interactive_shell', status: 'WARNING' },
        { type: 'timeclock.clocked_in', role: 'architect', status: 'SUCCESS' },
        { type: 'timeclock.session.timed_out', role: 'coder', status: 'WARNING' }
      ];
      const item = types[Math.floor(Math.random() * types.length)];
      const newEvent: EventEnvelope = {
        event_id: generateUUID(),
        event_type: item.type,
        source: item.type.startsWith('timeclock.') ? 'tackle.agent_timeclock' : 'tackle.agent_scheduler',
        event_timestamp: now,
        payload: {
          role: item.role,
          model: 'gemini-2.5-pro',
          session_id: `tc-${generateUUID().substring(0, 8)}`,
          status: item.status,
          latency_ms: Math.floor(Math.random() * 20) + 5
        },
        aggregate_type: item.type.startsWith('timeclock.') ? 'timeclock_session' : 'scheduler_entry',
        aggregate_id: generateUUID(),
        actor_type: item.type.startsWith('timeclock.') ? 'agent' : 'system',
        actor_id: item.type.startsWith('timeclock.') ? `${item.role}_agent_01` : 'tackle.cron_runner',
        correlation_id: generateUUID(),
        causation_id: null,
        caused_by_event_type: null,
        sequence_number: String(this.maxSequence),
        received_at: now,
        nats_subject: getNatsSubject(item.type),
        system_family: getSystemFamily(item.type)
      };
      this.events.unshift(newEvent);
      this.updateSubscribersOnNewEvent(newEvent);
      this.notify();
    } else {
      const types = [
        { type: 'lease.issued', units: 5000, status: 'SUCCESS' },
        { type: 'lease.consumed', units: 140, status: 'SUCCESS' },
        { type: 'lease.exhausted', units: 0, status: 'WARNING' },
        { type: 'nebula.agent_record.created', units: 0, status: 'SUCCESS' }
      ];
      const item = types[Math.floor(Math.random() * types.length)];
      const newEvent: EventEnvelope = {
        event_id: generateUUID(),
        event_type: item.type,
        source: item.type.startsWith('nebula.') ? 'nebula.agent_records' : 'tackle.role_leases',
        event_timestamp: now,
        payload: {
          lease_id: `lease-${generateUUID().substring(0, 8)}`,
          role: 'autonomous_coder',
          consumed_units: item.units,
          status: item.status
        },
        aggregate_type: item.type.startsWith('nebula.') ? 'agent_record' : 'role_lease',
        aggregate_id: generateUUID(),
        actor_type: item.type.startsWith('nebula.') ? 'agent' : 'system',
        actor_id: 'tackle.lease_dispenser',
        correlation_id: generateUUID(),
        causation_id: null,
        caused_by_event_type: null,
        sequence_number: String(this.maxSequence),
        received_at: now,
        nats_subject: getNatsSubject(item.type),
        system_family: getSystemFamily(item.type)
      };
      this.events.unshift(newEvent);
      this.updateSubscribersOnNewEvent(newEvent);
      this.notify();
    }
  }

  private emitVoyagerOrExecutionEvent() {
    this.maxSequence++;
    const now = new Date().toISOString();
    const isVoyager = Math.random() > 0.5;

    if (isVoyager) {
      const types = [
        { type: 'voyager.epoch.completed', status: 'SUCCESS', count: 1480 },
        { type: 'voyager.drift.detected', status: 'WARNING', entity: 'src/config/nats.json' },
        { type: 'voyager.topology.signal', status: 'SUCCESS', typeName: 'DAG_EDGE_DISCOVERY' },
        { type: 'registry.service.status_changed', status: 'WARNING', srv: 'redis-cache' }
      ];
      const item = types[Math.floor(Math.random() * types.length)];
      const newEvent: EventEnvelope = {
        event_id: generateUUID(),
        event_type: item.type,
        source: item.type.startsWith('registry.') ? 'registry.status_events' : 'voyager.file_observation',
        event_timestamp: now,
        payload: {
          ...item,
          latency_ms: Math.floor(Math.random() * 25) + 12
        },
        aggregate_type: item.type.startsWith('registry.') ? 'service_registry' : 'voyager_topology',
        aggregate_id: generateUUID(),
        actor_type: 'system',
        actor_id: item.type.startsWith('registry.') ? 'consul.health_checker' : 'voyager.daemon',
        correlation_id: generateUUID(),
        causation_id: null,
        caused_by_event_type: null,
        sequence_number: String(this.maxSequence),
        received_at: now,
        nats_subject: getNatsSubject(item.type),
        system_family: getSystemFamily(item.type)
      };
      this.events.unshift(newEvent);
      this.updateSubscribersOnNewEvent(newEvent);
      this.notify();
    } else {
      const types = [
        { type: 'execution.drift.detected', kind: 'unreleased_lease_for_terminal_request', status: 'WARNING' },
        { type: 'circuit_breaker.tripped', role: 'candidate_discoverer', status: 'FAILED' },
        { type: 'work.requeued', role: 'candidate_discoverer', status: 'WARNING' },
        { type: 'circuit_breaker.reset', role: 'candidate_discoverer', status: 'SUCCESS' }
      ];
      const item = types[Math.floor(Math.random() * types.length)];
      const newEvent: EventEnvelope = {
        event_id: generateUUID(),
        event_type: item.type,
        source: item.type.startsWith('execution.') ? 'execution-srv' : 'conduit.circuit_breaker',
        event_timestamp: now,
        payload: {
          ...item,
          reconciled: true
        },
        aggregate_type: item.type.startsWith('execution.') ? 'execution_drift' : 'circuit_breaker',
        aggregate_id: generateUUID(),
        actor_type: 'system',
        actor_id: item.type.startsWith('execution.') ? 'execution-srv.reconciler' : 'conduit.sentinel',
        correlation_id: generateUUID(),
        causation_id: null,
        caused_by_event_type: null,
        sequence_number: String(this.maxSequence),
        received_at: now,
        nats_subject: getNatsSubject(item.type),
        system_family: getSystemFamily(item.type)
      };
      this.events.unshift(newEvent);
      this.updateSubscribersOnNewEvent(newEvent);
      this.notify();
    }
  }

  private emitCircuitOrMcpEvent() {
    this.maxSequence++;
    const now = new Date().toISOString();
    const types = [
      { type: 'mcp.call.completed', srv: 'postgres-schema-inspector', tool: 'explain_query', status: 'SUCCESS', dur: 22 },
      { type: 'mcp.call.completed', srv: 'git-vcs-tool', tool: 'list_modified_files', status: 'SUCCESS', dur: 18 },
      { type: 'mcp.call.arguments_invalid', srv: 'docker-isolated-runner', tool: 'spawn_container', status: 'FAILED', dur: 5 },
      { type: 'mcp.server.started', srv: 'vector-indexer-mcp', status: 'SUCCESS', dur: 120 }
    ];
    const item = types[Math.floor(Math.random() * types.length)];
    const newEvent: EventEnvelope = {
      event_id: generateUUID(),
      event_type: item.type,
      source: `mcp.${item.srv}`,
      event_timestamp: now,
      payload: {
        server: item.srv,
        tool: item.tool,
        duration_ms: item.dur,
        status: item.status
      },
      aggregate_type: 'mcp_server',
      aggregate_id: generateUUID(),
      actor_type: item.type === 'mcp.server.started' ? 'system' : 'agent',
      actor_id: item.type === 'mcp.server.started' ? 'mcp.daemon' : 'coder_agent_02',
      correlation_id: generateUUID(),
      causation_id: null,
      caused_by_event_type: null,
      sequence_number: String(this.maxSequence),
      received_at: now,
      nats_subject: getNatsSubject(item.type),
      system_family: getSystemFamily(item.type)
    };
    this.events.unshift(newEvent);
    this.updateSubscribersOnNewEvent(newEvent);
    this.notify();
  }

  private emitWrpOrSubstanceEvent() {
    this.maxSequence++;
    const now = new Date().toISOString();
    const isWrp = Math.random() > 0.5;

    if (isWrp) {
      const types = [
        { type: 'wrp.state.mutated', status: 'SUCCESS', v: `v-${Math.floor(Math.random() * 500) + 100}` },
        { type: 'wrp.identity.derived', status: 'SUCCESS', scope: 'GLOBAL' },
        { type: 'wrp.arbitration.selected', status: 'SUCCESS', decision: 'GRANTED_EXECUTION_LOCK' },
        { type: 'wrp.replay.mismatch', status: 'WARNING', error: 'Minor clock skew detected' }
      ];
      const item = types[Math.floor(Math.random() * types.length)];
      const newEvent: EventEnvelope = {
        event_id: generateUUID(),
        event_type: item.type,
        source: 'nexus_core.wrp',
        event_timestamp: now,
        payload: {
          ...item,
          verified: true
        },
        aggregate_type: 'wrp_kernel',
        aggregate_id: generateUUID(),
        actor_type: 'system',
        actor_id: 'wrp.kernel_auditor',
        correlation_id: generateUUID(),
        causation_id: null,
        caused_by_event_type: null,
        sequence_number: String(this.maxSequence),
        received_at: now,
        nats_subject: getNatsSubject(item.type),
        system_family: getSystemFamily(item.type)
      };
      this.events.unshift(newEvent);
      this.updateSubscribersOnNewEvent(newEvent);
      this.notify();
    } else {
      const newEvent: EventEnvelope = {
        event_id: generateUUID(),
        event_type: 'substance.segment.expired',
        source: 'nebula.segments_history',
        event_timestamp: now,
        payload: {
          segment_id: `seg-${generateUUID().substring(0, 8)}`,
          freed_bytes: 492100,
          status: 'SUCCESS'
        },
        aggregate_type: 'substance_segment',
        aggregate_id: generateUUID(),
        actor_type: 'system',
        actor_id: 'substance.janitor',
        correlation_id: generateUUID(),
        causation_id: null,
        caused_by_event_type: null,
        sequence_number: String(this.maxSequence),
        received_at: now,
        nats_subject: getNatsSubject('substance.segment.expired'),
        system_family: getSystemFamily('substance.segment.expired')
      };
      this.events.unshift(newEvent);
      this.updateSubscribersOnNewEvent(newEvent);
      this.notify();
    }
  }

  private emitBackgroundTelemetry() {
    this.maxSequence++;
    const now = new Date().toISOString();
    const eventTypes = [
      { type: 'harvest.captured', src: 'rover.audio_harvester_v2', agg: 'harvest' },
      { type: 'wind.instance.completed', src: 'wind-srv', agg: 'wind_instance' },
      { type: 'question.created', src: 'rover.planner', agg: 'open_question' },
      { type: 'agenda.item_added', src: 'rover.candidate_promote', agg: 'agenda_item' }
    ];
    const item = eventTypes[Math.floor(Math.random() * eventTypes.length)];
    const newEvent: EventEnvelope = {
      event_id: generateUUID(),
      event_type: item.type,
      source: item.src,
      event_timestamp: now,
      payload: {
        stream_packet: true,
        worker_id: `worker-${Math.floor(Math.random() * 8) + 1}`,
        latency_ms: Math.floor(Math.random() * 35) + 10,
        tags: ['live-feed', 'stream-v1']
      },
      aggregate_type: item.agg,
      aggregate_id: generateUUID(),
      actor_type: 'system',
      actor_id: item.src,
      correlation_id: generateUUID(),
      causation_id: null,
      caused_by_event_type: null,
      sequence_number: String(this.maxSequence),
      received_at: now
    };

    this.events.unshift(newEvent);
    // update subscriber offsets slightly
    this.updateSubscribersOnNewEvent(newEvent);
    this.notify();
  }

  private emitCandidateDiscovery() {
    // Pick an existing harvest event
    const harvestEvents = this.events.filter(e => e.event_type === 'harvest.captured');
    const parent = harvestEvents[Math.floor(Math.random() * harvestEvents.length)];
    if (!parent) return;

    this.maxSequence++;
    const now = new Date().toISOString();
    const candId = generateUUID();
    const titles = [
      'Extract gRPC retry policy configuration from stream gateway',
      'Telemetry anomaly detector for audio packet loss',
      'Support OAuth 2.1 PKCE token exchange flow',
      'Optimize vector similarity top-k cache in candidate service'
    ];
    const title = titles[Math.floor(Math.random() * titles.length)];

    const candEvent: EventEnvelope = {
      event_id: generateUUID(),
      event_type: 'candidate.discovered',
      source: 'rover.batch_file_candidates',
      event_timestamp: now,
      payload: {
        harvest_id: parent.aggregate_id,
        candidate_id: candId,
        title,
        problem_statement: `Live transcript identified latency or architecture opportunity: ${title}.`,
        cpf: Number((0.75 + Math.random() * 0.23).toFixed(2)),
        risk_level: Math.random() > 0.6 ? 'High' : 'Medium'
      },
      aggregate_type: 'harvest_candidate',
      aggregate_id: candId,
      actor_type: 'agent',
      actor_id: 'rover.candidate_extractor',
      correlation_id: parent.correlation_id || generateUUID(),
      causation_id: parent.event_id,
      caused_by_event_type: parent.event_type,
      sequence_number: String(this.maxSequence),
      received_at: now
    };

    this.events.unshift(candEvent);
    this.updateSubscribersOnNewEvent(candEvent);
    this.notify();
  }

  private emitAssessmentOrRipple() {
    const candEvents = this.events.filter(e => e.event_type === 'candidate.discovered');
    const cand = candEvents[0];
    if (!cand) return;

    this.maxSequence++;
    const now = new Date().toISOString();
    const assessEventId = generateUUID();
    const isGreenlit = Math.random() > 0.25;

    const assessEvent: EventEnvelope = {
      event_id: assessEventId,
      event_type: 'candidate.assessed',
      source: 'rover.planner',
      event_timestamp: now,
      payload: {
        candidate_id: cand.aggregate_id,
        cpf: cand.payload.cpf || 0.85,
        outcome: isGreenlit ? 'greenlit' : 'escalated',
        confidence: Number((0.82 + Math.random() * 0.16).toFixed(2)),
        rationale_summary: isGreenlit 
          ? `High strategic value. Architecture verified for ${cand.payload.title}` 
          : `Candidate needs human architect sign-off due to cross-boundary dependencies.`
      },
      aggregate_type: 'harvest_candidate',
      aggregate_id: cand.aggregate_id,
      actor_type: 'agent',
      actor_id: 'rover.planner',
      correlation_id: cand.correlation_id,
      causation_id: cand.event_id,
      caused_by_event_type: 'candidate.discovered',
      sequence_number: String(this.maxSequence),
      received_at: now
    };

    this.events.unshift(assessEvent);

    this.assessments.unshift({
      resolution_id: generateUUID(),
      event_id: assessEventId,
      outcome: isGreenlit ? 'greenlit' : 'escalated',
      confidence: assessEvent.payload.confidence,
      rationale: {
        summary: assessEvent.payload.rationale_summary,
        strengths: ['High performance impact', 'Complies with v2 schema specs'],
        risks: isGreenlit ? ['Integration testing required'] : ['Requires consensus on breaking change'],
        estimated_complexity: 'Medium',
        dimension_scores: {
          feasibility: 0.9,
          business_value: 0.88,
          technical_debt: 0.82,
          security_risk: 0.95,
          alignment: 0.92
        }
      },
      dimensions_used: 5,
      dimensions_total: 5,
      resolved_at: now,
      event_type: 'candidate.assessed',
      source: 'rover.planner',
      payload: assessEvent.payload
    });

    this.updateSubscribersOnNewEvent(assessEvent);
    this.notify();
  }

  private emitHarnessTelemetry() {
    const plans = this.events.filter(e => e.event_type === 'requirement.promoted_to_plan');
    if (plans.length === 0) return;
    const plan = plans[0];

    this.maxSequence++;
    const now = new Date().toISOString();
    const harnessEvent: EventEnvelope = {
      event_id: generateUUID(),
      event_type: 'harness.completed',
      source: 'harness-srv.run-autonomous',
      event_timestamp: now,
      payload: {
        plan_id: plan.payload.plan_id,
        job_id: generateUUID(),
        status: 'SUCCESS',
        tests_passed: 38,
        coverage_delta: '+1.8%',
        execution_time_ms: 94200
      },
      aggregate_type: 'harness_job',
      aggregate_id: generateUUID(),
      actor_type: 'agent',
      actor_id: 'harness-srv.codegen_worker',
      correlation_id: plan.correlation_id,
      causation_id: plan.event_id,
      caused_by_event_type: 'requirement.promoted_to_plan',
      sequence_number: String(this.maxSequence),
      received_at: now
    };

    this.events.unshift(harnessEvent);
    this.updateSubscribersOnNewEvent(harnessEvent);
    this.notify();
  }

  private updateSubscribersOnNewEvent(evt: EventEnvelope) {
    this.subscribers.forEach(sub => {
      if (sub.enabled) {
        // Randomly process or lag
        if (Math.random() > 0.3) {
          sub.last_processed = evt.event_timestamp;
          sub.last_processed_at = evt.received_at;
          sub.processed_ids = [evt.event_id, ...sub.processed_ids.slice(0, 9)];
          sub.lag = Math.max(0, sub.lag - 1);
        } else {
          sub.lag = Math.min(50, sub.lag + 1);
        }
      } else {
        sub.lag = Math.min(100, sub.lag + 1);
      }
    });
  }

  // Inject a full synthetic workflow pipeline start-to-finish
  public async injectCustomWorkflow(
    transcript: string, 
    sourceName: string, 
    onStep?: (phase: string, event: EventEnvelope) => void
  ): Promise<string> {
    const correlationId = generateUUID();
    const harvestId = generateUUID();
    const candidateId = generateUUID();
    const reqId = generateUUID();
    const planId = generateUUID();
    const jobId = generateUUID();
    const ticketId = generateUUID();

    // 1. Harvest
    this.maxSequence++;
    const now1 = new Date().toISOString();
    const harvestEvent: EventEnvelope = {
      event_id: generateUUID(),
      event_type: 'harvest.captured',
      source: 'rover.batch_harvest_to_db',
      event_timestamp: now1,
      payload: {
        harvest_id: harvestId,
        source_origin: sourceName,
        title: `Harvested: ${transcript.slice(0, 45)}...`,
        transcript_preview: transcript,
        word_count: transcript.split(' ').length,
        language: 'en-US'
      },
      aggregate_type: 'harvest',
      aggregate_id: harvestId,
      actor_type: 'user',
      actor_id: 'console.manual_ingestion',
      correlation_id: correlationId,
      causation_id: null,
      caused_by_event_type: null,
      sequence_number: String(this.maxSequence),
      received_at: now1
    };
    this.events.unshift(harvestEvent);
    this.notify();
    if (onStep) onStep('Harvest Captured', harvestEvent);

    // 2. Candidate Discovery (simulated after short delay)
    await new Promise(r => setTimeout(r, 600));
    this.maxSequence++;
    const now2 = new Date().toISOString();
    const candEvent: EventEnvelope = {
      event_id: generateUUID(),
      event_type: 'candidate.discovered',
      source: 'rover.batch_file_candidates',
      event_timestamp: now2,
      payload: {
        harvest_id: harvestId,
        candidate_id: candidateId,
        title: `Extract Requirement: ${transcript.slice(0, 40)}`,
        problem_statement: transcript,
        cpf: 0.93,
        risk_level: 'Low'
      },
      aggregate_type: 'harvest_candidate',
      aggregate_id: candidateId,
      actor_type: 'agent',
      actor_id: 'rover.candidate_extractor',
      correlation_id: correlationId,
      causation_id: harvestEvent.event_id,
      caused_by_event_type: 'harvest.captured',
      sequence_number: String(this.maxSequence),
      received_at: now2
    };
    this.events.unshift(candEvent);
    this.notify();
    if (onStep) onStep('Candidate Discovered', candEvent);

    // 3. Assessment & Resolution
    await new Promise(r => setTimeout(r, 600));
    this.maxSequence++;
    const now3 = new Date().toISOString();
    const assessEvent: EventEnvelope = {
      event_id: generateUUID(),
      event_type: 'candidate.assessed',
      source: 'rover.planner',
      event_timestamp: now3,
      payload: {
        candidate_id: candidateId,
        cpf: 0.93,
        outcome: 'greenlit',
        confidence: 0.94,
        rationale_summary: 'Fully aligned with architectural roadmap. High feasibility confirmed.'
      },
      aggregate_type: 'harvest_candidate',
      aggregate_id: candidateId,
      actor_type: 'agent',
      actor_id: 'rover.planner',
      correlation_id: correlationId,
      causation_id: candEvent.event_id,
      caused_by_event_type: 'candidate.discovered',
      sequence_number: String(this.maxSequence),
      received_at: now3
    };
    this.events.unshift(assessEvent);
    this.assessments.unshift({
      resolution_id: generateUUID(),
      event_id: assessEvent.event_id,
      outcome: 'greenlit',
      confidence: 0.94,
      rationale: {
        summary: assessEvent.payload.rationale_summary,
        strengths: ['Clean architectural boundaries', 'High business payoff'],
        estimated_complexity: 'Medium',
        dimension_scores: { feasibility: 0.95, business_value: 0.92, technical_debt: 0.88, security_risk: 0.96, alignment: 0.97 }
      },
      dimensions_used: 5,
      dimensions_total: 5,
      resolved_at: now3,
      event_type: 'candidate.assessed',
      source: 'rover.planner',
      payload: assessEvent.payload
    });
    this.notify();
    if (onStep) onStep('Candidate Evaluated & Greenlit', assessEvent);

    // 4. Promotion & Intent
    await new Promise(r => setTimeout(r, 600));
    this.maxSequence++;
    const now4 = new Date().toISOString();
    const promoEvent: EventEnvelope = {
      event_id: generateUUID(),
      event_type: 'candidate.promoted',
      source: 'rover.candidate_promote',
      event_timestamp: now4,
      payload: {
        candidate_id: candidateId,
        requirement_id: reqId,
        status: 'promoted_to_requirement'
      },
      aggregate_type: 'harvest_candidate',
      aggregate_id: candidateId,
      actor_type: 'agent',
      actor_id: 'rover.candidate_promote',
      correlation_id: correlationId,
      causation_id: assessEvent.event_id,
      caused_by_event_type: 'candidate.assessed',
      sequence_number: String(this.maxSequence),
      received_at: now4
    };
    this.events.unshift(promoEvent);
    this.notify();
    if (onStep) onStep('Promoted to Formal Requirement', promoEvent);

    // 5. Plan Promotion
    await new Promise(r => setTimeout(r, 600));
    this.maxSequence++;
    const now5 = new Date().toISOString();
    const planEvent: EventEnvelope = {
      event_id: generateUUID(),
      event_type: 'requirement.promoted_to_plan',
      source: 'rover.req_compiler',
      event_timestamp: now5,
      payload: {
        requirement_id: reqId,
        plan_id: planId,
        sprint_target: 'Sprint 2026.35',
        tasks: ['Architecture spec', 'Harness sandbox', 'Unit tests', 'CI verification']
      },
      aggregate_type: 'requirement',
      aggregate_id: reqId,
      actor_type: 'agent',
      actor_id: 'rover.req_compiler',
      correlation_id: correlationId,
      causation_id: promoEvent.event_id,
      caused_by_event_type: 'candidate.promoted',
      sequence_number: String(this.maxSequence),
      received_at: now5
    };
    this.events.unshift(planEvent);
    this.notify();
    if (onStep) onStep('Compiled Implementation Plan', planEvent);

    // 6. Dev Harness Run & Completion
    await new Promise(r => setTimeout(r, 700));
    this.maxSequence++;
    const now6 = new Date().toISOString();
    const harnessStart: EventEnvelope = {
      event_id: generateUUID(),
      event_type: 'harness.started',
      source: 'harness-srv.run-autonomous',
      event_timestamp: now6,
      payload: {
        plan_id: planId,
        job_id: jobId,
        image: 'ghcr.io/nexus/runner:latest'
      },
      aggregate_type: 'harness_job',
      aggregate_id: jobId,
      actor_type: 'system',
      actor_id: 'harness-srv',
      correlation_id: correlationId,
      causation_id: planEvent.event_id,
      caused_by_event_type: 'requirement.promoted_to_plan',
      sequence_number: String(this.maxSequence),
      received_at: now6
    };
    this.events.unshift(harnessStart);
    this.notify();
    if (onStep) onStep('Dev Harness Booted', harnessStart);

    await new Promise(r => setTimeout(r, 800));
    this.maxSequence++;
    const now7 = new Date().toISOString();
    const harnessDone: EventEnvelope = {
      event_id: generateUUID(),
      event_type: 'harness.completed',
      source: 'harness-srv.run-autonomous',
      event_timestamp: now7,
      payload: {
        job_id: jobId,
        status: 'SUCCESS',
        tests_passed: 54,
        code_diff: '+192 / -22',
        pr_number: 142
      },
      aggregate_type: 'harness_job',
      aggregate_id: jobId,
      actor_type: 'agent',
      actor_id: 'harness-srv.codegen_agent',
      correlation_id: correlationId,
      causation_id: harnessStart.event_id,
      caused_by_event_type: 'harness.started',
      sequence_number: String(this.maxSequence),
      received_at: now7
    };
    this.events.unshift(harnessDone);
    this.notify();
    if (onStep) onStep('Harness Completed & PR Generated', harnessDone);

    // 7. Deploy completed
    await new Promise(r => setTimeout(r, 600));
    this.maxSequence++;
    const now8 = new Date().toISOString();
    const windDone: EventEnvelope = {
      event_id: generateUUID(),
      event_type: 'wind.ticket.completed',
      source: 'wind-srv',
      event_timestamp: now8,
      payload: {
        ticket_id: ticketId,
        environment: 'production-canary',
        status: 'DEPLOYED_SUCCESS'
      },
      aggregate_type: 'deployment',
      aggregate_id: ticketId,
      actor_type: 'system',
      actor_id: 'wind-srv.continuous_deployer',
      correlation_id: correlationId,
      causation_id: harnessDone.event_id,
      caused_by_event_type: 'harness.completed',
      sequence_number: String(this.maxSequence),
      received_at: now8
    };
    this.events.unshift(windDone);
    this.notify();
    if (onStep) onStep('Canary Deployment Verified', windDone);

    return correlationId;
  }

  // --- API Endpoint Implementations (Matching cascade-srv) ---

  // 1. GET /cascade/events
  public getEvents(filters: EventFilterState): {
    events: EventEnvelope[];
    total: number;
    limit: number;
    offset: number;
  } {
    let filtered = [...this.events];

    if (filters.type) {
      const typeLower = filters.type.toLowerCase();
      filtered = filtered.filter(e => e.event_type.toLowerCase() === typeLower || e.event_type.toLowerCase().includes(typeLower));
    }
    if (filters.source) {
      filtered = filtered.filter(e => e.source.toLowerCase().includes(filters.source!.toLowerCase()));
    }
    if (filters.aggregate_type) {
      filtered = filtered.filter(e => e.aggregate_type?.toLowerCase() === filters.aggregate_type!.toLowerCase());
    }
    if (filters.aggregate_id) {
      filtered = filtered.filter(e => e.aggregate_id === filters.aggregate_id);
    }
    if (filters.correlation_id) {
      filtered = filtered.filter(e => e.correlation_id === filters.correlation_id);
    }
    if (filters.actor_type) {
      filtered = filtered.filter(e => e.actor_type === filters.actor_type);
    }
    if (filters.status && filters.status !== 'all') {
      filtered = filtered.filter(e => getEventStatusBadge(e).status === filters.status);
    }
    if (filters.health_status && filters.health_status !== 'all') {
      filtered = filtered.filter(e => getEventHealthInfo(e).status === filters.health_status);
    }
    if (filters.severities && filters.severities.length > 0) {
      filtered = filtered.filter(e => filters.severities!.includes(getEventSeverity(e).level));
    } else if (filters.severity && filters.severity !== 'all') {
      filtered = filtered.filter(e => getEventSeverity(e).level === filters.severity);
    }
    const originFilter = filters.origin_tier || filters.event_origin;
    if (originFilter && originFilter !== 'all') {
      filtered = filtered.filter(e => getEventOrigin(e).tier === originFilter || e.source.toLowerCase().includes(originFilter.toLowerCase()));
    }
    if (filters.selected_tags && filters.selected_tags.length > 0) {
      filtered = filtered.filter(e => {
        const eTags = getEventTags(e).map(t => t.toLowerCase());
        return filters.selected_tags!.every(reqTag => {
          const cleanReq = reqTag.toLowerCase();
          return eTags.includes(cleanReq) || eTags.some(t => t.includes(cleanReq.replace('#', '')));
        });
      });
    }
    if (filters.metadata_key) {
      const key = filters.metadata_key.trim();
      const val = (filters.metadata_value || '').trim().toLowerCase();
      filtered = filtered.filter(e => {
        if (!e.payload) return false;
        if (!(key in e.payload)) return false;
        if (!val) return true;
        return String(e.payload[key]).toLowerCase().includes(val);
      });
    }
    if (filters.system_family && filters.system_family !== 'all') {
      filtered = filtered.filter(e => (e.system_family || getSystemFamily(e.event_type)) === filters.system_family);
    }
    if (filters.nats_subject) {
      filtered = filtered.filter(e => (e.nats_subject || getNatsSubject(e.event_type)).toLowerCase().includes(filters.nats_subject!.toLowerCase()));
    }
    if (filters.flagged_status && filters.flagged_status !== 'all') {
      if (filters.flagged_status === 'flagged') {
        filtered = filtered.filter(e => this.reviewFlags.has(e.event_id) && this.reviewFlags.get(e.event_id)!.status !== 'resolved' && this.reviewFlags.get(e.event_id)!.status !== 'dismissed');
      } else if (filters.flagged_status === 'unflagged') {
        filtered = filtered.filter(e => !this.reviewFlags.has(e.event_id));
      } else if (filters.flagged_status === 'pending') {
        filtered = filtered.filter(e => this.reviewFlags.get(e.event_id)?.status === 'pending');
      } else if (filters.flagged_status === 'resolved') {
        filtered = filtered.filter(e => this.reviewFlags.get(e.event_id)?.status === 'resolved');
      }
    }
    if (filters.since) {
      const sinceTime = new Date(filters.since).getTime();
      filtered = filtered.filter(e => new Date(e.event_timestamp).getTime() >= sinceTime);
    }
    if (filters.until) {
      const untilTime = new Date(filters.until).getTime();
      filtered = filtered.filter(e => new Date(e.event_timestamp).getTime() <= untilTime);
    }
    if (filters.search) {
      const q = filters.search.toLowerCase();
      filtered = filtered.filter(e => 
        e.event_id.toLowerCase().includes(q) ||
        e.event_type.toLowerCase().includes(q) ||
        e.source.toLowerCase().includes(q) ||
        (e.aggregate_id && e.aggregate_id.toLowerCase().includes(q)) ||
        JSON.stringify(e.payload).toLowerCase().includes(q)
      );
    }

    const total = filtered.length;
    const limit = Math.min(500, Math.max(1, filters.limit || 50));
    const offset = Math.max(0, filters.offset || 0);
    const pagedEvents = filtered.slice(offset, offset + limit).map(e => ({
      ...e,
      review_flag: this.reviewFlags.get(e.event_id) || null
    }));

    return {
      events: pagedEvents,
      total,
      limit,
      offset
    };
  }

  // 2. GET /cascade/events/:id
  public getEventById(id: string): EventEnvelope | null {
    return this.events.find(e => e.event_id === id) || null;
  }

  // 3. GET /cascade/events/:id/children
  public getEventChildren(id: string): { parent: string; children: ReducedChildEvent[] } {
    const children = this.events
      .filter(e => e.causation_id === id)
      .sort((a, b) => new Date(a.event_timestamp).getTime() - new Date(b.event_timestamp).getTime())
      .map(e => ({
        event_id: e.event_id,
        event_type: e.event_type,
        aggregate_type: e.aggregate_type,
        aggregate_id: e.aggregate_id,
        source: e.source,
        event_timestamp: e.event_timestamp
      }));

    return { parent: id, children };
  }

  // 4. GET /cascade/events/:id/lineage (Backward causation chain)
  public getEventLineage(id: string, maxDepth: number = 10): { anchor: string; chain: LineageChainItem[]; depth: number } {
    const clampedDepth = Math.min(20, Math.max(1, maxDepth));
    const chain: LineageChainItem[] = [];
    let currentId: string | null = id;
    let depth = 0;

    const visited = new Set<string>();

    while (currentId && depth <= clampedDepth) {
      if (visited.has(currentId)) break;
      visited.add(currentId);

      const evt = this.events.find(e => e.event_id === currentId);
      if (!evt) break;

      chain.push({
        ...evt,
        depth
      });

      currentId = evt.causation_id;
      depth++;
    }

    return {
      anchor: id,
      chain,
      depth: chain.length
    };
  }

  // 5. GET /cascade/lineage (Graph nodes + edges)
  public getLineageGraph(params: {
    root?: string;
    anchor?: string;
    maxDepth?: number;
    edgeType?: string;
  }): LineageGraphResponse {
    const maxDepth = Math.min(15, Math.max(1, params.maxDepth || 5));
    const edgeType = params.edgeType || 'caused_by';
    const seedId = params.root || params.anchor;

    if (!seedId) {
      // Pick the first event with children or root
      const sample = this.events.find(e => e.causation_id !== null) || this.events[0];
      const fallbackId = sample?.event_id || generateUUID();
      return this.getLineageGraph({ root: fallbackId, maxDepth, edgeType });
    }

    const direction = params.root ? 'forward' : 'backward';
    const nodes: LineageGraphResponse['nodes'] = [];
    const edges: LineageGraphResponse['edges'] = [];
    const visitedNodes = new Set<string>();
    const visitedEdges = new Set<string>();

    const queue: { id: string; depth: number }[] = [{ id: seedId, depth: 0 }];

    while (queue.length > 0) {
      const { id, depth } = queue.shift()!;
      if (depth > maxDepth) continue;

      if (!visitedNodes.has(id)) {
        visitedNodes.add(id);
        const evt = this.events.find(e => e.event_id === id);
        if (evt) {
          nodes.push({
            id: evt.event_id,
            type: evt.event_type,
            source: evt.source,
            timestamp: evt.event_timestamp,
            depth,
            aggregate_type: evt.aggregate_type,
            aggregate_id: evt.aggregate_id,
            stage: mapEventTypeToStage(evt.event_type)
          });
        }
      }

      if (direction === 'forward') {
        // Find events whose causation_id = current id
        const children = this.events.filter(e => e.causation_id === id);
        for (const child of children) {
          const edgeKey = `${id}->${child.event_id}`;
          if (!visitedEdges.has(edgeKey)) {
            visitedEdges.add(edgeKey);
            edges.push({
              source: id,
              target: child.event_id,
              type: edgeType
            });
          }
          if (!visitedNodes.has(child.event_id) && depth + 1 <= maxDepth) {
            queue.push({ id: child.event_id, depth: depth + 1 });
          }
        }
      } else {
        // Backward: find parent whose event_id = current causation_id
        const currEvt = this.events.find(e => e.event_id === id);
        if (currEvt && currEvt.causation_id) {
          const parentId = currEvt.causation_id;
          const edgeKey = `${parentId}->${id}`;
          if (!visitedEdges.has(edgeKey)) {
            visitedEdges.add(edgeKey);
            edges.push({
              source: parentId,
              target: id,
              type: edgeType
            });
          }
          if (!visitedNodes.has(parentId) && depth + 1 <= maxDepth) {
            queue.push({ id: parentId, depth: depth + 1 });
          }
        }
      }
    }

    return {
      root: seedId,
      direction,
      nodes,
      edges,
      truncated: nodes.length >= maxDepth * 10
    };
  }

  // 6. GET /cascade/analytics
  public getAnalytics(range: string = '24h', granularity: string = 'hour'): CascadeAnalytics {
    const totalEvents = this.events.length;

    // Throughput by event_type
    const typeCountMap: Record<string, number> = {};
    const sourceCountMap: Record<string, number> = {};

    this.events.forEach(e => {
      typeCountMap[e.event_type] = (typeCountMap[e.event_type] || 0) + 1;
      sourceCountMap[e.source] = (sourceCountMap[e.source] || 0) + 1;
    });

    const throughput = Object.entries(typeCountMap)
      .map(([event_type, count]) => ({ event_type, count }))
      .sort((a, b) => b.count - a.count);

    const topSources = Object.entries(sourceCountMap)
      .map(([source, count]) => ({ source, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Timeline buckets
    const now = Date.now();
    const timeline: CascadeAnalytics['timeline'] = [];
    const bucketCount = 12;

    for (let i = bucketCount - 1; i >= 0; i--) {
      const bucketTime = new Date(now - i * 3600 * 1000 * 2).toISOString().slice(0, 13) + ':00:00Z';
      const topType = throughput[0]?.event_type || 'harvest.captured';
      timeline.push({
        bucket: bucketTime,
        event_type: topType,
        count: Math.floor(Math.random() * 25) + 5
      });
    }

    // Pipeline funnel distinct aggregate counts
    const harvests = this.events.filter(e => e.event_type === 'harvest.captured').length;
    const candidates = this.events.filter(e => e.event_type === 'candidate.discovered').length;
    const promoted = this.events.filter(e => e.event_type === 'candidate.promoted').length;
    const intent_records = this.events.filter(e => e.event_type === 'intent_record.created').length;
    const plans = this.events.filter(e => e.event_type === 'requirement.promoted_to_plan').length;
    const harness_jobs = this.events.filter(e => e.event_type.startsWith('harness.')).length;
    const deployments = this.events.filter(e => e.event_type.startsWith('wind.')).length;

    return {
      range,
      granularity,
      totalEvents,
      throughput,
      timeline,
      pipelineFunnel: {
        harvests,
        candidates,
        promoted,
        intent_records,
        plans,
        harness_jobs,
        deployments
      },
      topSources
    };
  }

  // 7. GET /cascade/assessments
  public getAssessments(filters: {
    outcome?: string;
    event_id?: string;
    limit?: number;
    offset?: number;
  }): {
    assessments: AssessmentResolution[];
    total: number;
    limit: number;
    offset: number;
  } {
    let filtered = [...this.assessments];

    if (filters.outcome) {
      filtered = filtered.filter(a => a.outcome.toLowerCase() === filters.outcome!.toLowerCase());
    }
    if (filters.event_id) {
      filtered = filtered.filter(a => a.event_id === filters.event_id);
    }

    const total = filtered.length;
    const limit = Math.min(200, Math.max(1, filters.limit || 50));
    const offset = Math.max(0, filters.offset || 0);

    return {
      assessments: filtered.slice(offset, offset + limit),
      total,
      limit,
      offset
    };
  }

  // 8. GET /cascade/subscribers
  public getSubscribers(): { subscribers: Subscriber[] } {
    return { subscribers: this.subscribers };
  }

  // 9. GET /cascade/subscribers/:pattern
  public getSubscriberByPattern(pattern: string): Subscriber | null {
    return this.subscribers.find(s => s.subject_pattern === pattern) || null;
  }

  // 10. PATCH /cascade/subscribers/:pattern
  public updateSubscriber(pattern: string, enabled: boolean): Subscriber | null {
    const sub = this.subscribers.find(s => s.subject_pattern === pattern);
    if (!sub) return null;
    sub.enabled = enabled;
    this.notify();
    return sub;
  }

  // 11. GET /cascade/health
  public getHealth(): CascadeHealth {
    return {
      status: 'ok',
      schema: 'cascade',
      totalEvents: this.events.length,
      time: new Date().toISOString(),
      port: 3106,
      uptime_seconds: 184290,
      active_subscribers: this.subscribers.filter(s => s.enabled).length
    };
  }

  // 12. GET / (root info)
  public getRootInfo(): { name: string; version: string; port: number } {
    return {
      name: 'cascade-srv',
      version: '1.0.0',
      port: 3106
    };
  }

  // Correlation IDs list
  public getCorrelationWorkflows(): { correlation_id: string; title: string; count: number; stage: LifecycleStage; firstSeen: string }[] {
    const map = new Map<string, { events: EventEnvelope[] }>();
    this.events.forEach(e => {
      if (e.correlation_id) {
        if (!map.has(e.correlation_id)) {
          map.set(e.correlation_id, { events: [] });
        }
        map.get(e.correlation_id)!.events.push(e);
      }
    });

    const workflows: { correlation_id: string; title: string; count: number; stage: LifecycleStage; firstSeen: string }[] = [];
    map.forEach((data, corrId) => {
      const sorted = data.events.sort((a, b) => new Date(a.event_timestamp).getTime() - new Date(b.event_timestamp).getTime());
      const first = sorted[0];
      const last = sorted[sorted.length - 1];
      const title = first.payload?.title || first.payload?.transcript_preview?.slice(0, 40) || `Workflow ${corrId.substring(0, 8)}`;
      workflows.push({
        correlation_id: corrId,
        title,
        count: sorted.length,
        stage: mapEventTypeToStage(last.event_type),
        firstSeen: first.event_timestamp
      });
    });

    return workflows.sort((a, b) => new Date(b.firstSeen).getTime() - new Date(a.firstSeen).getTime());
  }

  // ==========================================
  // BATCH OPERATIONS & REVIEW WORKBENCH API
  // ==========================================

  public getReviewFlags(): EventReviewFlag[] {
    return Array.from(this.reviewFlags.values()).sort(
      (a, b) => new Date(b.flagged_at).getTime() - new Date(a.flagged_at).getTime()
    );
  }

  public getFlaggedEvents(): EventEnvelope[] {
    const activeIds = Array.from(this.reviewFlags.entries())
      .filter(([_, flag]) => flag.status !== 'resolved' && flag.status !== 'dismissed')
      .map(([id]) => id);
    
    return this.events
      .filter(e => activeIds.includes(e.event_id))
      .map(e => ({ ...e, review_flag: this.reviewFlags.get(e.event_id) || null }));
  }

  public flagEventsForReview(
    eventIds: string[], 
    params: { 
      reason: string; 
      category?: EventReviewFlag['category']; 
      priority?: EventReviewFlag['priority']; 
      assigned_to?: string; 
      notes?: string;
      flagged_by?: string;
    }
  ): { success: boolean; count: number } {
    let count = 0;
    const now = new Date().toISOString();

    eventIds.forEach(id => {
      const evt = this.events.find(e => e.event_id === id);
      if (evt) {
        this.reviewFlags.set(id, {
          event_id: id,
          flagged_at: now,
          flagged_by: params.flagged_by || 'secops_engineer',
          reason: params.reason || 'Manual review requested via Batch Workbench',
          category: params.category || 'manual_audit',
          priority: params.priority || 'medium',
          status: 'pending',
          notes: params.notes || '',
          assigned_to: params.assigned_to || 'tackle_triage_team'
        });
        evt.review_flag = this.reviewFlags.get(id);
        count++;
      }
    });

    if (count > 0) {
      this.batchAudits.unshift({
        id: generateUUID(),
        timestamp: now,
        action: 'flag_for_review',
        target_count: count,
        event_ids: eventIds,
        details: params,
        performed_by: params.flagged_by || 'secops_engineer',
        status: 'success'
      });
      this.notify();
    }

    return { success: count > 0, count };
  }

  public resolveReviewFlags(
    eventIds: string[], 
    resolutionNotes?: string,
    resolverName?: string
  ): { success: boolean; count: number } {
    let count = 0;
    const now = new Date().toISOString();

    eventIds.forEach(id => {
      const flag = this.reviewFlags.get(id);
      if (flag) {
        flag.status = 'resolved';
        flag.resolution_notes = resolutionNotes || 'Audited and verified in Batch Workbench';
        flag.resolved_at = now;
        count++;
      }
    });

    if (count > 0) {
      this.batchAudits.unshift({
        id: generateUUID(),
        timestamp: now,
        action: 'resolve_review',
        target_count: count,
        event_ids: eventIds,
        details: { resolution_notes: resolutionNotes },
        performed_by: resolverName || 'lead_investigator',
        status: 'success'
      });
      this.notify();
    }

    return { success: count > 0, count };
  }

  public unflagEvents(eventIds: string[]): { success: boolean; count: number } {
    let count = 0;
    eventIds.forEach(id => {
      if (this.reviewFlags.delete(id)) {
        const evt = this.events.find(e => e.event_id === id);
        if (evt) evt.review_flag = null;
        count++;
      }
    });

    if (count > 0) {
      this.batchAudits.unshift({
        id: generateUUID(),
        timestamp: new Date().toISOString(),
        action: 'batch_unflag',
        target_count: count,
        event_ids: eventIds,
        details: {},
        performed_by: 'operator',
        status: 'success'
      });
      this.notify();
    }

    return { success: count > 0, count };
  }

  public batchTagEvents(
    eventIds: string[], 
    tags: string[], 
    action: 'add' | 'remove' | 'set' = 'add'
  ): { success: boolean; count: number } {
    let count = 0;
    eventIds.forEach(id => {
      const evt = this.events.find(e => e.event_id === id);
      if (evt) {
        const current = new Set(evt.tags || []);
        if (action === 'add') {
          tags.forEach(t => current.add(t));
        } else if (action === 'remove') {
          tags.forEach(t => current.delete(t));
        } else if (action === 'set') {
          current.clear();
          tags.forEach(t => current.add(t));
        }
        evt.tags = Array.from(current);
        count++;
      }
    });

    if (count > 0) {
      this.batchAudits.unshift({
        id: generateUUID(),
        timestamp: new Date().toISOString(),
        action: 'batch_tag',
        target_count: count,
        event_ids: eventIds,
        details: { tags, action },
        performed_by: 'operator',
        status: 'success'
      });
      this.notify();
    }

    return { success: count > 0, count };
  }

  public batchAssessCandidates(
    eventIds: string[], 
    outcome: string, 
    notes?: string
  ): { success: boolean; count: number } {
    let count = 0;
    const now = new Date().toISOString();

    eventIds.forEach(id => {
      const evt = this.events.find(e => e.event_id === id);
      if (evt) {
        const resolution: AssessmentResolution = {
          resolution_id: generateUUID(),
          event_id: id,
          outcome: (outcome === 'PROMOTED' ? 'greenlit' : outcome === 'DISMISSED' ? 'rejected' : 'escalated') as any,
          confidence: 0.94,
          rationale: {
            summary: notes || `Batch assessed and resolved as ${outcome} via Batch Operations Workbench`,
            strengths: ['Batch verified by operational review team', 'Passes schema validation'],
            risks: outcome === 'DISMISSED' ? ['Flagged as low impact'] : ['Normal lifecycle integration'],
            estimated_complexity: 'Medium'
          },
          dimensions_used: 5,
          dimensions_total: 5,
          resolved_at: now,
          event_type: evt.event_type,
          source: evt.source,
          payload: evt.payload
        };
        this.assessments.unshift(resolution);
        count++;
      }
    });

    if (count > 0) {
      this.batchAudits.unshift({
        id: generateUUID(),
        timestamp: now,
        action: 'batch_assess',
        target_count: count,
        event_ids: eventIds,
        details: { outcome, notes },
        performed_by: 'qa_reviewer',
        status: 'success'
      });
      this.notify();
    }

    return { success: count > 0, count };
  }

  public getBatchAudits(): BatchOperationAudit[] {
    return [...this.batchAudits];
  }

  public getActiveBatchJob(): BatchSimulationJob | null {
    return this.activeBatchJob;
  }

  public async runBatchReSimulation(
    eventIds: string[],
    options?: Partial<BatchSimulationJob['options']>,
    onProgress?: (job: BatchSimulationJob) => void
  ): Promise<BatchSimulationJob> {
    const fullOptions: BatchSimulationJob['options'] = {
      replay_mode: options?.replay_mode || 'mutate_timestamp',
      speed_multiplier: options?.speed_multiplier || 1,
      delay_ms: options?.delay_ms !== undefined ? options.delay_ms : 120,
      override_source: options?.override_source,
      preserve_causation: options?.preserve_causation !== undefined ? options.preserve_causation : true,
      inject_faults: options?.inject_faults || false
    };

    const jobId = `job-resim-${generateUUID().substring(0, 8)}`;
    const job: BatchSimulationJob = {
      job_id: jobId,
      started_at: new Date().toISOString(),
      status: 'running',
      total: eventIds.length,
      processed: 0,
      success_count: 0,
      failed_count: 0,
      event_ids: eventIds,
      replayed_events: [],
      options: fullOptions,
      logs: [
        {
          timestamp: new Date().toISOString(),
          message: `Initiating batch re-simulation for ${eventIds.length} envelopes in mode: ${fullOptions.replay_mode}`,
          level: 'info'
        }
      ]
    };

    this.activeBatchJob = job;
    this.notify();
    if (onProgress) onProgress(job);

    const sourceEvents = eventIds
      .map(id => this.events.find(e => e.event_id === id))
      .filter((e): e is EventEnvelope => Boolean(e));

    for (let i = 0; i < sourceEvents.length; i++) {
      const src = sourceEvents[i];
      const stepDelay = Math.max(20, fullOptions.delay_ms / (fullOptions.speed_multiplier || 1));
      await new Promise(r => setTimeout(r, stepDelay));

      try {
        this.maxSequence++;
        const now = new Date().toISOString();
        const newId = generateUUID();

        // Determine if fault is injected
        const isFault = fullOptions.inject_faults && (i % 4 === 0);

        const newEvent: EventEnvelope = {
          event_id: newId,
          event_type: src.event_type,
          source: fullOptions.override_source || src.source,
          event_timestamp: fullOptions.replay_mode === 'replay_identical' ? src.event_timestamp : now,
          payload: {
            ...src.payload,
            _resimulated_from: src.event_id,
            _simulation_job: jobId,
            ...(isFault ? { status: 'FAILED', error_code: 'SIMULATED_REPLAY_INDUCED_FAULT' } : {})
          },
          aggregate_type: src.aggregate_type,
          aggregate_id: src.aggregate_id,
          actor_type: src.actor_type,
          actor_id: `${src.actor_id}.resim`,
          correlation_id: fullOptions.preserve_causation ? src.correlation_id : generateUUID(),
          causation_id: fullOptions.preserve_causation ? src.event_id : null,
          caused_by_event_type: src.event_type,
          sequence_number: String(this.maxSequence),
          received_at: now,
          nats_subject: getNatsSubject(src.event_type),
          system_family: getSystemFamily(src.event_type)
        };

        this.events.unshift(newEvent);
        this.updateSubscribersOnNewEvent(newEvent);

        job.processed++;
        if (isFault) {
          job.failed_count++;
          job.logs.unshift({
            timestamp: now,
            message: `[${job.processed}/${job.total}] Replayed event ${src.event_type} (${src.sequence_number}) -> ${newId} with FAULT injection`,
            level: 'warn'
          });
        } else {
          job.success_count++;
          job.logs.unshift({
            timestamp: now,
            message: `[${job.processed}/${job.total}] Replayed ${src.event_type} -> Envelope ${newId.substring(0, 8)} (Seq #${this.maxSequence})`,
            level: 'success'
          });
        }

        job.replayed_events.push(newEvent);
        this.notify();
        if (onProgress) onProgress({ ...job });

      } catch (err: any) {
        job.processed++;
        job.failed_count++;
        job.logs.unshift({
          timestamp: new Date().toISOString(),
          message: `Failed replaying event ${src.event_id}: ${err?.message || 'Execution error'}`,
          level: 'error'
        });
        this.notify();
        if (onProgress) onProgress({ ...job });
      }
    }

    job.status = 'completed';
    job.completed_at = new Date().toISOString();
    job.logs.unshift({
      timestamp: job.completed_at,
      message: `Batch re-simulation job finished: ${job.success_count} succeeded, ${job.failed_count} errors.`,
      level: job.failed_count > 0 ? 'warn' : 'success'
    });

    this.batchAudits.unshift({
      id: generateUUID(),
      timestamp: job.completed_at,
      action: 're_simulate',
      target_count: job.processed,
      event_ids: eventIds,
      details: {
        job_id: jobId,
        success_count: job.success_count,
        failed_count: job.failed_count,
        options: fullOptions
      },
      performed_by: 'batch_resim_engine',
      status: job.failed_count === 0 ? 'success' : 'warning'
    });

    this.notify();
    if (onProgress) onProgress({ ...job });
    return job;
  }
}

export const cascadeStore = new CascadeStore();
