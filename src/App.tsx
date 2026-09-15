import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ThemeProvider, useAppTheme } from './context/ThemeContext';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { OverviewView } from './components/OverviewView';
import { EventLedgerView } from './components/EventLedgerView';
import { LineageGraphView } from './components/LineageGraphView';
import { PipelineTraceView } from './components/PipelineTraceView';
import { AssessmentsView } from './components/AssessmentsView';
import { SubscribersView } from './components/SubscribersView';
import { SimulatorView } from './components/SimulatorView';
import { ApiExplorerView } from './components/ApiExplorerView';
import { BatchOperationsView } from './components/BatchOperationsView';
import { EventEnvelopeModal } from './components/EventEnvelopeModal';
import { ActiveView, EventEnvelope } from './types';
import { cascadeStore } from './services/cascadeService';

function MainApp() {
  const { themeClasses } = useAppTheme();
  const [activeView, setActiveView] = useState<ActiveView>('overview');
  const [selectedEvent, setSelectedEvent] = useState<EventEnvelope | null>(null);
  const [selectedCorrelationId, setSelectedCorrelationId] = useState<string | undefined>(undefined);
  const [selectedLineageSeedId, setSelectedLineageSeedId] = useState<string | undefined>(undefined);
  const [globalSearch, setGlobalSearch] = useState<string>('');
  
  // Real-time store state sync
  const [totalEvents, setTotalEvents] = useState<number>(() => cascadeStore.getEvents({ limit: 1, offset: 0 }).total);
  const [isStreaming, setIsStreaming] = useState<boolean>(() => cascadeStore.getIsStreaming());

  useEffect(() => {
    const unsubscribe = cascadeStore.subscribe(() => {
      setTotalEvents(cascadeStore.getEvents({ limit: 1, offset: 0 }).total);
      setIsStreaming(cascadeStore.getIsStreaming());
    });
    return unsubscribe;
  }, []);

  const handleSelectEvent = (event: EventEnvelope) => {
    setSelectedEvent(event);
  };

  const handleSelectEventById = (eventId: string) => {
    const evt = cascadeStore.getEventById(eventId);
    if (evt) {
      setSelectedEvent(evt);
    }
  };

  const handleOpenLineage = (eventId: string) => {
    setSelectedLineageSeedId(eventId);
    setActiveView('lineage');
    setSelectedEvent(null);
  };

  const handleOpenPipeline = (correlationId: string) => {
    setSelectedCorrelationId(correlationId);
    setActiveView('pipeline');
    setSelectedEvent(null);
  };

  const handleQuickSimulate = () => {
    cascadeStore.simulateNextRandomEvent();
  };

  const handleToggleStreaming = () => {
    const newState = cascadeStore.toggleLiveStreaming();
    setIsStreaming(newState);
  };

  return (
    <div className="flex h-full w-full min-h-screen overflow-hidden bg-[#0f172a]">
      {/* Left Navigation Sidebar */}
      <Sidebar
        activeView={activeView}
        setActiveView={setActiveView}
        totalEvents={totalEvents}
        isStreaming={isStreaming}
        onToggleStreaming={handleToggleStreaming}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden bg-gradient-to-br from-[#0f172a] to-[#1e293b]">
        <Header
          activeView={activeView}
          setActiveView={setActiveView}
          onOpenSimulator={() => setActiveView('simulator')}
          onQuickSimulate={handleQuickSimulate}
          globalSearch={globalSearch}
          setGlobalSearch={setGlobalSearch}
        />

        <main className="flex-1 overflow-y-auto custom-scrollbar relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeView}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{
                duration: 0.22,
                ease: [0.16, 1, 0.3, 1]
              }}
              className="min-h-full flex flex-col"
            >
              {activeView === 'overview' && (
                <OverviewView
                  onSelectEvent={handleSelectEvent}
                  setActiveView={setActiveView}
                  onOpenSimulator={() => setActiveView('simulator')}
                  onSelectWorkflow={handleOpenPipeline}
                />
              )}

              {activeView === 'ledger' && (
                <EventLedgerView
                  onSelectEvent={handleSelectEvent}
                  onOpenLineage={handleOpenLineage}
                  onOpenPipeline={handleOpenPipeline}
                  onOpenBatch={() => setActiveView('batch')}
                  initialSearch={globalSearch}
                />
              )}

              {activeView === 'batch' && (
                <BatchOperationsView
                  onSelectEvent={handleSelectEvent}
                  setActiveView={setActiveView}
                />
              )}

              {activeView === 'lineage' && (
                <LineageGraphView
                  initialEventId={selectedLineageSeedId}
                  onSelectEvent={handleSelectEvent}
                />
              )}

              {activeView === 'pipeline' && (
                <PipelineTraceView
                  initialCorrelationId={selectedCorrelationId}
                  onSelectEvent={handleSelectEvent}
                  onOpenSimulator={() => setActiveView('simulator')}
                />
              )}

              {activeView === 'assessments' && (
                <AssessmentsView
                  onSelectEventById={handleSelectEventById}
                />
              )}

              {activeView === 'subscribers' && (
                <SubscribersView
                  onSelectEventById={handleSelectEventById}
                />
              )}

              {activeView === 'simulator' && (
                <SimulatorView
                  onSelectEvent={handleSelectEvent}
                  onOpenLineage={handleOpenLineage}
                  onOpenPipeline={handleOpenPipeline}
                />
              )}

              {activeView === 'api_explorer' && (
                <ApiExplorerView />
              )}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      {/* Event Envelope Detailed Modal Drawer */}
      {selectedEvent && (
        <EventEnvelopeModal
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
          onSelectEvent={handleSelectEventById}
          onOpenLineage={handleOpenLineage}
          onOpenPipeline={handleOpenPipeline}
        />
      )}
    </div>
  );
}

export default function App() {
  return (
    <ThemeProvider>
      <MainApp />
    </ThemeProvider>
  );
}
