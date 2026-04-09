import type { ShiftEditorStatus } from '../domain/types';
import { ShiftStatusButton } from './ShiftStatusButton';

interface ShiftStatusSelectorProps {
  value: ShiftEditorStatus;
  onChange: (status: ShiftEditorStatus) => void;
}

const ORDER: ShiftEditorStatus[] = ['shift', 'replacement', 'day_off', 'sick_leave', 'no_show', 'no_shift', 'none'];

export function ShiftStatusSelector({ value, onChange }: ShiftStatusSelectorProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {ORDER.map((status) => (
        <ShiftStatusButton
          key={status}
          status={status}
          active={value === status}
          onClick={() => onChange(status)}
        />
      ))}
    </div>
  );
}
