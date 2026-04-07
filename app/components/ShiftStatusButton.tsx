import { cn } from './ui/utils';
import type { ShiftStatus } from '../domain/types';

interface ShiftStatusButtonProps {
  status: ShiftStatus;
  active: boolean;
  onClick: () => void;
}

const STATUS_META: Record<ShiftStatus, { label: string; activeClass: string }> = {
  working: {
    label: 'Работа',
    activeClass: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  },
  'day-off': {
    label: 'Выходной',
    activeClass: 'border-slate-300 bg-slate-100 text-slate-700',
  },
  sick: {
    label: 'Больничный',
    activeClass: 'border-amber-300 bg-amber-50 text-amber-700',
  },
  'no-show': {
    label: 'Не вышел',
    activeClass: 'border-rose-300 bg-rose-50 text-rose-700',
  },
  none: {
    label: 'Очистить',
    activeClass: 'border-stone-300 bg-stone-50 text-stone-700',
  },
};

export function ShiftStatusButton({ status, active, onClick }: ShiftStatusButtonProps) {
  const meta = STATUS_META[status];

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full border px-3 py-1.5 text-xs transition hover:border-stone-300 hover:bg-stone-50',
        active ? meta.activeClass : 'border-border bg-white text-muted-foreground',
      )}
    >
      {meta.label}
    </button>
  );
}
