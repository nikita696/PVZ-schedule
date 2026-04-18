import { Loader2, Save, X } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import { toast } from 'sonner';
import { MonthYearSelector } from '../components/MonthYearSelector';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import { Input } from '../components/ui/input';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { Tooltip, TooltipContent, TooltipTrigger } from '../components/ui/tooltip';
import { cn } from '../components/ui/utils';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { getLocalISODate } from '../lib/date';

const money = (value: number, locale: string) => new Intl.NumberFormat(locale, {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
}).format(value);

const DATE_INPUT_CLASSNAME = 'h-8 min-w-0 pr-2 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-100';

function InlineIconButton({
  label,
  icon,
  disabled = false,
  onClick,
  variant = 'outline',
  className,
}: {
  label: string;
  icon: ReactNode;
  disabled?: boolean;
  onClick: () => void;
  variant?: 'outline' | 'ghost';
  className?: string;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span className="inline-flex shrink-0">
          <Button
            type="button"
            size="icon"
            variant={variant}
            aria-label={label}
            title={label}
            className={className}
            disabled={disabled}
            onClick={onClick}
          >
            {icon}
            <span className="sr-only">{label}</span>
          </Button>
        </span>
      </TooltipTrigger>
      <TooltipContent sideOffset={6}>{label}</TooltipContent>
    </Tooltip>
  );
}

function InlineSaveButton({
  label,
  disabled,
  loading,
  onClick,
}: {
  label: string;
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <InlineIconButton
      label={label}
      disabled={disabled || loading}
      onClick={onClick}
      className={cn(
        'size-8 border-stone-200 text-stone-500',
        !disabled && !loading && 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800',
      )}
      icon={loading ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
    />
  );
}

function InlineCancelButton({
  label,
  onClick,
}: {
  label: string;
  onClick: () => void;
}) {
  return (
    <InlineIconButton
      label={label}
      onClick={onClick}
      className="size-8 border-stone-200 text-stone-500 hover:bg-stone-100 hover:text-stone-800"
      icon={<X className="size-4" />}
    />
  );
}

function StatusTrafficLight({
  status,
  label,
}: {
  status: 'active' | 'archived';
  label: string;
}) {
  const activeLamp: 'red' | 'green' = status === 'archived' ? 'red' : 'green';

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <div
          aria-label={label}
          title={label}
          className="inline-flex h-9 w-6 flex-col items-center justify-center gap-0.5 rounded-full border border-stone-200 bg-stone-100 px-1 py-1 shadow-inner"
        >
          <span className={cn('size-2 rounded-full', activeLamp === 'red' ? 'bg-rose-500 shadow-[0_0_10px_rgba(244,63,94,0.55)]' : 'bg-stone-300')} />
          <span className="size-2 rounded-full bg-stone-300" />
          <span className={cn('size-2 rounded-full', activeLamp === 'green' ? 'bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.55)]' : 'bg-stone-300')} />
          <span className="sr-only">{label}</span>
        </div>
      </TooltipTrigger>
      <TooltipContent sideOffset={6}>{label}</TooltipContent>
    </Tooltip>
  );
}

