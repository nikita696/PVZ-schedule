import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { toast } from 'sonner';
import { BottomNav } from '../components/BottomNav';
import { MonthYearSelector } from '../components/MonthYearSelector';
import type { EmployeeStats, Payment } from '../domain/types';
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
import { getLocalISODate } from '../lib/date';

const money = (value: number) => new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
}).format(value);

const getMonthYear = (date: string) => {
  const [year, month] = date.split('-').map(Number);
  return { year, month };
};

const isInMonth = (date: string, month: number, year: number) => {
  const parsed = getMonthYear(date);
  return parsed.month === month && parsed.year === year;
};

export default function DashboardPage() {
  const navigate = useNavigate();
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
    getEmployeeStats,
    exportEmployeePayslipXlsx,
    isOwner,
    myEmployeeId,
  } = useApp();

  const [name, setName] = useState('');
  const [workEmail, setWorkEmail] = useState('');
  const [hiredAt, setHiredAt] = useState(getLocalISODate());
  const [dailyRate, setDailyRate] = useState('');
  const [savingEmployee, setSavingEmployee] = useState(false);
  const [rateDrafts, setRateDrafts] = useState<Record<string, string>>({});
  const [exportEmployeeId, setExportEmployeeId] = useState('');

  const activeEmployees = useMemo(() => employees.filter((employee) => !employee.archived), [employees]);
  const archivedEmployees = useMemo(() => employees.filter((employee) => employee.archived), [employees]);

  const monthStats = useMemo(() => {
    const byEmployee = new Map<string, ReturnType<typeof getEmployeeStats>>();
    let earnedActual = 0;
    let paidConfirmed = 0;
    let dueNow = 0;
    let forecastTotal = 0;

    for (const employee of activeEmployees) {
      const stats = getEmployeeStats(employee.id, selectedMonth, selectedYear);
      byEmployee.set(employee.id, stats);
      earnedActual += stats.earnedActual;
      paidConfirmed += stats.paidConfirmed;
      dueNow += stats.dueNow;
      forecastTotal += stats.forecastTotal;
    }

    return {
      byEmployee,
      earnedActual,
      paidConfirmed,
      dueNow,
      forecastTotal,
    };
  }, [activeEmployees, getEmployeeStats, selectedMonth, selectedYear]);

  const pendingPaymentsCount = useMemo(() => (
    payments.filter((payment) => (
      payment.status === 'pending_confirmation' && isInMonth(payment.date, selectedMonth, selectedYear)
    )).length
  ), [payments, selectedMonth, selectedYear]);

  const todayInfo = useMemo(() => {
    const today = getLocalISODate();
    const todayShifts = shifts.filter((shift) => shift.date === today);

    const planned = todayShifts.filter((shift) => (
      shift.status === 'planned-work' || shift.status === 'worked'
    ));
    const sick = todayShifts.filter((shift) => shift.status === 'sick');
    const vacation = todayShifts.filter((shift) => shift.status === 'vacation');

    return {
      planned: planned.map((shift) => employees.find((employee) => employee.id === shift.employeeId)?.name ?? 'Сотрудник'),
      sick: sick.map((shift) => employees.find((employee) => employee.id === shift.employeeId)?.name ?? 'Сотрудник'),
      vacation: vacation.map((shift) => employees.find((employee) => employee.id === shift.employeeId)?.name ?? 'Сотрудник'),
      issue: planned.length !== 1,
    };
  }, [employees, shifts]);

  const calendarPath = isOwner ? '/admin/calendar' : '/employee/calendar';
  const paymentsPath = isOwner ? '/admin/payments' : '/employee/payments';

  const handleAddEmployee = async () => {
    const parsedRate = Number(dailyRate);
    if (!name.trim()) {
      toast.error('Введите имя сотрудника.');
      return;
    }

    if (!workEmail.trim()) {
      toast.error('Введите рабочий email сотрудника.');
      return;
    }

    if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
      toast.error('Введите корректную ставку за смену.');
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
    toast.success(result.message ?? 'Сотрудник добавлен.');
  };

  const handleArchive = async (employeeId: string) => {
    const result = await removeEmployee(employeeId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? 'Сотрудник отправлен в архив.');
  };

  const handleDeleteArchived = async (employeeId: string, employeeName: string) => {
    const confirmed = window.confirm(`Удалить архивного сотрудника "${employeeName}" и все его данные? Это действие нельзя отменить.`);
    if (!confirmed) return;

    const result = await deleteArchivedEmployee(employeeId);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? 'Архивный сотрудник удален.');
  };

  const handleRateSave = async (employeeId: string, currentRate: number) => {
    const nextRate = Number(rateDrafts[employeeId] ?? currentRate);
    if (!Number.isFinite(nextRate) || nextRate <= 0) {
      toast.error('Введите корректную ставку.');
      return;
    }

    if (nextRate === currentRate) return;
    const result = await updateEmployeeRate(employeeId, nextRate);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? 'Ставка обновлена.');
  };

  const handleExport = async (employeeId: string) => {
    const result = await exportEmployeePayslipXlsx(employeeId, selectedMonth, selectedYear);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? 'Расчетный лист выгружен.');
  };

  const handleToday = () => {
    const now = new Date();
    setSelectedMonth(now.getMonth() + 1);
    setSelectedYear(now.getFullYear());
  };

  const myEmployee = myEmployeeId ? employees.find((employee) => employee.id === myEmployeeId) ?? null : null;

  return (
    <div className="min-h-screen bg-stone-50">
      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
        <Card className="border-orange-100 bg-[radial-gradient(circle_at_top_left,#fff7ed,white_55%)]">
          <CardContent className="flex flex-col gap-4 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="w-fit rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                  {isOwner ? 'Панель администратора' : 'Личный кабинет сотрудника'}
                </div>
                <h1 className="mt-2 text-2xl font-semibold text-stone-900">
                  {isOwner ? 'Управление ПВЗ: график, сотрудники и выплаты' : 'Мой график, расчет и выплаты'}
                </h1>
              </div>

              <MonthYearSelector
                month={selectedMonth}
                year={selectedYear}
                onMonthChange={setSelectedMonth}
                onYearChange={setSelectedYear}
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={handleToday}>Сегодня</Button>
              <Button variant="outline" onClick={() => navigate(calendarPath)}>Календарь</Button>
              <Button variant="outline" onClick={() => navigate(paymentsPath)}>Выплаты</Button>
              {isOwner ? (
                <Button variant="outline" onClick={() => document.getElementById('employees-block')?.scrollIntoView({ behavior: 'smooth' })}>
                  Сотрудники
                </Button>
              ) : null}
              {isOwner ? (
                <div className="flex items-center gap-2">
                  <select
                    className="h-9 rounded-md border bg-white px-2 text-sm"
                    value={exportEmployeeId}
                    onChange={(event) => setExportEmployeeId(event.target.value)}
                  >
                    <option value="">Выбрать сотрудника</option>
                    {activeEmployees.map((employee) => (
                      <option key={employee.id} value={employee.id}>{employee.name}</option>
                    ))}
                  </select>
                  <Button
                    onClick={() => {
                      if (exportEmployeeId) {
                        void handleExport(exportEmployeeId);
                      }
                    }}
                    disabled={!exportEmployeeId}
                  >
                    Выгрузить Excel
                  </Button>
                </div>
              ) : myEmployee ? (
                <Button onClick={() => void handleExport(myEmployee.id)}>Выгрузить мой расчетный лист</Button>
              ) : null}
            </div>
          </CardContent>
        </Card>

        {isOwner ? (
          <>
            <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard label="Начислено за месяц" value={money(monthStats.earnedActual)} />
              <StatCard label="Выплачено за месяц" value={money(monthStats.paidConfirmed)} />
              <StatCard label="К выплате сейчас" value={money(monthStats.dueNow)} />
              <StatCard label="Ожидают подтверждения" value={String(pendingPaymentsCount)} />
            </section>

            <section className="grid gap-4 lg:grid-cols-[1.1fr_1.9fr]">
              <Card>
                <CardHeader>
                  <CardTitle>Сегодня</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <InfoLine label="Запланированы" value={todayInfo.planned.join(', ') || 'Никого'} />
                  <InfoLine label="Больничный" value={todayInfo.sick.join(', ') || 'Нет'} />
                  <InfoLine label="Отпуск" value={todayInfo.vacation.join(', ') || 'Нет'} />
                  <InfoLine label="Статус дня" value={todayInfo.issue ? 'Проблема: не 1 сотрудник' : 'День закрыт'} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Добавить сотрудника</CardTitle>
                </CardHeader>
                <CardContent className="grid gap-3 sm:grid-cols-[1.2fr_1.2fr_0.9fr_0.9fr_auto]">
                  <Input
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Имя сотрудника"
                  />
                  <Input
                    type="email"
                    value={workEmail}
                    onChange={(event) => setWorkEmail(event.target.value)}
                    placeholder="Рабочий email"
                  />
                  <Input
                    type="number"
                    min="1"
                    value={dailyRate}
                    onChange={(event) => setDailyRate(event.target.value)}
                    placeholder="Ставка"
                  />
                  <Input
                    type="date"
                    value={hiredAt}
                    onChange={(event) => setHiredAt(event.target.value)}
                    placeholder="Дата найма"
                  />
                  <Button onClick={() => void handleAddEmployee()} disabled={savingEmployee}>
                    {savingEmployee ? 'Сохранение...' : 'Добавить'}
                  </Button>
                </CardContent>
              </Card>
            </section>

            <Card id="employees-block">
              <CardHeader>
                <CardTitle>Сотрудники</CardTitle>
              </CardHeader>
              <CardContent className="overflow-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Имя</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Статус</TableHead>
                      <TableHead>Ставка</TableHead>
                      <TableHead>Отработано</TableHead>
                      <TableHead>Заработано</TableHead>
                      <TableHead>Выплачено</TableHead>
                      <TableHead>К выплате</TableHead>
                      <TableHead>Прогноз</TableHead>
                      <TableHead>Больничных</TableHead>
                      <TableHead>Отпуск</TableHead>
                      <TableHead>Действия</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {activeEmployees.map((employee) => {
                      const stats = monthStats.byEmployee.get(employee.id) ?? getEmployeeStats(employee.id, selectedMonth, selectedYear);
                      return (
                        <TableRow key={employee.id}>
                          <TableCell className="font-medium">{employee.name}</TableCell>
                          <TableCell>{employee.workEmail ?? '-'}</TableCell>
                          <TableCell>{employee.status}</TableCell>
                          <TableCell className="min-w-[180px]">
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min="1"
                                value={rateDrafts[employee.id] ?? String(employee.dailyRate)}
                                onChange={(event) => setRateDrafts((prev) => ({ ...prev, [employee.id]: event.target.value }))}
                                className="h-8"
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => void handleRateSave(employee.id, employee.dailyRate)}
                              >
                                Сохранить
                              </Button>
                            </div>
                          </TableCell>
                          <TableCell>{stats.workedCount}</TableCell>
                          <TableCell>{money(stats.earnedActual)}</TableCell>
                          <TableCell>{money(stats.paidConfirmed)}</TableCell>
                          <TableCell>{money(stats.dueNow)}</TableCell>
                          <TableCell>{money(stats.forecastTotal)}</TableCell>
                          <TableCell>{stats.sickCount}</TableCell>
                          <TableCell>{stats.vacationCount}</TableCell>
                          <TableCell className="space-x-2">
                            <Button size="sm" variant="outline" onClick={() => void handleExport(employee.id)}>
                              Excel
                            </Button>
                            <Button size="sm" variant="outline" onClick={() => void handleArchive(employee.id)}>
                              Архив
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
                  <CardTitle>Архив сотрудников</CardTitle>
                </CardHeader>
                <CardContent className="overflow-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Имя</TableHead>
                        <TableHead>В архиве с</TableHead>
                        <TableHead>Смен</TableHead>
                        <TableHead>Выплат</TableHead>
                        <TableHead>Действия</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {archivedEmployees.map((employee) => (
                        <TableRow key={employee.id}>
                          <TableCell className="font-medium">{employee.name}</TableCell>
                          <TableCell>{employee.archivedAt ? employee.archivedAt.slice(0, 10) : '—'}</TableCell>
                          <TableCell>{shifts.filter((shift) => shift.employeeId === employee.id).length}</TableCell>
                          <TableCell>{payments.filter((payment) => payment.employeeId === employee.id).length}</TableCell>
                          <TableCell>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => void handleDeleteArchived(employee.id, employee.name)}
                            >
                              Удалить навсегда
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            ) : null}
          </>
        ) : (
          <EmployeeDashboard
            employee={myEmployee}
            stats={myEmployee ? getEmployeeStats(myEmployee.id, selectedMonth, selectedYear) : null}
            payments={myEmployee ? payments.filter((payment) => payment.employeeId === myEmployee.id) : []}
            onExport={() => {
              if (myEmployee) {
                void handleExport(myEmployee.id);
              }
            }}
            onOpenCalendar={() => navigate(calendarPath)}
            onOpenPayments={() => navigate(paymentsPath)}
          />
        )}
      </main>

      <BottomNav />
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-2 text-2xl font-semibold">{value}</div>
      </CardContent>
    </Card>
  );
}

function InfoLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium text-stone-900">{value}</span>
    </div>
  );
}

