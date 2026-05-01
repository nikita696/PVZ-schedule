import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  CircleAlert,
  ShieldAlert,
  UserRound,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router';
import { toast } from 'sonner';
import { getShiftStatusLabel, getShiftStatusOptions, isShiftLikeStatus } from '../../domain/shiftStatus';
import type { Employee, MonthStatus } from '../../domain/types';
import { useApp } from '../../context/AppContext';
import { useLanguage } from '../../context/LanguageContext';
import { MONTH_NAMES } from '../../lib/i18n';
import { getMonthStatusLabels } from '../../pages/dashboardCopy';
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
  getShiftKey,
  getStatusCompactLabel,
  isOutsideEmployment,
  STATUS_SURFACE_CLASS,
} from './calendarExperimentUtils';

interface ExperimentalCalendarWorkspaceProps {
  classicHref: string;
}

const MONTH_STATUS_META: Record<MonthStatus, { className: string }> = {
  draft: { className: 'bg-slate-100 text-slate-700 border-slate-200' },
  pending_approval: { className: 'bg-amber-100 text-amber-800 border-amber-200' },
  approved: { className: 'bg-emerald-100 text-emerald-800 border-emerald-200' },
  closed: { className: 'bg-stone-200 text-stone-800 border-stone-300' },
};

const ISSUE_BADGE_CLASS: Record<'danger' | 'warning' | 'attention' | 'neutral', string> = {
  danger: 'bg-rose-100 text-rose-700',
  warning: 'bg-amber-100 text-amber-800',
  attention: 'bg-violet-100 text-violet-700',
  neutral: 'bg-stone-100 text-stone-500',
};

const ISSUE_FRAME_CLASS: Record<'danger' | 'warning' | 'attention' | 'neutral', string> = {
  danger: 'border-rose-300 bg-rose-50/70',
  warning: 'border-amber-300 bg-amber-50/70',
  attention: 'border-violet-300 bg-violet-50/70',
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
    return employee.name.trim().split(/\s+/)[0] ?? employee.name;
  }

  return employee.name;
};

