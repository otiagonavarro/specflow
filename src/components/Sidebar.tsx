import { 
  LayoutGrid, 
  Target, 
  Inbox, 
  User, 
  Settings, 
  HelpCircle, 
  Plus,
  Zap
} from 'lucide-react';
import { motion } from 'motion/react';

interface SidebarProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export default function Sidebar({ currentView, onViewChange }: SidebarProps) {
  const navItems = [
    { id: 'dashboard', label: 'Projects', icon: LayoutGrid },
    { id: 'issues', label: 'Issues', icon: Target },
    { id: 'inbox', label: 'Inbox', icon: Inbox },
    { id: 'my-issues', label: 'My Issues', icon: User },
  ];

  return (
    <aside className="h-screen w-64 flex flex-col py-6 px-4 gap-y-2 bg-zinc-950 border-r border-outline-variant/10">
      <div className="flex items-center gap-3 px-2 mb-8">
        <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center text-on-primary shadow-lg shadow-primary/20">
          <Zap size={20} fill="currentColor" />
        </div>
        <div>
          <h1 className="text-lg font-bold tracking-tighter text-white">Monolith</h1>
          <p className="text-[10px] text-zinc-500 uppercase tracking-widest font-bold">Precision Velocity</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => onViewChange(item.id)}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
              currentView === item.id 
                ? 'bg-surface-highest text-white shadow-sm' 
                : 'text-zinc-500 hover:text-zinc-200 hover:bg-surface-low'
            }`}
          >
            <item.icon size={18} />
            {item.label}
          </button>
        ))}
      </nav>

      <div className="mt-auto space-y-4">
        <motion.button 
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="w-full bg-primary text-on-primary py-2.5 px-4 rounded-xl font-bold text-xs flex items-center justify-center gap-2 shadow-lg shadow-primary/10"
        >
          <Plus size={16} strokeWidth={3} />
          New Issue
        </motion.button>

        <div className="space-y-1 pt-4 border-t border-outline-variant/10">
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-zinc-500 hover:text-zinc-200 transition-colors">
            <Settings size={16} />
            Settings
          </button>
          <button className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium text-zinc-500 hover:text-zinc-200 transition-colors">
            <HelpCircle size={16} />
            Support
          </button>
        </div>
      </div>
    </aside>
  );
}
