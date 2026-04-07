import { useEffect, useState } from 'react';
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
  onClose: () => void;
  onSubmit: (input: AddPaymentInput) => Promise<void>;
}

export function AddPaymentModal({
  open,
  employees,
  onClose,
  onSubmit,
}: AddPaymentModalProps) {
  const [employeeId, setEmployeeId] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(getLocalISODate());
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open) return;

    const firstEmployee = employees.find((employee) => !employee.archived) ?? employees[0];
    setEmployeeId(firstEmployee?.id ?? '');
    setAmount('');
    setDate(getLocalISODate());
    setComment('');
    setSubmitting(false);
  }, [employees, open]);

  const handleSubmit = async () => {
    const nextAmount = Number(amount);
    if (!employeeId) {
      toast.error('Выберите сотрудника.');
      return;
    }

    if (!Number.isFinite(nextAmount) || nextAmount <= 0) {
      toast.error('Введите корректную сумму.');
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
            Зафиксируйте выплату сотруднику.
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
            >
              {employees.filter((employee) => !employee.archived).map((employee) => (
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
              placeholder="Аванс, премия, корректировка..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? 'Сохранение...' : 'Сохранить выплату'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
