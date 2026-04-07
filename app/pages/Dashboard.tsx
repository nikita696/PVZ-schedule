import { Download, RefreshCcw, Upload } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { BottomNav } from '../components/BottomNav';
import { EmployeeCard } from '../components/EmployeeCard';
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
import { useAuth } from '../context/AuthContext';
import { useApp } from '../context/AppContext';

const money = (value: number) => new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
}).format(value);

const monthLabel = (month: number) => new Date(2026, month - 1, 1).toLocaleString('ru-RU', {
  month: 'short',
});

export default function DashboardPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const { user } = useAuth();
  const {
    employees,
    selectedMonth,
    selectedYear,
    status,
    error,
    setSelectedMonth,
    setSelectedYear,
    refreshData,
    addEmployee,
    removeEmployee,
    updateEmployeeRate,
    getEmployeeStats,
    getEmployeeLifetimeStats,
    getEmployeeMonthlyBreakdown,
    getCompanyMonthlyBreakdown,
    exportBackup,
    importAppState,
  } = useApp();

  const [name, setName] = useState('');
  const [dailyRate, setDailyRate] = useState('');
  const [savingEmployee, setSavingEmployee] = useState(false);

  const activeEmployees = employees.filter((employee) => !employee.archived);
  const archivedEmployees = employees.filter((employee) => employee.archived);

  const monthlyTotals = useMemo(() => activeEmployees.reduce((acc, employee) => {
    const stats = getEmployeeStats(employee.id, selectedMonth, selectedYear);
    acc.earned += stats.earned;
    acc.paid += stats.paid;
    acc.due += stats.due;
    return acc;
  }, { earned: 0, paid: 0, due: 0 }), [activeEmployees, getEmployeeStats, selectedMonth, selectedYear]);

  const handleAddEmployee = async () => {
    const parsedRate = Number(dailyRate);
    if (!name.trim()) {
      toast.error('Введите имя сотрудника.');
      return;
    }

    if (!Number.isFinite(parsedRate) || parsedRate <= 0) {
      toast.error('Введите корректную ставку за смену.');
      return;
    }

    setSavingEmployee(true);
    const result = await addEmployee(name.trim(), parsedRate);
    setSavingEmployee(false);

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setName('');
    setDailyRate('');
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

  const handleRateSave = async (employeeId: string, nextRate: number) => {
    const result = await updateEmployeeRate(employeeId, nextRate);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? 'Ставка обновлена.');
  };

  const handleRefresh = async () => {
    const result = await refreshData();
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success('Данные обновлены.');
  };

  const handleExport = () => {
    const payload = exportBackup();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `pvz-schedule-${selectedYear}-${String(selectedMonth).padStart(2, '0')}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Резервная копия экспортирована.');
  };

  const handleImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      const raw = await file.text();
      const result = await importAppState(JSON.parse(raw));
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(result.message ?? 'Резервная копия импортирована.');
    } catch {
      toast.error('Не удалось прочитать файл резервной копии.');
    }
  };

  const companyBreakdown = getCompanyMonthlyBreakdown(selectedYear);

  return (
    <div className="min-h-screen bg-stone-50">
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
        <section className="grid gap-6 lg:grid-cols-[1.3fr_0.9fr]">
          <Card className="border-orange-100 bg-[radial-gradient(circle_at_top_left,#fff7ed,white_55%)]">
            <CardContent className="flex flex-col gap-6 p-6 sm:p-8">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="space-y-3">
                  <div className="w-fit rounded-full bg-orange-100 px-4 py-1.5 text-sm font-semibold text-orange-700">
                    Панель управления
                  </div>
                  <div>
                    <h1 className="text-3xl font-semibold tracking-tight text-stone-900">
                      Смены, выплаты и контроль персонала
                    </h1>
                    <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                      Вы вошли как {user?.email ?? 'неизвестный пользователь'}. Здесь можно вести
                      помесячный учет, менять ставки, архивировать сотрудников и делать резервные копии.
                    </p>
                  </div>
                </div>

                <MonthYearSelector
                  month={selectedMonth}
                  year={selectedYear}
                  onMonthChange={setSelectedMonth}
                  onYearChange={setSelectedYear}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5">
                  <div className="text-xs uppercase tracking-wide text-emerald-700">Начислено</div>
                  <div className="mt-2 text-3xl font-semibold">{money(monthlyTotals.earned)}</div>
                </div>
                <div className="rounded-3xl border border-sky-200 bg-sky-50 p-5">
                  <div className="text-xs uppercase tracking-wide text-sky-700">Выплачено</div>
                  <div className="mt-2 text-3xl font-semibold">{money(monthlyTotals.paid)}</div>
                </div>
                <div className="rounded-3xl border border-orange-200 bg-orange-50 p-5">
                  <div className="text-xs uppercase tracking-wide text-orange-700">К выплате</div>
                  <div className="mt-2 text-3xl font-semibold">{money(monthlyTotals.due)}</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Управление</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2">
                <label htmlFor="employee-name" className="text-sm font-medium">Имя сотрудника</label>
                <Input
                  id="employee-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Иван Петров"
                />
              </div>
              <div className="grid gap-2">
                <label htmlFor="employee-rate" className="text-sm font-medium">Ставка за смену</label>
                <Input
                  id="employee-rate"
                  type="number"
                  min="1"
                  value={dailyRate}
                  onChange={(event) => setDailyRate(event.target.value)}
                  placeholder="2500"
                />
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button onClick={() => void handleAddEmployee()} disabled={savingEmployee}>
                  {savingEmployee ? 'Сохранение...' : 'Добавить сотрудника'}
                </Button>
                <Button variant="outline" onClick={() => void handleRefresh()}>
                  <RefreshCcw className="h-4 w-4" />
                  Обновить
                </Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <Button variant="outline" onClick={handleExport}>
                  <Download className="h-4 w-4" />
                  Экспорт
                </Button>
                <Button variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <Upload className="h-4 w-4" />
                  Импорт
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/json"
                  className="hidden"
                  onChange={(event) => void handleImportFile(event)}
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Статус: {status}{error ? ` | ${error}` : ''}
              </p>
            </CardContent>
          </Card>
        </section>

        <section className="grid gap-4">
          {activeEmployees.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-sm text-muted-foreground">
                Пока нет активных сотрудников. Добавьте первого сотрудника, чтобы начать учет.
              </CardContent>
            </Card>
          ) : (
            activeEmployees.map((employee) => (
              <EmployeeCard
                key={employee.id}
                employee={employee}
                monthlyStats={getEmployeeStats(employee.id, selectedMonth, selectedYear)}
                lifetimeStats={getEmployeeLifetimeStats(employee.id)}
                onArchive={handleArchive}
                onRateSave={handleRateSave}
              />
            ))
          )}
        </section>

        <section className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Общий баланс компании по месяцам</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Месяц</TableHead>
                    <TableHead>Смены</TableHead>
                    <TableHead>Начислено</TableHead>
                    <TableHead>Выплачено</TableHead>
                    <TableHead>Баланс на конец</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {companyBreakdown.map((row) => (
                    <TableRow key={row.month}>
                      <TableCell>{monthLabel(row.month)}</TableCell>
                      <TableCell>{row.shiftsWorked}</TableCell>
                      <TableCell>{money(row.accrued)}</TableCell>
                      <TableCell>{money(row.paid)}</TableCell>
                      <TableCell>{money(row.balanceEnd)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Помесячная детализация по сотрудникам</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              {activeEmployees.slice(0, 2).map((employee) => (
                <div key={employee.id} className="rounded-2xl border p-4">
                  <div className="mb-3 text-sm font-semibold text-stone-900">{employee.name}</div>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Месяц</TableHead>
                        <TableHead>Начислено</TableHead>
                        <TableHead>Выплачено</TableHead>
                        <TableHead>Баланс на конец</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getEmployeeMonthlyBreakdown(employee.id, selectedYear).map((row) => (
                        <TableRow key={`${employee.id}-${row.month}`}>
                          <TableCell>{monthLabel(row.month)}</TableCell>
                          <TableCell>{money(row.accrued)}</TableCell>
                          <TableCell>{money(row.paid)}</TableCell>
                          <TableCell>{money(row.balanceEnd)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}

              {activeEmployees.length === 0 ? (
                <p className="text-sm text-muted-foreground">Пока нет сотрудников для отображения.</p>
              ) : null}
            </CardContent>
          </Card>
        </section>

        {archivedEmployees.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>Архив сотрудников</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-3">
              {archivedEmployees.map((employee) => (
                <div key={employee.id} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                  <div className="font-medium text-stone-900">{employee.name}</div>
                  <div className="text-sm text-muted-foreground">
                    Общий баланс: {money(getEmployeeLifetimeStats(employee.id).due)}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : null}
      </main>

      <BottomNav />
    </div>
  );
}
