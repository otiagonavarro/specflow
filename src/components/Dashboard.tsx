import { Filter, MoreHorizontal, History, CheckCircle2 } from 'lucide-react';
import { motion } from 'motion/react';

interface Epic {
  id: string;
  name: string;
  code: string;
  category: string;
  status: 'Active' | 'In Review' | 'Blocked' | 'Planning';
  progress: number;
  assignees: string[];
  color: string;
}

const EPICS: Epic[] = [
  {
    id: '1',
    name: 'Auth Zero Integration',
    code: 'SYS-442',
    category: 'Core Infrastructure',
    status: 'Active',
    progress: 74,
    assignees: ['https://picsum.photos/seed/u1/40/40', 'https://picsum.photos/seed/u2/40/40'],
    color: '#bdc2ff'
  },
  {
    id: '2',
    name: 'Data Migration: v2 Architecture',
    code: 'SYS-501',
    category: 'Database Services',
    status: 'In Review',
    progress: 98,
    assignees: ['https://picsum.photos/seed/u3/40/40'],
    color: '#bec4ed'
  },
  {
    id: '3',
    name: 'Telemetry Dashboard Overhaul',
    code: 'SYS-112',
    category: 'Monitoring',
    status: 'Blocked',
    progress: 12,
    assignees: ['https://picsum.photos/seed/u4/40/40', 'https://picsum.photos/seed/u5/40/40'],
    color: '#ffb4ab'
  },
  {
    id: '4',
    name: 'Global Edge Delivery',
    code: 'SYS-993',
    category: 'Network',
    status: 'Planning',
    progress: 0,
    assignees: [],
    color: '#5e6ad2'
  }
];

interface DashboardProps {
  onEpicClick: (epic: Epic) => void;
}

export default function Dashboard({ onEpicClick }: DashboardProps) {
  return (
    <div className="p-8 max-w-7xl mx-auto w-full space-y-10">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <h2 className="text-4xl font-extrabold tracking-tighter text-white">System Epics</h2>
          <p className="text-zinc-500 text-sm max-w-md">Orchestrate high-level initiatives across the monolith architecture.</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-surface-low p-1 rounded-xl border border-outline-variant/5">
            <button className="px-4 py-1.5 text-xs font-bold bg-surface-highest text-white rounded-lg shadow-sm">List View</button>
            <button className="px-4 py-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-300">Board</button>
          </div>
          <button className="bg-surface-highest hover:bg-surface-high text-white text-xs font-bold px-4 py-2 rounded-xl transition-all flex items-center gap-2 border border-outline-variant/10">
            <Filter size={14} />
            Filters
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Epics', value: '24', sub: '+2 this month', color: 'text-primary' },
          { label: 'Execution Velocity', value: '82%', progress: 82, color: 'text-white' },
          { label: 'Active Blocks', value: '3', sub: 'Requires Review', color: 'text-error' },
          { label: 'Upcoming Deadlines', value: '08', sub: 'Due in 7d', color: 'text-white' },
        ].map((stat, i) => (
          <div key={i} className="bg-surface-low p-5 rounded-2xl border border-outline-variant/5 space-y-2">
            <p className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold">{stat.label}</p>
            <div className="flex items-baseline gap-3">
              <span className={`text-3xl font-black tracking-tighter ${stat.color}`}>{stat.value}</span>
              {stat.sub && <span className="text-[10px] text-zinc-500 font-medium">{stat.sub}</span>}
              {stat.progress !== undefined && (
                <div className="flex-1 h-1 bg-surface-highest rounded-full overflow-hidden self-center">
                  <div className="h-full bg-primary" style={{ width: `${stat.progress}%` }} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="bg-surface-low rounded-2xl border border-outline-variant/5 overflow-hidden">
        <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-outline-variant/10 text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-black">
          <div className="col-span-5">Epic Name</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Progress</div>
          <div className="col-span-2">Assignees</div>
          <div className="col-span-1"></div>
        </div>

        <div className="divide-y divide-outline-variant/5">
          {EPICS.map((epic) => (
            <motion.div 
              key={epic.id}
              whileHover={{ backgroundColor: 'rgba(52, 53, 54, 0.3)' }}
              onClick={() => onEpicClick(epic)}
              className="grid grid-cols-12 gap-4 px-6 py-5 items-center cursor-pointer group"
            >
              <div className="col-span-5 flex items-center gap-4">
                <div 
                  className="w-2.5 h-2.5 rounded-full shadow-lg" 
                  style={{ backgroundColor: epic.color, boxShadow: `0 0 12px ${epic.color}40` }} 
                />
                <div>
                  <p className="text-sm font-bold text-white group-hover:text-primary transition-colors">{epic.name}</p>
                  <p className="text-[10px] text-zinc-500 font-mono mt-0.5">{epic.code} • {epic.category}</p>
                </div>
              </div>
              <div className="col-span-2">
                <span className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase tracking-wider ${
                  epic.status === 'Active' ? 'bg-primary/10 text-primary' :
                  epic.status === 'Blocked' ? 'bg-error/10 text-error' :
                  'bg-surface-highest text-zinc-400'
                }`}>
                  {epic.status}
                </span>
              </div>
              <div className="col-span-2 flex items-center gap-3">
                <div className="flex-1 h-1 bg-surface-highest rounded-full overflow-hidden">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${epic.progress}%` }}
                    className="h-full"
                    style={{ backgroundColor: epic.color }}
                  />
                </div>
                <span className="text-[11px] font-mono text-zinc-500">{epic.progress}%</span>
              </div>
              <div className="col-span-2 flex -space-x-2">
                {epic.assignees.length > 0 ? (
                  epic.assignees.map((src, i) => (
                    <img 
                      key={i} 
                      src={src} 
                      className="w-7 h-7 rounded-full border-2 border-surface-low grayscale hover:grayscale-0 transition-all" 
                      referrerPolicy="no-referrer"
                    />
                  ))
                ) : (
                  <div className="w-7 h-7 rounded-full border-2 border-surface-low bg-surface-highest flex items-center justify-center text-[10px] text-zinc-500 font-bold">UN</div>
                )}
                {epic.assignees.length > 2 && (
                  <div className="w-7 h-7 rounded-full border-2 border-surface-low bg-surface-highest flex items-center justify-center text-[10px] text-zinc-300 font-bold">+2</div>
                )}
              </div>
              <div className="col-span-1 text-right">
                <button className="p-1.5 text-zinc-600 hover:text-white transition-colors">
                  <MoreHorizontal size={18} />
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>

      <div className="space-y-6">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Recent Orchestrations</h3>
        <div className="space-y-4">
          {[
            { user: 'Sarah Connor', action: 'moved', target: 'SYS-442', to: 'Active', time: '2m ago', icon: History, iconColor: 'text-primary' },
            { user: 'System Bot', action: 'completed automated test suite for', target: 'SYS-501', time: '1h ago', icon: CheckCircle2, iconColor: 'text-tertiary' },
          ].map((item, i) => (
            <div key={i} className="flex items-center gap-4 text-xs">
              <item.icon size={16} className={item.iconColor} />
              <p className="text-zinc-400">
                <span className="text-white font-bold">{item.user}</span> {item.action} <span className="text-primary font-mono">{item.target}</span>
                {item.to && <span className="ml-2 bg-primary/10 text-primary px-1.5 py-0.5 rounded text-[10px] font-bold uppercase">{item.to}</span>}
              </p>
              <span className="text-[10px] text-zinc-600 ml-auto font-medium">{item.time}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
