/**
 * Canonical Event Envelope and Cascade API Type Definitions
 * Following cascade-srv REST API & Envelope Specification
 */

export type ActorType = 'user' | 'agent' | 'system';

export type LifecycleStage = 
  | 'harvest' 
  | 'candidate' 
  | 'assessment' 
  | 'requirement' 
  | 'planning' 
  | 'harness' 
  | 'deployment'
  | 'scheduler'
  | 'timeclock'
  | 'nebula'
  | 'lease'
  | 'registry'
  | 'voyager'
  | 'execution'
  | 'circuit'
  | 'substance'
  | 'mcp'
  | 'wrp';

export type SystemFamily = 
  | 'lifecycle'
  | 'scheduler'
  | 'timeclock'
  | 'nebula'
  | 'harness'
  | 'lease'
  | 'registry'
  | 'voyager'
  | 'execution'
  | 'circuit'
  | 'substance'
  | 'mcp'
  | 'wrp';

export interface SystemFamilyInfo {
  id: SystemFamily;
  name: string;
  domain: string;
  natsSubjectPrefix: string;
  description: string;
  tableOrChannel: string;
  badgeClass: string;
  borderClass: string;
  textClass: string;
  dotClass: string;
}

export interface EventEnvelope {
  event_id: string;
  event_type: string;
  source: string;
  event_timestamp: string; // ISO 8601 UTC
  payload: Record<string, any>;
  aggregate_type: string | null;
  aggregate_id: string | null;
  actor_type: ActorType;
  actor_id: string;
  correlation_id: string | null;
  causation_id: string | null;
  caused_by_event_type: string | null;
  sequence_number: string; // BigInt string
  received_at: string; // ISO 8601 UTC
  nats_subject?: string;
  system_family?: SystemFamily;
  review_flag?: EventReviewFlag | null;
  tags?: string[];
}

export interface ReducedChildEvent {
  event_id: string;
  event_type: string;
  aggregate_type: string | null;
  aggregate_id: string | null;
  source: string;
  event_timestamp: string;
}

export interface LineageChainItem extends EventEnvelope {
  depth: number;
}

export interface LineageGraphNode {
  id: string;
  type: string;
  source: string;
  timestamp: string;
  depth: number;
  aggregate_type?: string | null;
  aggregate_id?: string | null;
  stage?: LifecycleStage;
}

export interface LineageGraphEdge {
  source: string; // causation_id
  target: string; // event_id
  type: string;   // 'caused_by'
}

export interface LineageGraphResponse {
  root: string;
  direction: 'forward' | 'backward';
  nodes: LineageGraphNode[];
  edges: LineageGraphEdge[];
  truncated: boolean;
}

export interface AssessmentRationale {
  summary: string;
  strengths?: string[];
  risks?: string[];
  dependencies?: string[];
  estimated_complexity?: 'Low' | 'Medium' | 'High' | 'Critical';
  target_component?: string;
  dimension_scores?: {
    feasibility: number;
    business_value: number;
    technical_debt: number;
    security_risk: number;
    alignment: number;
  };
}

export interface AssessmentResolution {
  resolution_id: string;
  event_id: string;
  outcome: 'approved' | 'greenlit' | 'escalated' | 'needs_clarification' | 'rejected';
  confidence: number; // 0.0 - 1.0
  rationale: AssessmentRationale;
  dimensions_used: number;
  dimensions_total: number;
  resolved_at: string;
  event_type: string;
  source: string;
  payload: Record<string, any>;
}

export interface Subscriber {
  subject_pattern: string;
  handler_name: string;
  description: string | null;
  enabled: boolean;
  created_at: string;
  last_processed: string | null;
  processed_ids: string[];
  last_processed_at: string | null;
  lag: number;
}

export interface AnalyticsThroughput {
  event_type: string;
  count: number;
}

export interface AnalyticsTimelineBucket {
  bucket: string;
  event_type: string;
  count: number;
}

export interface PipelineFunnel {
  harvests: number;
  candidates: number;
  promoted: number;
  intent_records: number;
  plans: number;
  harness_jobs: number;
  deployments: number;
}

export interface TopSource {
  source: string;
  count: number;
}

export interface CascadeAnalytics {
  range: string;
  granularity: string;
  totalEvents: number;
  throughput: AnalyticsThroughput[];
  timeline: AnalyticsTimelineBucket[];
  pipelineFunnel: PipelineFunnel;
  topSources: TopSource[];
}

