import { EventEnvelope } from '../types';

export type HighlightVisualEffect = 'pulse_and_tint' | 'tint_only' | 'pulse_only';
export type HighlightTarget = 'all_breaches' | 'latency_only' | 'errors_only';

export interface ThresholdHighlightConfig {
  enabled: boolean;
  latencyThresholdMs: number; // in milliseconds, e.g. 45ms, 60ms, 100ms
  target: HighlightTarget;
  effect: HighlightVisualEffect;
  onlyShowBreachedRows: boolean; // fast filter to view only rows violating thresholds
}

export const DEFAULT_THRESHOLD_CONFIG: ThresholdHighlightConfig = {
  enabled: true,
  latencyThresholdMs: 45,
  target: 'all_breaches',
  effect: 'pulse_and_tint',
  onlyShowBreachedRows: false
};

const STORAGE_KEY = 'cascade_ledger_threshold_highlight_v1';

export function loadThresholdHighlightConfig(): ThresholdHighlightConfig {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      return {
        ...DEFAULT_THRESHOLD_CONFIG,
        ...parsed
      };
    }
  } catch (err) {
    console.warn('Failed to load threshold highlight config from localStorage:', err);
  }
  return DEFAULT_THRESHOLD_CONFIG;
}

export function saveThresholdHighlightConfig(config: ThresholdHighlightConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.warn('Failed to save threshold highlight config to localStorage:', err);
  }
}

export interface EventThresholdBreach {
  isBreached: boolean;
  isHighLatency: boolean;
  hasErrorCode: boolean;
  latencyMs: number;
  latencyThreshold: number;
  errorCode?: string | number;
  errorLabel?: string;
  errorMessage?: string;
  breachType: 'latency' | 'error' | 'both' | 'none';
  primaryReason: string;
  badgeLabel: string;
  badgeClass: string;
}

/**
 * Extracts normalized execution latency in milliseconds for any event envelope
 */
export function extractEnvelopeLatency(evt: EventEnvelope): number {
  const p = evt.payload || {};

  // 1. Explicit latency in milliseconds
  if (typeof p.latency_ms === 'number' && p.latency_ms >= 0) {
    return p.latency_ms;
  }
  if (typeof p.execution_time_ms === 'number' && p.execution_time_ms >= 0) {
    return p.execution_time_ms;
  }
  if (typeof p.duration_ms === 'number' && p.duration_ms >= 0) {
    return p.duration_ms;
  }
  if (typeof p.lag_ms === 'number' && p.lag_ms >= 0) {
    return p.lag_ms;
  }

  // 2. If timeout_ms is specified on a failed event
  if (typeof p.timeout_ms === 'number' && (evt.event_type.includes('timeout') || p.status === 'FAILED')) {
    return p.timeout_ms;
  }

  // 3. Network ingestion / queue delta from received_at vs event_timestamp
  if (evt.received_at && evt.event_timestamp) {
    const delta = new Date(evt.received_at).getTime() - new Date(evt.event_timestamp).getTime();
    if (delta > 0 && delta < 600000) {
      return delta;
    }
  }

  // 4. Default nominal baseline by category
  if (evt.event_type.includes('harness')) return 35;
  if (evt.event_type.includes('voyager')) return 22;
  if (evt.event_type.includes('scheduler')) return 16;
  if (evt.event_type.includes('mcp')) return 24;
  return 12;
}

/**
 * Detects if an envelope carries an explicit error code, exit code, or failure state
 */