export default function EmployeesPage() {
  const { locale, t } = useLanguage();
  const {
    employees,
    shifts,
    payments,
    selectedMonth,
    selectedYear,
    setSelectedMonth,
    setSelectedYear,
    addEmployee,
    removeEmployee,
    deleteArchivedEmployee,
    updateEmployeeName,
    updateEmployeeRate,
    updateEmployeeHireDate,
    getEmployeeStats,
    exportEmployeePayslipXlsx,
  } = useApp();

  const [name, setName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [hiredAt, setHiredAt] = useState(getLocalISODate());
  const [dailyRate, setDailyRate] = useState('');
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [editingNameId, setEditingNameId] = useState<string | null>(null);
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [rateDrafts, setRateDrafts] = useState<Record<string, string>>({});
  const [hireDateDrafts, setHireDateDrafts] = useState<Record<string, string>>({});
  const [savingNameId, setSavingNameId] = useState<string | null>(null);
  const [savingHireDateId, setSavingHireDateId] = useState<string | null>(null);
  const [savingRateId, setSavingRateId] = useState<string | null>(null);

  const activeEmployees = useMemo(() => employees.filter((employee) => !employee.archived), [employees]);
  const archivedEmployees = useMemo(() => employees.filter((employee) => employee.archived), [employees]);
  const getEmployeeStatusLabel = (status: 'active' | 'archived') => (
    status === 'archived' ? t('В архиве', 'Archived') : t('Активный', 'Active')
  );

  const handleAddEmployee = async () => {
    const parsedRate = Number(dailyRate);
    if (!name.trim()) {
      toast.error(t('Укажи имя сотрудника.', 'Enter employee name.'));
      return;
    }

    if (!workEmail.trim()) {
      toast.error(t('Укажи рабочий email.', 'Enter work email.'));
      return;
    }

    if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
      toast.error(t('Укажи корректную ставку.', 'Enter a valid rate.'));
      return;
    }

    setSavingEmployee(true);
    const result = await addEmployee({
      name: name.trim(),
      workEmail: workEmail.trim(),
      dailyRate: parsedRate,
      hiredAt: hiredAt || null,
    });
    setSavingEmployee(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setName('');
    setWorkEmail('');
    setDailyRate('');
    setHiredAt(getLocalISODate());
    toast.success(t('Сотрудник добавлен.', 'Employee added.'));
  };

  const handleArchive = async (employeeId: string) => {
    const result = await removeEmployee(employeeId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(t('Сотрудник отправлен в архив.', 'Employee moved to archive.'));
  };

  const handleDeleteArchived = async (employeeId: string, employeeName: string) => {
    const confirmed = window.confirm(t(
      `Удалить архивного сотрудника "${employeeName}"? История может быть потеряна.`,
      `Delete archived employee "${employeeName}"? Historical data may be lost.`,
    ));
    if (!confirmed) return;

    const result = await deleteArchivedEmployee(employeeId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(t('Архивный сотрудник удалён.', 'Archived employee deleted.'));
  };

  const getNameDraftValue = (employeeId: string, fallbackName: string) => (
    nameDrafts[employeeId] ?? fallbackName
  );

  const handleStartNameEdit = (employeeId: string, fallbackName: string) => {
    setEditingNameId(employeeId);
    setNameDrafts((prev) => (
      prev[employeeId] !== undefined ? prev : { ...prev, [employeeId]: fallbackName }
    ));
  };

  const handleCancelNameEdit = (employeeId: string) => {
    setEditingNameId((prev) => (prev === employeeId ? null : prev));
    setNameDrafts((prev) => {
      const next = { ...prev };
      delete next[employeeId];
      return next;
    });
  };

  const handleNameSave = async (employeeId: string, fallbackName: string) => {
    const nextName = getNameDraftValue(employeeId, fallbackName).trim();
    if (!nextName) {
      toast.error(t('Укажи имя сотрудника.', 'Enter employee name.'));
      return;
    }

    if (nextName === fallbackName) {
      handleCancelNameEdit(employeeId);
      return;
    }

    setSavingNameId(employeeId);
    const result = await updateEmployeeName(employeeId, nextName);
    setSavingNameId(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    handleCancelNameEdit(employeeId);
    toast.success(t('Имя сотрудника обновлено.', 'Employee name updated.'));
  };

  const handleRateSave = async (employeeId: string, currentRate: number) => {
    const nextRate = Number(rateDrafts[employeeId] ?? currentRate);
    if (!Number.isFinite(nextRate) || nextRate <= 0) {
      toast.error(t('Укажи корректную ставку.', 'Enter a valid rate.'));
      return;
    }

    if (nextRate === currentRate) {
      return;
    }

    setSavingRateId(employeeId);
    const result = await updateEmployeeRate(employeeId, nextRate);
    setSavingRateId(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setRateDrafts((prev) => {
      const next = { ...prev };
      delete next[employeeId];
      return next;
    });
    toast.success(t('Ставка обновлена.', 'Rate updated.'));
  };

  const handleExport = async (employeeId: string) => {
    const result = await exportEmployeePayslipXlsx(employeeId, selectedMonth, selectedYear);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(t('Расчётный лист выгружен.', 'Payslip exported.'));
  };

  const getHireDateValue = (employeeId: string, fallbackDate: string) => (
    hireDateDrafts[employeeId] ?? fallbackDate
  );

  const handleHireDateSave = async (employeeId: string, fallbackDate: string) => {
    const nextHireDate = getHireDateValue(employeeId, fallbackDate).trim();
    if (!nextHireDate) {
      toast.error(t('Укажи дату трудоустройства.', 'Enter a hire date.'));
      return;
    }

    if (nextHireDate === fallbackDate) {
      return;
    }

    setSavingHireDateId(employeeId);
    const result = await updateEmployeeHireDate(employeeId, nextHireDate);
    setSavingHireDateId(null);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setHireDateDrafts((prev) => {
      const next = { ...prev };
      delete next[employeeId];
      return next;
    });
    toast.success(t('Дата трудоустройства обновлена.', 'Hire date updated.'));
  };

  return (
    <div className="bg-stone-50">
      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
        <Card>
          <CardContent className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
              {activeEmployees.length} {t('активных сотрудников', 'active employees')}
            </div>

            <MonthYearSelector
              month={selectedMonth}
              year={selectedYear}
              onMonthChange={setSelectedMonth}
              onYearChange={setSelectedYear}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('Добавить сотрудника', 'Add employee')}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-3 sm:grid-cols-[1.2fr_1.2fr_0.9fr_0.9fr_auto]">
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder={t('Имя сотрудника', 'Employee name')} />
            <Input type="email" value={workEmail} onChange={(event) => setWorkEmail(event.target.value)} placeholder={t('Рабочий email', 'Work email')} />
            <Input type="number" min="100" step={100} value={dailyRate} onChange={(event) => setDailyRate(event.target.value)} placeholder={t('Ставка', 'Rate')} />
            <Input type="date" value={hiredAt} onChange={(event) => setHiredAt(event.target.value)} placeholder={t('Дата выхода', 'Hire date')} className={DATE_INPUT_CLASSNAME} />
            <Button onClick={() => void handleAddEmployee()} disabled={savingEmployee}>
              {savingEmployee ? t('Сохраняю...', 'Saving...') : t('Добавить', 'Add')}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('Активные сотрудники', 'Active employees')}</CardTitle>
          </CardHeader>
          <CardContent className="overflow-auto">
            <Table className="text-[13px]">
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[160px]">{t('Имя', 'Name')}</TableHead>
                  <TableHead className="w-[176px]">Email</TableHead>
                  <TableHead className="w-[72px] text-center">{t('Статус', 'Status')}</TableHead>
                  <TableHead className="w-[180px] whitespace-normal leading-4">{t('Дата трудоустройства', 'Hire date')}</TableHead>
                  <TableHead className="w-[132px]">{t('Ставка', 'Rate')}</TableHead>
                  <TableHead className="w-[56px] text-center">{t('Смен', 'Shifts')}</TableHead>
                  <TableHead className="w-[88px] text-right" title={t('Начислено', 'Accrued')}>{t('Начисл.', 'Accrued')}</TableHead>
                  <TableHead className="w-[88px] text-right" title={t('Выплачено', 'Paid')}>{t('Выплач.', 'Paid')}</TableHead>
                  <TableHead className="w-[78px] text-right">{t('Долг', 'Balance')}</TableHead>
                  <TableHead className="w-[90px] text-right" title={t('Потенциал', 'Forecast')}>{t('Потенц.', 'Forecast')}</TableHead>
                  <TableHead className="w-[64px] text-center" title={t('Больничные', 'Sick days')}>{t('Больн.', 'Sick')}</TableHead>
                  <TableHead className="w-[66px] text-center" title={t('Выходные', 'Days off')}>{t('Вых.', 'Days off')}</TableHead>
                  <TableHead>{t('Экспорт', 'Export')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeEmployees.map((employee) => {
                  const stats = getEmployeeStats(employee.id, selectedMonth, selectedYear);
                  const hireDateFallback = employee.hiredAt ?? employee.createdAt.slice(0, 10);
                  const hireDateValue = getHireDateValue(employee.id, hireDateFallback);
                  const nameValue = getNameDraftValue(employee.id, employee.name);
                  const statusLabel = getEmployeeStatusLabel(employee.status);
                  const rateValue = rateDrafts[employee.id] ?? String(employee.dailyRate);
                  const parsedRate = Number(rateValue);
                  const canSaveRate = Number.isFinite(parsedRate) && parsedRate > 0 && parsedRate !== employee.dailyRate;
                  const canSaveHireDate = Boolean(hireDateValue) && hireDateValue !== hireDateFallback;
                  const canSaveName = Boolean(nameValue.trim()) && nameValue.trim() !== employee.name;
                  const isEditingName = editingNameId === employee.id;

                  return (
                    <TableRow key={employee.id}>
                      <TableCell className="max-w-[160px]">
                        {isEditingName ? (
                          <div className="flex items-center gap-2">
                            <Input
                              value={nameValue}
                              onChange={(event) => setNameDrafts((prev) => ({ ...prev, [employee.id]: event.target.value }))}
                              className="h-8 w-[118px] min-w-0"
                              autoFocus
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault();
                                  void handleNameSave(employee.id, employee.name);
                                }
                                if (event.key === 'Escape') {
                                  event.preventDefault();
                                  handleCancelNameEdit(employee.id);
                                }
                              }}
                            />
                            <InlineSaveButton
                              label={t('Сохранить имя сотрудника', 'Save employee name')}
                              disabled={!canSaveName}
                              loading={savingNameId === employee.id}
                              onClick={() => void handleNameSave(employee.id, employee.name)}
                            />
                            <InlineCancelButton
                              label={t('Отменить редактирование имени', 'Cancel employee name editing')}
                              onClick={() => handleCancelNameEdit(employee.id)}
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleStartNameEdit(employee.id, employee.name)}
                            className="max-w-full truncate text-left font-medium text-stone-900 transition hover:text-stone-600 hover:underline"
                            title={t('Нажми, чтобы изменить имя сотрудника', 'Click to rename employee')}
                          >
                            {employee.name}
                          </button>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[176px] truncate text-stone-600" title={employee.workEmail ?? undefined}>{employee.workEmail ?? '-'}</TableCell>
                      <TableCell className="text-center">
                        <StatusTrafficLight status={employee.status} label={statusLabel} />
                      </TableCell>
                      <TableCell className="min-w-[180px]">
                        <div className="flex items-center gap-2">
                          <Input
                            type="date"
                            value={hireDateValue}
                            onChange={(event) => setHireDateDrafts((prev) => ({ ...prev, [employee.id]: event.target.value }))}
                            className={cn(DATE_INPUT_CLASSNAME, 'w-[138px]')}
                          />
                          <InlineSaveButton
                            label={t('Сохранить дату трудоустройства', 'Save hire date')}
                            disabled={!canSaveHireDate}
                            loading={savingHireDateId === employee.id}
                            onClick={() => void handleHireDateSave(employee.id, hireDateFallback)}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[132px]">
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="100"
                            step={100}
                            value={rateValue}
                            onChange={(event) => setRateDrafts((prev) => ({ ...prev, [employee.id]: event.target.value }))}
                            className="h-8 w-[86px] min-w-0 text-right font-medium tabular-nums"
                          />
                          <InlineSaveButton
                            label={t('Сохранить ставку', 'Save rate')}
                            disabled={!canSaveRate}
                            loading={savingRateId === employee.id}
                            onClick={() => void handleRateSave(employee.id, employee.dailyRate)}
                          />
                        </div>
                      </TableCell>
                      <TableCell className="text-center font-medium tabular-nums">{stats.workedCount}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(stats.earnedActual, locale)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(stats.paidApproved, locale)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(stats.dueNow, locale)}</TableCell>
                      <TableCell className="text-right tabular-nums">{money(stats.forecastTotal, locale)}</TableCell>
                      <TableCell className="text-center font-medium tabular-nums">{stats.sickCount}</TableCell>
                      <TableCell className="text-center font-medium tabular-nums">{stats.dayOffCount}</TableCell>
                      <TableCell className="space-x-1.5 whitespace-nowrap">
                        <Button size="sm" variant="outline" onClick={() => void handleExport(employee.id)}>
                          Excel
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void handleArchive(employee.id)}>
                          {t('Архив', 'Archive')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {archivedEmployees.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>{t('Архив сотрудников', 'Archived employees')}</CardTitle>
            </CardHeader>
            <CardContent className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t('Имя', 'Name')}</TableHead>
                    <TableHead>{t('Дата архивации', 'Archived at')}</TableHead>
                    <TableHead>{t('Смен', 'Shifts')}</TableHead>
                    <TableHead>{t('Выплат', 'Payments')}</TableHead>
                    <TableHead>{t('Действие', 'Action')}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {archivedEmployees.map((employee) => (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">{employee.name}</TableCell>
                      <TableCell>{employee.archivedAt ? employee.archivedAt.slice(0, 10) : '-'}</TableCell>
                      <TableCell>{shifts.filter((shift) => shift.employeeId === employee.id).length}</TableCell>
                      <TableCell>{payments.filter((payment) => payment.employeeId === employee.id).length}</TableCell>
                      <TableCell>
                        <Button size="sm" variant="destructive" onClick={() => void handleDeleteArchived(employee.id, employee.name)}>
                          {t('Удалить', 'Delete')}
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        ) : null}
      </main>
    </div>
  );
}
