import React, { useState } from 'react';
import { 
  Terminal, 
  Play, 
  Copy, 
  Check, 
  Clock, 
  Database, 
  Send,
  Layers,
  Code2
} from 'lucide-react';
import { useAppTheme } from '../context/ThemeContext';
import { cascadeStore } from '../services/cascadeService';

export const ApiExplorerView: React.FC = () => {
  const { themeClasses, isSteel, isDark } = useAppTheme();

  const endpoints = [
    { method: 'GET', path: '/cascade/events', desc: 'List events with filtering, pagination, and time range' },
    { method: 'GET', path: '/cascade/events/:id', desc: 'Single event envelope detail' },
    { method: 'GET', path: '/cascade/events/:id/children', desc: 'Events caused by :id (causation_id pointing back)' },
    { method: 'GET', path: '/cascade/events/:id/lineage', desc: 'Walk causation chain backward toward root' },
    { method: 'GET', path: '/cascade/lineage', desc: 'Graph-style lineage query: nodes + edges' },
    { method: 'GET', path: '/cascade/analytics', desc: 'Aggregated metrics, throughput, timeline, and funnel' },
    { method: 'GET', path: '/cascade/assessments', desc: 'Assessment resolutions & evaluation rationales' },
    { method: 'GET', path: '/cascade/subscribers', desc: 'List registered subscribers with lag offsets' },
    { method: 'GET', path: '/cascade/subscribers/:pattern', desc: 'Get single subscriber by subject_pattern' },
    { method: 'PATCH', path: '/cascade/subscribers/:pattern', desc: 'Update subscriber config (enable/disable)' },
    { method: 'GET', path: '/cascade/health', desc: 'Health status and total events count' },
    { method: 'GET', path: '/', desc: 'Root service version and port info' }
  ];

  const [selectedEndpointIdx, setSelectedEndpointIdx] = useState<number>(0);
  const [paramId, setParamId] = useState<string>('');
  const [paramPattern, setParamPattern] = useState<string>('nexus.cascade.v1.*');
  const [queryType, setQueryType] = useState<string>('');
  const [queryLimit, setQueryLimit] = useState<number>(10);
  const [queryRange, setQueryRange] = useState<string>('24h');
  const [patchEnabled, setPatchEnabled] = useState<boolean>(true);

  const [responseStatus, setResponseStatus] = useState<number | null>(200);
  const [responseBody, setResponseBody] = useState<any>(() => cascadeStore.getEvents({ limit: 10, offset: 0 }));
  const [executionTimeMs, setExecutionTimeMs] = useState<number>(12);
  const [copied, setCopied] = useState<boolean>(false);

  // Set default sample ID on mount
  const sampleEvent = cascadeStore.getEvents({ limit: 1, offset: 0 }).events[0];
  const sampleId = paramId || sampleEvent?.event_id || '';

  const handleExecuteRequest = () => {
    const start = performance.now();
    const ep = endpoints[selectedEndpointIdx];

    let result: any = null;
    let status = 200;

    switch (ep.path) {
      case '/':
        result = cascadeStore.getRootInfo();
        break;
      case '/cascade/health':
        result = cascadeStore.getHealth();
        break;
      case '/cascade/events':
        result = cascadeStore.getEvents({
          type: queryType || undefined,
          limit: queryLimit,
          offset: 0
        });
        break;
      case '/cascade/events/:id':
        result = cascadeStore.getEventById(sampleId);
        if (!result) {
          status = 404;
          result = { error: 'Event not found' };
        }
        break;
      case '/cascade/events/:id/children':
        result = cascadeStore.getEventChildren(sampleId);
        break;
      case '/cascade/events/:id/lineage':
        result = cascadeStore.getEventLineage(sampleId, 10);
        break;
      case '/cascade/lineage':
        result = cascadeStore.getLineageGraph({ root: sampleId, maxDepth: 5 });
        break;
      case '/cascade/analytics':
        result = cascadeStore.getAnalytics(queryRange, 'hour');
        break;
      case '/cascade/assessments':
        result = cascadeStore.getAssessments({ limit: queryLimit });
        break;
      case '/cascade/subscribers':
        result = cascadeStore.getSubscribers();
        break;
      case '/cascade/subscribers/:pattern':
        if (ep.method === 'PATCH') {
          result = cascadeStore.updateSubscriber(paramPattern, patchEnabled);
        } else {
          result = cascadeStore.getSubscriberByPattern(paramPattern);
        }
        if (!result) {
          status = 404;
          result = { error: 'Subscriber not found' };
        }
        break;
      default:
        result = { error: 'Unknown endpoint' };
        status = 400;
    }

    const elapsed = Math.round(performance.now() - start);
    setExecutionTimeMs(Math.max(1, elapsed));
    setResponseStatus(status);
    setResponseBody(result);
  };

  const handleCopyJSON = () => {
    navigator.clipboard.writeText(JSON.stringify(responseBody, null, 2));
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const currentEndpoint = endpoints[selectedEndpointIdx];

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto custom-scrollbar">
      {/* Header */}
      <div className={`p-4 rounded-xl border ${themeClasses.border} ${themeClasses.bgCard} shadow-sm space-y-1`}>
        <h2 className="text-sm font-bold text-slate-100 flex items-center space-x-2">
          <Terminal className="w-4 h-4 text-sky-400" />
          <span>Cascade REST API & Envelope Specification Sandbox</span>
        </h2>
        <p className={`text-xs ${themeClasses.textMuted}`}>
          Base URL: <code className="text-sky-400 font-mono">http://localhost:3106</code> · CORS enabled · JSON in/out · 12 endpoints from FastAPI / nexus route inventory.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Endpoint Selector List */}
        <div className={`lg:col-span-4 p-4 rounded-xl border ${themeClasses.border} ${themeClasses.bgCard} shadow-md space-y-2 max-h-[600px] overflow-y-auto custom-scrollbar`}>
          <span className={`text-[10px] font-mono font-bold uppercase tracking-wider ${themeClasses.textMuted} block mb-2`}>
            12 Registered Endpoints
          </span>
          {endpoints.map((ep, idx) => (
            <button
              key={idx}
              onClick={() => {
                setSelectedEndpointIdx(idx);
              }}
              className={`w-full text-left p-2.5 rounded-lg border text-xs font-mono transition-all ${
                selectedEndpointIdx === idx
                  ? 'bg-sky-500/15 border-sky-500/40 text-sky-300 font-semibold'
                  : `${themeClasses.borderSubtle} ${themeClasses.bgMuted} ${themeClasses.textSecondary} hover:text-slate-200`
              }`}
            >
              <div className="flex items-center space-x-2">
                <span className={`text-[10px] px-1.5 py-0.2 rounded font-bold ${
                  ep.method === 'GET' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {ep.method}
                </span>
                <span className="font-bold truncate text-slate-200">{ep.path}</span>
              </div>
              <p className="text-[10px] text-slate-500 truncate mt-1">{ep.desc}</p>
            </button>
          ))}
        </div>

        {/* Request & Response Panel */}
        <div className={`lg:col-span-8 space-y-4`}>
          {/* Request Header Bar */}
          <div className={`p-4 rounded-xl border ${themeClasses.border} ${themeClasses.bgCard} shadow-sm space-y-3`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 font-mono text-xs">
                <span className={`px-2 py-0.5 rounded font-bold ${
                  currentEndpoint.method === 'GET' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-amber-500/20 text-amber-300'
                }`}>
                  {currentEndpoint.method}
                </span>
                <span className="text-slate-100 font-bold">{currentEndpoint.path}</span>
              </div>

              <button
                onClick={handleExecuteRequest}
                className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-white font-semibold text-xs font-mono shadow-sm transition-all flex items-center space-x-1.5"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Send Request</span>
              </button>
            </div>

            {/* Dynamic Parameters Inputs */}
            {currentEndpoint.path.includes(':id') && (
              <div className="space-y-1 pt-2 border-t border-slate-800">
                <label className="text-[10px] font-mono text-slate-400">Path Parameter (:id)</label>
                <input
                  type="text"
                  placeholder="UUID event_id"
                  value={sampleId}
                  onChange={(e) => setParamId(e.target.value)}
                  className={`w-full px-3 py-1.5 rounded-md text-xs font-mono border ${themeClasses.border} ${themeClasses.inputBg} ${themeClasses.textPrimary}`}
                />
              </div>
            )}

            {currentEndpoint.path.includes(':pattern') && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                <div>
                  <label className="text-[10px] font-mono text-slate-400">Path Parameter (:pattern)</label>
                  <input
                    type="text"
                    value={paramPattern}
                    onChange={(e) => setParamPattern(e.target.value)}
                    className={`w-full px-3 py-1.5 rounded-md text-xs font-mono border ${themeClasses.border} ${themeClasses.inputBg} ${themeClasses.textPrimary}`}
                  />
                </div>
                {currentEndpoint.method === 'PATCH' && (
                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="patchEnabled"
                      checked={patchEnabled}
                      onChange={(e) => setPatchEnabled(e.target.checked)}
                      className="rounded"
                    />
                    <label htmlFor="patchEnabled" className="text-xs font-mono text-slate-300">
                      Enabled: {patchEnabled ? 'true' : 'false'}
                    </label>
                  </div>
                )}
              </div>
            )}

            {currentEndpoint.path === '/cascade/events' && (
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800">
                <div>
                  <label className="text-[10px] font-mono text-slate-400">?type=</label>
                  <input
                    type="text"
                    placeholder="e.g. harvest.captured"
                    value={queryType}
                    onChange={(e) => setQueryType(e.target.value)}
                    className={`w-full px-2.5 py-1.5 rounded-md text-xs font-mono border ${themeClasses.border} ${themeClasses.inputBg} ${themeClasses.textPrimary}`}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-mono text-slate-400">?limit=</label>
                  <input
                    type="number"
                    value={queryLimit}
                    onChange={(e) => setQueryLimit(Number(e.target.value))}
                    className={`w-full px-2.5 py-1.5 rounded-md text-xs font-mono border ${themeClasses.border} ${themeClasses.inputBg} ${themeClasses.textPrimary}`}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Response Payload Viewer */}
          <div className={`p-4 rounded-xl border ${themeClasses.border} ${themeClasses.bgCard} shadow-md space-y-3`}>
            <div className="flex items-center justify-between border-b pb-2 border-slate-800">
              <div className="flex items-center space-x-3 text-xs font-mono">
                <span className="text-slate-400">Response:</span>
                <span className={`px-2 py-0.5 rounded font-bold ${
                  responseStatus === 200 ? 'bg-emerald-500/20 text-emerald-300' : 'bg-rose-500/20 text-rose-300'
                }`}>
                  {responseStatus} OK
                </span>
                <span className="text-slate-500">Latency: {executionTimeMs}ms</span>
              </div>

              <button
                onClick={handleCopyJSON}
                className={`flex items-center space-x-1 px-2.5 py-1 rounded text-xs font-mono border ${themeClasses.border} ${themeClasses.bgMuted} ${themeClasses.textSecondary} hover:text-white`}
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy'}</span>
              </button>
            </div>

            {/* Formatted JSON */}
            <div className={`p-4 rounded-xl border ${themeClasses.borderSubtle} ${themeClasses.codeBg} font-mono text-xs overflow-x-auto max-h-[420px] custom-scrollbar`}>
              <pre className="text-emerald-300/90 leading-relaxed">
                {JSON.stringify(responseBody, null, 2)}
              </pre>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
