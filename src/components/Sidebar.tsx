import React from 'react';
import { 
  Activity, 
  Database, 
  CheckSquare,
  GitFork, 
  Workflow, 
  CheckCircle2, 
  Radio, 
  PlayCircle, 
  Terminal, 
  Sun, 
  Moon, 
  ShieldCheck,
  Zap,
  Layers,
  Flag
} from 'lucide-react';
import { useAppTheme } from '../context/ThemeContext';
import { ActiveView, AppTheme } from '../types';
import { cascadeStore } from '../services/cascadeService';

interface SidebarProps {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  totalEvents: number;
  isStreaming: boolean;
  onToggleStreaming: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  setActiveView,
  totalEvents,
  isStreaming,
  onToggleStreaming
}) => {
  const { theme, setTheme, themeClasses, isDark, isSteel, isLight } = useAppTheme();
  const pendingReviewCount = cascadeStore.getReviewFlags().filter(f => f.status === 'pending' || f.status === 'in_review').length;

  const pipelineNavItems: { id: ActiveView; label: string; icon: React.FC<{ className?: string }>; badge?: string; badgeColor?: string }[] = [
    { id: 'overview', label: 'Overview & KPIs', icon: Activity },
    { id: 'ledger', label: 'Event Ledger', icon: Database, badge: totalEvents.toString() },
    { 
      id: 'batch', 
      label: 'Batch Operations', 
      icon: CheckSquare, 
      badge: pendingReviewCount > 0 ? `${pendingReviewCount} Flagged` : 'Workbench',
      badgeColor: pendingReviewCount > 0 ? 'bg-amber-500/20 text-amber-300 border-amber-500/30' : undefined
    },
    { id: 'lineage', label: 'Lineage DAG Graph', icon: GitFork },
    { id: 'pipeline', label: 'Lifecycle Pipelines', icon: Workflow },
  ];

  const devOpsNavItems: { id: ActiveView; label: string; icon: React.FC<{ className?: string }>; badge?: string; badgeColor?: string }[] = [
    { id: 'assessments', label: 'Assessments Matrix', icon: CheckCircle2 },
    { id: 'subscribers', label: 'Stream Subscribers', icon: Radio },
    { id: 'simulator', label: 'Ingestion Simulator', icon: PlayCircle, badge: 'Live' },
    { id: 'api_explorer', label: 'REST API Sandbox', icon: Terminal }
  ];

  return (
    <aside className={`w-64 flex-shrink-0 flex flex-col justify-between border-r ${themeClasses.border} ${themeClasses.sidebarBg} transition-colors duration-200 select-none`}>
      {/* Top Brand Header */}
      <div>
        <div className={`p-6 border-b ${themeClasses.border} flex items-center gap-3`}>
          <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center shadow-[0_0_15px_rgba(59,130,246,0.5)] text-white">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <div className="font-bold text-base tracking-tight text-white flex items-center gap-1.5">
              <span>STEEL CORE</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded font-mono bg-blue-500/20 text-blue-400 font-semibold border border-blue-500/30">v1.0</span>
            </div>
            <p className={`text-[10px] font-mono ${themeClasses.textMuted}`}>Cascade Srv · Port 3106</p>
          </div>
        </div>

        {/* Live Stream Telemetry Pill */}
        <div className="px-4 pt-3">
          <button
            onClick={onToggleStreaming}
            className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-xs font-medium transition-all ${
              isStreaming 
                ? 'bg-slate-700/50 border-blue-500/30 text-blue-400' 
                : `${themeClasses.bgMuted} ${themeClasses.border} ${themeClasses.textMuted} hover:text-slate-200`
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isStreaming ? 'bg-emerald-400 animate-pulse shadow-[0_0_8px_#10b981]' : 'bg-slate-500'}`} />
              <span className="text-xs">{isStreaming ? 'Real-time Streaming' : 'Streaming Paused'}</span>
            </div>
            <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono uppercase font-bold ${isStreaming ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30' : 'bg-slate-800 text-slate-400'}`}>
              {isStreaming ? 'LIVE' : 'IDLE'}
            </span>
          </button>
        </div>

        {/* Navigation List */}
        <nav className="p-4 space-y-2">
          <div className="px-3 py-1 text-xs font-semibold text-slate-500 uppercase tracking-widest">
            Main Pipeline
          </div>

          {pipelineNavItems.map(item => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                id={`nav-item-${item.id}`}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 group ${
                  isActive
                    ? 'bg-slate-700/50 rounded-xl text-blue-400 border border-blue-500/30 font-semibold'
                    : 'text-slate-400 hover:bg-slate-700/30 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 transition-colors ${
                    isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                    item.badgeColor || (isActive
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold'
                      : 'bg-slate-900 border border-slate-700 text-slate-400')
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}

          <div className="px-3 pt-3 pb-1 text-xs font-semibold text-slate-500 uppercase tracking-widest">
            Dev & Ops
          </div>

          {devOpsNavItems.map(item => {
            const Icon = item.icon;
            const isActive = activeView === item.id;
            return (
              <button
                key={item.id}
                id={`nav-item-${item.id}`}
                onClick={() => setActiveView(item.id)}
                className={`w-full flex items-center justify-between px-4 py-2.5 rounded-xl text-xs font-medium transition-all duration-150 group ${
                  isActive
                    ? 'bg-slate-700/50 rounded-xl text-blue-400 border border-blue-500/30 font-semibold'
                    : 'text-slate-400 hover:bg-slate-700/30 hover:text-slate-200'
                }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={`w-4 h-4 transition-colors ${
                    isActive ? 'text-blue-400' : 'text-slate-400 group-hover:text-slate-200'
                  }`} />
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${
                    item.badgeColor || (isActive
                      ? 'bg-blue-500/20 text-blue-300 border border-blue-500/40 font-bold'
                      : 'bg-slate-900 border border-slate-700 text-slate-400')
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>

      {/* Ingestion Health Box from Design */}
      <div className="p-6 border-t border-slate-700/50 bg-[#1e293b]/50 space-y-3">
        <div>
          <div className="text-xs text-slate-400 mb-2 flex items-center justify-between">
            <span>Ingestion Health</span>
            <span className="text-[10px] font-mono text-emerald-400 font-bold">100% OK</span>
          </div>
          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
            <div className="w-[88%] h-full bg-emerald-500 shadow-[0_0_8px_#10b981]" />
          </div>
          <div className="flex justify-between mt-2 text-[10px] uppercase font-bold text-slate-500">
            <span>88% Pipeline Rate</span>
            <span className="text-emerald-400">Active</span>
          </div>
        </div>

        {/* Theme Picker */}
        <div className="pt-2 border-t border-slate-700/40">
          <div className="grid grid-cols-3 gap-1 p-1 rounded-lg border border-slate-700/50 bg-slate-900/60">
            <button
              onClick={() => setTheme('dark')}
              className={`flex items-center justify-center space-x-1 py-1 rounded text-[10px] font-medium transition-all ${
                isDark 
                  ? 'bg-slate-800 text-blue-400 shadow-sm border border-blue-500/30 font-semibold' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Moon className="w-3 h-3" />
              <span>Dark</span>
            </button>
            <button
              onClick={() => setTheme('steel')}
              className={`flex items-center justify-center space-x-1 py-1 rounded text-[10px] font-medium transition-all ${
                isSteel 
                  ? 'bg-slate-800 text-blue-400 shadow-sm border border-blue-500/40 font-semibold' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-3 h-3" />
              <span>Steel</span>
            </button>
            <button
              onClick={() => setTheme('light')}
              className={`flex items-center justify-center space-x-1 py-1 rounded text-[10px] font-medium transition-all ${
                isLight 
                  ? 'bg-white text-indigo-600 shadow-sm border border-indigo-200 font-semibold' 
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sun className="w-3 h-3" />
              <span>Light</span>
            </button>
          </div>
        </div>
      </div>
    </aside>
  );
};
