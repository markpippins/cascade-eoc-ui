import React from 'react';
import { 
  Workflow, 
  GitFork, 
  Radio, 
  Scale, 
  FileText, 
  Sparkles, 
  Play, 
  RefreshCw, 
  AlertTriangle, 
  Search, 
  Filter, 
  CheckCircle2, 
  ShieldCheck, 
  Terminal, 
  Cpu, 
  Flame, 
  Zap, 
  Sliders, 
  Database, 
  Inbox, 
  Eye, 
  Compass, 
  Layers,
  ArrowRight,
  Plus
} from 'lucide-react';
import { useAppTheme } from '../context/ThemeContext';

export type EmptyStateType = 
  | 'ledger'
  | 'ledger_filtered'
  | 'lineage'
  | 'lineage_filtered'
  | 'lineage_inspector'
  | 'pipeline'
  | 'pipeline_stage'
  | 'pipeline_parallel'
  | 'pipeline_compare'
  | 'assessment'
  | 'assessment_filtered'
  | 'subscribers'
  | 'subscribers_filtered'
  | 'batch_selection'
  | 'batch_review_pristine'
  | 'batch_review_filtered'
  | 'batch_audit'
  | 'simulation_ready'
  | 'generic';

export interface EmptyStateAction {
  label: string;
  onClick: () => void;
  icon?: React.ComponentType<{ className?: string }>;
  variant?: 'primary' | 'secondary' | 'accent' | 'outline' | 'ghost';
  disabled?: boolean;
}

export interface EmptyStateHint {
  label: string;
  detail: string;
  badge?: string;
}

export interface EmptyStateProps {
  type?: EmptyStateType;
  title?: string;
  description?: string;
  secondaryText?: string;
  hints?: EmptyStateHint[];
  actions?: EmptyStateAction[];
  compact?: boolean;
  bordered?: boolean;
  className?: string;
  customIllustration?: React.ReactNode;
}