const getStatusDotClass = (status: ReturnType<typeof getEffectiveShiftStatus>) => {
  if (status === 'shift') return 'bg-emerald-500';
  if (status === 'day_off') return 'bg-sky-500';
  if (status === 'sick_leave') return 'bg-violet-500';
  if (status === 'no_show') return 'bg-rose-500';
  if (status === 'replacement') return 'bg-amber-400';
  return 'bg-stone-300';
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

  const monthSummary = useMemo(() => {
    const currentMonthDays = monthDays.filter((day) => day.isCurrentMonth);

    let assignedShiftCount = 0;
    let problemDays = 0;
    let staffedDays = 0;

    for (const day of currentMonthDays) {
      if (day.shiftLikeCount > 0) {
        staffedDays += 1;
      }

      if (day.issues.total > 0) {
        problemDays += 1;
      }

      for (const employee of visibleEmployees) {
        if (isOutsideEmployment(employee, day.date)) continue;
        const status = getEffectiveShiftStatus(shiftLookup.get(getShiftKey(employee.id, day.date)));
        if (isShiftLikeStatus(status)) {
          assignedShiftCount += 1;
        }
      }
    }

    return {
      staffedDays,
      problemDays,
      assignedShiftCount,
      monthDayCount: currentMonthDays.length,
    };
  }, [monthDays, shiftLookup, visibleEmployees]);

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
    <div className="min-h-full bg-[linear-gradient(180deg,#f7f4ee_0%,#efe9de_100%)]">
      <main className="mx-auto max-w-[1520px] px-2 py-2 sm:px-3 sm:py-2 lg:h-[calc(100svh-8.75rem)] lg:max-h-[calc(100svh-8.75rem)] lg:overflow-hidden">
        <section
          data-testid="experimental-calendar-shell"
          className="flex h-full min-h-0 flex-col overflow-hidden rounded-[24px] border border-stone-300/90 bg-[#fcfbf8] shadow-[0_12px_32px_rgba(28,25,23,0.08)]"
        >
          <div className="shrink-0 border-b border-stone-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8f4eb_100%)] px-2.5 py-2.5 sm:px-3 lg:px-4 lg:py-2.5">
            <div className="flex flex-col gap-2.5">
              <div
                data-testid="calendar-toolbar"
                className="grid gap-2 lg:grid-cols-[auto_minmax(0,1fr)_auto] lg:items-center"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-stone-900 bg-stone-900 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {t('Рабочий календарь', 'Operations calendar')}
                  </span>
                  <span className={cn('rounded-full border px-2.5 py-1 text-[11px] font-semibold', monthMeta.className)}>
                    {t('Месяц', 'Month')}: {monthStatusLabels[selectedMonthStatus]}
                  </span>
                  <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] font-medium text-stone-600">
                    {employeeFilter === 'all'
                      ? t(`Все сотрудники: ${visibleEmployees.length}`, `All employees: ${visibleEmployees.length}`)
                      : visibleEmployees[0]?.name ?? t('Сотрудник', 'Employee')}
                  </span>
                </div>

                <div className="flex min-w-0 flex-wrap items-center justify-start gap-1.5 lg:justify-center">
                  <div className="inline-flex items-center rounded-[16px] border border-stone-300 bg-white p-0.5 shadow-sm">
                    <Button size="icon" variant="ghost" className="size-8 rounded-[12px]" onClick={handlePrevMonth}>
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                    <div className="min-w-[150px] px-2 text-center text-sm font-semibold text-stone-900 sm:min-w-[210px]">
                      {currentMonthLabel}
                    </div>
                    <Button size="icon" variant="ghost" className="size-8 rounded-[12px]" onClick={handleNextMonth}>
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  </div>

                  <Button variant="outline" size="sm" className="h-9 rounded-full border-stone-300 bg-white px-3" onClick={handleToday}>
                    <CalendarDays className="h-4 w-4" />
                    {t('Сегодня', 'Today')}
                  </Button>
                </div>

                <div className="flex min-w-0 flex-wrap items-center justify-start gap-1.5 lg:justify-end">
                  {activeEmployees.length > 1 ? (
                    <Select value={employeeFilter} onValueChange={(value) => setEmployeeFilter(value as 'all' | string)}>
                      <SelectTrigger className="h-9 min-w-[170px] rounded-full border-stone-300 bg-white text-xs sm:text-sm">
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
                    <span className="inline-flex h-9 items-center gap-2 rounded-full border border-stone-200 bg-stone-50 px-3 text-xs font-medium text-stone-700">
                      <UserRound className="h-3.5 w-3.5" />
                      {visibleEmployees[0]?.name ?? t('Мой график', 'My schedule')}
                    </span>
                  ) : null}

                  <Button asChild size="sm" variant="outline" className="h-9 rounded-full border-stone-300 bg-white px-3">
                    <Link to={classicHref}>{t('Старая версия', 'Classic fallback')}</Link>
                  </Button>

                  {isOwner ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      {selectedMonthStatus === 'draft' ? (
                        <Button size="sm" variant="outline" className="h-9 rounded-full px-3" onClick={() => void handleMonthStatusChange('pending_approval')}>
                          {t('На утверждение', 'Send for approval')}
                        </Button>
                      ) : null}
                      {(selectedMonthStatus === 'draft' || selectedMonthStatus === 'pending_approval') ? (
                        <Button size="sm" className="h-9 rounded-full bg-stone-900 px-3 text-white hover:bg-stone-800" onClick={() => void handleMonthStatusChange('approved')}>
                          {t('Утвердить', 'Approve')}
                        </Button>
                      ) : null}
                      {selectedMonthStatus === 'pending_approval' ? (
                        <Button size="sm" variant="ghost" className="h-9 rounded-full px-3" onClick={() => void handleMonthStatusChange('draft')}>
                          {t('В черновик', 'Back to draft')}
                        </Button>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              </div>

              <div
                data-testid="calendar-info-strip"
                className="flex flex-wrap items-center justify-between gap-1.5 rounded-[16px] border border-stone-200 bg-white/85 px-2.5 py-1.5 text-[10px] leading-none text-stone-600"
              >
                <div className="flex flex-wrap items-center gap-1.5">
                  {problemSummary.coverage > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-1 font-semibold text-rose-700">
                      <AlertTriangle className="h-3 w-3" />
                      {t('Нет покрытия', 'No coverage')}: {problemSummary.coverage}
                    </span>
                  ) : null}
                  {problemSummary.conflict > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-800">
                      <CircleAlert className="h-3 w-3" />
                      {t('Конфликты', 'Conflicts')}: {problemSummary.conflict}
                    </span>
                  ) : null}
                  {problemSummary.noShow > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-1 font-semibold text-violet-700">
                      <ShieldAlert className="h-3 w-3" />
                      {t('Невыходы', 'No-shows')}: {problemSummary.noShow}
                    </span>
                  ) : null}
                  {problemSummary.coverage === 0 && problemSummary.conflict === 0 && problemSummary.noShow === 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-700">
                      {t('Месяц выглядит чисто', 'Month looks clean')}
                    </span>
                  ) : null}
                  <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-1 font-medium text-stone-700">
                    {t('Смен', 'Shifts')}: {monthSummary.assignedShiftCount}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-1 font-medium text-stone-700">
                    {t('Покрыто', 'Covered')}: {monthSummary.staffedDays}/{monthSummary.monthDayCount}
                  </span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-stone-100 px-2 py-1 font-medium text-stone-700">
                    {t('Проблемных дней', 'Problem days')}: {monthSummary.problemDays}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5 lg:justify-end">
                  {legendOptions.map((option) => (
                    <div
                      key={option.value}
                      className="inline-flex items-center gap-1 rounded-full border border-stone-200 bg-white px-2 py-1 font-medium text-stone-700"
                    >
                      <span className={cn('h-2 w-2 rounded-full border border-black/10', option.colorClass)} />
                      <span>{option.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col p-1.5 sm:p-2 lg:p-2">
            <div className="grid grid-cols-7 gap-1">
              {CALENDAR_WEEKDAY_LABELS[language].map((label, index) => (
                <div
                  key={label}
                  className={cn(
                    'rounded-[12px] border border-stone-200 bg-stone-100 px-1.5 py-1 text-center text-[9px] font-semibold uppercase tracking-[0.14em] text-stone-500 sm:text-[10px]',
                    index >= 5 ? 'bg-rose-50 text-rose-500' : '',
                  )}
                >
                  {label}
                </div>
              ))}
            </div>

            <div
              data-testid="calendar-grid"
              className="mt-1 grid min-h-0 flex-1 grid-cols-7 gap-1 lg:grid-rows-6"
            >
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
                  : (employeeFilter === 'all' ? 2 : 3);
                const visibleAssignments = assignments.slice(0, rowLimit);
                const hiddenAssignmentsCount = Math.max(0, assignments.length - visibleAssignments.length);

                return (
                  <div
                    key={day.date}
                    data-testid="calendar-day-card"
                    data-day={day.date}
                    className={cn(
                      'relative flex h-full min-h-[96px] flex-col overflow-hidden rounded-[16px] border p-1.5 lg:min-h-0 lg:rounded-[14px]',
                      ISSUE_FRAME_CLASS[day.issues.tone],
                      day.weekend && day.issues.tone === 'neutral' ? 'border-rose-200/80 bg-rose-50/50' : '',
                      day.isToday ? 'ring-2 ring-sky-400/70' : '',
                      !day.isCurrentMonth ? 'opacity-55' : '',
                    )}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0">
                        <div className="flex items-baseline gap-1">
                          <span
                            className={cn(
                              'text-[13px] font-semibold leading-none sm:text-[15px]',
                              day.weekend ? 'text-rose-600' : 'text-stone-900',
                              !day.isCurrentMonth ? 'text-stone-500' : '',
                            )}
                          >
                            {day.dayNumber}
                          </span>
                          {!day.isCurrentMonth ? (
                            <span className="text-[9px] font-medium uppercase tracking-[0.08em] text-stone-500">
                              {MONTH_NAMES[language][day.month - 1].slice(0, 3)}
                            </span>
                          ) : null}
                        </div>
                        <div className="mt-0.5 text-[9px] font-medium leading-none text-stone-500">
                          {getMonthShiftSummaryLabel(day.shiftLikeCount, language)}
                        </div>
                      </div>

                      {day.issues.label ? (
                        <span className={cn(
                          'inline-flex rounded-full px-1.5 py-0.5 text-[8px] font-semibold uppercase tracking-[0.08em]',
                          ISSUE_BADGE_CLASS[day.issues.tone],
                        )}>
                          {day.issues.label}
                        </span>
                      ) : null}
                    </div>

                    <div className="mt-1 grid flex-1 content-start gap-0.5">
                      {visibleAssignments.map((assignment) => {
                        const editorKey = `${day.date}:${assignment.employee.id}`;
                        const rowButton = (
                          <button
                            type="button"
                            disabled={!assignment.editable}
                            className={cn(
                              'grid w-full grid-cols-[minmax(0,1fr)_auto] items-center gap-1 rounded-[10px] border px-1.5 py-1 text-left text-[10px] leading-none transition sm:text-[11px]',
                              assignment.outsideEmployment
                                ? 'border-dashed border-stone-200 bg-stone-50 text-stone-400'
                                : STATUS_SURFACE_CLASS[assignment.status],
                              assignment.editable ? 'hover:brightness-[0.98]' : 'cursor-default',
                            )}
                            title={assignment.outsideEmployment
                              ? t('Сотрудник вне диапазона на эту дату', 'Employee is out of range for this date')
                              : getShiftStatusLabel(assignment.status, language)}
                          >
                            <span className="truncate font-medium leading-4" title={assignment.employee.name}>
                              {getAssignmentName(assignment.employee, isMobile)}
                            </span>
                            <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-1.5 py-0.5 text-[9px] font-semibold text-stone-700">
                              <span className={cn(
                                'h-2 w-2 rounded-full border border-black/10',
                                assignment.outsideEmployment ? 'bg-stone-200' : getStatusDotClass(assignment.status),
                              )} />
                              {assignment.outsideEmployment
                                ? '—'
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
                        <div className="rounded-[10px] border border-dashed border-stone-200 bg-stone-50 px-1.5 py-1 text-[9px] font-medium leading-none text-stone-500">
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
