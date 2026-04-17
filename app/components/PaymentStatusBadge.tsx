import type { PaymentStatus } from '../domain/types';
import { useLanguage } from '../context/LanguageContext';
import { cn } from './ui/utils';

interface PaymentStatusBadgeProps {
  status: PaymentStatus;
}

export function PaymentStatusBadge({ status }: PaymentStatusBadgeProps) {
  const { t } = useLanguage();

  const statusMeta: Record<PaymentStatus, { label: string; className: string }> = {
    pending: {
      label: t('На подтверждении', 'Pending'),
      className: 'border-amber-200 bg-amber-50 text-amber-700',
    },
    approved: {
      label: t('Подтверждена', 'Approved'),
      className: 'border-emerald-200 bg-emerald-50 text-emerald-700',
    },
    rejected: {
      label: t('Отклонена', 'Rejected'),
      className: 'border-rose-200 bg-rose-50 text-rose-700',
    },
  };

  const meta = statusMeta[status];

  return (
    <span className={cn('inline-flex rounded-full border px-2 py-0.5 text-xs font-medium', meta.className)}>
      {meta.label}
    </span>
  );
}
