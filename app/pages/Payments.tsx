import { ChevronDown, Pencil, Trash2, Wallet } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AddPaymentModal } from '../components/AddPaymentModal';
import { EditPaymentModal } from '../components/EditPaymentModal';
import { PaymentStatusBadge } from '../components/PaymentStatusBadge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '../components/ui/collapsible';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../components/ui/table';
import { cn } from '../components/ui/utils';
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';
import type { Payment } from '../domain/types';

const money = (value: number, locale: string) => new Intl.NumberFormat(locale, {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
}).format(value);

const paymentSortValue = (payment: Payment): string => (
  `${payment.date}T${payment.createdAt ?? ''}`
);

const sortPaymentsDesc = (payments: Payment[]): Payment[] => (
  [...payments].sort((left, right) => paymentSortValue(right).localeCompare(paymentSortValue(left)))
);

const getMonthKey = (date: string): string => date.slice(0, 7);

const formatMonthLabel = (monthKey: string, locale: string): string => {
  const [year, month] = monthKey.split('-').map(Number);
  const date = new Date(year, month - 1, 1);
  const label = new Intl.DateTimeFormat(locale, {
    month: 'long',
    year: 'numeric',
  }).format(date);

  return label.charAt(0).toUpperCase() + label.slice(1);
};

interface PaymentMonthGroup {
  key: string;
  label: string;
  payments: Payment[];
  approvedTotal: number;
  legacyCount: number;
}

const groupPaymentsByMonth = (payments: Payment[], locale: string): PaymentMonthGroup[] => {
  const byMonth = new Map<string, Payment[]>();

  sortPaymentsDesc(payments).forEach((payment) => {
    const key = getMonthKey(payment.date);
    const monthPayments = byMonth.get(key) ?? [];
    monthPayments.push(payment);
    byMonth.set(key, monthPayments);
  });

  return [...byMonth.entries()]
    .sort(([left], [right]) => right.localeCompare(left))
    .map(([key, monthPayments]) => ({
      key,
      label: formatMonthLabel(key, locale),
      payments: monthPayments,
      approvedTotal: monthPayments
        .filter((payment) => payment.status === 'approved')
        .reduce((sum, payment) => sum + payment.amount, 0),
      legacyCount: monthPayments.filter((payment) => payment.status !== 'approved').length,
    }));
};

interface EditPaymentState {
  paymentId: string;
  amount: number;
  date: string;
  comment: string;
}

interface SummaryItemProps {
  label: string;
  value: string;
}

function SummaryItem({ label, value }: SummaryItemProps) {
  return (
    <div className="rounded-lg border bg-white px-3 py-2 shadow-sm">
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 text-sm font-semibold text-stone-900">
        {value}
      </div>
    </div>
  );
}

