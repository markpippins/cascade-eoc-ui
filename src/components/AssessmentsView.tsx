import React, { useState } from 'react';
import { 
  CheckCircle2, 
  AlertTriangle, 
  ShieldAlert, 
  HelpCircle, 
  XCircle, 
  Filter, 
  Sliders, 
  ArrowRight,
  Sparkles,
  Bot,
  Play,
  RotateCcw
} from 'lucide-react';
import { useAppTheme } from '../context/ThemeContext';
import { AssessmentResolution, EventEnvelope } from '../types';
import { cascadeStore } from '../services/cascadeService';
import { EmptyState } from './EmptyState';

interface AssessmentsViewProps {
  onSelectEventById: (eventId: string) => void;
  onOpenSimulator?: () => void;
}

export const AssessmentsView: React.FC<AssessmentsViewProps> = ({
  onSelectEventById,
  onOpenSimulator
}) => {
  const { themeClasses, isSteel, isDark } = useAppTheme();
  const [outcomeFilter, setOutcomeFilter] = useState<string>('');

  const assessmentsData = cascadeStore.getAssessments({ outcome: outcomeFilter });
  const { assessments, total } = assessmentsData;

  const getOutcomeBadge = (outcome: string) => {
    switch (outcome.toLowerCase()) {
      case 'greenlit':
      case 'approved':
        return {
          bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
          icon: CheckCircle2,
          label: 'GREENLIT / APPROVED'
        };
      case 'escalated':
        return {
          bg: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
          icon: AlertTriangle,
          label: 'ESCALATED'
        };
      case 'needs_clarification':
        return {
          bg: 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40',
          icon: HelpCircle,
          label: 'NEEDS CLARIFICATION'
        };
      default:
        return {
          bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
          icon: XCircle,
          label: outcome.toUpperCase()
        };
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto custom-scrollbar">
      {/* Header & Filter Controls */}
      <div className={`p-4 rounded-xl border ${themeClasses.border} ${themeClasses.bgCard} shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3`}>
        <div>
          <h2 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>Cascade Assessment & Resolution Matrix (`/cascade/assessments`)</span>
          </h2>
          <p className={`text-xs ${themeClasses.textMuted}`}>
            Evaluations by autonomous planners and cascade assessors on candidate viability, risk, and architecture fit.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <Filter className={`w-3.5 h-3.5 ${themeClasses.textMuted}`} />
          <select
            value={outcomeFilter}
            onChange={(e) => setOutcomeFilter(e.target.value)}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono border ${themeClasses.border} ${themeClasses.inputBg} ${themeClasses.textPrimary}`}
          >
            <option value="">All Resolution Outcomes</option>
            <option value="greenlit">greenlit / approved</option>
            <option value="escalated">escalated</option>
            <option value="needs_clarification">needs_clarification</option>
            <option value="rejected">rejected</option>
          </select>
        </div>
      </div>

      {/* Assessment Resolutions Grid or Empty State */}
      {assessments.length === 0 ? (
        outcomeFilter ? (
          <EmptyState
            type="assessment_filtered"
            title={`No Assessments with Outcome "${outcomeFilter}"`}
            description={`No candidate evaluations in the ledger match the selected outcome filter "${outcomeFilter}". Try clearing your filter or selecting another resolution state.`}
            hints={[
              {
                label: 'Confidence Thresholds',
                detail: 'Assessors tag resolutions as greenlit (>=85% confidence), escalated (<70% or high risk), or needs_clarification.',
                badge: 'Filtering Tip'
              }
            ]}
            actions={[
              {
                label: 'Reset Outcome Filter',
                icon: RotateCcw,
                variant: 'outline',
                onClick: () => setOutcomeFilter('')
              }
            ]}
          />
        ) : (
          <EmptyState
            type="assessment"
            title="No Candidate Assessments Published"
            description="The Cascade Assessment engine has not registered any candidate evaluation rationales or multi-dimensional scoring matrices yet."
            hints={[
              {
                label: 'Autonomous Triage',
                detail: 'Assessors analyze candidate feasibility, business value, technical debt, and security risk.',
                badge: 'Stage 2'
              },
              {
                label: 'Event Emission',
                detail: 'Assessment outcomes are published as nexus.cascade.v1.candidate.assessed envelopes.',
                badge: 'Stream API'
              }
            ]}
            actions={
              onOpenSimulator
                ? [
                    {
                      label: 'Launch Telemetry Simulator',
                      icon: Play,
                      variant: 'primary',
                      onClick: onOpenSimulator
                    }
                  ]
                : []
            }
          />
        )
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {assessments.map(item => {
            const badge = getOutcomeBadge(item.outcome);
            const OutcomeIcon = badge.icon;
            const confPct = Math.round(item.confidence * 100);

            return (
              <div
                key={item.resolution_id}
                className={`p-5 rounded-xl border ${themeClasses.border} ${themeClasses.bgCard} shadow-md space-y-4 hover:border-sky-500/50 transition-all`}
              >
                {/* Top Banner */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2.5 py-1 rounded-md text-xs font-mono font-bold flex items-center space-x-1 border ${badge.bg}`}>
                      <OutcomeIcon className="w-3.5 h-3.5" />
                      <span>{badge.label}</span>
                    </span>
                    <span className="text-xs font-mono font-bold text-slate-300">
                      {confPct}% Confidence
                    </span>
                  </div>

                  <button
                    onClick={() => onSelectEventById(item.event_id)}
                    className="text-xs font-mono text-sky-400 hover:text-sky-300 flex items-center space-x-1 font-semibold"
                  >
                    <span>Event Envelope</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Rationale Summary */}
                <div className="space-y-1">
                  <div className={`text-[10px] font-mono font-bold uppercase tracking-wider ${themeClasses.textMuted}`}>
                    Assessment Summary
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed font-medium">
                    {item.rationale.summary}
                  </p>
                </div>

                {/* Multi-Dimension Evaluation Scores */}
                {item.rationale.dimension_scores && (
                  <div className="space-y-2 pt-2 border-t border-slate-800/80">
                    <div className={`text-[10px] font-mono font-bold uppercase tracking-wider ${themeClasses.textMuted} flex items-center justify-between`}>
                      <span>Dimensions Exercised ({item.dimensions_used} of {item.dimensions_total})</span>
                      <span>Score (0 - 100)</span>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                      <div className="space-y-1">
                        <div className="flex justify-between text-slate-400">
                          <span>Feasibility:</span>
                          <span className="text-slate-200 font-bold">
                            {Math.round(item.rationale.dimension_scores.feasibility * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1">
                          <div 
                            className="bg-emerald-400 h-1 rounded-full" 
                            style={{ width: `${item.rationale.dimension_scores.feasibility * 100}%` }} 
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-slate-400">
                          <span>Business Value:</span>
                          <span className="text-slate-200 font-bold">
                            {Math.round(item.rationale.dimension_scores.business_value * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1">
                          <div 
                            className="bg-sky-400 h-1 rounded-full" 
                            style={{ width: `${item.rationale.dimension_scores.business_value * 100}%` }} 
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-slate-400">
                          <span>Tech Debt Impact:</span>
                          <span className="text-slate-200 font-bold">
                            {Math.round(item.rationale.dimension_scores.technical_debt * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1">
                          <div 
                            className="bg-amber-400 h-1 rounded-full" 
                            style={{ width: `${item.rationale.dimension_scores.technical_debt * 100}%` }} 
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <div className="flex justify-between text-slate-400">
                          <span>Security & Risk:</span>
                          <span className="text-slate-200 font-bold">
                            {Math.round(item.rationale.dimension_scores.security_risk * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 rounded-full h-1">
                          <div 
                            className="bg-teal-400 h-1 rounded-full" 
                            style={{ width: `${item.rationale.dimension_scores.security_risk * 100}%` }} 
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Strengths & Risks */}
                {item.rationale.strengths && item.rationale.strengths.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80">
                    <div className={`text-[10px] font-mono font-bold uppercase tracking-wider text-emerald-400 mb-1`}>
                      Key Strengths
                    </div>
                    <ul className="text-xs text-slate-300 space-y-0.5 list-disc list-inside">
                      {item.rationale.strengths.map((str, idx) => (
                        <li key={idx} className="truncate">{str}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Footer Meta */}
                <div className="pt-3 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>Resolved by {item.source}</span>
                  <span>{new Date(item.resolved_at).toLocaleString()}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
