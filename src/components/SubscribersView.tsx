import React, { useState } from 'react';
import { 
  Radio, 
  CheckCircle, 
  AlertCircle, 
  Power, 
  Clock, 
  Layers, 
  ShieldCheck, 
  Database,
  ArrowRight,
  RefreshCw,
  Search,
  RotateCcw,
  Plus
} from 'lucide-react';
import { useAppTheme } from '../context/ThemeContext';
import { Subscriber } from '../types';
import { cascadeStore } from '../services/cascadeService';
import { EmptyState } from './EmptyState';

interface SubscribersViewProps {
  onSelectEventById: (eventId: string) => void;
}

export const SubscribersView: React.FC<SubscribersViewProps> = ({
  onSelectEventById
}) => {
  const { themeClasses, isSteel, isDark } = useAppTheme();
  const [subscribers, setSubscribers] = useState<Subscriber[]>(() => cascadeStore.getSubscribers().subscribers);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [updatingPattern, setUpdatingPattern] = useState<string | null>(null);

  const handleToggleSubscriber = (pattern: string, currentStatus: boolean) => {
    setUpdatingPattern(pattern);
    setTimeout(() => {
      cascadeStore.updateSubscriber(pattern, !currentStatus);
      setSubscribers([...cascadeStore.getSubscribers().subscribers]);
      setUpdatingPattern(null);
    }, 200);
  };

  const handleResetSubscribers = () => {
    // Re-initialize default daemons if empty
    cascadeStore.updateSubscriber('nexus.cascade.v1.*', true);
    cascadeStore.updateSubscriber('nexus.cascade.v1.candidate.discovered', true);
    cascadeStore.updateSubscriber('nexus.cascade.v1.candidate.assessed', true);
    cascadeStore.updateSubscriber('nexus.cascade.v1.plan.compiled', true);
    cascadeStore.updateSubscriber('nexus.cascade.v1.harness.job_completed', true);
    setSubscribers([...cascadeStore.getSubscribers().subscribers]);
  };

  const filteredSubscribers = subscribers.filter(s => 
    s.subject_pattern.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (s.handler_name && s.handler_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
    (s.description && s.description.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const getLagMeter = (lag: number) => {
    if (lag === 0) {
      return {
        bg: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
        label: 'REAL-TIME SYNCHRONIZED (0 lag)'
      };
    }
    if (lag < 15) {
      return {
        bg: 'bg-sky-500/20 text-sky-300 border-sky-500/40',
        label: `${lag} events unconsumed (nominal)`
      };
    }
    return {
      bg: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
      label: `${lag} BACKLOG LAG (attention)`
    };
  };

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto custom-scrollbar">
      {/* View Header */}
      <div className={`p-4 rounded-xl border ${themeClasses.border} ${themeClasses.bgCard} shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3`}>
        <div>
          <h2 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
            <Radio className="w-4 h-4 text-sky-400" />
            <span>NATS Stream Subscribers & Offsets (`/cascade/subscribers`)</span>
          </h2>
          <p className={`text-xs ${themeClasses.textMuted}`}>
            Live monitoring of registered consumer daemons, processing offset timestamps, and unconsumed event backlog.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Search input */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-slate-400" />
            <input
              type="text"
              placeholder="Filter pattern..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className={`pl-8 pr-3 py-1.5 rounded-lg text-xs font-mono border ${themeClasses.border} ${themeClasses.inputBg} ${themeClasses.textPrimary} w-44`}
            />
          </div>

          <div className="flex items-center space-x-2 text-xs font-mono text-slate-400 bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-800">
            <span>Active Consumers: </span>
            <strong className="text-emerald-400 font-bold">
              {subscribers.filter(s => s.enabled).length} of {subscribers.length}
            </strong>
          </div>
        </div>
      </div>

      {/* Subscribers Grid or Empty State */}
      {filteredSubscribers.length === 0 ? (
        searchQuery ? (
          <EmptyState
            type="subscribers_filtered"
            title={`No Subscribers Match "${searchQuery}"`}
            description="No NATS consumer stream registrations match your active subject wildcard or handler search."
            hints={[
              {
                label: 'Wildcard Semantics',
                detail: 'NATS subjects use token hierarchies. For instance, "nexus.cascade.v1.*" matches all sub-topics.',
                badge: 'NATS v2'
              }
            ]}
            actions={[
              {
                label: 'Clear Search Query',
                icon: RotateCcw,
                variant: 'outline',
                onClick: () => setSearchQuery('')
              }
            ]}
          />
        ) : (
          <EmptyState
            type="subscribers"
            title="No NATS Stream Subscribers Registered"
            description="There are currently zero active consumer daemons or offset listeners attached to the Cascade event broker."
            hints={[
              {
                label: 'Consumer Groups',
                detail: 'Subscribers read from the append-only event stream and maintain their own cursor sequence offset.',
                badge: 'Offset Protocol'
              },
              {
                label: 'Lag Compensation',
                detail: 'Unconsumed events are queued until downstream worker pools acknowledge receipt.',
                badge: 'Backlog Buffer'
              }
            ]}
            actions={[
              {
                label: 'Register Default Daemons',
                icon: Plus,
                variant: 'primary',
                onClick: handleResetSubscribers
              }
            ]}
          />
        )
      ) : (
        <div className="space-y-4">
          {filteredSubscribers.map(sub => {
            const lagInfo = getLagMeter(sub.lag);
            const isUpdating = updatingPattern === sub.subject_pattern;

            return (
              <div
                key={sub.subject_pattern}
                className={`p-5 rounded-xl border ${sub.enabled ? themeClasses.border : 'border-slate-800 opacity-80'} ${themeClasses.bgCard} shadow-md space-y-4 transition-all`}
              >
                {/* Top Title & Toggle Button */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 border-slate-800/80">
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-sm font-bold text-sky-400">
                        {sub.subject_pattern}
                      </span>
                      <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded border ${lagInfo.bg}`}>
                        {lagInfo.label}
                      </span>
                    </div>
                    <div className="text-xs font-mono text-slate-400">
                      Handler: <strong className="text-slate-200">{sub.handler_name}</strong>
                    </div>
                  </div>

                  {/* Enable/Disable Toggle button */}
                  <div className="flex items-center space-x-3">
                    <button
                      disabled={isUpdating}
                      onClick={() => handleToggleSubscriber(sub.subject_pattern, sub.enabled)}
                      className={`flex items-center space-x-2 px-3 py-1.5 rounded-lg border text-xs font-mono font-semibold transition-all ${
                        sub.enabled
                          ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 hover:bg-emerald-500/25'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      <Power className={`w-3.5 h-3.5 ${sub.enabled ? 'text-emerald-400' : 'text-slate-500'}`} />
                      <span>{sub.enabled ? 'SUBSCRIPTION ACTIVE' : 'DISABLED (PAUSED)'}</span>
                    </button>
                  </div>
                </div>

                {/* Description */}
                {sub.description && (
                  <p className="text-xs text-slate-300">
                    {sub.description}
                  </p>
                )}

                {/* Offset Metadata */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-xs font-mono">
                  <div className={`p-2.5 rounded-lg border ${themeClasses.borderSubtle} ${themeClasses.bgMuted}`}>
                    <div className={`text-[10px] font-bold uppercase tracking-wider ${themeClasses.textMuted} mb-1 flex items-center space-x-1`}>
                      <Clock className="w-3 h-3" />
                      <span>Last Consumed Offset</span>
                    </div>
                    <div className="text-slate-200 truncate">
                      {sub.last_processed ? new Date(sub.last_processed).toLocaleString() : 'No events consumed yet'}
                    </div>
                  </div>

                  <div className={`p-2.5 rounded-lg border ${themeClasses.borderSubtle} ${themeClasses.bgMuted}`}>
                    <div className={`text-[10px] font-bold uppercase tracking-wider ${themeClasses.textMuted} mb-1`}>
                      Offset Table Updated At
                    </div>
                    <div className="text-slate-200 truncate">
                      {sub.last_processed_at ? new Date(sub.last_processed_at).toLocaleString() : '—'}
                    </div>
                  </div>

                  <div className={`p-2.5 rounded-lg border ${themeClasses.borderSubtle} ${themeClasses.bgMuted}`}>
                    <div className={`text-[10px] font-bold uppercase tracking-wider ${themeClasses.textMuted} mb-1`}>
                      Created At
                    </div>
                    <div className="text-slate-200 truncate">
                      {new Date(sub.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>

                {/* Recently Processed Event IDs (Dedup Window) */}
                {sub.processed_ids && sub.processed_ids.length > 0 && (
                  <div className="pt-2 border-t border-slate-800/80">
                    <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${themeClasses.textMuted} block mb-1.5`}>
                      Recent Processed Event IDs (Dedup Window)
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {sub.processed_ids.map(id => (
                        <button
                          key={id}
                          onClick={() => onSelectEventById(id)}
                          className={`px-2 py-0.5 rounded text-[10px] font-mono border ${themeClasses.borderSubtle} ${themeClasses.bgMuted} text-slate-300 hover:text-sky-400 hover:border-sky-500/50 transition-all`}
                        >
                          {id.slice(0, 8)}...
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
