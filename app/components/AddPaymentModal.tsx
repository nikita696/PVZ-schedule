import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { AddPaymentInput, Employee } from '../domain/types';
import { getLocalISODate } from '../lib/date';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Input } from './ui/input';

interface AddPaymentModalProps {
  open: boolean;
  employees: Employee[];
  fixedEmployeeId?: string | null;
  onClose: () => void;
  onSubmit: (input: AddPaymentInput) => Promise<void>;
}

export function AddPaymentModal({
  open,
  employees,
  fixedEmployeeId = null,
  onClose,
  onSubmit,
}: AddPaymentModalProps) {
  const activeEmployees = useMemo(
    () => employees.filter((employee) => !employee.archived),
    [employees],
  );
  const [employeeId, setEmployeeId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getLocalISODate());
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const canSubmit = !submitting
    && employeeId.length > 0
    && Number.isFinite(Number(amount))
    && Number(amount) > 0
    && /^\d{4}-\d{2}-\d{2}$/.test(date);

  useEffect(() => {
    if (!open) return;

    const firstEmployee = activeEmployees[0];
    setEmployeeId(fixedEmployeeId ?? firstEmployee?.id ?? '');
    setAmount('');
    setDate(getLocalISODate());
    setComment('');
    setSubmitting(false);
  }, [activeEmployees, fixedEmployeeId, open]);

  const handleSubmit = async () => {
    const nextAmount = Number(amount);
    if (!employeeId) {
      toast.error('Выбери сотрудника.');
      return;
    }

    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      toast.error('Укажи корректную сумму.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      toast.error('Укажи дату в формате YYYY-MM-DD.');
      return;
    }

    setSubmitting(true);
    await onSubmit({
      employeeId,
      amount: nextAmount,
      date,
      comment,
    });
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Добавить выплату</DialogTitle>
          <DialogDescription>
            Сотрудник создает запрос на выплату, а администратор потом подтверждает его.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <label htmlFor="payment-employee" className="text-sm font-medium">
              Сотрудник
            </label>
            <select
              id="payment-employee"
              className="h-10 rounded-md border bg-input-background px-3 text-sm"
              value={employeeId}
              onChange={(event) => setEmployeeId(event.target.value)}
              disabled={Boolean(fixedEmployeeId)}
            >
              {activeEmployees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid gap-2">
            <label htmlFor="payment-amount" className="text-sm font-medium">
              Сумма
            </label>
            <Input
              id="payment-amount"
              type="number"
              min="1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              placeholder="3000"
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="payment-date" className="text-sm font-medium">
              Дата
            </label>
            <Input
              id="payment-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="payment-comment" className="text-sm font-medium">
              Комментарий
            </label>
            <Input
              id="payment-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Аванс, частичная выплата, наличные..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={!canSubmit}>
            {submitting ? 'Сохраняю...' : 'Сохранить выплату'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
