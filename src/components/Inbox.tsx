import { useState, type ElementType } from 'react';
import { AvatarImage } from './AvatarImage';
import { CheckCircle2, History, AlertTriangle, GitMerge, MessageSquare, Zap, Bell, Check } from 'lucide-react';
import { motion } from 'motion/react';

type NotifType = 'status_change' | 'mention' | 'blocked' | 'merged' | 'comment' | 'automated';

interface Notification {
  id: string;
  type: NotifType;
  read: boolean;
  actor: string;
  actorAvatar: string;
  action: string;
  target: string;
  targetCode: string;
  detail?: string;
  time: string;
  epic?: string;
}

const TYPE_CONFIG: Record<NotifType, { icon: ElementType; className: string; bg: string }> = {
  status_change: { icon: History, className: 'text-primary', bg: 'bg-primary/10' },
  mention: { icon: MessageSquare, className: 'text-secondary', bg: 'bg-secondary/10' },
  blocked: { icon: AlertTriangle, className: 'text-error', bg: 'bg-error/10' },
  merged: { icon: GitMerge, className: 'text-tertiary', bg: 'bg-tertiary/10' },
  comment: { icon: MessageSquare, className: 'text-zinc-400', bg: 'bg-surface-highest' },
  automated: { icon: Zap, className: 'text-primary', bg: 'bg-primary/10' },
};

const TABS = ['All', 'Unread', 'Mentions', 'Automated'];

export default function Inbox() {
  const [activeTab, setActiveTab] = useState('All');
  const [notifications, setNotifications] = useState<Notification[]>([]);

  const filtered = notifications.filter(n => {
    if (activeTab === 'Unread') return !n.read;
    if (activeTab === 'Mentions') return n.type === 'mention';
    if (activeTab === 'Automated') return n.type === 'automated';
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const markAllRead = () => setNotifications(n => n.map(item => ({ ...item, read: true })));
  const markRead = (id: string) => setNotifications(n => n.map(item => item.id === id ? { ...item, read: true } : item));

  return (
    <div className="p-8 max-w-4xl mx-auto w-full space-y-8">
      <div className="flex justify-between items-end">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h2 className="text-4xl font-extrabold tracking-tighter text-white">Inbox</h2>
            {unreadCount > 0 && (
              <span className="bg-primary text-on-primary text-[11px] font-black px-2.5 py-0.5 rounded-full">
                {unreadCount}
              </span>
            )}
          </div>
          <p className="text-zinc-500 text-sm">Notificações reais (integração pendente).</p>
        </div>
        {unreadCount > 0 && (
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={markAllRead}
            className="flex items-center gap-2 text-xs font-bold text-zinc-400 hover:text-white transition-colors bg-surface-low border border-outline-variant/10 px-4 py-2 rounded-xl"
          >
            <Check size={14} />
            Mark all read
          </motion.button>
        )}
      </div>

      <div className="flex items-center gap-1 bg-surface-low p-1 rounded-xl border border-outline-variant/5 w-fit">
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
              activeTab === tab
                ? 'bg-surface-highest text-white shadow-sm'
                : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            {tab}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <div className="w-14 h-14 rounded-2xl bg-surface-low flex items-center justify-center">
            <Bell size={24} className="text-zinc-600" />
          </div>
          <p className="text-zinc-500 text-sm text-center max-w-sm leading-relaxed">
            Nenhuma notificação. Esta área ficará vazia até integrarmos webhooks ou a API de atividade do Jira — não usamos lista fictícia.
          </p>
        </div>
      ) : (
        <div className="bg-surface-low rounded-2xl border border-outline-variant/5 overflow-hidden divide-y divide-outline-variant/5">
          {filtered.map((notif) => {
            const Config = TYPE_CONFIG[notif.type];
            const Icon = Config.icon;
            return (
              <motion.div
                key={notif.id}
                whileHover={{ backgroundColor: 'rgba(52, 53, 54, 0.3)' }}
                onClick={() => markRead(notif.id)}
                className={`flex items-start gap-4 px-6 py-5 cursor-pointer group transition-opacity ${notif.read ? 'opacity-50' : ''}`}
              >
                <div className="flex-shrink-0 flex items-center gap-3 mt-0.5">
                  {!notif.read && (
                    <div className="w-1.5 h-1.5 rounded-full bg-primary shadow-lg shadow-primary/40" />
                  )}
                  {notif.read && <div className="w-1.5 h-1.5" />}

                  <div className="relative">
                    <AvatarImage
                      src={notif.actorAvatar || null}
                      name={notif.actor}
                      size={32}
                      className="grayscale group-hover:grayscale-0 transition-all"
                      ariaLabel={notif.actor}
                    />
                    <div
                      className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${Config.bg} flex items-center justify-center pointer-events-none`}
                    >
                      <Icon size={9} className={Config.className} />
                    </div>
                  </div>
                </div>

                <div className="flex-1 min-w-0 space-y-1">
                  <p className="text-sm text-zinc-300 leading-snug">
                    <span className="font-bold text-white">{notif.actor}</span>{' '}
                    {notif.action}{' '}
                    <span className="text-primary font-semibold">{notif.target}</span>
                  </p>
                  {notif.detail && (
                    <p className="text-[11px] text-zinc-500 font-mono bg-surface-highest/50 px-2 py-1 rounded-md inline-block">
                      {notif.detail}
                    </p>
                  )}
                  {notif.epic && (
                    <p className="text-[10px] text-zinc-600 uppercase tracking-wider font-bold">{notif.epic}</p>
                  )}
                </div>

                <div className="flex-shrink-0 flex flex-col items-end gap-2">
                  <span className="text-[11px] text-zinc-600 font-mono whitespace-nowrap">{notif.time}</span>
                  <span className="text-[10px] text-zinc-700 font-mono">{notif.targetCode}</span>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