export function detectEnvelopeErrorCode(evt: EventEnvelope): {
  hasError: boolean;
  code?: string | number;
  label?: string;
  message?: string;
} {
  const p = evt.payload || {};
  const type = (evt.event_type || '').toLowerCase();
  const statusStr = String(p.status || '').toUpperCase();
  const execStatus = String(p.execution_status || p.state || '').toUpperCase();

  // 1. Exit code (e.g. exit_code: 137, exit_code: 1)
  if (p.exit_code !== undefined && p.exit_code !== null && p.exit_code !== 0) {
    return {
      hasError: true,
      code: p.exit_code,
      label: `Exit ${p.exit_code}`,
      message: p.error || p.error_detail || `Process exited with code ${p.exit_code}`
    };
  }

  // 2. HTTP status code (e.g. 400, 404, 429, 500, 502, 503)
  if (typeof p.status_code === 'number' && p.status_code >= 400) {
    return {
      hasError: true,
      code: p.status_code,
      label: `HTTP ${p.status_code}`,
      message: p.error || p.message || `HTTP ${p.status_code} Error`
    };
  }

  // 3. Explicit error code (e.g. 'ERR_TIMEOUT', 'RATE_LIMITED', 'CIRCUIT_TRIPPED')
  if (p.error_code) {
    const c = String(p.error_code);
    return {
      hasError: true,
      code: c,
      label: c.length > 14 ? c.slice(0, 12) + '…' : c,
      message: p.error || p.error_message || p.reason || c
    };
  }

  // 4. Error class (e.g. 'SchemaValidationError', 'ResourceExhausted')
  if (p.error_class) {
    const ec = String(p.error_class);
    return {
      hasError: true,
      code: ec,
      label: ec.replace('Error', '').slice(0, 12),
      message: p.details || p.error || ec
    };
  }

  // 5. Test failures
  if (typeof p.tests_failed === 'number' && p.tests_failed > 0) {
    return {
      hasError: true,
      code: `FAIL:${p.tests_failed}`,
      label: `${p.tests_failed} Tests Failed`,
      message: `${p.tests_failed} sandbox validation tests failed`
    };
  }

  // 6. Specific error event types
  if (type.includes('circuit_breaker.tripped') || type.includes('circuit.tripped')) {
    return {
      hasError: true,
      code: 'CIRCUIT_TRIPPED',
      label: 'Circuit Tripped',
      message: p.error || 'Circuit breaker tripped due to error spike'
    };
  }

  if (type.includes('execution.drift.detected') || type.includes('drift')) {
    return {
      hasError: true,
      code: 'DRIFT_DETECTED',
      label: 'Execution Drift',
      message: p.error_detail || p.kind || 'Execution drift detected against baseline'
    };
  }

  if (type.includes('kernel.invariant_violated')) {
    return {
      hasError: true,
      code: 'INVARIANT_VIOLATION',
      label: 'Invariant Violated',
      message: p.error || 'Kernel DAG invariant violated'
    };
  }

  if (type.includes('call.timed_out')) {
    return {
      hasError: true,
      code: 'TIMEOUT',
      label: 'Timed Out',
      message: `Execution timed out after ${p.timeout_ms || 120000}ms`
    };
  }

  if (type.includes('arguments_invalid')) {
    return {
      hasError: true,
      code: 'INVALID_ARGS',
      label: 'Args Invalid',
      message: p.details || 'Tool arguments validation failed'
    };
  }

  // 7. Generic error payload or status
  if (statusStr === 'FAILED' || statusStr === 'ERROR' || execStatus === 'FAILED' || p.health_status === 'failed' || type.endsWith('.failed') || type.endsWith('.error')) {
    const errorMsg = p.error || p.error_message || p.failure_reason || p.reason;
    return {
      hasError: true,
      code: 'ERR',
      label: typeof errorMsg === 'string' && errorMsg.includes('ResourceExhausted') 
        ? 'ResExhausted' 
        : typeof errorMsg === 'string' && errorMsg.includes('InvalidCron') 
          ? 'InvalidCron' 
          : 'Failed',
      message: errorMsg || 'Event marked as failed'
    };
  }

  return { hasError: false };
}

/**
 * Evaluates whether an event envelope breaches the current highlight thresholds
 */
