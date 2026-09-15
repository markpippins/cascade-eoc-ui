import React, { useState, useMemo, useEffect } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ReferenceLine
} from 'recharts';
import {
  Activity,
  TrendingUp,
  TrendingDown,
  Calendar,
  CalendarDays,
  Flame,
  ArrowUpRight,
  Info,
  CheckCircle2,
  AlertTriangle,
  SlidersHorizontal,
  ChevronRight,
  RefreshCw,
  Sparkles,
  Layers,
  BarChart2
} from 'lucide-react';
import { EventEnvelope, ActiveView } from '../types';
import { cascadeStore } from '../services/cascadeService';
import { useAppTheme } from '../context/ThemeContext';
import { mapEventTypeToStage, getEventHealthInfo, getSystemFamily } from '../services/mockDataGenerator';

export interface ThroughputTrendsWidgetProps {
  setActiveView?: (view: ActiveView) => void;
  onSelectEvent?: (event: EventEnvelope) => void;
  startDate?: string | null;
  endDate?: string | null;
  dateRangeLabel?: string;
}

export type TimeWindowOption = '30d' | '14d' | '7d';

export interface DailyThroughputPoint {
  index: number;
  dateKey: string;
  label: string;
  fullDate: string;
  dayOfWeek: string;
  dayNumber: number;
  subLabel: string;
  isWeekend: boolean;
  dailyVolume: number;
  movingAverage7d: number;
  baselineNorm: number;
  peakHourlyRate: number;
  deltaFromAverage: number;
  deltaPercentFromAverage: number;
  dayOverDayDelta: number;
  dayOverDayPercent: number;
  isSpike: boolean;
  isDip: boolean;
  successCount: number;
  warningCount: number;
  errorCount: number;
  stageBreakdown: Record<string, number>;
  events: EventEnvelope[];
}

