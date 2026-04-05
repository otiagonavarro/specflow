import { Search, Bell, Command } from 'lucide-react';

export default function TopBar() {
  return (
    <header className="h-14 flex items-center justify-between px-8 glass border-b border-outline-variant/5 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <nav className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold">
          <span>Workspace</span>
          <span className="text-zinc-700">/</span>
          <span className="text-primary">Issues</span>
        </nav>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
          <input 
            type="text" 
            placeholder="Search system epics..." 
            className="bg-surface-highest/50 border-none rounded-lg pl-9 pr-4 py-1.5 w-64 text-xs focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-zinc-600"
          />
        </div>

        <div className="flex items-center gap-2">
          <button className="p-2 text-zinc-400 hover:text-white hover:bg-surface-highest rounded-lg transition-all">
            <Bell size={18} />
          </button>
          <button className="p-2 text-zinc-400 hover:text-white hover:bg-surface-highest rounded-lg transition-all flex items-center gap-1">
            <Command size={18} />
          </button>
        </div>

        <div className="h-6 w-px bg-outline-variant/20" />

        <div className="flex items-center gap-3">
          <button className="bg-primary-container text-white text-[10px] font-bold px-4 py-1.5 rounded-lg tracking-wider uppercase hover:bg-primary-container/80 transition-colors">
            Request Proposal
          </button>
          <img 
            src="https://picsum.photos/seed/monolith-user/100/100" 
            alt="User" 
            className="w-8 h-8 rounded-full border border-outline-variant/20 grayscale hover:grayscale-0 transition-all cursor-pointer"
            referrerPolicy="no-referrer"
          />
        </div>
      </div>
    </header>
  );
}