export function evaluateEventThresholdBreach(
  evt: EventEnvelope,
  config: ThresholdHighlightConfig
): EventThresholdBreach {
  const latencyMs = extractEnvelopeLatency(evt);
  const isHighLatency = latencyMs >= config.latencyThresholdMs;
  const errorInfo = detectEnvelopeErrorCode(evt);
  const hasErrorCode = errorInfo.hasError;

  let isBreached = false;
  let breachType: 'latency' | 'error' | 'both' | 'none' = 'none';

  if (config.enabled) {
    if (config.target === 'all_breaches') {
      if (isHighLatency && hasErrorCode) {
        isBreached = true;
        breachType = 'both';
      } else if (isHighLatency) {
        isBreached = true;
        breachType = 'latency';
      } else if (hasErrorCode) {
        isBreached = true;
        breachType = 'error';
      }
    } else if (config.target === 'latency_only') {
      if (isHighLatency) {
        isBreached = true;
        breachType = 'latency';
      }
    } else if (config.target === 'errors_only') {
      if (hasErrorCode) {
        isBreached = true;
        breachType = 'error';
      }
    }
  }

  let badgeLabel = '';
  let badgeClass = '';
  let primaryReason = '';

  if (breachType === 'both') {
    badgeLabel = `${errorInfo.label || 'Err'} • ${latencyMs}ms`;
    badgeClass = 'bg-rose-500/20 text-rose-300 border-rose-500/40 ring-1 ring-rose-500/30';
    primaryReason = `Threshold breached: Error (${errorInfo.label}) and Latency (${latencyMs}ms >= ${config.latencyThresholdMs}ms)`;
  } else if (breachType === 'error') {
    badgeLabel = errorInfo.label || 'Error';
    badgeClass = 'bg-rose-500/20 text-rose-300 border-rose-500/40';
    primaryReason = `Error code flagged: ${errorInfo.message || errorInfo.label || 'Failed'}`;
  } else if (breachType === 'latency') {
    badgeLabel = `${latencyMs}ms`;
    badgeClass = 'bg-amber-500/20 text-amber-300 border-amber-500/40';
    primaryReason = `High latency breached: ${latencyMs}ms >= ${config.latencyThresholdMs}ms threshold`;
  }

  return {
    isBreached,
    isHighLatency,
    hasErrorCode,
    latencyMs,
    latencyThreshold: config.latencyThresholdMs,
    errorCode: errorInfo.code,
    errorLabel: errorInfo.label,
    errorMessage: errorInfo.message,
    breachType,
    primaryReason,
    badgeLabel,
    badgeClass
  };
}

/**
 * Returns the CSS styling classes for table rows based on breach status and configured effect
 */
export function getRowHighlightClasses(
  breach: EventThresholdBreach,
  config: ThresholdHighlightConfig,
  isDark: boolean = true,
  isSteel: boolean = false
): {
  rowClass: string;
  borderLeftClass: string;
  isAnimated: boolean;
} {
  if (!config.enabled || !breach.isBreached || breach.breachType === 'none') {
    return {
      rowClass: '',
      borderLeftClass: '',
      isAnimated: false
    };
  }

  const { breachType } = breach;
  const { effect } = config;
  const includePulse = effect === 'pulse_and_tint' || effect === 'pulse_only';
  const includeTint = effect === 'pulse_and_tint' || effect === 'tint_only';

  let animationClass = '';
  if (includePulse) {
    if (breachType === 'both') {
      animationClass = 'animate-pulse-dual-row';
    } else if (breachType === 'error') {
      animationClass = 'animate-pulse-error-row';
    } else {
      animationClass = 'animate-pulse-latency-row';
    }
  }

  let tintClass = '';
  let borderLeftClass = '';

  if (breachType === 'both') {
    borderLeftClass = 'border-l-4 border-l-rose-500';
    if (includeTint) {
      tintClass = isDark
        ? 'bg-gradient-to-r from-rose-950/40 via-amber-950/20 to-transparent hover:from-rose-900/50 hover:via-amber-900/30'
        : isSteel
          ? 'bg-gradient-to-r from-rose-900/30 via-amber-900/20 to-transparent hover:from-rose-900/40 hover:via-amber-900/30'
          : 'bg-gradient-to-r from-rose-100/90 via-amber-100/60 to-transparent hover:from-rose-100 hover:via-amber-100';
    }
  } else if (breachType === 'error') {
    borderLeftClass = 'border-l-4 border-l-rose-500';
    if (includeTint) {
      tintClass = isDark
        ? 'bg-rose-950/35 hover:bg-rose-900/45'
        : isSteel
          ? 'bg-rose-900/25 hover:bg-rose-900/35'
          : 'bg-rose-100/80 hover:bg-rose-100';
    }
  } else {
    // Latency
    borderLeftClass = 'border-l-4 border-l-amber-500';
    if (includeTint) {
      tintClass = isDark
        ? 'bg-amber-950/35 hover:bg-amber-900/45'
        : isSteel
          ? 'bg-amber-900/25 hover:bg-amber-900/35'
          : 'bg-amber-100/80 hover:bg-amber-100';
    }
  }

  const combinedClasses = [
    borderLeftClass,
    tintClass,
    animationClass,
    'transition-all duration-300'
  ].filter(Boolean).join(' ');

  return {
    rowClass: combinedClasses,
    borderLeftClass,
    isAnimated: includePulse
  };
}
