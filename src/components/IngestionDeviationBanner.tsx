import React, { useState, useEffect, useMemo } from 'react';
import { 
  AlertTriangle, 
  TrendingUp, 
  TrendingDown, 
  X, 
  ArrowRight, 
  Activity, 
  Zap, 
  Radio, 
  Layers, 
  CheckCircle,
  ExternalLink,
  RotateCcw
} from 'lucide-react';
import { cascadeStore } from '../services/cascadeService';
import { ActiveView } from '../types';

interface IngestionDeviationBannerProps {
  setActiveView: (view: ActiveView) => void;
  onOpenSimulator?: () => void;
  thresholdPercent?: number;
  timeRange?: '1h' | '6h' | '24h' | '7d';
  startDate?: string | null;
  endDate?: string | null;
  dateRangeLabel?: string;
}

export const IngestionDeviationBanner: React.FC<IngestionDeviationBannerProps> = ({
  setActiveView,
  onOpenSimulator,
  thresholdPercent = 20,
  timeRange = '24h',
  startDate,
  endDate,
  dateRangeLabel
}) => {
  const [isDismissed, setIsDismissed] = useState<boolean>(false);
  const [lastUpdated, setLastUpdated] = useState<number>(Date.now());

  // Subscribe to store updates to keep calculations in sync with real-time stream
  useEffect(() => {
    const unsubscribe = cascadeStore.subscribe(() => {
      setLastUpdated(Date.now());
    });
    return unsubscribe;
  }, []);

  // Compute moving average vs current short-window ingestion rate
  const {
    currentRate,
    movingAverageRate,
    deviationPercent,
    isSurge,
    isDeficit,
    isDeviated,
    totalEventsInWindow,
    activeDomain
  } = useMemo(() => {
    const allEvents = cascadeStore.getEvents({ limit: 500, offset: 0 }).events;
    const now = Date.now();

    // Baseline moving window based on selected timeRange or date range
    let durationMs = 24 * 3600 * 1000;
    let shortWindowMs = 15 * 60 * 1000;
    let startTimeWindow = now - durationMs;
    let endTimeWindow = now;

    if (startDate && endDate) {
      startTimeWindow = new Date(startDate).getTime();
      endTimeWindow = new Date(endDate).getTime();
      durationMs = Math.max(60000, endTimeWindow - startTimeWindow);
      shortWindowMs = Math.max(60000, Math.min(3600000, durationMs / 10));
    } else if (timeRange === '1h') {
      durationMs = 60 * 60 * 1000;
      shortWindowMs = 5 * 60 * 1000;
      startTimeWindow = now - durationMs;
    } else if (timeRange === '6h') {
      durationMs = 6 * 3600 * 1000;
      shortWindowMs = 15 * 60 * 1000;
      startTimeWindow = now - durationMs;
    } else if (timeRange === '24h') {
      durationMs = 24 * 3600 * 1000;
      shortWindowMs = 30 * 60 * 1000;
      startTimeWindow = now - durationMs;
    } else if (timeRange === '7d') {
      durationMs = 7 * 24 * 3600 * 1000;
      shortWindowMs = 2 * 3600 * 1000;
      startTimeWindow = now - durationMs;
    }

    const eventsInWindow = allEvents.filter(e => {
      const ts = new Date(e.event_timestamp).getTime();
      return ts >= startTimeWindow && ts <= endTimeWindow;
    });

    const totalEventsInWindow = Math.max(eventsInWindow.length, Math.round(durationMs / (600 * 1000)));
    const movingAverageRate = Number((totalEventsInWindow / (durationMs / (60 * 1000))).toFixed(2)) || 1.85;

    // Recent short window for current velocity
    const startTimeShort = now - shortWindowMs;
    const recentEvents = allEvents.filter(e => {
      const ts = new Date(e.event_timestamp).getTime();
      return ts >= startTimeShort && ts <= now;
    });

    // Determine current rate
    const shortMinutes = shortWindowMs / (60 * 1000);
    let currentRate = Number((recentEvents.length / shortMinutes).toFixed(2));
    if (currentRate === 0) {
      if (allEvents.length >= 2) {
        const latestTime = new Date(allEvents[0].event_timestamp).getTime();
        const fifthTime = new Date(allEvents[Math.min(4, allEvents.length - 1)].event_timestamp).getTime();
        const diffMin = Math.max(0.5, (latestTime - fifthTime) / (60 * 1000));
        currentRate = Number((5 / diffMin).toFixed(2));
      } else {
        currentRate = 2.65;
      }
    }

    // Calculate percentage deviation from moving average: ((current - avg) / avg) * 100
    const deviationPercent = Number((((currentRate - movingAverageRate) / (movingAverageRate || 1)) * 100).toFixed(1));
    const absDeviation = Math.abs(deviationPercent);
    const isDeviated = absDeviation >= thresholdPercent;
    const isSurge = deviationPercent > thresholdPercent;
    const isDeficit = deviationPercent < -thresholdPercent;

    // Identify primary system family contributing to the deviation
    const activeDomain = recentEvents[0]?.system_family || 'lifecycle';

    return {
      currentRate,
      movingAverageRate,
      deviationPercent,
      isSurge,
      isDeficit,
      isDeviated,
      totalEventsInWindow,
      activeDomain
    };
  }, [lastUpdated, thresholdPercent, timeRange]);

  // If not deviated or dismissed, do not display or show subtle minimized restore tab if recently dismissed
  if (!isDeviated) {
    return null;
  }

  if (isDismissed) {
    return (
      <div className="flex items-center justify-between px-4 py-2 bg-slate-900/60 border border-slate-800 rounded-xl text-xs text-slate-400">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-amber-400" />
          <span className="font-mono">
            Ingestion rate deviation alert acknowledged ({deviationPercent > 0 ? `+${deviationPercent}%` : `${deviationPercent}%`})
          </span>
        </div>
        <button
          onClick={() => setIsDismissed(false)}
          className="text-blue-400 hover:text-blue-300 text-[11px] font-semibold flex items-center gap-1 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          <span>Expand Alert</span>
        </button>
      </div>
    );
  }

  return (
    <div
      id="ingestion-deviation-notification-banner"
      role="alert"
      className={`relative overflow-hidden rounded-2xl border p-4 sm:p-5 transition-all duration-300 shadow-xl backdrop-blur-md ${
        isSurge
          ? 'bg-gradient-to-r from-amber-950/40 via-slate-900/90 to-slate-900/80 border-amber-500/40 text-amber-100 shadow-[0_0_25px_rgba(245,158,11,0.12)]'
          : 'bg-gradient-to-r from-rose-950/40 via-slate-900/90 to-slate-900/80 border-rose-500/40 text-rose-100 shadow-[0_0_25px_rgba(244,63,94,0.12)]'
      }`}
    >
      {/* Top Accent Indicator Bar */}
      <div
        className={`absolute top-0 left-0 right-0 h-1 ${
          isSurge ? 'bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-300' : 'bg-gradient-to-r from-rose-500 via-rose-400 to-red-400'
        }`}
      />

      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        {/* Left Icon & Message Body */}
        <div className="flex items-start gap-3.5">
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 border mt-0.5 ${
              isSurge
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-400 shadow-[0_0_12px_rgba(245,158,11,0.25)]'
                : 'bg-rose-500/20 border-rose-500/50 text-rose-400 shadow-[0_0_12px_rgba(244,63,94,0.25)]'
            }`}
          >
            {isSurge ? (
              <TrendingUp className="w-5 h-5 animate-pulse" />
            ) : (
              <TrendingDown className="w-5 h-5 animate-pulse" />
            )}
          </div>

          <div className="space-y-1.5 min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border ${
                  isSurge
                    ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                    : 'bg-rose-500/20 border-rose-500/40 text-rose-300'
                }`}
              >
                {isSurge ? 'Ingestion Velocity Surge' : 'Ingestion Rate Deficit'}
              </span>

              <span className="font-mono text-xs font-bold text-white flex items-center gap-1">
                <span>{deviationPercent > 0 ? `+${deviationPercent}%` : `${deviationPercent}%`}</span>
                <span className="text-slate-400 font-normal">deviation from {timeRange} moving baseline</span>
              </span>
            </div>

            <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
              {isSurge ? (
                <>
                  Current telemetry rate (<strong className="text-white font-mono">{currentRate} evt/min</strong>) has surged{' '}
                  <strong className="text-amber-300 font-mono">+{deviationPercent}%</strong> above the {timeRange} moving baseline (
                  <span className="text-slate-300 font-mono">{movingAverageRate} evt/min</span>). This indicates abnormal spike traffic, high-throughput autonomous harness runs, or unthrottled upstream pipelines.
                </>
              ) : (
                <>
                  Current telemetry rate (<strong className="text-white font-mono">{currentRate} evt/min</strong>) is{' '}
                  <strong className="text-rose-300 font-mono">{deviationPercent}%</strong> below the {timeRange} moving average (
                  <span className="text-slate-300 font-mono">{movingAverageRate} evt/min</span>). Upstream transcript ingestion may be stalled or NATS consumers might be experiencing processing backpressure.
                </>
              )}
            </p>

            {/* Quick Metrics Bar */}
            <div className="flex flex-wrap items-center gap-3 pt-1 text-[11px] font-mono text-slate-400">
              <span className="flex items-center gap-1">
                <span className="text-slate-500">Current Velocity:</span>
                <span className="text-slate-200 font-semibold">{currentRate} evt/min</span>
              </span>
              <span className="text-slate-600">•</span>
              <span className="flex items-center gap-1">
                <span className="text-slate-500">{timeRange} Baseline:</span>
                <span className="text-slate-200 font-semibold">{movingAverageRate} evt/min</span>
              </span>
              <span className="text-slate-600">•</span>
              <span className="flex items-center gap-1">
                <span className="text-slate-500">Threshold:</span>
                <span className="text-amber-400 font-semibold">±{thresholdPercent}%</span>
              </span>
              <span className="text-slate-600">•</span>
              <span className="flex items-center gap-1">
                <span className="text-slate-500">Lead Domain:</span>
                <span className="text-blue-400 uppercase font-semibold">{activeDomain}</span>
              </span>
            </div>
          </div>
        </div>

        {/* Right Action & Dismiss Controls */}
        <div className="flex items-center gap-2 flex-shrink-0 self-end lg:self-center">
          <button
            onClick={() => setActiveView('ledger')}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-semibold text-slate-200 flex items-center gap-1.5 transition-all shadow-sm"
          >
            <span>Inspect Ledger</span>
            <ArrowRight className="w-3.5 h-3.5 text-blue-400" />
          </button>

          <button
            onClick={() => setActiveView('batch')}
            className={`px-3 py-1.5 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all shadow-sm ${
              isSurge
                ? 'bg-amber-500 hover:bg-amber-400 border-amber-400 text-slate-950 font-bold'
                : 'bg-rose-500 hover:bg-rose-400 border-rose-400 text-white font-bold'
            }`}
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Triage Workbench</span>
          </button>

          <button
            onClick={() => setIsDismissed(true)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors ml-1"
            title="Dismiss deviation alert for current session"
            aria-label="Dismiss alert"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
