import { useState, useEffect, useMemo, useCallback } from 'react';
import { loadConfigFromServer, getConfig } from './api/config';
import Sidebar from './components/Sidebar';
import TopBar from './components/TopBar';
import Dashboard from './components/Dashboard';
import Projects from './components/Projects';
import BoardDashboard from './components/BoardDashboard';
import type { JiraBoardSummary } from './api/jira';
import EpicDetail from './components/EpicDetail';
import ProposalFlow from './components/ProposalFlow';
import Issues from './components/Issues';
import Inbox from './components/Inbox';
import MyIssues from './components/MyIssues';
import Settings from './components/Settings';
import NewIssueModal from './components/NewIssueModal';
import { motion, AnimatePresence } from 'motion/react';
import { Plus } from 'lucide-react';
import { useLocale } from './locales';

export type AppView =
  | 'projects'
  | 'board-dashboard'
  | 'epics'
  | 'epic-detail'
  | 'proposal-flow'
  | 'issues'
  | 'inbox'
  | 'my-issues'
  | 'settings';

export default function App() {
  const { t } = useLocale();
  const [currentView, setCurrentView] = useState<AppView>('projects');
  const [selectedEpic, setSelectedEpic] = useState<any>(null);
  const [boardForDashboard, setBoardForDashboard] = useState<JiraBoardSummary | null>(null);
  const [newIssueOpen, setNewIssueOpen] = useState(false);
  const [integrationReady, setIntegrationReady] = useState(false);

  useEffect(() => {
    void loadConfigFromServer().finally(() => setIntegrationReady(true));
  }, []);

  const handleEpicClick = (epic: any) => {
    setSelectedEpic(epic);
    setCurrentView('epic-detail');
  };

  const handleProposalClick = () => {
    setCurrentView('proposal-flow');
  };

  const handleOpenBoardDashboard = useCallback((board: JiraBoardSummary, _projectKey: string) => {
    setBoardForDashboard(board);
    setCurrentView('board-dashboard');
  }, []);

  const topBarMeta = useMemo(() => {
    switch (currentView) {
      case 'projects':
        return { current: t('top.projects'), search: t('search.boards') };
      case 'board-dashboard':
        return {
          current: boardForDashboard
            ? `${boardForDashboard.name} · ${t('top.boardInsights')}`
            : t('top.projects'),
          search: t('search.boards'),
        };
      case 'epics':
      case 'epic-detail':
        return { current: t('top.epics'), search: t('search.epics') };
      case 'issues':
        return { current: t('top.issues'), search: t('search.issues') };
      case 'my-issues':
        return { current: t('top.myIssues'), search: t('search.myIssues') };
      case 'inbox':
        return { current: t('top.inbox'), search: t('search.issues') };
      case 'settings':
        return { current: t('top.settings'), search: t('search.issues') };
      case 'proposal-flow':
        return { current: t('top.epics'), search: t('search.epics') };
      default:
        return { current: t('top.issues'), search: t('search.issues') };
    }
  }, [currentView, t, boardForDashboard]);

  const renderView = () => {
    switch (currentView) {
      case 'projects':
        return <Projects onOpenBoard={handleOpenBoardDashboard} />;
      case 'board-dashboard':
        if (!boardForDashboard) {
          return <Projects onOpenBoard={handleOpenBoardDashboard} />;
        }
        return (
          <BoardDashboard
            board={boardForDashboard}
            projectKey={
              boardForDashboard.projectKey?.trim() ||
              getConfig().jira?.projectKey?.trim() ||
              ''
            }
            onBack={() => {
              setBoardForDashboard(null);
              setCurrentView('projects');
            }}
          />
        );
      case 'epics':
        return <Dashboard onEpicClick={handleEpicClick} />;
      case 'epic-detail':
        return <EpicDetail epic={selectedEpic || {}} onProposalClick={handleProposalClick} />;
      case 'proposal-flow':
        return <ProposalFlow />;
      case 'issues':
        return <Issues onNavigateSettings={() => setCurrentView('settings')} />;
      case 'my-issues':
        return <MyIssues onNavigateSettings={() => setCurrentView('settings')} />;
      case 'inbox':
        return <Inbox />;
      case 'settings':
        return <Settings />;
      default:
        return (
          <div className="flex items-center justify-center h-full text-zinc-600 uppercase tracking-[0.3em] font-black text-sm">
            Module under development
          </div>
        );
    }
  };

  const sidebarActiveView: AppView | 'settings' =
    currentView === 'epic-detail' || currentView === 'proposal-flow'
      ? 'epics'
      : currentView === 'board-dashboard'
        ? 'projects'
        : currentView;

  if (!integrationReady) {
    return (
      <div className="flex h-screen bg-background items-center justify-center text-zinc-500 text-sm font-medium">
        {t('app.loading')}
      </div>
    );
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      <Sidebar
        currentView={sidebarActiveView}
        onViewChange={(view) => setCurrentView(view as AppView)}
        onNewIssue={() => setNewIssueOpen(true)}
      />

      <div className="flex-1 flex flex-col min-w-0">
        <TopBar
          onRequestProposal={() => setCurrentView('proposal-flow')}
          breadcrumbCurrent={topBarMeta.current}
          searchPlaceholder={topBarMeta.search}
        />

        <main className="flex-1 overflow-hidden relative">
          <AnimatePresence mode="wait">
            <motion.div
              key={currentView}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
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
        onClick={() => setNewIssueOpen(true)}
        className="fixed bottom-8 right-8 w-14 h-14 bg-gradient-to-br from-primary to-primary-container text-on-primary rounded-2xl shadow-2xl shadow-primary/20 flex items-center justify-center z-50"
        aria-label={t('nav.newIssue')}
      >
        <Plus size={28} strokeWidth={3} />
      </motion.button>

      <NewIssueModal open={newIssueOpen} onClose={() => setNewIssueOpen(false)} />
    </div>
  );
}
