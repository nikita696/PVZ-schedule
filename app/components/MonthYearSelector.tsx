import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from './ui/select';
import { useLanguage } from '../context/LanguageContext';
import { MONTH_NAMES } from '../lib/i18n';

interface MonthYearSelectorProps {
  month: number;
  year: number;
  onMonthChange: (month: number) => void;
  onYearChange: (year: number) => void;
}

export function MonthYearSelector({
  month,
  year,
  onMonthChange,
  onYearChange,
}: MonthYearSelectorProps) {
  const { language, t } = useLanguage();
  const years = Array.from({ length: 7 }, (_, index) => year - 3 + index);
  const monthNames = MONTH_NAMES[language];

  return (
    <div className="flex flex-col gap-3 sm:flex-row">
      <Select value={String(month)} onValueChange={(value) => onMonthChange(Number(value))}>
        <SelectTrigger className="w-full sm:w-44">
          <SelectValue placeholder={t('Месяц', 'Month')} />
        </SelectTrigger>
        <SelectContent>
          {monthNames.map((label, index) => (
            <SelectItem key={label} value={String(index + 1)}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select value={String(year)} onValueChange={(value) => onYearChange(Number(value))}>
        <SelectTrigger className="w-full sm:w-32">
          <SelectValue placeholder={t('Год', 'Year')} />
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
