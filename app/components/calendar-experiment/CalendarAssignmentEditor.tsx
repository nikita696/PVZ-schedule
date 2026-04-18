import { Check, Pencil } from 'lucide-react';
import type { ReactNode } from 'react';
import { getShiftStatusLabel, getShiftStatusOptions } from '../../domain/shiftStatus';
import type { ShiftEditorStatus, ShiftStatusDb } from '../../domain/types';
import { useLanguage } from '../../context/LanguageContext';
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
  DrawerTrigger,
} from '../ui/drawer';
import { Popover, PopoverContent, PopoverTrigger } from '../ui/popover';
import { useIsMobile } from '../ui/use-mobile';
import { cn } from '../ui/utils';

interface CalendarAssignmentEditorProps {
  trigger: ReactNode;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeName: string;
  dateLabel: string;
  currentStatus: ShiftStatusDb;
  onStatusChange: (status: ShiftEditorStatus) => void;
}

function EditorBody({
  employeeName,
  dateLabel,
  currentStatus,
  onStatusChange,
}: Omit<CalendarAssignmentEditorProps, 'trigger' | 'open' | 'onOpenChange'>) {
  const { language, t } = useLanguage();
  const options = getShiftStatusOptions(language);

  return (
    <div className="grid gap-1.5">
      <div className="px-1 pb-1">
        <div className="text-xs font-semibold text-stone-900">{employeeName}</div>
        <div className="text-[11px] text-stone-500">{dateLabel}</div>
      </div>
      {options.map((option) => {
        const active = option.value === currentStatus;

        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onStatusChange(option.value)}
            className={cn(
              'flex items-center justify-between rounded-xl border px-3 py-2 text-left text-sm transition hover:bg-stone-50',
              active ? 'border-stone-900 bg-stone-900 text-white hover:bg-stone-900' : 'border-stone-200 bg-white text-stone-700',
            )}
          >
            <div className="flex items-center gap-2">
              <span className={cn('h-2.5 w-2.5 rounded-full border border-black/10', option.colorClass)} />
              <span>{option.label}</span>
            </div>
            {active ? <Check className="h-4 w-4" /> : null}
          </button>
        );
      })}
      <div className="pt-1 text-[11px] text-stone-500">
        {t(
          `Текущий статус: ${getShiftStatusLabel(currentStatus, language)}`,
          `Current status: ${getShiftStatusLabel(currentStatus, language)}`,
        )}
      </div>
    </div>
  );
}

export function CalendarAssignmentEditor(props: CalendarAssignmentEditorProps) {
  const { employeeName, dateLabel, currentStatus, onOpenChange, onStatusChange, open, trigger } = props;
  const { t } = useLanguage();
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerTrigger asChild>{trigger}</DrawerTrigger>
        <DrawerContent className="rounded-t-3xl">
          <DrawerHeader className="pb-2">
            <DrawerTitle className="flex items-center gap-2 text-base">
              <Pencil className="h-4 w-4" />
              {t('Изменить статус', 'Edit status')}
            </DrawerTitle>
            <DrawerDescription>
              {employeeName} • {dateLabel}
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-6">
            <EditorBody
              employeeName={employeeName}
              dateLabel={dateLabel}
              currentStatus={currentStatus}
              onStatusChange={onStatusChange}
            />
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Popover open={open} onOpenChange={onOpenChange}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="start" className="w-72 rounded-2xl p-3">
        <EditorBody
          employeeName={employeeName}
          dateLabel={dateLabel}
          currentStatus={currentStatus}
          onStatusChange={onStatusChange}
        />
      </PopoverContent>
    </Popover>
  );
}
