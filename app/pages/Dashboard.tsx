import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { EmployeeCard } from '../components/EmployeeCard';
import { MonthYearSelector } from '../components/MonthYearSelector';
import { AddPaymentModal } from '../components/AddPaymentModal';
import { useNavigate } from 'react-router';
import { AlertCircle } from 'lucide-react';

export function Dashboard() {
  const {
    employees,
    selectedMonth,
    selectedYear,
    getEmployeeStats,
    getEmployeeLifetimeStats,
    getEmployeeMonthlyBreakdown,
    getCompanyMonthlyBreakdown,
    addEmployee,
    removeEmployee,
    updateEmployeeRate,
    syncStatus,
    syncError,
  } = useApp();

  const navigate = useNavigate();
  const activeEmployees = employees.filter((e) => !e.archived);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | undefined>();
  const [newEmployeeName, setNewEmployeeName] = useState('');
  const [newEmployeeRate, setNewEmployeeRate] = useState('2500');
  const [selectedStatsEmployeeId, setSelectedStatsEmployeeId] = useState<string>('company');

  const monthNames = ['Янв', 'Фев', 'Мар', 'Апр', 'Май', 'Июн', 'Июл', 'Авг', 'Сен', 'Окт', 'Ноя', 'Дек'];

  const handleAddPayment = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    setIsPaymentModalOpen(true);
  };

  const handleViewHistory = (employeeId: string) => {
    navigate(`/payments?employee=${employeeId}`);
  };

  const handleAddEmployee = () => {
    const name = newEmployeeName.trim();
    const rate = Number(newEmployeeRate);
    if (!name || Number.isNaN(rate) || rate < 0) return;

    addEmployee(name, rate);
    setNewEmployeeName('');
  };

  const totalDueMonth = activeEmployees.reduce((sum, emp) => {
    const stats = getEmployeeStats(emp.id, selectedMonth, selectedYear);
    return sum + stats.due;
  }, 0);

  const totalDueAllTime = employees.reduce((sum, emp) => {
    const stats = getEmployeeLifetimeStats(emp.id);
    return sum + stats.due;
  }, 0);

  const statsRows = selectedStatsEmployeeId === 'company'
    ? getCompanyMonthlyBreakdown(selectedYear)
    : getEmployeeMonthlyBreakdown(selectedStatsEmployeeId, selectedYear);

  const monthEmployeeRows = activeEmployees.map((employee) => {
    const stats = getEmployeeStats(employee.id, selectedMonth, selectedYear);
    return { employee, stats };
  });

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="text-xl font-semibold text-neutral-900 mb-3">ПВЗ: смены и выплаты</h1>
          <MonthYearSelector />

          <div className="mt-3 flex gap-2">
            <input
              value={newEmployeeName}
              onChange={(e) => setNewEmployeeName(e.target.value)}
              placeholder="Имя сотрудника"
              className="flex-1 h-9 px-3 rounded-md border border-neutral-300 text-sm"
            />
            <input
              type="number"
              min={0}
              step={100}
              value={newEmployeeRate}
              onChange={(e) => setNewEmployeeRate(e.target.value)}
              className="w-24 h-9 px-2 rounded-md border border-neutral-300 text-sm"
            />
            <button
              onClick={handleAddEmployee}
              className="h-9 px-3 rounded-md bg-orange-600 text-white text-sm"
            >
              +
            </button>
          </div>

          <div className="mt-2 text-[11px] text-neutral-500">
            Синхронизация: {syncStatus === 'synced' ? 'облако ✓' : syncStatus === 'syncing' ? 'сохранение…' : syncStatus === 'error' ? 'ошибка' : 'локально'}
          </div>
          {syncError && <div className="text-[11px] text-red-600 mt-1">{syncError}</div>}
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-4 space-y-4">
        {(totalDueMonth > 0 || totalDueAllTime > 0) && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-orange-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-orange-900">К выплате за месяц: {totalDueMonth.toLocaleString()} ₽</p>
              <p className="text-sm font-medium text-orange-900">К выплате всего: {totalDueAllTime.toLocaleString()} ₽</p>
            </div>
          </div>
        )}

        {activeEmployees.map((employee) => {
          const stats = getEmployeeStats(employee.id, selectedMonth, selectedYear);
          return (
            <EmployeeCard
              key={employee.id}
              employee={employee}
              stats={stats}
              onAddPayment={() => handleAddPayment(employee.id)}
              onViewHistory={() => handleViewHistory(employee.id)}
              onRateChange={(rate) => updateEmployeeRate(employee.id, rate)}
              onRemove={() => removeEmployee(employee.id)}
            />
          );
        })}

        <div className="bg-white rounded-lg border border-neutral-200 p-3">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold text-neutral-900">Сводка за месяц</h2>
            <span className="text-xs text-neutral-500">{monthNames[selectedMonth - 1]} {selectedYear}</span>
          </div>
          <div className="space-y-2">
            {monthEmployeeRows.map(({ employee, stats }) => (
              <div key={employee.id} className="text-sm border border-neutral-100 rounded-md p-2">
                <div className="font-medium text-neutral-900">{employee.name}</div>
                <div className="text-xs text-neutral-600 mt-1">
                  Начислено: {stats.earned.toLocaleString()} ₽ · Выплачено: {stats.paid.toLocaleString()} ₽ · К выплате: {stats.due.toLocaleString()} ₽
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-neutral-200 p-3">
          <div className="flex items-center justify-between gap-2 mb-3">
            <h2 className="text-sm font-semibold text-neutral-900">Статистика по месяцам</h2>
            <select
              value={selectedStatsEmployeeId}
              onChange={(e) => setSelectedStatsEmployeeId(e.target.value)}
              className="h-8 rounded-md border border-neutral-300 text-xs px-2"
            >
              <option value="company">Все сотрудники</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>{emp.name}</option>
              ))}
            </select>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[520px]">
              <thead>
                <tr className="text-left text-neutral-500 border-b border-neutral-200">
                  <th className="py-1.5 pr-2">Месяц</th>
                  <th className="py-1.5 pr-2 text-right">Смен</th>
                  <th className="py-1.5 pr-2 text-right">Начислено</th>
                  <th className="py-1.5 pr-2 text-right">Выплачено</th>
                  <th className="py-1.5 pr-2 text-right">Разница</th>
                  <th className="py-1.5 text-right">Остаток</th>
                </tr>
              </thead>
              <tbody>
                {statsRows.map((row) => (
                  <tr key={row.month} className="border-b border-neutral-100 last:border-b-0">
                    <td className="py-1.5 pr-2 text-neutral-800">{monthNames[row.month - 1]}</td>
                    <td className="py-1.5 pr-2 text-right text-neutral-700">{row.shiftsWorked}</td>
                    <td className="py-1.5 pr-2 text-right text-neutral-700">{row.accrued.toLocaleString()} ₽</td>
                    <td className="py-1.5 pr-2 text-right text-neutral-700">{row.paid.toLocaleString()} ₽</td>
                    <td className={`py-1.5 pr-2 text-right ${row.delta >= 0 ? 'text-orange-700' : 'text-emerald-700'}`}>
                      {row.delta >= 0 ? '+' : ''}{row.delta.toLocaleString()} ₽
                    </td>
                    <td className={`py-1.5 text-right font-medium ${row.balanceEnd >= 0 ? 'text-neutral-900' : 'text-emerald-700'}`}>
                      {row.balanceEnd.toLocaleString()} ₽
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <AddPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => {
          setIsPaymentModalOpen(false);
          setSelectedEmployeeId(undefined);
        }}
        preselectedEmployeeId={selectedEmployeeId}
      />
    </div>
  );
}
