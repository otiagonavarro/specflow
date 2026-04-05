import { 
  Sparkles, 
  Rocket, 
  ArrowRight, 
  Terminal, 
  ShieldAlert,
  Cpu,
  CheckCircle2
} from 'lucide-react';
import { motion } from 'motion/react';
import { useState, useEffect } from 'react';

export default function ProposalFlow() {
  const [logs, setLogs] = useState<string[]>([]);
  
  useEffect(() => {
    const initialLogs = [
      '[14:02:11] INITIALIZING DEPLOYMENT PIPELINE v3.4.0...',
      '[14:02:12] AUTHENTICATING AS VECTOR-7 PRIME... [SUCCESS]',
      '[14:02:14] FETCHING PROPOSAL DELTA...',
      '[14:02:15] CLUSTER AFFINITY DETECTED: EU-WEST-1, US-EAST-2',
    ];
    
    let i = 0;
    const interval = setInterval(() => {
      if (i < initialLogs.length) {
        setLogs(prev => [...prev, initialLogs[i]]);
        i++;
      } else {
        clearInterval(interval);
      }
    }, 800);
    
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="p-10 max-w-6xl mx-auto w-full space-y-10">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <h1 className="text-5xl font-black tracking-tighter text-white">OpenCode Proposal Flow</h1>
          <p className="text-zinc-500 max-w-2xl text-lg leading-relaxed">
            Orchestrate the automated architectural alignment and deployment sequence for the v3.4 expansion. This flow ensures parity between regional clusters and the core monolith engine.
          </p>
        </div>
        <span className="px-4 py-1.5 rounded-lg bg-primary-container/20 text-primary text-[10px] font-black uppercase tracking-widest flex items-center gap-2 border border-primary/20">
          <div className="w-2 h-2 rounded-full bg-primary animate-pulse shadow-[0_0_8px_#bdc2ff]" />
          In Progress
        </span>
      </div>

      <div className="grid grid-cols-12 gap-8">
        <div className="col-span-12 lg:col-span-8 space-y-8">
          <div className="space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">Engine Operations</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                { title: 'Generate OpenCode Proposal', desc: 'Initialize LLM synthesis to draft structural changes.', icon: Sparkles, action: 'Execute Sequence' },
                { title: 'Deploy Implementation', desc: 'Commit signed changes to the production branch.', icon: Rocket, action: 'Start Deployment' },
              ].map((op, i) => (
                <motion.button 
                  key={i}
                  whileHover={{ y: -4, borderColor: 'rgba(189, 194, 255, 0.3)' }}
                  className="group relative p-8 bg-surface-low rounded-2xl text-left border border-outline-variant/10 transition-all"
                >
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />
                  <div className="relative z-10 space-y-6">
                    <op.icon size={28} className="text-primary" />
                    <div>
                      <h4 className="font-black text-xl text-white">{op.title}</h4>
                      <p className="text-sm text-zinc-500 mt-2 leading-relaxed">{op.desc}</p>
                    </div>
                    <div className="text-primary text-[10px] font-black uppercase tracking-widest flex items-center gap-2 group-hover:gap-3 transition-all">
                      {op.action} <ArrowRight size={14} />
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          </div>

          <div className="bg-surface-low rounded-2xl p-8 border border-outline-variant/10">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-8">Subtasks Checklist</h3>
            <div className="space-y-5">
              {[
                { label: 'Analyze current schema for latent dependencies', checked: true },
                { label: 'Validate security tokens for local node injection', checked: true },
                { label: 'Simulate proposal rollout in staging environment', checked: false },
                { label: 'Finalize peer review with Senior Architect', checked: false },
              ].map((task, i) => (
                <label key={i} className="flex items-center gap-5 group cursor-pointer">
                  <div className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                    task.checked ? 'bg-primary border-primary' : 'border-outline-variant bg-surface-highest group-hover:border-primary/50'
                  }`}>
                    {task.checked && <CheckCircle2 size={14} className="text-on-primary" strokeWidth={3} />}
                  </div>
                  <span className={`text-sm font-bold transition-colors ${
                    task.checked ? 'text-zinc-600 line-through' : 'text-white group-hover:text-primary'
                  }`}>
                    {task.label}
                  </span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="col-span-12 lg:col-span-4 space-y-6">
          <div className="bg-surface-low rounded-2xl p-8 border border-outline-variant/10">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600 mb-6">Assigned Agent</h3>
            <div className="flex items-center gap-5">
              <div className="relative">
                <img 
                  src="https://picsum.photos/seed/vector-7/100/100" 
                  className="w-14 h-14 rounded-xl object-cover grayscale opacity-80 border border-outline-variant/20" 
                  referrerPolicy="no-referrer"
                />
                <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-primary rounded-full border-4 border-surface-low" />
              </div>
              <div>
                <h5 className="text-white font-black text-lg tracking-tight">Vector-7 Prime</h5>
                <p className="text-[10px] text-primary font-black uppercase tracking-widest mt-0.5">Autonomous Protocol</p>
              </div>
            </div>
          </div>

          <div className="bg-surface-low rounded-2xl p-8 border border-outline-variant/10 space-y-6">
            <h3 className="text-[10px] font-black uppercase tracking-[0.3em] text-zinc-600">Computational Load</h3>
            <div className="space-y-5">
              <div className="flex justify-between items-end">
                <span className="text-4xl font-black text-white tracking-tighter">84.2%</span>
                <span className="text-[10px] font-black text-primary uppercase tracking-widest">Peak Utilization</span>
              </div>
              <div className="h-2 w-full bg-surface-highest rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: '84.2%' }}
                  className="h-full bg-gradient-to-r from-primary-container to-primary rounded-full shadow-[0_0_15px_rgba(189,194,255,0.4)]" 
                />
              </div>
              <div className="flex justify-between text-[10px] text-zinc-500 font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1.5"><Cpu size={12} /> Core-16: Active</span>
                <span>VRAM: 12.8GB / 16GB</span>
              </div>
            </div>
          </div>

          <div className="bg-surface-low rounded-2xl p-8 border border-outline-variant/10 divide-y divide-outline-variant/10">
            <div className="pb-4 mb-4 flex justify-between items-center">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Deadline</span>
              <span className="text-xs font-black text-white">Oct 24, 2023</span>
            </div>
            <div className="py-4 mb-4 flex justify-between items-center">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Priority</span>
              <span className="text-xs font-black text-error flex items-center gap-1.5">
                <ShieldAlert size={14} fill="currentColor" /> Critical
              </span>
            </div>
            <div className="pt-4 flex justify-between items-center">
              <span className="text-xs font-bold text-zinc-500 uppercase tracking-widest">Labels</span>
              <div className="flex gap-2">
                <span className="px-2 py-1 rounded bg-zinc-900 text-[9px] text-zinc-400 font-black border border-outline-variant/20 uppercase tracking-widest">AI-Synth</span>
                <span className="px-2 py-1 rounded bg-zinc-900 text-[9px] text-zinc-400 font-black border border-outline-variant/20 uppercase tracking-widest">Kernal</span>
              </div>
            </div>
          </div>
        </div>

        <div className="col-span-12">
          <div className="bg-zinc-950 rounded-2xl border border-outline-variant/10 overflow-hidden shadow-2xl">
            <div className="bg-surface-highest/30 px-6 py-3 flex items-center justify-between border-b border-outline-variant/10">
              <div className="flex items-center gap-6">
                <div className="flex gap-2">
                  <div className="w-3 h-3 rounded-full bg-error/40" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/40" />
                  <div className="w-3 h-3 rounded-full bg-primary/40" />
                </div>
                <span className="text-[10px] font-black text-zinc-500 uppercase tracking-[0.3em] flex items-center gap-2.5">
                  <Terminal size={14} />
                  Deployment Terminal
                </span>
              </div>
              <div className="flex items-center gap-6 text-[10px] text-zinc-600 font-mono font-bold uppercase tracking-widest">
                <span>uptime: 4d 12h 03m</span>
                <span className="text-primary">system: healthy</span>
              </div>
            </div>
            <div className="p-8 h-64 overflow-y-auto font-mono text-sm leading-relaxed text-zinc-400">
              {logs.map((log, i) => (
                <div key={i} className="mb-1.5">
                  {log.includes('[SUCCESS]') ? (
                    <>
                      {log.split('[SUCCESS]')[0]}
                      <span className="text-primary font-bold">[SUCCESS]</span>
                    </>
                  ) : log}
                </div>
              ))}
              <div className="bg-zinc-900/50 p-5 rounded-xl my-4 border-l-4 border-primary/30 font-mono text-xs">
                <code className="text-zinc-300">
                  <span className="text-primary font-bold">mutation</span> {'{'} <br/>
                  &nbsp;&nbsp;deployProposal(id: <span className="text-secondary">"opencode-v34-delta"</span>) {'{'} <br/>
                  &nbsp;&nbsp;&nbsp;&nbsp;status, node_affinity, cluster_hash <br/>
                  &nbsp;&nbsp;{'}'} <br/>
                  {'}'}
                </code>
              </div>
              <div className="animate-pulse text-zinc-600">
                [14:02:16] AWAITING FINAL MANIFEST SIGNATURE... _
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