export default function PaymentsPage() {
  const { locale, t } = useLanguage();
  const {
    employees,
    payments,
    addPayment,
    updatePayment,
    deletePayment,
    isOwner,
    myEmployeeId,
  } = useApp();

  const [selectedEmployeeId, setSelectedEmployeeId] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<EditPaymentState | null>(null);
  const [openMonthKeys, setOpenMonthKeys] = useState<string[]>([]);
  const [hasInitializedMonthState, setHasInitializedMonthState] = useState(false);

  const visibleEmployees = useMemo(() => {
    const active = employees.filter((employee) => !employee.archived);
    if (isOwner) return active;
    return active.filter((employee) => employee.id === myEmployeeId);
  }, [employees, isOwner, myEmployeeId]);

  const employeeById = useMemo(() => (
    new Map(employees.map((employee) => [employee.id, employee]))
  ), [employees]);

  const visiblePayments = useMemo(() => {
    const scoped = isOwner
      ? payments
      : payments.filter((payment) => payment.employeeId === myEmployeeId);

    if (!isOwner || selectedEmployeeId === 'all') return scoped;
    return scoped.filter((payment) => payment.employeeId === selectedEmployeeId);
  }, [isOwner, myEmployeeId, payments, selectedEmployeeId]);

  const paymentGroups = useMemo(
    () => groupPaymentsByMonth(visiblePayments, locale),
    [locale, visiblePayments],
  );

  const totalApproved = useMemo(() => (
    visiblePayments
      .filter((payment) => payment.status === 'approved')
      .reduce((sum, payment) => sum + payment.amount, 0)
  ), [visiblePayments]);

  const latestMonth = paymentGroups[0] ?? null;

  useEffect(() => {
    const validMonthKeys = paymentGroups.map((group) => group.key);

    setOpenMonthKeys((prev) => prev.filter((key) => validMonthKeys.includes(key)));

    if (!hasInitializedMonthState && validMonthKeys.length > 0) {
      setOpenMonthKeys([validMonthKeys[0]]);
      setHasInitializedMonthState(true);
    }
  }, [hasInitializedMonthState, paymentGroups]);

  const toggleMonth = (monthKey: string, isOpen: boolean) => {
    setOpenMonthKeys((prev) => {
      if (isOpen) {
        return prev.includes(monthKey) ? prev : [...prev, monthKey];
      }

      return prev.filter((key) => key !== monthKey);
    });
  };

  const expandAllMonths = () => {
    setOpenMonthKeys(paymentGroups.map((group) => group.key));
  };

  const collapseAllMonths = () => {
    setOpenMonthKeys([]);
  };

  const handleAddPayment = async (input: Parameters<typeof addPayment>[0]) => {
    const result = await addPayment(input);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setModalOpen(false);
    toast.success(t('Выплата сохранена.', 'Payment saved.'));
  };

  const handleDeletePayment = async (id: string) => {
    const confirmed = window.confirm(t(
      'Удалить запись выплаты? Это действие нельзя отменить.',
      'Delete this payment record? This action cannot be undone.',
    ));
    if (!confirmed) return;

    const result = await deletePayment(id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(t('Выплата удалена.', 'Payment deleted.'));
  };

  const handleEditPayment = async (payload: EditPaymentState) => {
    const result = await updatePayment(payload.paymentId, {
      amount: payload.amount,
      date: payload.date,
      comment: payload.comment,
    });

    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setEditingPayment(null);
    toast.success(t('Выплата обновлена.', 'Payment updated.'));
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <main
        className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6"
        data-testid="payments-journal"
      >
        <Card data-testid="payments-summary">
          <CardContent className="p-4 sm:p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-wide text-stone-500">
                  {isOwner ? t('Журнал выплат ПВЗ', 'PVZ payment journal') : t('История выплат', 'Payment history')}
                </div>
                <h1 className="mt-1 text-2xl font-semibold tracking-tight text-stone-950">
                  {isOwner ? t('Выплаты сотрудникам', 'Employee payments') : t('Мои выплаты', 'My payments')}
                </h1>
                <p className="mt-1 hidden max-w-2xl text-sm text-muted-foreground sm:block">
                  {t(
                    'Компактная история фактических выплат без лишних действий и больших карточек.',
                    'A compact history of recorded payments without extra actions or large cards.',
                  )}
                </p>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                {isOwner ? (
                  <select
                    className="h-9 rounded-md border bg-input-background px-3 text-sm"
                    value={selectedEmployeeId}
                    onChange={(event) => setSelectedEmployeeId(event.target.value)}
                    aria-label={t('Фильтр по сотруднику', 'Employee filter')}
                  >
                    <option value="all">{t('Все сотрудники', 'All employees')}</option>
                    {visibleEmployees.map((employee) => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name}
                      </option>
                    ))}
                  </select>
                ) : null}

                {isOwner ? (
                  <Button
                    className="h-9"
                    onClick={() => setModalOpen(true)}
                    data-testid="add-payment-button"
                  >
                    <Wallet className="h-4 w-4" />
                    {t('Зафиксировать выплату', 'Record payment')}
                  </Button>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              <SummaryItem
                label={t('Записей', 'Records')}
                value={String(visiblePayments.length)}
              />
              <SummaryItem
                label={t('Учтено в расчете', 'Counted in payroll')}
                value={money(totalApproved, locale)}
              />
              <SummaryItem
                label={t('Свежий месяц', 'Latest month')}
                value={latestMonth
                  ? `${latestMonth.label}: ${money(latestMonth.approvedTotal, locale)}`
                  : t('Нет записей', 'No records')}
              />
            </div>
          </CardContent>
        </Card>

        {paymentGroups.length > 0 ? (
          <section className="flex flex-col gap-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-xs text-muted-foreground">
                {t(
                  'Нажми на месяц, чтобы свернуть или раскрыть его записи.',
                  'Click a month to collapse or expand its entries.',
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={collapseAllMonths}
                  data-testid="collapse-all-months"
                >
                  {t('Свернуть все', 'Collapse all')}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8"
                  onClick={expandAllMonths}
                  data-testid="expand-all-months"
                >
                  {t('Развернуть все', 'Expand all')}
                </Button>
              </div>
            </div>
            {paymentGroups.map((group) => (
              <Collapsible
                key={group.key}
                open={openMonthKeys.includes(group.key)}
                onOpenChange={(isOpen) => toggleMonth(group.key, isOpen)}
                data-testid="payment-month-group"
                data-month-key={group.key}
              >
                <Card className="gap-0 overflow-hidden">
                  <CollapsibleTrigger
                    className="w-full text-left"
                    data-testid={`payment-month-toggle-${group.key}`}
                  >
                    <CardHeader className={cn(
                      'flex flex-col gap-2 px-4 py-3 transition-colors hover:bg-stone-50 sm:flex-row sm:items-center sm:justify-between sm:px-5',
                      openMonthKeys.includes(group.key) ? 'border-b' : '',
                    )}>
                      <div className="flex items-start gap-3">
                        <ChevronDown
                          className={cn(
                            'mt-0.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
                            openMonthKeys.includes(group.key) ? 'rotate-0' : '-rotate-90',
                          )}
                        />
                        <div>
                          <CardTitle className="text-base font-semibold text-stone-950">
                            {group.label}
                          </CardTitle>
                          <div className="mt-1 text-xs text-muted-foreground">
                            {t('Записей', 'Records')}: {group.payments.length}
                            {' · '}
                            {t('Учтено в расчете', 'Counted in payroll')}: {money(group.approvedTotal, locale)}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {group.legacyCount > 0 ? (
                          <div className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800">
                            {t('Особые записи', 'Special records')}: {group.legacyCount}
                          </div>
                        ) : null}
                      </div>
                    </CardHeader>
                  </CollapsibleTrigger>

                  <CollapsibleContent data-testid={`payment-month-content-${group.key}`}>
                    <CardContent className="overflow-x-auto p-0">
                      <Table className="min-w-[760px] table-fixed">
                        <TableHeader>
                          <TableRow className="bg-stone-50/70">
                            <TableHead className="w-[112px] px-4 py-2 text-xs">{t('Дата', 'Date')}</TableHead>
                            <TableHead className="w-[220px] px-4 py-2 text-xs">{t('Сотрудник', 'Employee')}</TableHead>
                            <TableHead className="w-[140px] px-4 py-2 text-xs">{t('Сумма', 'Amount')}</TableHead>
                            <TableHead className="px-4 py-2 text-xs">{t('Комментарий', 'Comment')}</TableHead>
                            {isOwner ? (
                              <TableHead className="w-[132px] px-4 py-2 text-right text-xs">
                                {t('Действия', 'Actions')}
                              </TableHead>
                            ) : null}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {group.payments.map((payment) => {
                            const employee = employeeById.get(payment.employeeId);
                            const canEdit = isOwner;
                            const canDelete = isOwner && payment.status !== 'approved';
                            const comment = payment.comment.trim() || t('Без комментария', 'No comment');

                            return (
                              <TableRow key={payment.id} data-testid="payment-row">
                                <TableCell className="px-4 py-2 text-sm font-medium text-stone-800">
                                  {payment.date}
                                </TableCell>
                                <TableCell className="px-4 py-2 text-sm">
                                  <div className="font-medium text-stone-900">
                                    {employee?.name ?? t('Сотрудник', 'Employee')}
                                  </div>
                                </TableCell>
                                <TableCell className="px-4 py-2 text-sm font-semibold text-stone-950">
                                  {money(payment.amount, locale)}
                                </TableCell>
                                <TableCell className="px-4 py-2 text-sm">
                                  <div className="flex min-w-0 max-w-[360px] items-center gap-2">
                                    <span className="truncate text-stone-700" title={comment}>
                                      {comment}
                                    </span>
                                    {payment.status !== 'approved' ? (
                                      <span data-testid="payment-legacy-status">
                                        <PaymentStatusBadge status={payment.status} />
                                      </span>
                                    ) : null}
                                  </div>
                                </TableCell>
                                {isOwner ? (
                                  <TableCell className="px-4 py-2 text-right" data-testid="payment-actions">
                                    <div className="flex justify-end gap-1">
                                      {canEdit ? (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-8 px-2"
                                          onClick={() => setEditingPayment({
                                            paymentId: payment.id,
                                            amount: payment.amount,
                                            date: payment.date,
                                            comment: payment.comment,
                                          })}
                                        >
                                          <Pencil className="h-3.5 w-3.5" />
                                          <span className="sr-only sm:not-sr-only sm:ml-1">{t('Изменить', 'Edit')}</span>
                                        </Button>
                                      ) : null}
                                      {canDelete ? (
                                        <Button
                                          variant="outline"
                                          size="sm"
                                          className="h-8 px-2 text-rose-700 hover:text-rose-800"
                                          onClick={() => void handleDeletePayment(payment.id)}
                                        >
                                          <Trash2 className="h-3.5 w-3.5" />
                                          <span className="sr-only sm:not-sr-only sm:ml-1">{t('Удалить', 'Delete')}</span>
                                        </Button>
                                      ) : null}
                                    </div>
                                  </TableCell>
                                ) : null}
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </CardContent>
                  </CollapsibleContent>
                </Card>
              </Collapsible>
            ))}
          </section>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-2 px-4 py-10 text-center">
              <div className="rounded-full bg-stone-100 p-3 text-stone-500">
                <Wallet className="h-5 w-5" />
              </div>
              <div className="text-sm font-semibold text-stone-900">
                {t('В журнале пока нет выплат', 'The payment journal is empty')}
              </div>
              <div className="max-w-md text-sm text-muted-foreground">
                {isOwner
                  ? t('Зафиксируй первую выплату или измени фильтр сотрудника.', 'Record the first payment or change the employee filter.')
                  : t('Когда появятся выплаты, они будут собраны здесь по месяцам.', 'When payments appear, they will be grouped here by month.')}
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {isOwner ? (
        <AddPaymentModal
          open={modalOpen}
          employees={visibleEmployees}
          fixedEmployeeId={null}
          onClose={() => setModalOpen(false)}
          onSubmit={handleAddPayment}
        />
      ) : null}

      <EditPaymentModal
        open={editingPayment !== null}
        initial={editingPayment}
        onClose={() => setEditingPayment(null)}
        onSubmit={handleEditPayment}
      />
    </div>
  );
}
