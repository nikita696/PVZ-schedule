import type { PaymentStatus } from '../domain/types';
import { cn } from './ui/utils';

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
}

const STATUS_META: Record<PaymentStatus, { label: string; className: string }> = {
  pending_confirmation: {
    label: 'Ожидает подтверждения',
    className: 'border-amber-200 bg-amber-50 text-amber-700',
  },
  confirmed: {
    label: 'Подтверждена',
    className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  },
  rejected: {
    label: 'Отклонена',
    className: 'border-rose-200 bg-rose-50 text-rose-700',
  },
};

export function PaymentStatusBadge({ status }: PaymentStatusBadgeProps) {
  const meta = STATUS_META[status];

  return (
    <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-medium', meta.className)}>
      {meta.label}
    </span>
  );
}
