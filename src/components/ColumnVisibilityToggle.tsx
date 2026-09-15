import React, { useState, useRef, useEffect } from 'react';
import {
  Columns,
  Check,
  RotateCcw,
  Clock,
  Activity,
  AlertTriangle,
  Tag,
  Globe,
  Fingerprint,
  Layers,
  User,
  ArrowUpRight,
  Sliders,
  X,
  Eye,
  EyeOff
} from 'lucide-react';
import {
  ColumnKey,
  ColumnVisibilityMap,
  AVAILABLE_COLUMNS,
  DEFAULT_COLUMN_VISIBILITY,
  COMPACT_COLUMN_VISIBILITY,
  TRACE_FOCUS_COLUMN_VISIBILITY
} from '../utils/columnVisibility';
import { useAppTheme } from '../context/ThemeContext';

interface ColumnVisibilityToggleProps {
  visibility: ColumnVisibilityMap;
  onChange: (newVisibility: ColumnVisibilityMap) => void;
  variant?: 'header' | 'toolbar';
}

const COLUMN_ICONS: Record<ColumnKey, React.ComponentType<{ className?: string }>> = {
  timestamp: Clock,
  status: Activity,
  severity: AlertTriangle,
  eventType: Tag,
  origin: Globe,
  traceId: Fingerprint,
  aggregate: Layers,
  actor: User,
  causation: ArrowUpRight,
  actions: Sliders
};

