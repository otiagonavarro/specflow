import { Search, Bell, Command } from 'lucide-react';
import { useLocale } from '../locales';
import { isJiraConfigured } from '../api/config';
import { useJiraMyself } from '../hooks/useJiraMyself';
import { AvatarImage } from './AvatarImage';

interface TopBarProps {
  onRequestProposal: () => void;
  breadcrumbCurrent: string;
  searchPlaceholder?: string;
}

export default function TopBar({ onRequestProposal, breadcrumbCurrent, searchPlaceholder }: TopBarProps) {
  const { t } = useLocale();
  const jiraOn = isJiraConfigured();
  const { loading: meLoading, user: me } = useJiraMyself();

  return (
    <header className="h-14 flex items-center justify-between px-8 glass border-b border-outline-variant/5 sticky top-0 z-40">
      <div className="flex items-center gap-4">
        <nav className="flex items-center gap-2 text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-bold">
          <span>{t('top.workspace')}</span>
          <span className="text-zinc-700">/</span>
          <span className="text-primary">{breadcrumbCurrent}</span>
        </nav>
      </div>

      <div className="flex items-center gap-6">
        <div className="relative group">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500" size={14} />
          <input
            type="text"
            placeholder={searchPlaceholder ?? t('search.epics')}
            className="bg-surface-highest/50 border-none rounded-lg pl-9 pr-4 py-1.5 w-64 text-xs focus:ring-1 focus:ring-primary/30 transition-all placeholder:text-zinc-600"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            className="p-2 text-zinc-400 hover:text-white hover:bg-surface-highest rounded-lg transition-all"
          >
            <Bell size={18} />
          </button>
          <button
            type="button"
            className="p-2 text-zinc-400 hover:text-white hover:bg-surface-highest rounded-lg transition-all flex items-center gap-1"
          >
            <Command size={18} />
          </button>
        </div>

        <div className="h-6 w-px bg-outline-variant/20" />

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onRequestProposal}
            className="bg-primary-container text-white text-[10px] font-bold px-4 py-1.5 rounded-lg tracking-wider uppercase hover:bg-primary-container/80 transition-colors"
          >
            {t('proposal')}
          </button>
          {jiraOn && meLoading && (
            <div
              className="w-8 h-8 rounded-full bg-surface-highest border border-outline-variant/20 animate-pulse"
              aria-hidden
            />
          )}
          {jiraOn && !meLoading && me && (
            <AvatarImage
              src={me.avatarUrl}
              name={me.displayName}
              size={32}
              className="hover:grayscale-0 transition-all cursor-pointer"
              ariaLabel={me.displayName}
            />
          )}
          {jiraOn && !meLoading && !me && (
            <AvatarImage
              src={null}
              name="?"
              size={32}
              className="cursor-pointer"
              ariaLabel={t('top.userUnknown')}
            />
          )}
          {!jiraOn && (
            <AvatarImage
              src={null}
              name="?"
              size={32}
              className="cursor-pointer"
              ariaLabel={t('top.userUnknown')}
            />
          )}
        </div>
      </div>
    </header>
  );
}
