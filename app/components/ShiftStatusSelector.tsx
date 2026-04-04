import { ShiftStatus } from '../context/AppContext';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface ShiftStatusSelectorProps {
  value: ShiftStatus;
  onChange: (status: ShiftStatus) => void;
}

const statusOptions: { value: ShiftStatus; label: string; color: string }[] = [
  { value: 'working', label: 'Working', color: 'text-orange-700' },
  { value: 'day-off', label: 'Day off', color: 'text-green-700' },
  { value: 'sick', label: 'Sick leave', color: 'text-blue-700' },
  { value: 'no-show', label: 'No-show', color: 'text-red-700' },
  { value: 'none', label: 'No shift', color: 'text-neutral-500' },
];

export function ShiftStatusSelector({ value, onChange }: ShiftStatusSelectorProps) {
  const currentOption = statusOptions.find((opt) => opt.value === value);

  return (
    <Select value={value} onValueChange={(val) => onChange(val as ShiftStatus)}>
      <SelectTrigger className="w-full h-9 text-xs">
        <SelectValue>
          <span className={currentOption?.color}>{currentOption?.label}</span>
        </SelectValue>
      </SelectTrigger>
      <SelectContent>
        {statusOptions.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            <span className={option.color}>{option.label}</span>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
