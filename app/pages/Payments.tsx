import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { Trash2, Plus } from 'lucide-react';
import { Button } from '../components/ui/button';
import { AddPaymentModal } from '../components/AddPaymentModal';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';
import { toast } from 'sonner';
import { useSearchParams } from 'react-router';

const parseLocalDate = (dateStr: string) => {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
};

export function Payments() {
  const { employees, payments, deletePayment } = useApp();
  const [searchParams] = useSearchParams();
  const preselectedEmployee = searchParams.get('employee');

  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('all');
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);

  useEffect(() => {
    if (preselectedEmployee) {
      setSelectedEmployeeId(preselectedEmployee);
    }
  }, [preselectedEmployee]);

  const filteredPayments = payments.filter((payment) => {
    if (selectedEmployeeId === 'all') return true;
    return payment.employeeId === selectedEmployeeId;
  });

  const sortedPayments = [...filteredPayments].sort((a, b) => {
    return parseLocalDate(b.date).getTime() - parseLocalDate(a.date).getTime();
  });

  const handleDelete = (id: string) => {
    if (window.confirm('Удалить эту выплату?')) {
      deletePayment(id);
      toast.success('Выплата удалена');
    }
  };

  const getEmployeeName = (employeeId: string) => {
    return employees.find((e) => e.id === employeeId)?.name || employeeId;
  };

  const formatDate = (dateStr: string) => {
    const date = parseLocalDate(dateStr);
    return new Intl.DateTimeFormat('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }).format(date);
  };

  return (
    <div className="min-h-screen bg-neutral-50 pb-20">
      <div className="bg-white border-b border-neutral-200">
        <div className="max-w-md mx-auto px-4 py-4">
          <h1 className="text-xl font-semibold text-neutral-900 mb-3">
            История выплат
          </h1>

          <div className="flex gap-2">
            <Select value={selectedEmployeeId} onValueChange={setSelectedEmployeeId}>
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Все сотрудники</SelectItem>
                {employees.map((emp) => (
                  <SelectItem key={emp.id} value={emp.id}>
                    {emp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={() => setIsPaymentModalOpen(true)}
              className="bg-orange-600 hover:bg-orange-700 text-white"
            >
              <Plus className="w-4 h-4 mr-1" />
              Добавить
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-md mx-auto px-4 py-4">
        {sortedPayments.length === 0 ? (
          <div className="bg-white rounded-lg border border-neutral-200 p-8 text-center">
            <p className="text-neutral-500">Выплат пока нет</p>
          </div>
        ) : (
          <div className="space-y-2">
            {sortedPayments.map((payment) => (
              <div
                key={payment.id}
                className="bg-white rounded-lg border border-neutral-200 p-4 flex items-start gap-3"
              >
                <div className="flex-1">
                  <div className="flex items-baseline gap-2 mb-1">
                    <span className="text-lg font-semibold text-neutral-900">
                      {payment.amount.toLocaleString()} ₽
                    </span>
                    <span className="text-sm text-neutral-500">
                      {getEmployeeName(payment.employeeId)}
                    </span>
                  </div>
                  <p className="text-sm text-neutral-600 mb-1">{payment.comment}</p>
                  <p className="text-xs text-neutral-500">{formatDate(payment.date)}</p>
                </div>

                <button
                  onClick={() => handleDelete(payment.id)}
                  className="p-2 hover:bg-red-50 rounded-lg transition-colors group"
                >
                  <Trash2 className="w-4 h-4 text-neutral-400 group-hover:text-red-600" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <AddPaymentModal
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
        preselectedEmployeeId={selectedEmployeeId !== 'all' ? selectedEmployeeId : undefined}
      />
    </div>
  );
}