// Visual SVG Schematics with glowing ambient backdrops
export const EmptyStateIllustration: React.FC<{ type: EmptyStateType; compact?: boolean }> = ({ type, compact }) => {
  const sizeClass = compact ? 'w-24 h-24' : 'w-36 h-36';

  switch (type) {
    case 'ledger':
    case 'ledger_filtered':
      return (
        <div className={`relative ${sizeClass} mx-auto flex items-center justify-center select-none`}>
          {/* Ambient Glow */}
          <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-2xl animate-pulse" />
          <svg className="w-full h-full text-slate-700" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Grid Table Frame */}
            <rect x="20" y="24" width="120" height="112" rx="14" className="stroke-slate-700/80 fill-slate-900/60" strokeWidth="2" />
            <line x1="20" y1="52" x2="140" y2="52" className="stroke-slate-700/80" strokeWidth="2" />
            
            {/* Table Header Columns */}
            <rect x="32" y="34" width="24" height="8" rx="4" className="fill-slate-600" />
            <rect x="64" y="34" width="36" height="8" rx="4" className="fill-slate-600" />
            <rect x="108" y="34" width="20" height="8" rx="4" className="fill-sky-500/40" />

            {/* Dotted / Empty Rows */}
            <rect x="32" y="66" width="36" height="6" rx="3" className="fill-slate-800" />
            <rect x="76" y="66" width="52" height="6" rx="3" className="fill-slate-800/80" />
            
            <rect x="32" y="86" width="48" height="6" rx="3" className="fill-slate-800" />
            <rect x="88" y="86" width="40" height="6" rx="3" className="fill-slate-800/80" />

            <rect x="32" y="106" width="28" height="6" rx="3" className="fill-slate-800" />
            <rect x="68" y="106" width="60" height="6" rx="3" className="fill-slate-800/80" />

            {/* Floating Filter Lens or Ledger Badge */}
            <g className="filter drop-shadow-[0_4px_12px_rgba(56,189,248,0.35)]">
              <circle cx="112" cy="108" r="24" className="fill-slate-900 stroke-sky-400" strokeWidth="2.5" />
              {type === 'ledger_filtered' ? (
                <path d="M104 102L120 102M107 108L117 108M110 114L114 114" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" />
              ) : (
                <path d="M104 108L109 113L120 102" stroke="#38bdf8" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
              )}
            </g>
          </svg>
        </div>
      );

    case 'lineage':
    case 'lineage_filtered':
      return (
        <div className={`relative ${sizeClass} mx-auto flex items-center justify-center select-none`}>
          <div className="absolute inset-0 bg-indigo-500/10 rounded-full blur-2xl animate-pulse" />
          <svg className="w-full h-full text-slate-700" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* DAG Curved Connectors */}
            <path d="M40 80 C 65 80, 65 44, 90 44" className="stroke-slate-700" strokeWidth="2" strokeDasharray="4 4" />
            <path d="M40 80 C 65 80, 65 116, 90 116" className="stroke-slate-700" strokeWidth="2" strokeDasharray="4 4" />
            <path d="M90 44 C 115 44, 115 80, 135 80" className="stroke-slate-700" strokeWidth="2" strokeDasharray="4 4" />
            <path d="M90 116 C 115 116, 115 80, 135 80" className="stroke-slate-700" strokeWidth="2" strokeDasharray="4 4" />

            {/* Root Node */}
            <circle cx="40" cy="80" r="16" className="fill-slate-900 stroke-amber-400" strokeWidth="2.5" />
            <circle cx="40" cy="80" r="6" className="fill-amber-400/80 animate-pulse" />

            {/* Branch 1 */}
            <circle cx="90" cy="44" r="13" className="fill-slate-900 stroke-sky-400" strokeWidth="2" />
            <circle cx="90" cy="44" r="4" className="fill-sky-400/80" />

            {/* Branch 2 */}
            <circle cx="90" cy="116" r="13" className="fill-slate-900 stroke-indigo-400" strokeWidth="2" />
            <circle cx="90" cy="116" r="4" className="fill-indigo-400/80" />

            {/* Convergent Node */}
            <circle cx="135" cy="80" r="14" className="fill-slate-900 stroke-slate-600" strokeWidth="2" />
            <circle cx="135" cy="80" r="4" className="fill-slate-600" />
          </svg>
        </div>
      );

    case 'lineage_inspector':
      return (
        <div className="relative w-20 h-20 mx-auto flex items-center justify-center select-none">
          <div className="absolute inset-0 bg-sky-500/10 rounded-full blur-xl" />
          <svg className="w-full h-full text-slate-700" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="18" y="18" width="64" height="64" rx="12" className="stroke-slate-700 fill-slate-900/80" strokeWidth="1.5" strokeDasharray="3 3" />
            <circle cx="50" cy="42" r="12" className="stroke-sky-400 fill-sky-950/60" strokeWidth="1.5" />
            <path d="M46 42H54M50 38V46" stroke="#38bdf8" strokeWidth="1.5" strokeLinecap="round" />
            <rect x="30" y="62" width="40" height="4" rx="2" className="fill-slate-700" />
            <rect x="36" y="70" width="28" height="4" rx="2" className="fill-slate-800" />
          </svg>
        </div>
      );

    case 'pipeline':
    case 'pipeline_stage':
    case 'pipeline_parallel':
    case 'pipeline_compare':
      return (
        <div className={`relative ${sizeClass} mx-auto flex items-center justify-center select-none`}>
          <div className="absolute inset-0 bg-sky-500/10 rounded-full blur-2xl animate-pulse" />
          <svg className="w-full h-full text-slate-700" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Flow Stage Blocks */}
            <rect x="18" y="56" width="32" height="48" rx="8" className="stroke-blue-500/60 fill-slate-900/80" strokeWidth="2" />
            <rect x="64" y="56" width="32" height="48" rx="8" className="stroke-indigo-500/60 fill-slate-900/80" strokeWidth="2" />
            <rect x="110" y="56" width="32" height="48" rx="8" className="stroke-emerald-500/60 fill-slate-900/80" strokeWidth="2" />

            {/* Connecting Chevrons */}
            <path d="M52 80L60 80" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" />
            <path d="M98 80L106 80" stroke="#818cf8" strokeWidth="2" strokeLinecap="round" />

            {/* Stage Indicators */}
            <circle cx="34" cy="72" r="5" className="fill-blue-400" />
            <rect x="25" y="85" width="18" height="4" rx="2" className="fill-slate-700" />

            <circle cx="80" cy="72" r="5" className="fill-indigo-400" />
            <rect x="71" y="85" width="18" height="4" rx="2" className="fill-slate-700" />

            <circle cx="126" cy="72" r="5" className="fill-emerald-400" />
            <rect x="117" y="85" width="18" height="4" rx="2" className="fill-slate-700" />

            {/* Orbit / Synced Pulse */}
            <circle cx="80" cy="80" r="62" className="stroke-slate-800" strokeWidth="1.5" strokeDasharray="6 6" />
          </svg>
        </div>
      );

    case 'assessment':
    case 'assessment_filtered':
      return (
        <div className={`relative ${sizeClass} mx-auto flex items-center justify-center select-none`}>
          <div className="absolute inset-0 bg-emerald-500/10 rounded-full blur-2xl animate-pulse" />
          <svg className="w-full h-full text-slate-700" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Balance Scale Pillar */}
            <rect x="76" y="48" width="8" height="74" rx="4" className="fill-slate-700" />
            <rect x="52" y="118" width="56" height="8" rx="4" className="fill-slate-600" />
            <circle cx="80" cy="46" r="8" className="fill-slate-800 stroke-slate-600" strokeWidth="2" />

            {/* Balance Crossbar */}
            <line x1="28" y1="52" x2="132" y2="52" className="stroke-slate-600" strokeWidth="3" strokeLinecap="round" />

            {/* Left Pan (Approved) */}
            <line x1="38" y1="54" x2="38" y2="78" className="stroke-slate-700" strokeWidth="1.5" />
            <path d="M22 78 C22 92, 54 92, 54 78 Z" className="fill-slate-900 stroke-emerald-400" strokeWidth="2" />
            <circle cx="38" cy="80" r="3" className="fill-emerald-400" />

            {/* Right Pan (Vetoed) */}
            <line x1="122" y1="54" x2="122" y2="78" className="stroke-slate-700" strokeWidth="1.5" />
            <path d="M106 78 C106 92, 138 92, 138 78 Z" className="fill-slate-900 stroke-rose-400" strokeWidth="2" />
            <path d="M120 78 L124 82 M124 78 L120 82" stroke="#fb7185" strokeWidth="1.5" strokeLinecap="round" />

            {/* Central Evaluation Sparkle */}
            <g className="filter drop-shadow-[0_0_8px_rgba(52,211,153,0.6)]">
              <circle cx="80" cy="30" r="14" className="fill-emerald-950 stroke-emerald-400" strokeWidth="2" />
              <path d="M80 24V36M74 30H86" stroke="#34d399" strokeWidth="2" strokeLinecap="round" />
            </g>
          </svg>
        </div>
      );

    case 'subscribers':
    case 'subscribers_filtered':
      return (
        <div className={`relative ${sizeClass} mx-auto flex items-center justify-center select-none`}>
          <div className="absolute inset-0 bg-sky-500/10 rounded-full blur-2xl animate-pulse" />
          <svg className="w-full h-full text-slate-700" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
            {/* Broadcast Antenna Base */}
            <path d="M64 124 L80 72 L96 124" className="stroke-slate-700" strokeWidth="3" strokeLinecap="round" />
            <line x1="70" y1="102" x2="90" y2="102" className="stroke-slate-700" strokeWidth="2" />
            <circle cx="80" cy="68" r="8" className="fill-slate-900 stroke-sky-400" strokeWidth="2.5" />

            {/* Radio Emission Concentric Arcs */}
            <path d="M60 52 C72 40, 88 40, 100 52" className="stroke-sky-400/60" strokeWidth="2" strokeLinecap="round" />
            <path d="M46 38 C64 22, 96 22, 114 38" className="stroke-sky-400/40" strokeWidth="2" strokeLinecap="round" />
            <path d="M32 24 C58 4, 102 4, 128 24" className="stroke-sky-400/20" strokeWidth="2" strokeLinecap="round" />

            {/* Consumer Nodes */}
            <g className="filter drop-shadow-[0_2px_8px_rgba(56,189,248,0.3)]">
              <rect x="22" y="112" width="28" height="20" rx="5" className="fill-slate-900 stroke-emerald-400" strokeWidth="1.5" />
              <circle cx="36" cy="122" r="3" className="fill-emerald-400 animate-pulse" />

              <rect x="110" y="112" width="28" height="20" rx="5" className="fill-slate-900 stroke-indigo-400" strokeWidth="1.5" />
              <circle cx="124" cy="122" r="3" className="fill-indigo-400 animate-pulse" />
            </g>
          </svg>
        </div>
      );

    case 'batch_review_pristine':
      return (
        <div className={`relative ${sizeClass} mx-auto flex items-center justify-center select-none`}>
          <div className="absolute inset-0 bg-emerald-500/10 rounded-full blur-2xl animate-pulse" />
          <svg className="w-full h-full text-slate-700" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="80" cy="80" r="54" className="stroke-slate-800 fill-slate-900/60" strokeWidth="2" />
            <circle cx="80" cy="80" r="44" className="stroke-emerald-500/30" strokeWidth="1.5" strokeDasharray="4 4" />
            
            {/* Shield Outline */}
            <path d="M80 44 L108 56 V84 C108 102, 80 114, 80 114 C80 114, 52 102, 52 84 V56 Z" className="fill-emerald-950/60 stroke-emerald-400" strokeWidth="2.5" strokeLinejoin="round" />
            
            {/* Checkmark */}
            <path d="M68 80 L76 88 L92 72" stroke="#34d399" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
      );

    case 'batch_audit':
      return (
        <div className={`relative ${sizeClass} mx-auto flex items-center justify-center select-none`}>
          <div className="absolute inset-0 bg-blue-500/10 rounded-full blur-2xl" />
          <svg className="w-full h-full text-slate-700" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
            <rect x="24" y="32" width="112" height="96" rx="12" className="fill-slate-900/80 stroke-slate-700" strokeWidth="2" />
            <path d="M24 52 H136" className="stroke-slate-800" strokeWidth="2" />
            <circle cx="38" cy="42" r="3" className="fill-rose-500" />
            <circle cx="48" cy="42" r="3" className="fill-amber-500" />
            <circle cx="58" cy="42" r="3" className="fill-emerald-500" />
            
            {/* Command prompt */}
            <path d="M40 70 L48 76 L40 82" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            <line x1="56" y1="76" x2="88" y2="76" stroke="#60a5fa" strokeWidth="2" strokeLinecap="round" />
            
            <rect x="40" y="96" width="60" height="6" rx="3" className="fill-slate-800" />
            <rect x="40" y="108" width="40" height="6" rx="3" className="fill-slate-800" />
          </svg>
        </div>
      );

    case 'simulation_ready':
      return (
        <div className={`relative ${sizeClass} mx-auto flex items-center justify-center select-none`}>
          <div className="absolute inset-0 bg-sky-500/10 rounded-full blur-2xl animate-pulse" />
          <svg className="w-full h-full text-slate-700" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="80" cy="80" r="56" className="fill-slate-900/60 stroke-slate-800" strokeWidth="2" />
            
            {/* Stepper Rings */}
            <circle cx="80" cy="80" r="42" className="stroke-sky-500/40" strokeWidth="2" strokeDasharray="6 6" />
            
            {/* Play Core */}
            <circle cx="80" cy="80" r="26" className="fill-sky-500/20 stroke-sky-400" strokeWidth="2.5" />
            <path d="M74 68 L92 80 L74 92 Z" className="fill-sky-400" />
          </svg>
        </div>
      );

    default:
      return (
        <div className={`relative ${sizeClass} mx-auto flex items-center justify-center select-none`}>
          <div className="absolute inset-0 bg-slate-500/10 rounded-full blur-xl" />
          <svg className="w-full h-full text-slate-700" viewBox="0 0 160 160" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="80" cy="80" r="50" className="fill-slate-900/60 stroke-slate-800" strokeWidth="2" />
            <path d="M64 74H96M64 86H86" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" />
            <circle cx="80" cy="80" r="32" className="stroke-slate-700" strokeWidth="1.5" strokeDasharray="4 4" />
          </svg>
        </div>
      );
  }
};

