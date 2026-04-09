import { useEffect, useState } from 'react';
import { toast } from 'sonner';
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

interface EditPaymentModalProps {
  open: boolean;
  initial: {
    paymentId: string;
    amount: number;
    date: string;
    comment: string;
  } | null;
  onClose: () => void;
  onSubmit: (payload: {
    paymentId: string;
    amount: number;
    date: string;
    comment: string;
  }) => Promise<void>;
}

export function EditPaymentModal({
  open,
  initial,
  onClose,
  onSubmit,
}: EditPaymentModalProps) {
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!open || !initial) return;
    setAmount(String(initial.amount));
    setDate(initial.date);
    setComment(initial.comment);
    setSubmitting(false);
  }, [initial, open]);

  const handleSubmit = async () => {
    if (!initial) return;

    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      toast.error('Укажи корректную сумму.');
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      toast.error('Укажи дату в формате YYYY-MM-DD.');
      return;
    }

    setSubmitting(true);
    await onSubmit({
      paymentId: initial.paymentId,
      amount: parsedAmount,
      date,
      comment,
    });
    setSubmitting(false);
  };

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Изменить выплату</DialogTitle>
          <DialogDescription>
            Можно поправить сумму, дату и комментарий до финального подтверждения.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <label htmlFor="edit-payment-amount" className="text-sm font-medium">
              Сумма
            </label>
            <Input
              id="edit-payment-amount"
              type="number"
              min="1"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="edit-payment-date" className="text-sm font-medium">
              Дата
            </label>
            <Input
              id="edit-payment-date"
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </div>

          <div className="grid gap-2">
            <label htmlFor="edit-payment-comment" className="text-sm font-medium">
              Комментарий
            </label>
            <Input
              id="edit-payment-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Причина, формат выплаты..."
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? 'Сохраняю...' : 'Сохранить'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
