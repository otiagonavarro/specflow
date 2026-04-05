import { 
  Zap, 
  ShieldAlert, 
  Clock, 
  MoreHorizontal, 
  CheckCircle2, 
  Settings2,
  Activity
} from 'lucide-react';
import { motion } from 'motion/react';

interface Epic {
  id: string;
  name: string;
  code: string;
  category: string;
  status: string;
  progress: number;
  color: string;
}

interface EpicDetailProps {
  epic: Epic;
  onProposalClick: () => void;
}

export default function EpicDetail({ epic, onProposalClick }: EpicDetailProps) {
  const tasks = [
    { id: 'TK-1024', name: 'Neural Lattice Stabilization', priority: 'Ultra-High', eta: '2h 15m', status: 'Executing', agent: 'Agent Zero' },
    { id: 'TK-1025', name: 'Sub-Zero Thermal Calibration', priority: 'High', eta: '14h', status: 'Pending', agent: 'S. Varma' },
    { id: 'TK-1021', name: 'Legacy Node Decommissioning', priority: 'Medium', eta: 'Completed 2h ago', status: 'Verified', agent: 'M. Ross' },
  ];

  return (
    <div className="flex h-full overflow-hidden">
      <div className="flex-1 overflow-y-auto p-10 min-w-0">
        <div className="max-w-5xl mx-auto space-y-12">
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <span className="bg-surface-highest text-zinc-400 text-[10px] font-black px-2.5 py-1 rounded tracking-widest uppercase">EPIC-01</span>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_10px_#bdc2ff]" />
                <span className="text-xs text-primary font-bold tracking-tight">Active Operation</span>
              </div>
            </div>
            
            <h2 className="text-5xl font-black text-white tracking-tighter leading-none">
              Quantum Infrastructure Overhaul
            </h2>
            
            <p className="text-zinc-500 max-w-2xl text-base leading-relaxed">
              System-wide modernization of the core compute fabric. Deploying decentralized nodes to handle neural-mesh throughput and stabilizing the tertiary lattice for sub-millisecond latency requirements.
            </p>
          </div>

          <div className="grid grid-cols-4 gap-4">
            {[
              { label: 'Completion', value: '64%', progress: 64 },
              { label: 'Compute Load', value: '1.2 PHz', sub: 'Peak', subColor: 'text-error' },
              { label: 'Nodes Active', value: '1,024', sub: '/ 1,200 Target' },
              { label: 'Risk Vector', value: 'Nominal', sub: 'Level 2 Clear' },
            ].map((stat, i) => (
              <div key={i} className="bg-surface-low p-6 rounded-2xl border border-outline-variant/5">
                <span className="block text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-bold mb-2">{stat.label}</span>
                <span className="text-3xl font-black text-white tracking-tighter">{stat.value}</span>
                {stat.progress !== undefined ? (
                  <div className="w-full bg-surface-highest h-1.5 rounded-full mt-4 overflow-hidden">
                    <div className="bg-primary h-full" style={{ width: `${stat.progress}%` }} />
                  </div>
                ) : (
                  <p className={`text-[10px] font-bold mt-2 ${stat.subColor || 'text-zinc-500'}`}>{stat.sub}</p>
                )}
              </div>
            ))}
          </div>

          <section className="space-y-6">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-xs font-black uppercase tracking-[0.3em] text-zinc-500">Task Registry</h3>
              <div className="flex items-center gap-2 text-zinc-600 hover:text-zinc-400 cursor-pointer transition-colors">
                <span className="text-[10px] font-bold uppercase">Filter: All Tasks</span>
                <Settings2 size={14} />
              </div>
            </div>

            <div className="space-y-2">
              {tasks.map((task) => (
                <motion.div 
                  key={task.id}
                  whileHover={{ x: 4, backgroundColor: 'rgba(52, 53, 54, 0.3)' }}
                  className="flex items-center bg-surface-low p-4 rounded-xl border border-outline-variant/5 group"
                >
                  <div className="w-24">
                    <span className="text-[10px] font-mono text-zinc-600 font-bold">#{task.id}</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-bold text-white">{task.name}</h4>
                    <div className="flex items-center gap-4 mt-1.5">
                      <span className="text-[10px] text-zinc-500 font-bold flex items-center gap-1.5">
                        <ShieldAlert size={12} className={task.priority === 'Ultra-High' ? 'text-error' : 'text-zinc-500'} />
                        Priority: {task.priority}
                      </span>
                      <span className="text-[10px] text-zinc-500 font-bold flex items-center gap-1.5">
                        <Clock size={12} />
                        ETA: {task.eta}
                      </span>
                    </div>
                  </div>
                  <div className="w-36 flex items-center gap-2.5">
                    <div className={`w-2 h-2 rounded-full ${
                      task.status === 'Executing' ? 'bg-primary shadow-[0_0_8px_#bdc2ff]' :
                      task.status === 'Verified' ? 'bg-emerald-500' : 'bg-zinc-700'
                    }`} />
                    <span className={`text-[10px] font-black uppercase tracking-wider ${
                      task.status === 'Executing' ? 'text-white' :
                      task.status === 'Verified' ? 'text-emerald-500' : 'text-zinc-600'
                    }`}>{task.status}</span>
                  </div>
                  <div className="w-48 flex items-center gap-3">
                    <img 
                      src={`https://picsum.photos/seed/${task.agent}/40/40`} 
                      className="w-7 h-7 rounded-full border border-outline-variant/20 grayscale" 
                      referrerPolicy="no-referrer"
                    />
                    <span className="text-[11px] text-zinc-400 font-bold">{task.agent}</span>
                  </div>
                  <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 text-zinc-600 hover:text-white">
                    <MoreHorizontal size={18} />
                  </button>
                </motion.div>
              ))}
            </div>
          </section>
        </div>
      </div>

      <aside className="w-80 bg-zinc-950 border-l border-outline-variant/10 flex flex-col p-8 gap-10 overflow-y-auto">
        <div className="space-y-6">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">System Metadata</h3>
          <div className="space-y-5">
            <div className="space-y-1.5">
              <span className="text-[11px] text-zinc-500 font-bold">Lead Architect</span>
              <div className="flex items-center gap-2.5">
                <div className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_8px_#bdc2ff]" />
                <span className="text-sm font-bold text-white">Director Elias Thorne</span>
              </div>
            </div>
            <div className="space-y-1.5">
              <span className="text-[11px] text-zinc-500 font-bold">Resource Allocation</span>
              <span className="text-sm font-bold text-white block">Tier-1 Computational</span>
            </div>
            <div className="space-y-2">
              <span className="text-[11px] text-zinc-500 font-bold">Security Protocol</span>
              <div className="flex items-center gap-2 bg-surface-highest px-3 py-2 rounded-lg self-start border border-primary/20">
                <Zap size={12} className="text-primary" fill="currentColor" />
                <span className="text-[10px] font-mono text-primary font-bold uppercase tracking-wider">AES-4096-QUANTUM</span>
              </div>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">Live Protocols</h3>
          <div className="space-y-2.5">
            {[
              { label: 'Auto-Scaling', active: true },
              { label: 'Redundancy Mesh', active: false },
            ].map((p, i) => (
              <div key={i} className="p-4 rounded-xl bg-surface-low border border-outline-variant/5 flex items-center justify-between">
                <span className="text-xs font-bold text-zinc-400">{p.label}</span>
                <div className={`w-9 h-5 rounded-full relative transition-colors ${p.active ? 'bg-primary/20' : 'bg-zinc-800'}`}>
                  <motion.div 
                    animate={{ x: p.active ? 18 : 2 }}
                    className={`w-3.5 h-3.5 rounded-full absolute top-0.75 ${p.active ? 'bg-primary' : 'bg-zinc-600'}`} 
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-auto">
          <div className="bg-surface-low p-5 rounded-2xl border border-outline-variant/5 relative overflow-hidden group">
            <div className="absolute inset-0 opacity-10 pointer-events-none bg-gradient-to-br from-primary to-transparent" />
            <div className="flex items-center justify-between mb-4">
              <span className="text-[10px] text-zinc-500 uppercase tracking-[0.2em] font-black">Resource Health</span>
              <Activity size={14} className="text-primary animate-pulse" />
            </div>
            <div className="flex items-end gap-1.5 h-14">
              {[40, 60, 80, 50, 90, 75, 85].map((h, i) => (
                <motion.div 
                  key={i}
                  initial={{ height: 0 }}
                  animate={{ height: `${h}%` }}
                  transition={{ delay: i * 0.1 }}
                  className="flex-1 bg-primary/40 rounded-t-sm group-hover:bg-primary transition-colors" 
                />
              ))}
            </div>
            <p className="text-[10px] text-zinc-500 mt-4 italic font-medium">Telemetry nominal for current load.</p>
          </div>
        </div>

        <button 
          onClick={onProposalClick}
          className="w-full bg-primary-container text-white py-3 rounded-xl font-black text-xs uppercase tracking-widest shadow-xl shadow-primary-container/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
        >
          Open Proposal Flow
        </button>
      </aside>
    </div>
  );
}
