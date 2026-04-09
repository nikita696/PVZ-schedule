import type { ShiftEditorStatus } from '../domain/types';
import { SHIFT_STATUS_OPTIONS } from '../domain/shiftStatus';
import { cn } from './ui/utils';

interface ShiftStatusButtonProps {
  status: ShiftEditorStatus;
  active: boolean;
  onClick: () => void;
}

const STATUS_META: Record<ShiftEditorStatus, { label: string; activeClass: string }> = {
  shift: {
    label: 'Смена',
    activeClass: 'border-emerald-300 bg-emerald-50 text-emerald-700',
  },
  day_off: {
    label: 'Выходной',
    activeClass: 'border-blue-300 bg-blue-50 text-blue-700',
  },
  sick_leave: {
    label: 'Больничный',
    activeClass: 'border-violet-300 bg-violet-50 text-violet-700',
  },
  no_show: {
    label: 'Невыход',
    activeClass: 'border-rose-300 bg-rose-50 text-rose-700',
  },
  replacement: {
    label: 'Замена',
    activeClass: 'border-amber-300 bg-amber-50 text-amber-700',
  },
  no_shift: {
    label: 'Нет смены',
    activeClass: 'border-stone-300 bg-stone-100 text-stone-700',
  },
  none: {
    label: 'Очистить',
    activeClass: 'border-stone-300 bg-stone-50 text-stone-700',
  },
};

void SHIFT_STATUS_OPTIONS;

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
