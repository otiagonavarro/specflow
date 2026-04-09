import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useLocale } from '../locales';

interface PaginationBarProps {
  pageLabel: string;
  canGoPrev: boolean;
  canGoNext: boolean;
  onPrev: () => void;
  onNext: () => void;
  loadingMore?: boolean;
  disabled?: boolean;
}

export default function PaginationBar({
  pageLabel,
  canGoPrev,
  canGoNext,
  onPrev,
  onNext,
  loadingMore,
  disabled,
}: PaginationBarProps) {
  const { t } = useLocale();
  return (
    <div className="flex items-center justify-between gap-4 px-6 py-3 border-t border-outline-variant/10 bg-surface-low/50">
      <span className="text-[11px] text-zinc-500 font-medium">{pageLabel}</span>
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onPrev}
          disabled={disabled || !canGoPrev}
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-surface-highest border border-outline-variant/10 text-zinc-300 hover:text-white disabled:opacity-35 disabled:pointer-events-none"
        >
          <ChevronLeft size={16} />
          {t('pagination.prev')}
        </button>
        <button
          type="button"
          onClick={onNext}
          disabled={disabled || !canGoNext || loadingMore}
          className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-lg bg-surface-highest border border-outline-variant/10 text-zinc-300 hover:text-white disabled:opacity-35 disabled:pointer-events-none"
        >
          {loadingMore ? t('pagination.loading') : t('pagination.next')}
          <ChevronRight size={16} />
        </button>
      </div>
    </div>
  );
}