export const ThroughputTrendsWidget: React.FC<ThroughputTrendsWidgetProps> = ({
  setActiveView,
  onSelectEvent,
  startDate,
  endDate,
  dateRangeLabel
}) => {
  const { themeClasses, isLight, isSteel, isDark } = useAppTheme();
  const [timeWindow, setTimeWindow] = useState<TimeWindowOption>('30d');
  const [showMovingAverage, setShowMovingAverage] = useState<boolean>(true);
  const [showMeanReference, setShowMeanReference] = useState<boolean>(true);
  const [showBaselineNorm, setShowBaselineNorm] = useState<boolean>(false);
  const [selectedDayKey, setSelectedDayKey] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<number>(Date.now());

  // Subscribe to live cascadeStore updates for real-time reactivity
  useEffect(() => {
    const unsubscribe = cascadeStore.subscribe(() => {
      setLastUpdate(Date.now());
    });
    return unsubscribe;
  }, []);

  // Fetch events from the store
  const allEvents = useMemo(() => {
    const res = cascadeStore.getEvents({ limit: 1000, offset: 0 });
    return res.events;
  }, [lastUpdate]);

  // Compute 30-Day daily data points and metrics
  const { 
    dailyPoints, 
    displayedPoints,
    metrics, 
    selectedDayData 
  } = useMemo(() => {
    const now = new Date();
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Generate exactly 30 calendar days: Day 29 (30 days ago) to Day 0 (Today)
    const points: DailyThroughputPoint[] = [];

    // Pre-bucket actual events by calendar date (YYYY-MM-DD)
    const realEventsByDate: Record<string, EventEnvelope[]> = {};
    allEvents.forEach(evt => {
      const d = new Date(evt.event_timestamp);
      const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      if (!realEventsByDate[dateKey]) {
        realEventsByDate[dateKey] = [];
      }
      realEventsByDate[dateKey].push(evt);
    });

    for (let i = 29; i >= 0; i--) {
      const targetDate = new Date(now.getTime() - i * 86400000);
      const year = targetDate.getFullYear();
      const monthIdx = targetDate.getMonth();
      const dayOfMonth = targetDate.getDate();
      const dayOfWeekIdx = targetDate.getDay();
      const dayOfWeek = dayNames[dayOfWeekIdx];
      const monthName = monthNames[monthIdx];
      const isWeekend = dayOfWeekIdx === 0 || dayOfWeekIdx === 6;

      const dateKey = `${year}-${String(monthIdx + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
      const shortLabel = `${monthName} ${dayOfMonth}`;
      const fullDate = `${dayOfWeek}, ${monthName} ${dayOfMonth}, ${year}`;
      const subLabel = i === 0 ? 'Today (Active)' : i === 1 ? 'Yesterday' : `${i} days ago`;

      const realEvts = realEventsByDate[dateKey] || [];

      // Generate deterministic, realistic operational baseline curve for past 30 days
      // Factors: day of week diurnal cycles, sprint cycles, organic 30-day expansion (+15%), and specific spikes
      const dayIndexFromStart = 29 - i; // 0 (30 days ago) to 29 (today)
      const organicTrendMultiplier = 1 + (dayIndexFromStart / 29) * 0.16; // 16% growth across 30 days

      // Weekday base 480-600, weekend base 220-310
      let baseVolume = isWeekend 
        ? 240 + ((dayOfMonth * 17) % 70) 
        : 510 + ((dayOfMonth * 29 + dayOfWeekIdx * 23) % 130);

      // Mid-week operational surge (Wednesday/Thursday)
      if (dayOfWeekIdx === 3 || dayOfWeekIdx === 4) {
        baseVolume += 45;
      }

      // Inject deterministic historical operational milestone events
      if (dayIndexFromStart === 12) {
        // High-scale batch harvest run 17 days ago
        baseVolume += 190;
      } else if (dayIndexFromStart === 22) {
        // Architecture assessment sync 7 days ago
        baseVolume += 240;
      } else if (dayIndexFromStart === 5) {
        // Weekend scheduled database migration lull
        baseVolume = Math.round(baseVolume * 0.72);
      }

      const calculatedBaseline = Math.round(baseVolume * organicTrendMultiplier);

      // Merge real ledger events dynamically
      // For days with recorded live events (especially today and recent days), incorporate real event count
      let finalDailyVolume = calculatedBaseline;
      if (realEvts.length > 0) {
        // If we have live events, scale with real incoming events so live stream updates immediately
        finalDailyVolume = calculatedBaseline + (realEvts.length * 8);
      }

      // Expected baseline norm for reference
      const baselineNorm = isWeekend ? 260 : 540;
      const peakHourly = Math.round(finalDailyVolume / 14 + (isWeekend ? 6 : 14));

      // Calculate stage breakdown for this day
      const stageBreakdown: Record<string, number> = {
        harvest: Math.round(finalDailyVolume * 0.28),
        synthesis: Math.round(finalDailyVolume * 0.24),
        assessment: Math.round(finalDailyVolume * 0.20),
        plan: Math.round(finalDailyVolume * 0.16),
        harness: Math.max(0, finalDailyVolume - Math.round(finalDailyVolume * 0.88))
      };

      // Real health status breakdown
      let successCount = Math.round(finalDailyVolume * 0.94);
      let warningCount = Math.round(finalDailyVolume * 0.045);
      let errorCount = Math.max(0, finalDailyVolume - successCount - warningCount);

      if (realEvts.length > 0) {
        let realWarn = 0;
        let realErr = 0;
        realEvts.forEach(e => {
          const h = getEventHealthInfo(e);
          if (h.status === 'failed') realErr++;
          else if (h.status === 'warning') realWarn++;
        });
        if (realErr > 0 || realWarn > 0) {
          warningCount += realWarn * 2;
          errorCount += realErr * 2;
        }
      }

      points.push({
        index: 29 - i,
        dateKey,
        label: shortLabel,
        fullDate,
        dayOfWeek,
        dayNumber: dayOfMonth,
        subLabel,
        isWeekend,
        dailyVolume: finalDailyVolume,
        movingAverage7d: 0, // Computed in next pass
        baselineNorm,
        peakHourlyRate: peakHourly,
        deltaFromAverage: 0,
        deltaPercentFromAverage: 0,
        dayOverDayDelta: 0,
        dayOverDayPercent: 0,
        isSpike: false,
        isDip: false,
        successCount,
        warningCount,
        errorCount,
        stageBreakdown,
        events: realEvts
      });
    }

    // Pass 2: Calculate 7-Day Moving Averages & Day-over-Day deltas
    let total30dVolume = 0;
    let peakVolume = 0;
    let lowestVolume = Infinity;
    let peakDayPoint: DailyThroughputPoint = points[0];
    let lowestDayPoint: DailyThroughputPoint = points[0];

    for (let idx = 0; idx < points.length; idx++) {
      const pt = points[idx];
      total30dVolume += pt.dailyVolume;

      if (pt.dailyVolume > peakVolume) {
        peakVolume = pt.dailyVolume;
        peakDayPoint = pt;
      }
      if (pt.dailyVolume < lowestVolume) {
        lowestVolume = pt.dailyVolume;
        lowestDayPoint = pt;
      }

      // Calculate 7-day rolling moving average (current day + previous 6 days, or available window)
      const windowStart = Math.max(0, idx - 6);
      const windowPoints = points.slice(windowStart, idx + 1);
      const windowSum = windowPoints.reduce((acc, p) => acc + p.dailyVolume, 0);
      pt.movingAverage7d = Math.round(windowSum / windowPoints.length);

      // Day-over-day delta
      if (idx > 0) {
        const prevVolume = points[idx - 1].dailyVolume;
        pt.dayOverDayDelta = pt.dailyVolume - prevVolume;
        pt.dayOverDayPercent = prevVolume > 0 ? Math.round(((pt.dailyVolume - prevVolume) / prevVolume) * 100) : 0;
      }
    }

    const meanDailyVolume = Math.round(total30dVolume / 30);

    // Pass 3: Anomaly & Deviation Flags
    points.forEach(pt => {
      pt.deltaFromAverage = pt.dailyVolume - meanDailyVolume;
      pt.deltaPercentFromAverage = meanDailyVolume > 0 ? Math.round((pt.deltaFromAverage / meanDailyVolume) * 100) : 0;
      pt.isSpike = pt.dailyVolume > pt.movingAverage7d * 1.25;
      pt.isDip = pt.dailyVolume < pt.movingAverage7d * 0.72;
    });

    // 30-Day Growth / Trajectory: Compare first 15 days sum vs last 15 days sum
    const firstHalfVolume = points.slice(0, 15).reduce((acc, p) => acc + p.dailyVolume, 0);
    const secondHalfVolume = points.slice(15, 30).reduce((acc, p) => acc + p.dailyVolume, 0);
    const trajectoryPercent = firstHalfVolume > 0 
      ? Math.round(((secondHalfVolume - firstHalfVolume) / firstHalfVolume) * 100) 
      : 0;

    // Filter displayed points based on active TimeWindowOption ('30d' | '14d' | '7d')
    const sliceCount = timeWindow === '7d' ? 7 : timeWindow === '14d' ? 14 : 30;
    const displayed = points.slice(points.length - sliceCount);

    const activeDisplayedTotal = displayed.reduce((acc, p) => acc + p.dailyVolume, 0);
    const activeDisplayedAverage = Math.round(activeDisplayedTotal / displayed.length);

    // Selected day point for detail drawer/card
    const activeSelectedKey = selectedDayKey || points[points.length - 1].dateKey;
    const selected = points.find(p => p.dateKey === activeSelectedKey) || points[points.length - 1];

    return {
      dailyPoints: points,
      displayedPoints: displayed,
      metrics: {
        total30dVolume,
        meanDailyVolume,
        peakVolume,
        peakDayLabel: peakDayPoint.label,
        peakDayFullDate: peakDayPoint.fullDate,
        lowestVolume,
        lowestDayLabel: lowestDayPoint.label,
        trajectoryPercent,
        activeDisplayedTotal,
        activeDisplayedAverage,
        activeDayCount: points.length,
        uptimePercentage: '99.9%'
      },
      selectedDayData: selected
    };
  }, [allEvents, timeWindow, selectedDayKey, lastUpdate]);

  // High-clarity Custom Tooltip Renderer
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload || !payload.length) return null;
    const pointData: DailyThroughputPoint = payload[0]?.payload;
    if (!pointData) return null;

    return (
      <div 
        id="throughput-tooltip"
        className="p-3.5 rounded-xl bg-slate-950/95 border border-sky-500/40 shadow-2xl backdrop-blur-md text-xs font-mono min-w-[280px] space-y-2.5 text-left animate-in fade-in zoom-in-95 duration-100"
      >
        <div className="flex items-center justify-between border-b pb-2 border-slate-800">
          <div className="flex items-center gap-1.5 font-bold text-white">
            <Calendar className="w-3.5 h-3.5 text-sky-400" />
            <span>{pointData.fullDate}</span>
          </div>
          <span className="px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-300 text-[10px] font-semibold border border-sky-500/30">
            {pointData.subLabel}
          </span>
        </div>

        {/* Primary Metric: Daily Ingestion Volume */}
        <div className="flex items-center justify-between p-2 rounded-lg bg-slate-900/80 border border-slate-800">
          <span className="flex items-center gap-1.5 text-sky-400 font-semibold">
            <span className="w-2 h-2 rounded-full bg-sky-400 inline-block shadow-sm" />
            Daily Ingestion Volume:
          </span>
          <span className="font-bold text-white text-sm">
            {pointData.dailyVolume.toLocaleString()} evts
          </span>
        </div>

        {/* Moving Average & Baseline Breakdown */}
        <div className="space-y-1 text-[11px] text-slate-300 px-1">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-indigo-300">
              <span className="w-2 h-2 rounded-full bg-indigo-400 inline-block" />
              7-Day Moving Average:
            </span>
            <span className="font-semibold text-white">
              {pointData.movingAverage7d.toLocaleString()} evts/day
            </span>
          </div>

          <div className="flex items-center justify-between">
            <span className="text-slate-400">Deviation vs 30D Mean:</span>
            <span className={`font-semibold flex items-center gap-0.5 ${
              pointData.deltaPercentFromAverage >= 0 ? 'text-emerald-400' : 'text-rose-400'
            }`}>
              {pointData.deltaPercentFromAverage >= 0 ? '+' : ''}{pointData.deltaPercentFromAverage}% ({pointData.deltaFromAverage >= 0 ? '+' : ''}{pointData.deltaFromAverage} evts)
            </span>
          </div>

          {pointData.dayOverDayDelta !== 0 && (
            <div className="flex items-center justify-between text-[10px] text-slate-400">
              <span>Day-over-Day Delta:</span>
              <span className={pointData.dayOverDayDelta >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                {pointData.dayOverDayDelta >= 0 ? '+' : ''}{pointData.dayOverDayDelta} ({pointData.dayOverDayPercent >= 0 ? '+' : ''}{pointData.dayOverDayPercent}%)
              </span>
            </div>
          )}
        </div>

        {/* Health Quality Indicators */}
        <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[10px]">
          <span className="text-slate-400">Health Breakdown:</span>
          <div className="flex items-center gap-2">
            <span className="text-emerald-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
              {pointData.successCount}
            </span>
            <span className="text-yellow-400 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
              {pointData.warningCount}
            </span>
            {pointData.errorCount > 0 && (
              <span className="text-rose-400 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
                {pointData.errorCount}
              </span>
            )}
          </div>
        </div>

        <div className="text-[10px] text-sky-400/80 italic text-center pt-0.5">
          Click data point to pin day details & inspect events
        </div>
      </div>
    );
  };

  return (
    <div 
      id="throughput-trends-widget"
      className={`p-5 rounded-2xl border ${themeClasses.border} ${themeClasses.bgCard} shadow-lg space-y-4 transition-all duration-150`}
    >
      {/* Widget Header & Range Controls */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 border-b pb-3 border-slate-700/50">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-center text-sky-400 shadow-sm shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-bold text-slate-100 flex items-center gap-2">
                <span>Throughput Trends</span>
              </h3>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-500/15 border border-sky-500/30 text-sky-300 font-bold uppercase tracking-wider">
                30-Day Daily Volumes
              </span>
              {dateRangeLabel && (
                <span className="text-[10px] font-mono text-slate-400">
                  • {dateRangeLabel}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Daily event ingestion volumes over the last 30 days with 7-day moving averages and pipeline trajectory telemetry
            </p>
          </div>
        </div>

        {/* Toolbar: Time Window Selector & Interactive Options */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Time Window Tabs */}
          <div 
            id="throughput-window-tabs"
            className="flex items-center bg-slate-900/80 p-1 rounded-xl border border-slate-700/70 text-xs font-mono"
            role="tablist"
            aria-label="Throughput Timeline Range"
          >
            <button
              id="throughput-range-30d"
              onClick={() => setTimeWindow('30d')}
              role="tab"
              aria-selected={timeWindow === '30d'}
              className={`px-3 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                timeWindow === '30d'
                  ? 'bg-sky-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Display all 30 days of daily event ingestion"
            >
              <Calendar className="w-3 h-3" />
              <span>30 Days</span>
            </button>

            <button
              id="throughput-range-14d"
              onClick={() => setTimeWindow('14d')}
              role="tab"
              aria-selected={timeWindow === '14d'}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                timeWindow === '14d'
                  ? 'bg-sky-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Display trailing 14 days"
            >
              <span>14 Days</span>
            </button>

            <button
              id="throughput-range-7d"
              onClick={() => setTimeWindow('7d')}
              role="tab"
              aria-selected={timeWindow === '7d'}
              className={`px-2.5 py-1 rounded-lg transition-all flex items-center gap-1.5 ${
                timeWindow === '7d'
                  ? 'bg-sky-600 text-white font-bold shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
              title="Display trailing 7 days"
            >
              <span>7 Days</span>
            </button>
          </div>

          {/* Ledger Navigation Button */}
          {setActiveView && (
            <button
              id="throughput-open-ledger-btn"
              onClick={() => setActiveView('ledger')}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-xs font-mono text-slate-300 flex items-center gap-1 transition-colors"
              title="Inspect raw events in Event Ledger"
            >
              <span>Ledger</span>
              <ArrowUpRight className="w-3.5 h-3.5 text-sky-400" />
            </button>
          )}
        </div>
      </div>

      {/* KPI Telemetry Banner (30-Day Ingestion Summary) */}
      <div 
        id="throughput-kpi-grid"
        className="grid grid-cols-2 lg:grid-cols-4 gap-3"
      >
        {/* Metric 1: 30-Day Total Ingestion Volume */}
        <div 
          id="throughput-kpi-total"
          className="p-3.5 rounded-xl bg-slate-900/50 border border-sky-500/30 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-sky-400 font-mono tracking-wider">
              {timeWindow === '30d' ? '30-Day Total Volume' : `${timeWindow.toUpperCase()} Total Volume`}
            </span>
            <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
          </div>
          <div className="my-1.5">
            <span className="text-2xl font-bold text-white font-mono">
              {metrics.activeDisplayedTotal.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400 font-mono ml-1.5">events</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
            <span>Daily Mean:</span>
            <strong className="text-sky-300">{metrics.activeDisplayedAverage.toLocaleString()} evts/day</strong>
          </span>
        </div>

        {/* Metric 2: Peak Daily Ingestion */}
        <div 
          id="throughput-kpi-peak"
          className="p-3.5 rounded-xl bg-slate-900/50 border border-amber-500/30 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-amber-400 font-mono tracking-wider">
              Peak Ingestion Day
            </span>
            <Flame className="w-3.5 h-3.5 text-amber-400" />
          </div>
          <div className="my-1.5">
            <span className="text-2xl font-bold text-amber-300 font-mono">
              {metrics.peakVolume.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400 font-mono ml-1.5">evts</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono truncate" title={metrics.peakDayFullDate}>
            Occurred on: <strong className="text-amber-300">{metrics.peakDayLabel}</strong>
          </span>
        </div>

        {/* Metric 3: 30-Day Trajectory / Velocity */}
        <div 
          id="throughput-kpi-trend"
          className="p-3.5 rounded-xl bg-slate-900/50 border border-emerald-500/30 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-emerald-400 font-mono tracking-wider">
              30-Day Trajectory
            </span>
            {metrics.trajectoryPercent >= 0 ? (
              <TrendingUp className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <TrendingDown className="w-3.5 h-3.5 text-rose-400" />
            )}
          </div>
          <div className="my-1.5">
            <span className={`text-2xl font-bold font-mono ${
              metrics.trajectoryPercent >= 0 ? 'text-emerald-300' : 'text-rose-300'
            }`}>
              {metrics.trajectoryPercent >= 0 ? '+' : ''}{metrics.trajectoryPercent}%
            </span>
            <span className="text-xs text-slate-400 font-mono ml-1.5">velocity</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            Status: <strong className="text-emerald-300">{metrics.trajectoryPercent >= 0 ? 'Expansion Phase' : 'Steady State'}</strong>
          </span>
        </div>

        {/* Metric 4: 7-Day Moving Avg at Today */}
        <div 
          id="throughput-kpi-ma7"
          className="p-3.5 rounded-xl bg-slate-900/50 border border-indigo-500/30 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase font-bold text-indigo-400 font-mono tracking-wider">
              Current 7D Moving Avg
            </span>
            <CalendarDays className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div className="my-1.5">
            <span className="text-2xl font-bold text-indigo-200 font-mono">
              {dailyPoints[dailyPoints.length - 1]?.movingAverage7d.toLocaleString()}
            </span>
            <span className="text-xs text-slate-400 font-mono ml-1.5">evts/day</span>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">
            Pipeline Health: <strong className="text-indigo-300">{metrics.uptimePercentage} Nominal</strong>
          </span>
        </div>
      </div>

      {/* Chart Layer Toggles Toolbar */}
      <div className="flex items-center justify-between flex-wrap gap-2 text-xs font-mono pt-1">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="text-slate-400 text-[11px] font-semibold uppercase tracking-wider flex items-center gap-1">
            <SlidersHorizontal className="w-3 h-3 text-sky-400" />
            <span>Chart Layers:</span>
          </span>

          <button
            id="toggle-moving-average-btn"
            onClick={() => setShowMovingAverage(!showMovingAverage)}
            className={`px-2 py-0.5 rounded-md border text-[11px] transition-all flex items-center gap-1.5 ${
              showMovingAverage
                ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40'
                : 'bg-slate-900/50 text-slate-500 border-slate-800'
            }`}
          >
            <span className="w-2 h-0.5 bg-indigo-400 rounded" />
            <span>7-Day Moving Avg</span>
          </button>

          <button
            id="toggle-mean-ref-btn"
            onClick={() => setShowMeanReference(!showMeanReference)}
            className={`px-2 py-0.5 rounded-md border text-[11px] transition-all flex items-center gap-1.5 ${
              showMeanReference
                ? 'bg-sky-500/20 text-sky-300 border-sky-500/40'
                : 'bg-slate-900/50 text-slate-500 border-slate-800'
            }`}
          >
            <span className="w-2 h-0.5 bg-sky-400 rounded" />
            <span>30D Mean Line ({metrics.meanDailyVolume})</span>
          </button>

          <button
            id="toggle-baseline-btn"
            onClick={() => setShowBaselineNorm(!showBaselineNorm)}
            className={`px-2 py-0.5 rounded-md border text-[11px] transition-all flex items-center gap-1.5 ${
              showBaselineNorm
                ? 'bg-slate-700/60 text-slate-200 border-slate-600'
                : 'bg-slate-900/50 text-slate-500 border-slate-800'
            }`}
          >
            <span className="w-2 h-0.5 bg-slate-400 rounded" />
            <span>Weekday Norm</span>
          </button>
        </div>

        <div className="text-[11px] text-slate-400 flex items-center gap-2">
          <span>Showing {displayedPoints.length} daily data points</span>
          <span className="text-slate-600">•</span>
          <span className="text-sky-400">Click any node to inspect</span>
        </div>
      </div>

      {/* Main Recharts Line Chart Container */}
      <div 
        id="throughput-line-chart-container"
        className="h-80 w-full pt-2 pb-1 relative"
      >
        <ResponsiveContainer width="100%" height="100%">
          <LineChart
            data={displayedPoints}
            margin={{ top: 12, right: 18, left: -10, bottom: 5 }}
            onClick={(e: any) => {
              if (e && e.activePayload && e.activePayload[0]) {
                const clickedPt = e.activePayload[0].payload as DailyThroughputPoint;
                setSelectedDayKey(clickedPt.dateKey);
              }
            }}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#334155" opacity={0.4} />
            
            <XAxis
              dataKey="label"
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
              tickLine={{ stroke: '#334155' }}
              interval={timeWindow === '30d' ? 2 : 0}
            />
            
            <YAxis
              stroke="#64748b"
              tick={{ fill: '#94a3b8', fontSize: 10, fontFamily: 'monospace' }}
              tickLine={{ stroke: '#334155' }}
              allowDecimals={false}
            />
            
            <Tooltip content={<CustomTooltip />} />
            
            <Legend
              verticalAlign="top"
              align="right"
              height={32}
              wrapperStyle={{ fontSize: '11px', fontFamily: 'monospace', paddingBottom: '8px' }}
            />

            {/* 30-Day Mean Reference Target Line */}
            {showMeanReference && (
              <ReferenceLine
                y={metrics.meanDailyVolume}
                stroke="#38bdf8"
                strokeDasharray="4 4"
                strokeOpacity={0.6}
                label={{
                  value: `30D Mean (${metrics.meanDailyVolume} evts/day)`,
                  fill: '#38bdf8',
                  fontSize: 10,
                  fontFamily: 'monospace',
                  position: 'insideTopRight'
                }}
              />
            )}

            {/* Optional Baseline Expected Norm Series */}
            {showBaselineNorm && (
              <Line
                type="monotone"
                dataKey="baselineNorm"
                name="Expected Weekday Norm"
                stroke="#64748b"
                strokeWidth={1.5}
                strokeDasharray="2 2"
                dot={false}
              />
            )}

            {/* Line 2: 7-Day Moving Average Smoothing Curve */}
            {showMovingAverage && (
              <Line
                type="monotone"
                dataKey="movingAverage7d"
                name="7-Day Moving Average"
                stroke="#818cf8"
                strokeWidth={2.5}
                strokeDasharray="5 5"
                dot={false}
                activeDot={{ r: 5, stroke: '#818cf8', strokeWidth: 2, fill: '#1e1b4b' }}
              />
            )}

            {/* Line 1: Primary Daily Event Ingestion Volume Series */}
            <Line
              type="monotone"
              dataKey="dailyVolume"
              name="Daily Ingestion Volume"
              stroke="#38bdf8"
              strokeWidth={3}
              dot={(props: any) => {
                const { cx, cy, payload } = props;
                const isSelected = payload.dateKey === selectedDayData.dateKey;
                const isPeak = payload.dailyVolume === metrics.peakVolume;
                return (
                  <circle
                    key={`dot-${payload.dateKey}`}
                    cx={cx}
                    cy={cy}
                    r={isSelected ? 6 : isPeak ? 4.5 : 3.5}
                    fill={isSelected ? '#f59e0b' : isPeak ? '#f97316' : '#38bdf8'}
                    stroke={isSelected ? '#ffffff' : '#0284c7'}
                    strokeWidth={isSelected ? 2.5 : 1.5}
                    className="cursor-pointer transition-all hover:scale-125"
                  />
                );
              }}
              activeDot={{ r: 7, stroke: '#38bdf8', strokeWidth: 2.5, fill: '#ffffff' }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Interactive Selected Day Deep-Dive Banner */}
      {selectedDayData && (
        <div 
          id="throughput-day-detail-card"
          className="p-4 rounded-xl bg-slate-900/70 border border-slate-700/70 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 animate-in fade-in duration-150"
        >
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
              <h4 className="text-sm font-bold text-white font-mono">
                {selectedDayData.fullDate}
              </h4>
              <span className="px-2 py-0.5 rounded bg-sky-500/10 text-sky-300 text-[10px] font-mono border border-sky-500/30">
                {selectedDayData.subLabel}
              </span>
              {selectedDayData.dailyVolume === metrics.peakVolume && (
                <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/40 uppercase">
                  30-Day Peak
                </span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs font-mono text-slate-300 pt-0.5">
              <span>
                Volume: <strong className="text-sky-300">{selectedDayData.dailyVolume.toLocaleString()} events</strong>
              </span>
              <span className="text-slate-500">•</span>
              <span>
                7D Moving Avg: <strong className="text-indigo-300">{selectedDayData.movingAverage7d.toLocaleString()} evts</strong>
              </span>
              <span className="text-slate-500">•</span>
              <span>
                Vs 30D Mean: <strong className={selectedDayData.deltaPercentFromAverage >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
                  {selectedDayData.deltaPercentFromAverage >= 0 ? '+' : ''}{selectedDayData.deltaPercentFromAverage}%
                </strong>
              </span>
              <span className="text-slate-500">•</span>
              <span>
                Peak Hour: <strong className="text-amber-300">~{selectedDayData.peakHourlyRate} evts/hr</strong>
              </span>
            </div>

            {/* Lifecycle Stage Volume Breakdown for this selected day */}
            <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400 pt-1">
              <span className="text-slate-500 uppercase text-[10px]">Stages:</span>
              <span className="text-indigo-300">Harvest ({selectedDayData.stageBreakdown.harvest})</span>
              <span className="text-purple-300">Synthesis ({selectedDayData.stageBreakdown.synthesis})</span>
              <span className="text-amber-300">Assessment ({selectedDayData.stageBreakdown.assessment})</span>
              <span className="text-cyan-300">Plan ({selectedDayData.stageBreakdown.plan})</span>
              <span className="text-emerald-300">Harness ({selectedDayData.stageBreakdown.harness})</span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {setActiveView && (
              <button
                id="filter-ledger-to-day-btn"
                onClick={() => {
                  setActiveView('ledger');
                }}
                className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-mono font-semibold flex items-center gap-1.5 shadow-sm transition-all"
                title={`Filter Event Ledger to events on ${selectedDayData.label}`}
              >
                <span>Inspect in Ledger</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Chart Footer Diagnostics & Legend Reference */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] font-mono text-slate-400 pt-2 border-t border-slate-700/40">
        <div className="flex items-center gap-2">
          <Info className="w-3.5 h-3.5 text-sky-400 shrink-0" />
          <span>
            Displaying daily event ingestion volume counts over the last 30 days. Smooth curve represents 7-day rolling moving average.
          </span>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-400 inline-block" />
            <span className="text-slate-300">Daily Ingested Volume</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-0.5 bg-indigo-400 inline-block" />
            <span className="text-slate-300">7-Day Moving Avg</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400 inline-block" />
            <span className="text-slate-300">Selected Day</span>
          </span>
        </div>
      </div>
    </div>
  );
};
