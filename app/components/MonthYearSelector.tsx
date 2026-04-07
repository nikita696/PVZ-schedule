import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';

interface MonthYearSelectorProps {
  month: number;
  year: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
}

const MONTHS = [
  'Январь',
  'Февраль',
  'Март',
  'Апрель',
  'Май',
  'Июнь',
  'Июль',
  'Август',
  'Сентябрь',
  'Октябрь',
  'Ноябрь',
  'Декабрь',
];

export function MonthYearSelector({
  month,
  year,
  onMonthChange,
  onYearChange,
}: MonthYearSelectorProps) {
  const years = Array.from({ length: 7 }, (_, index) => year - 3 + index);

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Select value={String(month)} onValueChange={(value) => onMonthChange(Number(value))}>
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder="Месяц" />
        </SelectTrigger>
        <SelectContent>
          {MONTHS.map((label, index) => (
            <SelectItem key={label} value={String(index + 1)}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={String(year)} onValueChange={(value) => onYearChange(Number(value))}>
        <SelectTrigger className="w-full sm:w-32">
          <SelectValue placeholder="Год" />
        </SelectTrigger>
        <SelectContent>
          {years.map((option) => (
            <SelectItem key={option} value={String(option)}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

