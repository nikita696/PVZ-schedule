import type { ShiftStatus } from '../domain/types';
import { ShiftStatusButton } from './ShiftStatusButton';

interface ShiftStatusSelectorProps {
  value: ShiftStatus;
  onChange: (status: ShiftStatus) => void;
}

const ORDER: ShiftStatus[] = ['planned-work', 'worked', 'day-off', 'vacation', 'sick', 'no-show', 'none'];

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
