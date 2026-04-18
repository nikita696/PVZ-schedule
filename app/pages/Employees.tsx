import { useMemo, useState } from 'react';
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
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import { getLocalISODate } from '../lib/date';

const money = (value: number, locale: string) => new Intl.NumberFormat(locale, {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
}).format(value);

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
  const [rateDrafts, setRateDrafts] = useState<Record<string, string>>({});
  const [hireDateDrafts, setHireDateDrafts] = useState<Record<string, string>>({});
  const [savingHireDateId, setSavingHireDateId] = useState<string | null>(null);

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

  const handleRateSave = async (employeeId: string, currentRate: number) => {
    const nextRate = Number(rateDrafts[employeeId] ?? currentRate);
    if (!Number.isFinite(nextRate) || nextRate <= 0) {
      toast.error(t('Укажи корректную ставку.', 'Enter a valid rate.'));
      return;
    }

    if (nextRate === currentRate) {
      return;
    }

    const result = await updateEmployeeRate(employeeId, nextRate);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

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
            <Input type="number" min="1" value={dailyRate} onChange={(event) => setDailyRate(event.target.value)} placeholder={t('Ставка', 'Rate')} />
            <Input type="date" value={hiredAt} onChange={(event) => setHiredAt(event.target.value)} placeholder={t('Дата выхода', 'Hire date')} />
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
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Имя', 'Name')}</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead>{t('Статус', 'Status')}</TableHead>
                  <TableHead>{t('Дата трудоустройства', 'Hire date')}</TableHead>
                  <TableHead>{t('Ставка', 'Rate')}</TableHead>
                  <TableHead>{t('Смен', 'Shifts')}</TableHead>
                  <TableHead>{t('Начислено', 'Accrued')}</TableHead>
                  <TableHead>{t('Выплачено', 'Paid')}</TableHead>
                  <TableHead>{t('Долг', 'Balance')}</TableHead>
                  <TableHead>{t('Потенциал', 'Forecast')}</TableHead>
                  <TableHead>{t('Больничные', 'Sick days')}</TableHead>
                  <TableHead>{t('Выходные', 'Days off')}</TableHead>
                  <TableHead>{t('Действия', 'Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeEmployees.map((employee) => {
                  const stats = getEmployeeStats(employee.id, selectedMonth, selectedYear);
                  const hireDateFallback = employee.hiredAt ?? employee.createdAt.slice(0, 10);
                  const hireDateValue = getHireDateValue(employee.id, hireDateFallback);
                  return (
                    <TableRow key={employee.id}>
                      <TableCell className="font-medium">{employee.name}</TableCell>
                      <TableCell>{employee.workEmail ?? '-'}</TableCell>
                      <TableCell>{getEmployeeStatusLabel(employee.status)}</TableCell>
                      <TableCell className="min-w-[220px]">
                        <div className="flex items-center gap-2">
                          <Input
                            type="date"
                            value={hireDateValue}
                            onChange={(event) => setHireDateDrafts((prev) => ({ ...prev, [employee.id]: event.target.value }))}
                            className="h-8"
                          />
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => void handleHireDateSave(employee.id, hireDateFallback)}
                            disabled={savingHireDateId === employee.id || !hireDateValue || hireDateValue === hireDateFallback}
                          >
                            {savingHireDateId === employee.id ? t('Сохраняю...', 'Saving...') : t('Сохранить', 'Save')}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell className="min-w-[180px]">
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="1"
                            value={rateDrafts[employee.id] ?? String(employee.dailyRate)}
                            onChange={(event) => setRateDrafts((prev) => ({ ...prev, [employee.id]: event.target.value }))}
                            className="h-8"
                          />
                          <Button size="sm" variant="outline" onClick={() => void handleRateSave(employee.id, employee.dailyRate)}>
                            {t('Сохранить', 'Save')}
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>{stats.workedCount}</TableCell>
                      <TableCell>{money(stats.earnedActual, locale)}</TableCell>
                      <TableCell>{money(stats.paidApproved, locale)}</TableCell>
                      <TableCell>{money(stats.dueNow, locale)}</TableCell>
                      <TableCell>{money(stats.forecastTotal, locale)}</TableCell>
                      <TableCell>{stats.sickCount}</TableCell>
                      <TableCell>{stats.dayOffCount}</TableCell>
                      <TableCell className="space-x-2 whitespace-nowrap">
                        <Button size="sm" variant="outline" onClick={() => void handleExport(employee.id)}>
                          Excel
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => void handleArchive(employee.id)}>
                          {t('В архив', 'Archive')}
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