export interface CascadeHealth {
  status: 'ok' | 'degraded' | 'error';
  schema: string;
  totalEvents: number;
  time: string;
  port: number;
  uptime_seconds?: number;
  active_subscribers?: number;
}

export type EventHealthStatus = 'success' | 'warning' | 'failed';

export type EventVisualStatus = 'Success' | 'Pending' | 'Failure' | 'Warning';

export interface EventStatusBadgeInfo {
  status: EventVisualStatus;
  label: string;
  sublabel?: string;
  badgeClass: string;
  dotClass: string;
  glowClass: string;
  reason: string;
  metadataKey?: string;
  metadataValue?: string | number;
}

export interface EventHealthInfo {
  status: EventHealthStatus;
  label: string;
  badgeClass: string;
  dotClass: string;
  glowClass: string;
  reason: string;
}

export type AppTheme = 'dark' | 'steel' | 'light';

export type ActiveView = 
  | 'overview'
  | 'ledger'
  | 'batch'
  | 'lineage'
  | 'pipeline'
  | 'assessments'
  | 'subscribers'
  | 'simulator'
  | 'api_explorer';

export interface EventReviewFlag {
  event_id: string;
  flagged_at: string;
  flagged_by: string;
  reason: string;
  category: 'anomaly' | 'schema_mismatch' | 'circuit_trip' | 'latency_spike' | 'drift' | 'manual_audit' | 'other';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'pending' | 'in_review' | 'resolved' | 'dismissed';
  notes?: string;
  assigned_to?: string;
  resolution_notes?: string;
  resolved_at?: string;
}

export interface BatchSimulationJob {
  job_id: string;
  started_at: string;
  completed_at?: string;
  status: 'idle' | 'running' | 'completed' | 'failed' | 'paused';
  total: number;
  processed: number;
  success_count: number;
  failed_count: number;
  event_ids: string[];
  replayed_events: EventEnvelope[];
  options: {
    replay_mode: 'replay_identical' | 'mutate_timestamp' | 're_evaluate' | 'trigger_downstream';
    speed_multiplier: number;
    delay_ms: number;
    override_source?: string;
    preserve_causation?: boolean;
    inject_faults?: boolean;
  };
  logs: Array<{ timestamp: string; message: string; level: 'info' | 'warn' | 'error' | 'success' }>;
}

export interface BatchOperationAudit {
  id: string;
  timestamp: string;
  action: 're_simulate' | 'flag_for_review' | 'resolve_review' | 'batch_assess' | 'batch_export' | 'batch_tag' | 'batch_unflag';
  target_count: number;
  event_ids: string[];
  details: Record<string, any>;
  performed_by: string;
  status: 'success' | 'warning' | 'failed';
}

export type EventSeverityLevel = 'critical' | 'error' | 'warning' | 'info' | 'debug';

export type EventOriginTier = 
  | 'all' 
  | 'rover-ingest' 
  | 'harness-devloop' 
  | 'nexus-kernel' 
  | 'nebula-cloud' 
  | 'voyager-fs' 
  | 'mcp-gateway' 
  | 'execution-drift';

export interface EventFilterState {
  type?: string;
  source?: string;
  aggregate_type?: string;
  aggregate_id?: string;
  correlation_id?: string;
  actor_type?: string;
  status?: EventVisualStatus | 'all';
  health_status?: EventHealthStatus | 'all';
  severity?: EventSeverityLevel | 'all';
  severities?: EventSeverityLevel[];
  event_origin?: EventOriginTier | string;
  origin_tier?: EventOriginTier;
  selected_tags?: string[];
  metadata_key?: string;
  metadata_value?: string;
  system_family?: SystemFamily | 'all';
  nats_subject?: string;
  flagged_status?: 'all' | 'flagged' | 'unflagged' | 'pending' | 'resolved';
  search?: string;
  since?: string;
  until?: string;
  limit: number;
  offset: number;
}

export type DateRangePreset = '15m' | '1h' | '6h' | '12h' | '24h' | '3d' | '7d' | '30d' | 'all' | 'custom';

export interface GlobalDateRangeState {
  preset: DateRangePreset;
  startDate: string | null; // ISO timestamp
  endDate: string | null;   // ISO timestamp
  label: string;
}

