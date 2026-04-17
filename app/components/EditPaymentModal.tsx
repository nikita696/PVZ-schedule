import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { useLanguage } from '../context/LanguageContext';
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
  const { t } = useLanguage();
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
      toast.error(t('Укажи корректную сумму.', 'Enter a valid amount.'));
      return;
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      toast.error(t('Укажи дату в формате YYYY-MM-DD.', 'Enter the date in YYYY-MM-DD format.'));
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
          <DialogTitle>{t('Изменить выплату', 'Edit payment')}</DialogTitle>
          <DialogDescription>
            {t(
              'Можно поправить сумму, дату и комментарий до финального подтверждения.',
              'You can edit the amount, date, and comment before final approval.',
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4">
          <div className="grid gap-2">
            <label htmlFor="edit-payment-amount" className="text-sm font-medium">
              {t('Сумма', 'Amount')}
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
              {t('Дата', 'Date')}
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
              {t('Комментарий', 'Comment')}
            </label>
            <Input
              id="edit-payment-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder={t('Причина, формат выплаты...', 'Reason, payment format...')}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            {t('Отмена', 'Cancel')}
          </Button>
          <Button onClick={() => void handleSubmit()} disabled={submitting}>
            {submitting ? t('Сохраняю...', 'Saving...') : t('Сохранить', 'Save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
