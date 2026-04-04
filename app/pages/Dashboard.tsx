import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { EmployeeCard } from '../components/EmployeeCard';
import { MonthYearSelector } from '../components/MonthYearSelector';
import { AddPaymentModal } from '../components/AddPaymentModal';
import { useNavigate } from 'react-router';
import { AlertCircle } from 'lucide-react';

export function Dashboard() {
  const { employees, selectedMonth, selectedYear, getEmployeeStats, getEmployeeLifetimeStats } = useApp();
  const navigate = useNavigate();
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | undefined>();

  const handleAddPayment = (employeeId: string) => {
    setSelectedEmployeeId(employeeId);
    setIsPaymentModalOpen(true);
  };

  const handleViewHistory = (employeeId: string) => {
    navigate(`/payments?employee=${employeeId}`);
  };

  const totalDueMonth = employees.reduce((sum, emp) => {
    const stats = getEmployeeStats(emp.id, selectedMonth, selectedYear);
    return sum + stats.due;
  }, 0);

  const totalDueAllTime = employees.reduce((sum, emp) => {
    const stats = getEmployeeLifetimeStats(emp.id);
    return sum + stats.due;
  }, 0);

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="text-xl font-semibold text-neutral-900 mb-3">
            ПВЗ: смены и выплаты
          </h1>
          <MonthYearSelector />
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

        {employees.map((employee) => {
          const stats = getEmployeeStats(employee.id, selectedMonth, selectedYear);
          return (
            <EmployeeCard
              key={employee.id}
              employee={employee}
              stats={stats}
              onAddPayment={() => handleAddPayment(employee.id)}
              onViewHistory={() => handleViewHistory(employee.id)}
            />
          );
        })}
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
