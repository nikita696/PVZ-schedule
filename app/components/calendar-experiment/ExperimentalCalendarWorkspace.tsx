import { AlertTriangle, ArrowLeft, ArrowRight, CalendarDays, CircleAlert, Layers3, ShieldAlert, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { getMonthStatusLabels } from '../../pages/dashboardCopy';
import { getShiftStatusLabel, getShiftStatusOptions } from '../../domain/shiftStatus';
import type { Employee, MonthStatus } from '../../domain/types';
import { MONTH_NAMES } from '../../lib/i18n';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { Button } from '../ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { useIsMobile } from '../ui/use-mobile';
import { cn } from '../ui/utils';
import { CalendarAssignmentEditor } from './CalendarAssignmentEditor';
import {
  buildCalendarGridDays,
  buildShiftLookup,
  CALENDAR_WEEKDAY_LABELS,
  formatMonthHeading,
  getEffectiveShiftStatus,
  getEmployeeShortName,
  getShiftKey,
  getStatusCompactLabel,
  isOutsideEmployment,
  STATUS_SURFACE_CLASS,
} from './calendarExperimentUtils';

interface ExperimentalCalendarWorkspaceProps {
  classicHref: string;
}

const MONTH_STATUS_META: Record<MonthStatus, { className: string }> = {
  draft: { className: 'bg-slate-100 text-slate-700' },
  pending_approval: { className: 'bg-amber-100 text-amber-800' },
  approved: { className: 'bg-emerald-100 text-emerald-800' },
  closed: { className: 'bg-stone-200 text-stone-800' },
};

const ISSUE_BADGE_CLASS: Record<'danger' | 'warning' | 'attention' | 'neutral', string> = {
  danger: 'bg-rose-100 text-rose-700',
  warning: 'bg-amber-100 text-amber-800',
  attention: 'bg-violet-100 text-violet-700',
  neutral: 'bg-stone-100 text-stone-500',
};

const ISSUE_FRAME_CLASS: Record<'danger' | 'warning' | 'attention' | 'neutral', string> = {
  danger: 'border-rose-200 bg-rose-50/65',
  warning: 'border-amber-200 bg-amber-50/65',
  attention: 'border-violet-200 bg-violet-50/70',
  neutral: 'border-stone-200 bg-white',
};

const getMonthShiftSummaryLabel = (count: number, language: 'ru' | 'en'): string => {
  if (language === 'en') {
    return count === 1 ? '1 shift' : `${count} shifts`;
  }

  if (count === 1) return '1 смена';
  if (count >= 2 && count <= 4) return `${count} смены`;
  return `${count} смен`;
};

const getDateLabel = (date: string): string => {
  const [year, month, day] = date.split('-');
  return `${day}.${month}.${year}`;
};

const getAssignmentName = (employee: Employee, isMobile: boolean): string => {
  if (isMobile) {
    return getEmployeeShortName(employee.name, 3);
  }

  return getEmployeeShortName(employee.name, 8);
};

export function ExperimentalCalendarWorkspace({ classicHref }: ExperimentalCalendarWorkspaceProps) {
  const isMobile = useIsMobile();
  const { language, t } = useLanguage();
  const monthStatusLabels = getMonthStatusLabels(language);
  const {
    employees,
    shifts,
    selectedMonth,
    selectedYear,
    selectedMonthStatus,
    canEditSelectedMonth,
    setSelectedMonth,
    setSelectedYear,
    setSelectedMonthStatus,
    updateShift,
    isOwner,
    myEmployeeId,
  } = useApp();
  const [employeeFilter, setEmployeeFilter] = useState<'all' | string>('all');
  const [openEditorKey, setOpenEditorKey] = useState<string | null>(null);

  const activeEmployees = useMemo(
    () => employees.filter((employee) => !employee.archived),
    [employees],
  );

  const editableEmployeeIds = useMemo(() => {
    if (!canEditSelectedMonth) {
      return [];
    }

    if (isOwner) {
      return activeEmployees.map((employee) => employee.id);
    }

    return myEmployeeId ? [myEmployeeId] : [];
  }, [activeEmployees, canEditSelectedMonth, isOwner, myEmployeeId]);

  useEffect(() => {
    if (!isOwner && myEmployeeId) {
      setEmployeeFilter(myEmployeeId);
      return;
    }

    if (employeeFilter !== 'all' && !activeEmployees.some((employee) => employee.id === employeeFilter)) {
      setEmployeeFilter('all');
    }
  }, [activeEmployees, employeeFilter, isOwner, myEmployeeId]);

  const shiftLookup = useMemo(() => buildShiftLookup(shifts), [shifts]);

  const monthDays = useMemo(
    () => buildCalendarGridDays(selectedYear, selectedMonth, activeEmployees, shiftLookup, language),
    [activeEmployees, language, selectedMonth, selectedYear, shiftLookup],
  );

  const visibleEmployees = useMemo(() => {
    if (employeeFilter === 'all') {
      return activeEmployees;
    }

    return activeEmployees.filter((employee) => employee.id === employeeFilter);
  }, [activeEmployees, employeeFilter]);

  const problemSummary = useMemo(() => {
    const currentMonthDays = monthDays.filter((day) => day.isCurrentMonth);

    return currentMonthDays.reduce((acc, day) => ({
      coverage: acc.coverage + Number(day.issues.coverage),
      conflict: acc.conflict + Number(day.issues.conflict),
      noShow: acc.noShow + Number(day.issues.noShow),
    }), { coverage: 0, conflict: 0, noShow: 0 });
  }, [monthDays]);

  const handlePrevMonth = () => {
    if (selectedMonth === 1) {
      setSelectedMonth(12);
      setSelectedYear(selectedYear - 1);
      return;
    }

    setSelectedMonth(selectedMonth - 1);
  };

  const handleNextMonth = () => {
    if (selectedMonth === 12) {
      setSelectedMonth(1);
      setSelectedYear(selectedYear + 1);
      return;
    }

    setSelectedMonth(selectedMonth + 1);
  };

  const handleToday = () => {
    const today = new Date();
    setSelectedMonth(today.getMonth() + 1);
    setSelectedYear(today.getFullYear());
  };

  const handleMonthStatusChange = async (nextStatus: MonthStatus) => {
    const result = await setSelectedMonthStatus(nextStatus);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(t('Статус месяца обновлён.', 'Month status updated.'));
  };

  const handleStatusChange = async (employeeId: string, date: string, status: Parameters<typeof updateShift>[2]) => {
    const result = await updateShift(employeeId, date, status);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setOpenEditorKey(null);
  };

  const legendOptions = useMemo(
    () => getShiftStatusOptions(language).filter((option) => option.value !== 'none'),
    [language],
  );

  const monthMeta = MONTH_STATUS_META[selectedMonthStatus];
  const currentMonthLabel = formatMonthHeading(language, selectedMonth, selectedYear);

  return (
    <div className="bg-[#f4f1eb]">
      <main className="mx-auto max-w-[1500px] px-3 py-3 sm:px-4 lg:py-4">
        <section className="overflow-hidden rounded-[28px] border border-stone-200 bg-white shadow-[0_16px_40px_rgba(15,23,42,0.08)]">
          <div className="border-b border-stone-200 px-3 py-3 sm:px-4 sm:py-4">
            <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
              <div className="flex min-w-0 flex-1 flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-2 rounded-full bg-stone-900 px-3 py-1 text-xs font-semibold text-white">
                    <Layers3 className="h-3.5 w-3.5" />
                    {t('Experimental calendar', 'Experimental calendar')}
                  </span>
                  <span className={cn('rounded-full px-3 py-1 text-xs font-semibold', monthMeta.className)}>
                    {t('Месяц', 'Month')}: {monthStatusLabels[selectedMonthStatus]}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="inline-flex items-center rounded-full border border-stone-200 bg-stone-50 p-1">
                    <Button size="icon" variant="ghost" className="rounded-full" onClick={handlePrevMonth}>
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="min-w-[160px] px-2 text-center text-sm font-semibold text-stone-900 sm:min-w-[220px]">
                      {currentMonthLabel}
                    </div>
                    <Button size="icon" variant="ghost" className="rounded-full" onClick={handleNextMonth}>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>

                  <Button variant="outline" size="sm" className="rounded-full" onClick={handleToday}>
                    <CalendarDays className="h-4 w-4" />
                    {t('Сегодня', 'Today')}
                  </Button>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 xl:max-w-[580px] xl:justify-end">
                {legendOptions.map((option) => (
                  <div
                    key={option.value}
                    className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-2.5 py-1 text-[11px] font-medium text-stone-700"
                  >
                    <span className={cn('h-2.5 w-2.5 rounded-full border border-black/10', option.colorClass)} />
                    <span>{option.label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-3 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="flex flex-wrap items-center gap-2">
                {problemSummary.coverage > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    {t('Без смены', 'No coverage')}: {problemSummary.coverage}
                  </span>
                ) : null}
                {problemSummary.conflict > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                    <CircleAlert className="h-3.5 w-3.5" />
                    {t('Конфликты', 'Conflicts')}: {problemSummary.conflict}
                  </span>
                ) : null}
                {problemSummary.noShow > 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-3 py-1 text-xs font-semibold text-violet-700">
                    <ShieldAlert className="h-3.5 w-3.5" />
                    {t('Невыходы', 'No-shows')}: {problemSummary.noShow}
                  </span>
                ) : null}
                {problemSummary.coverage === 0 && problemSummary.conflict === 0 && problemSummary.noShow === 0 ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">
                    {t('Месяц выглядит чисто', 'Month looks clean')}
                  </span>
                ) : null}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {activeEmployees.length > 1 ? (
                  <Select value={employeeFilter} onValueChange={(value) => setEmployeeFilter(value as 'all' | string)}>
                    <SelectTrigger className="h-9 min-w-[180px] rounded-full border-stone-200 bg-white text-sm">
                      <SelectValue placeholder={t('Фильтр по сотруднику', 'Employee filter')} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('Все сотрудники', 'All employees')}</SelectItem>
                      {activeEmployees.map((employee) => (
                        <SelectItem key={employee.id} value={employee.id}>
                          {employee.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : null}

                {!isOwner && myEmployeeId ? (
                  <span className="inline-flex items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-xs font-medium text-stone-700">
                    <UserRound className="h-3.5 w-3.5" />
                    {visibleEmployees[0]?.name ?? t('Мой график', 'My schedule')}
                  </span>
                ) : null}

                {isOwner ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {selectedMonthStatus === 'draft' ? (
                      <Button size="sm" variant="outline" className="rounded-full" onClick={() => void handleMonthStatusChange('pending_approval')}>
                        {t('На утверждение', 'Send for approval')}
                      </Button>
                    ) : null}
                    {(selectedMonthStatus === 'draft' || selectedMonthStatus === 'pending_approval') ? (
                      <Button size="sm" className="rounded-full" onClick={() => void handleMonthStatusChange('approved')}>
                        {t('Утвердить', 'Approve')}
                      </Button>
                    ) : null}
                    {selectedMonthStatus === 'approved' ? (
                      <Button size="sm" variant="outline" className="rounded-full" onClick={() => void handleMonthStatusChange('closed')}>
                        {t('Закрыть', 'Close')}
                      </Button>
                    ) : null}
                    {selectedMonthStatus === 'pending_approval' ? (
                      <Button size="sm" variant="ghost" className="rounded-full" onClick={() => void handleMonthStatusChange('draft')}>
                        {t('В черновик', 'Back to draft')}
                      </Button>
                    ) : null}
                  </div>
                ) : null}

                <Button asChild size="sm" variant="outline" className="rounded-full">
                  <Link to={classicHref}>{t('Classic fallback', 'Classic fallback')}</Link>
                </Button>
              </div>
            </div>
          </div>

          <div className="p-2 sm:p-3 lg:p-4">
            <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
              {CALENDAR_WEEKDAY_LABELS[language].map((label, index) => (
                <div
                  key={label}
                  className={cn(
                    'rounded-2xl border border-stone-200 bg-stone-100/80 px-2 py-2 text-center text-[11px] font-semibold uppercase tracking-[0.12em] text-stone-500 sm:text-xs',
                    index >= 5 ? 'text-rose-500' : '',
                  )}
                >
                  {label}
                </div>
              ))}

              {monthDays.map((day) => {
                const assignments = visibleEmployees.map((employee) => {
                  const outsideEmployment = isOutsideEmployment(employee, day.date);
                  const status = getEffectiveShiftStatus(shiftLookup.get(getShiftKey(employee.id, day.date)));
                  const editable = editableEmployeeIds.includes(employee.id) && !outsideEmployment;

                  return {
                    employee,
                    outsideEmployment,
                    status,
                    editable,
                  };
                });

                const rowLimit = isMobile
                  ? (employeeFilter === 'all' ? 2 : 3)
                  : (employeeFilter === 'all' ? 4 : 5);
                const visibleAssignments = assignments.slice(0, rowLimit);
                const hiddenAssignmentsCount = Math.max(0, assignments.length - visibleAssignments.length);

                return (
                  <div
                    key={day.date}
                    className={cn(
                      'flex min-h-[108px] flex-col rounded-[22px] border p-2 sm:min-h-[132px] sm:p-2.5 lg:min-h-[148px]',
                      ISSUE_FRAME_CLASS[day.issues.tone],
                      day.isToday ? 'ring-2 ring-sky-400/65' : '',
                      !day.isCurrentMonth ? 'bg-stone-50/80 text-stone-400' : '',
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <span className="text-sm font-semibold text-stone-900 sm:text-base">
                            {day.dayNumber}
                          </span>
                          {!day.isCurrentMonth ? (
                            <span className="text-[10px] font-medium text-stone-500">
                              {MONTH_NAMES[language][day.month - 1].slice(0, 3)}
                            </span>
                          ) : null}
                        </div>
                        <div className="text-[10px] text-stone-500">
                          {getMonthShiftSummaryLabel(day.shiftLikeCount, language)}
                        </div>
                      </div>

                      {day.issues.label ? (
                        <span className={cn(
                          'inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold',
                          ISSUE_BADGE_CLASS[day.issues.tone],
                        )}>
                          {day.issues.label}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-2 grid flex-1 content-start gap-1">
                      {visibleAssignments.map((assignment) => {
                        const editorKey = `${day.date}:${assignment.employee.id}`;
                        const rowButton = (
                          <button
                            type="button"
                            disabled={!assignment.editable}
                            className={cn(
                              'flex w-full items-center justify-between gap-2 rounded-xl border px-2 py-1.5 text-left text-[11px] transition sm:text-xs',
                              assignment.outsideEmployment
                                ? 'border-dashed border-stone-200 bg-stone-50 text-stone-400'
                                : STATUS_SURFACE_CLASS[assignment.status],
                              assignment.editable ? 'hover:brightness-[0.98]' : 'cursor-default',
                            )}
                            title={assignment.outsideEmployment ? t('Сотрудник ещё не в графике на эту дату', 'Employee is out of range for this date') : getShiftStatusLabel(assignment.status, language)}
                          >
                            <span className="truncate font-medium">
                              {getAssignmentName(assignment.employee, isMobile)}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-1.5 py-0.5 text-[10px] font-semibold text-stone-700">
                              <span className={cn(
                                'h-2 w-2 rounded-full border border-black/10',
                                assignment.outsideEmployment ? 'bg-stone-200' : STATUS_SURFACE_CLASS[assignment.status].includes('emerald') ? 'bg-emerald-500'
                                  : STATUS_SURFACE_CLASS[assignment.status].includes('sky') ? 'bg-sky-500'
                                    : STATUS_SURFACE_CLASS[assignment.status].includes('violet') ? 'bg-violet-500'
                                      : STATUS_SURFACE_CLASS[assignment.status].includes('rose') ? 'bg-rose-500'
                                        : STATUS_SURFACE_CLASS[assignment.status].includes('amber') ? 'bg-amber-400'
                                          : 'bg-stone-300',
                              )} />
                              {assignment.outsideEmployment
                                ? t('—', '—')
                                : getStatusCompactLabel(assignment.status, language)}
                            </span>
                          </button>
                        );

                        if (!assignment.editable) {
                          return (
                            <div key={editorKey}>
                              {rowButton}
                            </div>
                          );
                        }

                        return (
                          <CalendarAssignmentEditor
                            key={editorKey}
                            trigger={rowButton}
                            open={openEditorKey === editorKey}
                            onOpenChange={(nextOpen) => setOpenEditorKey(nextOpen ? editorKey : null)}
                            employeeName={assignment.employee.name}
                            dateLabel={getDateLabel(day.date)}
                            currentStatus={assignment.status}
                            onStatusChange={(status) => void handleStatusChange(assignment.employee.id, day.date, status)}
                          />
                        );
                      })}

                      {hiddenAssignmentsCount > 0 ? (
                        <div className="rounded-xl border border-dashed border-stone-200 px-2 py-1 text-[10px] font-medium text-stone-500">
                          {t(`ещё ${hiddenAssignmentsCount}`, `${hiddenAssignmentsCount} more`)}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