function EmployeeDashboard({
  employee,
  stats,
  payments,
  onExport,
  onOpenCalendar,
  onOpenPayments,
}: {
  employee: { name: string } | null;
  stats: EmployeeStats | null;
  payments: Payment[];
  onExport: () => void;
  onOpenCalendar: () => void;
  onOpenPayments: () => void;
}) {
  if (!employee || !stats) {
    return (
      <Card>
        <CardContent className="p-5 text-sm text-muted-foreground">
          Профиль сотрудника пока не привязан к вашему аккаунту. Попроси администратора проверить привязку в базе.
        </CardContent>
      </Card>
    );
  }

  const pendingCount = payments.filter((payment) => payment.status === 'pending_confirmation').length;

  return (
    <>
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Отработано смен" value={String(stats.workedCount)} />
        <StatCard label="Заработано (факт)" value={money(stats.earnedActual)} />
        <StatCard label="Выплачено" value={money(stats.paidConfirmed)} />
        <StatCard label="К выплате" value={money(stats.dueNow)} />
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard label="Прогноз по графику" value={money(stats.forecastTotal)} />
        <StatCard label="Больничных в месяце" value={String(stats.sickCount)} />
        <StatCard label="Отпускных дней" value={String(stats.vacationCount)} />
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{employee.name}</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={onOpenCalendar}>Мой календарь</Button>
          <Button variant="outline" onClick={onOpenPayments}>Мои выплаты</Button>
          <Button onClick={onExport}>Выгрузить мой расчетный лист</Button>
          <div className="ml-auto text-sm text-muted-foreground">
            Выплат ждут подтверждения: {pendingCount}
          </div>
        </CardContent>
      </Card>
    </>
  );
}