export const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'generic',
  title,
  description,
  secondaryText,
  hints = [],
  actions = [],
  compact = false,
  bordered = true,
  className = '',
  customIllustration
}) => {
  const { themeClasses } = useAppTheme();

  // Smart defaults based on type
  const getDefaultTitle = () => {
    switch (type) {
      case 'ledger':
        return 'Event Ledger is Empty';
      case 'ledger_filtered':
        return 'No Envelopes Match Filters';
      case 'lineage':
        return 'No Causal Lineage Graph Available';
      case 'lineage_filtered':
        return 'No Graph Nodes Match Active Filters';
      case 'lineage_inspector':
        return 'Select a Graph Node';
      case 'pipeline':
        return 'No Workflows or Lifecycle Traces Found';
      case 'pipeline_stage':
        return 'No Envelopes in This Lifecycle Stage';
      case 'pipeline_parallel':
        return 'No Parallel Sub-Tasks Recorded';
      case 'pipeline_compare':
        return 'Select Traces to Compare';
      case 'assessment':
        return 'No Assessment Decisions Recorded';
      case 'assessment_filtered':
        return 'No Assessments Match Filter';
      case 'subscribers':
        return 'No Stream Subscribers Registered';
      case 'subscribers_filtered':
        return 'No Subscribers Match Search';
      case 'batch_selection':
        return 'No Envelopes Match Batch Query';
      case 'batch_review_pristine':
        return 'Review Queue is Pristine';
      case 'batch_review_filtered':
        return 'No Flagged Envelopes Match Filter';
      case 'batch_audit':
        return 'Immutable Audit Ledger is Clear';
      case 'simulation_ready':
        return 'Autonomous Pipeline Ready';
      default:
        return 'No Data Found';
    }
  };

  const getDefaultDescription = () => {
    switch (type) {
      case 'ledger':
        return 'The immutable Cascade event store currently contains no published event envelopes.';
      case 'ledger_filtered':
        return 'No events match your current filter parameters, search keywords, or active time slice.';
      case 'lineage':
        return 'Select a valid root seed event envelope to compute and render the causal dependency DAG.';
      case 'lineage_filtered':
        return 'The active hotspot severity thresholds or causal hop depth settings have excluded all nodes.';
      case 'lineage_inspector':
        return 'Click any node in the DAG canvas to inspect its envelope payload, timing latency, and blast radius impact.';
      case 'pipeline':
        return 'No end-to-end SDLC correlation workflows have been ingested or tracked in the store.';
      case 'pipeline_stage':
        return 'The selected correlation workflow has not emitted any envelopes in this stage yet.';
      case 'pipeline_parallel':
        return 'Coordinator agents have not decomposed any parallel subtasks for this workflow.';
      case 'pipeline_compare':
        return 'Pick two distinct correlation IDs above to perform differential regression and latency diffs.';
      case 'assessment':
        return 'No candidate evaluation resolutions or AI assessment verdicts have been published yet.';
      case 'assessment_filtered':
        return 'No assessment resolutions match the selected confidence threshold or outcome filter.';
      case 'subscribers':
        return 'No NATS stream consumer daemons or offset trackers are registered in the routing table.';
      case 'subscribers_filtered':
        return 'No stream consumer patterns match your current search criteria.';
      case 'batch_selection':
        return 'No event envelopes match the current multi-select filter criteria for batch operations.';
      case 'batch_review_pristine':
        return 'There are currently zero envelopes flagged for manual review, security triage, or latency diagnosis.';
      case 'batch_review_filtered':
        return 'No review flags match your selected priority or assignee filter criteria.';
      case 'batch_audit':
        return 'No batch re-simulations, bulk tag mutations, or flag resolutions have been executed in this session.';
      case 'simulation_ready':
        return 'Configure your harvest transcript or select a preset to execute an end-to-end SDLC workflow.';
      default:
        return 'There is no data available for this view at this time.';
    }
  };

  const finalTitle = title || getDefaultTitle();
  const finalDescription = description || getDefaultDescription();

  return (
    <div
      className={`rounded-2xl transition-all select-none text-center ${
        bordered ? `border ${themeClasses.border} ${themeClasses.bgCard} shadow-sm` : ''
      } ${compact ? 'p-6 space-y-4' : 'p-8 sm:p-12 space-y-6'} ${className}`}
    >
      {/* Illustration */}
      <div>
        {customIllustration ? customIllustration : <EmptyStateIllustration type={type} compact={compact} />}
      </div>

      {/* Main Text Content */}
      <div className="space-y-1.5 max-w-lg mx-auto">
        <h3 className={`font-mono font-bold text-slate-100 ${compact ? 'text-sm' : 'text-base'}`}>
          {finalTitle}
        </h3>
        <p className={`text-xs ${themeClasses.textMuted} leading-relaxed`}>
          {finalDescription}
        </p>
        {secondaryText && (
          <p className="text-[11px] text-slate-500 font-mono pt-1">
            {secondaryText}
          </p>
        )}
      </div>

      {/* Structured Helper Hints (if provided) */}
      {hints.length > 0 && (
        <div className="max-w-md mx-auto text-left grid grid-cols-1 gap-2 pt-1">
          {hints.map((hint, idx) => (
            <div 
              key={idx} 
              className={`p-3 rounded-xl border ${themeClasses.borderSubtle} ${themeClasses.bgMuted} flex items-start space-x-2.5 text-xs`}
            >
              <div className="mt-0.5 text-sky-400 flex-shrink-0">
                <Sparkles className="w-3.5 h-3.5" />
              </div>
              <div className="space-y-0.5 flex-1 min-w-0">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-slate-200 font-mono text-[11px]">{hint.label}</span>
                  {hint.badge && (
                    <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700">
                      {hint.badge}
                    </span>
                  )}
                </div>
                <p className="text-[11px] text-slate-400 leading-relaxed font-sans">{hint.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Action Buttons (if provided) */}
      {actions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
          {actions.map((act, idx) => {
            const Icon = act.icon;
            let btnClasses = '';

            switch (act.variant) {
              case 'primary':
                btnClasses = 'bg-sky-500 hover:bg-sky-400 text-white font-bold shadow-md shadow-sky-500/20';
                break;
              case 'accent':
                btnClasses = 'bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-500/20';
                break;
              case 'secondary':
                btnClasses = 'bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold';
                break;
              case 'ghost':
                btnClasses = 'bg-transparent hover:bg-slate-800/60 text-slate-400 hover:text-slate-200 font-medium';
                break;
              case 'outline':
              default:
                btnClasses = 'bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 font-semibold';
                break;
            }

            return (
              <button
                key={idx}
                disabled={act.disabled}
                onClick={act.onClick}
                className={`px-4 py-2 rounded-xl text-xs font-mono transition-all flex items-center space-x-2 disabled:opacity-40 disabled:cursor-not-allowed ${btnClasses}`}
              >
                {Icon && <Icon className="w-3.5 h-3.5" />}
                <span>{act.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};