export const ColumnVisibilityToggle: React.FC<ColumnVisibilityToggleProps> = ({
  visibility,
  onChange,
  variant = 'toolbar'
}) => {
  const { isDark, isSteel } = useAppTheme();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const visibleCount = AVAILABLE_COLUMNS.filter(col => visibility[col.id]).length;
  const totalCount = AVAILABLE_COLUMNS.length;

  // Click outside to close
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const handleToggleColumn = (id: ColumnKey) => {
    const isCurrentlyVisible = visibility[id];
    // Prevent hiding all columns
    if (isCurrentlyVisible && visibleCount <= 1) {
      return;
    }
    onChange({
      ...visibility,
      [id]: !isCurrentlyVisible
    });
  };

  const handleShowAll = () => {
    const allVisible = AVAILABLE_COLUMNS.reduce((acc, col) => {
      acc[col.id] = true;
      return acc;
    }, {} as ColumnVisibilityMap);
    onChange(allVisible);
  };

  const handleResetDefault = () => {
    onChange(DEFAULT_COLUMN_VISIBILITY);
  };

  const handlePresetCompact = () => {
    onChange(COMPACT_COLUMN_VISIBILITY);
  };

  const handlePresetTrace = () => {
    onChange(TRACE_FOCUS_COLUMN_VISIBILITY);
  };

  return (
    <div className="relative inline-block" ref={dropdownRef} id="column-visibility-toggle-root">
      {/* Trigger Button */}
      {variant === 'header' ? (
        <button
          type="button"
          id="btn-table-header-column-visibility"
          onClick={(e) => {
            e.stopPropagation();
            setIsOpen(!isOpen);
          }}
          className={`inline-flex items-center space-x-1 px-2 py-1 rounded text-[10px] font-mono transition-all ${
            isOpen
              ? 'bg-sky-500/25 text-sky-200 border border-sky-500/50 shadow-xs'
              : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/80 border border-transparent hover:border-slate-700'
          }`}
          title="Customize visible table metadata columns"
        >
          <Columns className="w-3 h-3 text-sky-400" />
          <span className="font-semibold">Columns</span>
          <span className="text-[9px] px-1 py-0.2 rounded bg-slate-800 text-slate-300 font-bold ml-0.5">
            {visibleCount}/{totalCount}
          </span>
        </button>
      ) : (
        <button
          type="button"
          id="btn-toolbar-column-visibility"
          onClick={() => setIsOpen(!isOpen)}
          className={`flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-mono font-medium transition-all ${
            isOpen
              ? 'bg-sky-500/20 border-sky-500/50 text-sky-200 shadow-xs'
              : 'border-slate-800 bg-slate-900/90 text-slate-300 hover:text-white hover:bg-slate-800/90'
          }`}
          title="Configure table column visibility"
        >
          <Columns className="w-3.5 h-3.5 text-sky-400" />
          <span>Columns</span>
          <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
            {visibleCount}/{totalCount}
          </span>
        </button>
      )}

      {/* Dropdown Popover */}
      {isOpen && (
        <div
          id="column-visibility-dropdown-menu"
          className={`absolute right-0 top-full mt-2 w-72 sm:w-80 rounded-xl border p-3.5 shadow-2xl z-50 animate-fadeIn font-mono text-xs ${
            isDark
              ? 'bg-slate-900 border-slate-700 text-slate-200 shadow-black/80'
              : isSteel
                ? 'bg-slate-800 border-slate-600 text-slate-100 shadow-black/60'
                : 'bg-white border-slate-300 text-slate-800 shadow-xl'
          }`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-700/60">
            <div className="flex items-center space-x-2">
              <Columns className="w-4 h-4 text-sky-400" />
              <span className="font-bold text-sm tracking-wide">Column Visibility</span>
            </div>
            <div className="flex items-center space-x-1">
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700 font-semibold">
                {visibleCount} of {totalCount}
              </span>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800"
                title="Close"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Presets Bar */}
          <div className="py-2 border-b border-slate-800/80">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Quick Presets
            </div>
            <div className="grid grid-cols-4 gap-1 text-[10px]">
              <button
                type="button"
                onClick={handleResetDefault}
                className="px-1.5 py-1 rounded border border-slate-700 bg-slate-800/80 hover:bg-slate-700 hover:text-white text-slate-300 text-center transition-all"
                title="Restore standard default columns"
              >
                Default
              </button>
              <button
                type="button"
                onClick={handleShowAll}
                className="px-1.5 py-1 rounded border border-slate-700 bg-slate-800/80 hover:bg-slate-700 hover:text-white text-slate-300 text-center transition-all"
                title="Show all available columns"
              >
                All
              </button>
              <button
                type="button"
                onClick={handlePresetCompact}
                className="px-1.5 py-1 rounded border border-slate-700 bg-slate-800/80 hover:bg-slate-700 hover:text-white text-slate-300 text-center transition-all"
                title="High density compact view"
              >
                Compact
              </button>
              <button
                type="button"
                onClick={handlePresetTrace}
                className="px-1.5 py-1 rounded border border-slate-700 bg-slate-800/80 hover:bg-slate-700 hover:text-white text-slate-300 text-center transition-all"
                title="Optimized for distributed trace analysis"
              >
                Trace
              </button>
            </div>
          </div>

          {/* Column Toggles List */}
          <div className="py-2 max-h-72 overflow-y-auto space-y-1 divide-y divide-slate-800/40">
            {AVAILABLE_COLUMNS.map((col) => {
              const isChecked = !!visibility[col.id];
              const IconComp = COLUMN_ICONS[col.id] || Columns;
              const isOnlyOneLeft = isChecked && visibleCount <= 1;

              return (
                <div
                  key={col.id}
                  onClick={() => !isOnlyOneLeft && handleToggleColumn(col.id)}
                  className={`flex items-center justify-between p-2 rounded-lg cursor-pointer select-none transition-all group ${
                    isChecked
                      ? 'bg-slate-800/50 hover:bg-slate-800'
                      : 'opacity-50 hover:opacity-80 hover:bg-slate-800/30'
                  } ${isOnlyOneLeft ? 'cursor-not-allowed opacity-80' : ''}`}
                >
                  <div className="flex items-center space-x-2.5 min-w-0 pr-2">
                    <div
                      className={`w-4 h-4 rounded border flex items-center justify-center transition-colors shrink-0 ${
                        isChecked
                          ? 'bg-sky-500 border-sky-400 text-white'
                          : 'border-slate-600 bg-slate-800'
                      }`}
                    >
                      {isChecked && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <IconComp className={`w-3.5 h-3.5 shrink-0 ${isChecked ? 'text-sky-400' : 'text-slate-500'}`} />
                    <div className="min-w-0">
                      <div className="font-semibold text-slate-200 text-xs flex items-center space-x-1.5">
                        <span className="truncate">{col.label}</span>
                        {col.headerLabel !== col.label && (
                          <span className="text-[10px] text-slate-500">({col.headerLabel})</span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 truncate max-w-[180px]">
                        {col.description}
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 pl-1 text-slate-500 group-hover:text-slate-300">
                    {isChecked ? (
                      <Eye className="w-3.5 h-3.5 text-sky-400/80" />
                    ) : (
                      <EyeOff className="w-3.5 h-3.5 text-slate-600" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div className="pt-2 border-t border-slate-800 flex items-center justify-between text-[11px] text-slate-400">
            <button
              type="button"
              onClick={handleResetDefault}
              className="flex items-center space-x-1 text-sky-400 hover:text-sky-300 transition-colors"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset Defaults</span>
            </button>
            <span className="text-[10px] text-slate-500">
              Preferences auto-saved
            </span>
          </div>
        </div>
      )}
    </div>
  );
};
