import { Archive, Wallet } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';
import type { Employee, EmployeeStats } from '../domain/types';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';

interface EmployeeCardProps {
  employee: Employee;
  monthlyStats: EmployeeStats;
  lifetimeStats: EmployeeStats;
  onArchive: (employeeId: string) => Promise<void>;
  onRateSave: (employeeId: string, dailyRate: number) => Promise<void>;
}

const money = (value: number) => new Intl.NumberFormat('ru-RU', {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
}).format(value);

export function EmployeeCard({
  employee,
  monthlyStats,
  lifetimeStats,
  onArchive,
  onRateSave,
}: EmployeeCardProps) {
  const [rateDraft, setRateDraft] = useState(String(employee.dailyRate));

  const handleBlur = async () => {
    const nextRate = Number(rateDraft);
    if (!Number.isFinite(nextRate) || nextRate <= 0) {
      setRateDraft(String(employee.dailyRate));
      toast.error('Введите корректную ставку за смену.');
      return;
    }

    if (nextRate === employee.dailyRate) {
      return;
    }

    await onRateSave(employee.id, nextRate);
  };

  return (
    <Card className={employee.archived ? 'border-stone-200 bg-stone-50/60' : ''}>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div>
          <CardTitle className="text-lg">{employee.name}</CardTitle>
          <p className="mt-1 text-sm text-muted-foreground">
            Общий баланс: {money(lifetimeStats.due)}
          </p>
        </div>

        {!employee.archived ? (
          <Button variant="outline" size="sm" onClick={() => void onArchive(employee.id)}>
            <Archive className="h-4 w-4" />
            В архив
          </Button>
        ) : (
          <span className="rounded-full bg-stone-200 px-3 py-1 text-xs text-stone-700">
            В архиве
          </span>
        )}
      </CardHeader>

      <CardContent className="grid gap-4">
        <div className="grid gap-2">
          <label htmlFor={`rate-${employee.id}`} className="text-sm font-medium">
            Ставка за смену
          </label>
          <Input
            id={`rate-${employee.id}`}
            type="number"
            min="1"
            value={rateDraft}
            onChange={(event) => setRateDraft(event.target.value)}
            onBlur={() => void handleBlur()}
            disabled={employee.archived}
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <div className="text-xs uppercase tracking-wide text-emerald-700">Начислено</div>
            <div className="mt-2 text-xl font-semibold">{money(monthlyStats.earned)}</div>
            <div className="mt-1 text-xs text-emerald-700">
              {monthlyStats.shiftsWorked} отработанных смен
            </div>
          </div>

          <div className="rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <div className="text-xs uppercase tracking-wide text-sky-700">Выплачено</div>
            <div className="mt-2 text-xl font-semibold">{money(monthlyStats.paid)}</div>
            <div className="mt-1 text-xs text-sky-700">Выплаты за выбранный месяц</div>
          </div>

          <div className="rounded-2xl border border-orange-200 bg-orange-50 p-4">
            <div className="text-xs uppercase tracking-wide text-orange-700">К выплате</div>
            <div className="mt-2 flex items-center gap-2 text-xl font-semibold">
              <Wallet className="h-5 w-5" />
              {money(monthlyStats.due)}
            </div>
            <div className="mt-1 text-xs text-orange-700">Баланс месяца</div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
