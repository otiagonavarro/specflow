import { useState } from 'react';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Dashboard from './components/Dashboard';
import EpicDetail from './components/EpicDetail';
import ProposalFlow from './components/ProposalFlow';
import { motion, AnimatePresence } from 'motion/react';
import { Plus } from 'lucide-react';

type View = 'dashboard' | 'epic-detail' | 'proposal-flow' | 'issues' | 'inbox' | 'my-issues';

export default function App() {
  const [currentView, setCurrentView] = useState<View>('dashboard');
  const [selectedEpic, setSelectedEpic] = useState<any>(null);

  const handleEpicClick = (epic: any) => {
    setSelectedEpic(epic);
    setCurrentView('epic-detail');
  };

  const handleProposalClick = () => {
    setCurrentView('proposal-flow');
  };

  const renderView = () => {
    switch (currentView) {
      case 'dashboard':
        return <Dashboard onEpicClick={handleEpicClick} />;
      case 'epic-detail':
        return <EpicDetail epic={selectedEpic || {}} onProposalClick={handleProposalClick} />;
      case 'proposal-flow':
        return <ProposalFlow />;
      default:
        return (
          <div className="flex items-center justify-center h-full text-zinc-600 uppercase tracking-[0.3em] font-black text-sm">
            Module under development
          </div>
        );
    }
  };

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar 
        currentView={currentView === 'epic-detail' || currentView === 'proposal-flow' ? 'dashboard' : currentView} 
        onViewChange={(view) => setCurrentView(view as View)} 
      />
      
      <div className="flex-1 flex flex-col min-w-0">
        <TopBar />
        
        <main className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="h-full overflow-y-auto"
            >
              {renderView()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>

      <motion.button 
        whileHover={{ scale: 1.1, rotate: 90 }}
        whileTap={{ scale: 0.9 }}
        className="fixed bottom-8 right-8 w-14 h-14 bg-gradient-to-br from-primary to-primary-container text-on-primary rounded-2xl shadow-2xl shadow-primary/20 flex items-center justify-center z-50"
      >
        <Plus size={28} strokeWidth={3} />
      </motion.button>
    </div>
  );
}
