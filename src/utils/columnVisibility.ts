export type ColumnKey =
  | 'timestamp'
  | 'status'
  | 'severity'
  | 'eventType'
  | 'origin'
  | 'traceId'
  | 'aggregate'
  | 'actor'
  | 'causation'
  | 'actions';

export interface ColumnDefinition {
  id: ColumnKey;
  label: string;
  headerLabel: string;
  description: string;
  defaultVisible: boolean;
}

export const AVAILABLE_COLUMNS: ColumnDefinition[] = [
  {
    id: 'timestamp',
    label: 'Timestamp',
    headerLabel: 'Seq / Time',
    description: 'Sequence number, event timestamp, and latency badge',
    defaultVisible: true
  },
  {
    id: 'status',
    label: 'Status',
    headerLabel: 'Status',
    description: 'Health state, validation status, and metadata details',
    defaultVisible: true
  },
  {
    id: 'severity',
    label: 'Severity',
    headerLabel: 'Severity',
    description: 'Critical, Error, Warning, Info, or Debug classification',
    defaultVisible: true
  },
  {
    id: 'eventType',
    label: 'Event Type & Tags',
    headerLabel: 'Event Type & Tags',
    description: 'Stage badge, schema name, summary, and metadata tags',
    defaultVisible: true
  },
  {
    id: 'origin',
    label: 'Origin & Source',
    headerLabel: 'Origin & Source',
    description: 'Origin tier badge (Edge/Kernel/App) and emitter service',
    defaultVisible: true
  },
  {
    id: 'traceId',
    label: 'Trace ID',
    headerLabel: 'Trace ID',
    description: 'Correlation ID and distributed OpenTelemetry trace ID',
    defaultVisible: true
  },
  {
    id: 'aggregate',
    label: 'Aggregate',
    headerLabel: 'Aggregate',
    description: 'Domain entity aggregate type and unique identifier',
    defaultVisible: true
  },
  {
    id: 'actor',
    label: 'Actor',
    headerLabel: 'Actor',
    description: 'Initiator identity (Agent, User, System) and principal ID',
    defaultVisible: true
  },
  {
    id: 'causation',
    label: 'Causation Parent',
    headerLabel: 'Causation Parent',
    description: 'Preceding causal trigger event or root origin marker',
    defaultVisible: true
  },
  {
    id: 'actions',
    label: 'Actions',
    headerLabel: 'Actions',
    description: 'Lineage DAG trace, pipeline swimlane, and envelope inspector',
    defaultVisible: true
  }
];

export type ColumnVisibilityMap = Record<ColumnKey, boolean>;

export const DEFAULT_COLUMN_VISIBILITY: ColumnVisibilityMap = AVAILABLE_COLUMNS.reduce(
  (acc, col) => {
    acc[col.id] = col.defaultVisible;
    return acc;
  },
  {} as ColumnVisibilityMap
);

export const COMPACT_COLUMN_VISIBILITY: ColumnVisibilityMap = {
  timestamp: true,
  status: true,
  severity: false,
  eventType: true,
  origin: false,
  traceId: true,
  aggregate: false,
  actor: false,
  causation: false,
  actions: true
};

export const TRACE_FOCUS_COLUMN_VISIBILITY: ColumnVisibilityMap = {
  timestamp: true,
  status: true,
  severity: false,
  eventType: true,
  origin: true,
  traceId: true,
  aggregate: true,
  actor: true,
  causation: true,
  actions: true
};

const STORAGE_KEY = 'cascade_ledger_column_visibility_v2';

export function loadColumnVisibility(): ColumnVisibilityMap {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      // Ensure all current columns are present
      return {
        ...DEFAULT_COLUMN_VISIBILITY,
        ...parsed
      };
    }
  } catch (err) {
    console.warn('Failed to load column visibility from localStorage:', err);
  }
  return DEFAULT_COLUMN_VISIBILITY;
}

export function saveColumnVisibility(visibility: ColumnVisibilityMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(visibility));
  } catch (err) {
    console.warn('Failed to save column visibility to localStorage:', err);
  }
}
