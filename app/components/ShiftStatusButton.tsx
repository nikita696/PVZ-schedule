import type { ShiftEditorStatus } from '../domain/types';
import { getShiftStatusLabel } from '../domain/shiftStatus';
import { useLanguage } from '../context/LanguageContext';
import { cn } from './ui/utils';

interface ShiftStatusButtonProps {
  status: ShiftEditorStatus;
  active: boolean;
  onClick: () => void;
}

export function ShiftStatusButton({ status, active, onClick }: ShiftStatusButtonProps) {
  const { language } = useLanguage();

  const statusMeta: Record<ShiftEditorStatus, { label: string; activeClass: string }> = {
    shift: {
      label: getShiftStatusLabel('shift', language),
      activeClass: 'border-emerald-300 bg-emerald-50 text-emerald-700',
    },
    day_off: {
      label: getShiftStatusLabel('day_off', language),
      activeClass: 'border-blue-300 bg-blue-50 text-blue-700',
    },
    sick_leave: {
      label: getShiftStatusLabel('sick_leave', language),
      activeClass: 'border-violet-300 bg-violet-50 text-violet-700',
    },
    no_show: {
      label: getShiftStatusLabel('no_show', language),
      activeClass: 'border-rose-300 bg-rose-50 text-rose-700',
    },
    replacement: {
      label: getShiftStatusLabel('replacement', language),
      activeClass: 'border-amber-300 bg-amber-50 text-amber-700',
    },
    no_shift: {
      label: getShiftStatusLabel('no_shift', language),
      activeClass: 'border-stone-300 bg-stone-100 text-stone-700',
    },
    none: {
      label: getShiftStatusLabel('none', language),
      activeClass: 'border-stone-300 bg-stone-50 text-stone-700',
    },
  };

  const meta = statusMeta[status];

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
