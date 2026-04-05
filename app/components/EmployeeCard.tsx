import { Clock, CheckCircle, AlertCircle, Archive } from 'lucide-react';
import { Button } from './ui/button';
import { Card } from './ui/card';
import { Employee } from '../context/AppContext';

interface EmployeeCardProps {
  employee: Employee;
  stats: {
    shiftsWorked: number;
    earned: number;
    paid: number;
    due: number;
  };
  onAddPayment: () => void;
  onViewHistory: () => void;
  onRateChange: (newRate: number) => void;
  onRemove: () => void;
}

export function EmployeeCard({
  employee,
  stats,
  onAddPayment,
  onViewHistory,
  onRateChange,
  onRemove,
}: EmployeeCardProps) {
  return (
    <Card className="p-4 bg-white shadow-sm border border-neutral-200">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="text-lg font-semibold text-neutral-900">{employee.name}</h3>
          <p className="text-sm text-neutral-500">{stats.shiftsWorked} смен</p>
        </div>

        <div className="text-right">
          <p className="text-xs text-neutral-500">Ставка за смену</p>
          <input
            type="number"
            min={0}
            step={100}
            value={employee.dailyRate}
            onChange={(e) => onRateChange(Number(e.target.value) || 0)}
            className="w-24 text-right text-sm font-semibold text-neutral-900 bg-transparent border-b border-dashed border-neutral-400 focus:outline-none"
          />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-neutral-50 rounded-lg p-3">
          <div className="flex items-center gap-1 mb-1">
            <Clock className="w-3.5 h-3.5 text-neutral-500" />
            <p className="text-xs text-neutral-600">Начислено</p>
          </div>
          <p className="font-semibold text-neutral-900">{stats.earned.toLocaleString()} ₽</p>
        </div>

        <div className="bg-green-50 rounded-lg p-3">
          <div className="flex items-center gap-1 mb-1">
            <CheckCircle className="w-3.5 h-3.5 text-green-600" />
            <p className="text-xs text-green-700">Выплачено</p>
          </div>
          <p className="font-semibold text-green-700">{stats.paid.toLocaleString()} ₽</p>
        </div>

        <div className={`${stats.due > 0 ? 'bg-orange-50' : 'bg-neutral-50'} rounded-lg p-3`}>
          <div className="flex items-center gap-1 mb-1">
            <AlertCircle className={`w-3.5 h-3.5 ${stats.due > 0 ? 'text-orange-600' : 'text-neutral-500'}`} />
            <p className={`text-xs ${stats.due > 0 ? 'text-orange-700' : 'text-neutral-600'}`}>К выплате</p>
          </div>
          <p className={`font-semibold ${stats.due > 0 ? 'text-orange-700' : 'text-neutral-900'}`}>
            {stats.due.toLocaleString()} ₽
          </p>
        </div>
      </div>

      <div className="flex gap-2">
        <Button onClick={onAddPayment} className="flex-1 bg-orange-600 hover:bg-orange-700 text-white">
          Добавить выплату
        </Button>
        <Button onClick={onViewHistory} variant="outline" className="flex-1 border-neutral-300 text-neutral-700">
          История
        </Button>
        <Button
          onClick={onRemove}
          variant="outline"
          title="Архив (история сохраняется)"
          className="px-3 border-amber-200 text-amber-700 hover:bg-amber-50"
        >
          <Archive className="w-4 h-4" />
        </Button>
      </div>
    </Card>
  );
}
