import { ShiftStatus } from '../context/AppContext';

interface ShiftStatusButtonProps {
  status: ShiftStatus;
  onClick: () => void;
}

const statusConfig: Record<ShiftStatus, { label: string; color: string; bg: string }> = {
  working: { label: 'Work', color: 'text-orange-700', bg: 'bg-orange-100 border-orange-200' },
  'day-off': { label: 'Off', color: 'text-green-700', bg: 'bg-green-100 border-green-200' },
  sick: { label: 'Sick', color: 'text-blue-700', bg: 'bg-blue-100 border-blue-200' },
  'no-show': { label: 'No-show', color: 'text-red-700', bg: 'bg-red-100 border-red-200' },
  none: { label: '—', color: 'text-neutral-500', bg: 'bg-neutral-50 border-neutral-200' },
};

export function ShiftStatusButton({ status, onClick }: ShiftStatusButtonProps) {
  const config = statusConfig[status];

  return (
    <button
      onClick={onClick}
      className={`${config.bg} ${config.color} border px-2 py-1 rounded text-xs font-medium transition-all hover:opacity-80 active:scale-95 min-w-[65px]`}
    >
      {config.label}
    </button>
  );
}
