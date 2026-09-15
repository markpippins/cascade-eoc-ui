import React, { useEffect, useState } from 'react';
import { 
  AlertTriangle, 
  X, 
  Zap, 
  TrendingUp, 
  Clock, 
  Bell, 
  CheckCircle, 
  Info, 
  Volume2, 
  VolumeX 
} from 'lucide-react';
import { useAppTheme } from '../context/ThemeContext';

export interface ToastMessage {
  id: string;
  type: 'warning' | 'error' | 'info' | 'success';
  title: string;
  message: string;
  metric?: string;
  timestamp: string;
  durationMs?: number;
}

interface ToastProps {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}

export const Toast: React.FC<ToastProps> = ({ toast, onDismiss }) => {
  const { themeClasses } = useAppTheme();
  const duration = toast.durationMs || 5000;
  const [progress, setProgress] = useState(100);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const remaining = Math.max(0, 100 - (elapsed / duration) * 100);
      setProgress(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
        onDismiss(toast.id);
      }
    }, 50);

    return () => clearInterval(interval);
  }, [toast.id, duration, onDismiss]);

  const typeConfig = {
    warning: {
      bg: 'bg-amber-950/90 border-amber-500/80 text-amber-200 shadow-amber-500/20',
      icon: AlertTriangle,
      iconColor: 'text-amber-400',
      barColor: 'bg-amber-400',
      badge: 'RATE LIMIT WARNING'
    },
    error: {
      bg: 'bg-rose-950/90 border-rose-500/80 text-rose-200 shadow-rose-500/20',
      icon: AlertTriangle,
      iconColor: 'text-rose-400',
      barColor: 'bg-rose-400',
      badge: 'RATE SPIKE CRITICAL'
    },
    info: {
      bg: 'bg-sky-950/90 border-sky-500/80 text-sky-200 shadow-sky-500/20',
      icon: Info,
      iconColor: 'text-sky-400',
      barColor: 'bg-sky-400',
      badge: 'NOTIFICATION'
    },
    success: {
      bg: 'bg-emerald-950/90 border-emerald-500/80 text-emerald-200 shadow-emerald-500/20',
      icon: CheckCircle,
      iconColor: 'text-emerald-400',
      barColor: 'bg-emerald-400',
      badge: 'SYSTEM OK'
    }
  }[toast.type];

  const Icon = typeConfig.icon;

  return (
    <div
      role="alert"
      className={`relative w-full max-w-md overflow-hidden rounded-xl border backdrop-blur-md shadow-2xl transition-all duration-300 transform translate-y-0 ${typeConfig.bg}`}
    >
      <div className="p-4 flex items-start space-x-3">
        {/* Pulsing Icon Badge */}
        <div className="flex-shrink-0 p-2 rounded-lg bg-black/30 border border-white/10 relative">
          <Icon className={`w-5 h-5 ${typeConfig.iconColor} animate-pulse`} />
          <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-amber-500"></span>
          </span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0 pr-2">
          <div className="flex items-center space-x-2">
            <span className="text-[9px] font-mono font-bold uppercase tracking-wider px-1.5 py-0.2 rounded bg-black/40 border border-white/10 text-slate-300">
              {typeConfig.badge}
            </span>
            <span className="text-[10px] font-mono text-slate-400">
              {toast.timestamp}
            </span>
          </div>

          <h4 className="text-xs font-bold font-mono text-slate-100 mt-1 truncate">
            {toast.title}
          </h4>

          <p className="text-xs font-sans text-slate-300 mt-0.5 leading-relaxed">
            {toast.message}
          </p>

          {toast.metric && (
            <div className="mt-2 inline-flex items-center space-x-1.5 px-2 py-0.5 rounded bg-black/40 border border-white/15 text-[11px] font-mono font-bold text-amber-300">
              <Zap className="w-3 h-3 text-amber-400" />
              <span>{toast.metric}</span>
            </div>
          )}
        </div>

        {/* Close Button */}
        <button
          onClick={() => onDismiss(toast.id)}
          className="flex-shrink-0 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
          aria-label="Dismiss Notification"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Auto-Dismiss Progress Bar */}
      <div className="w-full bg-black/40 h-1">
        <div
          className={`h-full ${typeConfig.barColor} transition-all duration-75 ease-linear`}
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

interface ToastContainerProps {
  toasts: ToastMessage[];
  onDismiss: (id: string) => void;
  onClearAll?: () => void;
}

export const ToastContainer: React.FC<ToastContainerProps> = ({
  toasts,
  onDismiss,
  onClearAll
}) => {
  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col space-y-3 max-w-md w-full pointer-events-auto">
      {toasts.length > 1 && onClearAll && (
        <div className="flex justify-end">
          <button
            onClick={onClearAll}
            className="px-2.5 py-1 rounded-md bg-slate-900/90 text-slate-300 hover:text-white border border-slate-700 text-[10px] font-mono font-semibold shadow-lg backdrop-blur-sm transition-all flex items-center space-x-1"
          >
            <X className="w-3 h-3" />
            <span>Clear All ({toasts.length})</span>
          </button>
        </div>
      )}
      {toasts.map(t => (
        <Toast key={t.id} toast={t} onDismiss={onDismiss} />
      ))}
    </div>
  );
};
