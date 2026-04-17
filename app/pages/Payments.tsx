import { CheckCircle2, Pencil, Trash2, Wallet, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AddPaymentModal } from '../components/AddPaymentModal';
import { EditPaymentModal } from '../components/EditPaymentModal';
import { PaymentStatusBadge } from '../components/PaymentStatusBadge';
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
import { useApp } from '../context/AppContext';
import { useLanguage } from '../context/LanguageContext';

const money = (value: number, locale: string) => new Intl.NumberFormat(locale, {
  style: 'currency',
  currency: 'RUB',
  maximumFractionDigits: 0,
}).format(value);

interface EditPaymentState {
  paymentId: string;
  amount: number;
  date: string;
  comment: string;
}

export default function PaymentsPage() {
  const { locale, t } = useLanguage();
  const {
    employees,
    payments,
    addPayment,
    updatePayment,
    deletePayment,
    confirmPayment,
    rejectPayment,
    isOwner,
    myEmployeeId,
  } = useApp();

  const [selectedEmployeeId, setSelectedEmployeeId] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingPayment, setEditingPayment] = useState<EditPaymentState | null>(null);

  const visibleEmployees = useMemo(() => {
    const active = employees.filter((employee) => !employee.archived);
    if (isOwner) return active;
    return active.filter((employee) => employee.id === myEmployeeId);
  }, [employees, isOwner, myEmployeeId]);

  const visiblePayments = useMemo(() => {
    const scoped = isOwner
      ? payments
      : payments.filter((payment) => payment.employeeId === myEmployeeId);

    if (!isOwner || selectedEmployeeId === 'all') return scoped;
    return scoped.filter((payment) => payment.employeeId === selectedEmployeeId);
  }, [isOwner, myEmployeeId, payments, selectedEmployeeId]);

  const pendingCount = useMemo(() => (
    visiblePayments.filter((payment) => payment.status === 'pending').length
  ), [visiblePayments]);

  const approvedCount = useMemo(() => (
    visiblePayments.filter((payment) => payment.status === 'approved').length
  ), [visiblePayments]);

  const totalApproved = useMemo(() => (
    visiblePayments
      .filter((payment) => payment.status === 'approved')
      .reduce((sum, payment) => sum + payment.amount, 0)
  ), [visiblePayments]);

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
      'Удалить выплату? Это действие нельзя отменить.',
      'Delete this payment? This action cannot be undone.',
    ));
    if (!confirmed) return;

    const result = await deletePayment(id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(t('Выплата удалена.', 'Payment deleted.'));
  };

  const handleConfirmPayment = async (id: string) => {
    const result = await confirmPayment(id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(t('Выплата подтверждена.', 'Payment approved.'));
  };

  const handleRejectPayment = async (id: string) => {
    const result = await rejectPayment(id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(t('Выплата отклонена.', 'Payment rejected.'));
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
    <div className="bg-stone-50">
      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
        <Card>
          <CardContent className="flex flex-col gap-3 p-5 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-700">
                {isOwner ? t('Все выплаты ПВЗ', 'All PVZ payments') : t('Твои выплаты', 'Your payments')}
              </div>
              <div className="rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                {t('На подтверждении', 'Pending')}: {pendingCount}
              </div>
            </div>

            <Button onClick={() => setModalOpen(true)}>
              <Wallet className="h-4 w-4" />
              {t('Добавить выплату', 'Add payment')}
            </Button>
          </CardContent>
        </Card>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{t('Всего записей', 'Total records')}</div>
              <div className="mt-2 text-2xl font-semibold">{visiblePayments.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{t('На подтверждении', 'Pending')}</div>
              <div className="mt-2 text-2xl font-semibold text-amber-700">{pendingCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">{t('Подтверждено / сумма', 'Approved / amount')}</div>
              <div className="mt-2 text-2xl font-semibold text-emerald-700">
                {approvedCount} / {money(totalApproved, locale)}
              </div>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <CardTitle>{isOwner ? t('Все выплаты', 'All payments') : t('История моих выплат', 'My payment history')}</CardTitle>
            {isOwner ? (
              <select
                className="h-10 rounded-md border bg-input-background px-3 text-sm"
                value={selectedEmployeeId}
                onChange={(event) => setSelectedEmployeeId(event.target.value)}
              >
                <option value="all">{t('Все сотрудники', 'All employees')}</option>
                {visibleEmployees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name}
                  </option>
                ))}
              </select>
            ) : null}
          </CardHeader>
          <CardContent className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('Дата', 'Date')}</TableHead>
                  <TableHead>{t('Сотрудник', 'Employee')}</TableHead>
                  <TableHead>{t('Сумма', 'Amount')}</TableHead>
                  <TableHead>{t('Комментарий', 'Comment')}</TableHead>
                  <TableHead>{t('Статус', 'Status')}</TableHead>
                  <TableHead className="w-[320px]">{t('Действия', 'Actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiblePayments.map((payment) => {
                  const employee = employees.find((item) => item.id === payment.employeeId);
                  const canEdit = isOwner || payment.status === 'pending';
                  const canDelete = isOwner ? payment.status !== 'approved' : payment.status === 'pending';
                  const canConfirm = isOwner && payment.status === 'pending';
                  const canReject = isOwner && payment.status === 'pending';

                  return (
                    <TableRow key={payment.id}>
                      <TableCell>{payment.date}</TableCell>
                      <TableCell>{employee?.name ?? t('Сотрудник', 'Employee')}</TableCell>
                      <TableCell>{money(payment.amount, locale)}</TableCell>
                      <TableCell>{payment.comment || '-'}</TableCell>
                      <TableCell>
                        <PaymentStatusBadge status={payment.status} />
                      </TableCell>
                      <TableCell className="space-x-2">
                        {canConfirm ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleConfirmPayment(payment.id)}
                          >
                            <CheckCircle2 className="h-4 w-4" />
                            {t('Подтвердить', 'Approve')}
                          </Button>
                        ) : null}
                        {canReject ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleRejectPayment(payment.id)}
                          >
                            <XCircle className="h-4 w-4" />
                            {t('Отклонить', 'Reject')}
                          </Button>
                        ) : null}
                        {canEdit ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setEditingPayment({
                              paymentId: payment.id,
                              amount: payment.amount,
                              date: payment.date,
                              comment: payment.comment,
                            })}
                          >
                            <Pencil className="h-4 w-4" />
                            {t('Изменить', 'Edit')}
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleDeletePayment(payment.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                            {t('Удалить', 'Delete')}
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}

                {visiblePayments.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      {isOwner
                        ? t('Пока нет ни одной выплаты за выбранный период.', 'There are no payments for the selected period yet.')
                        : t('У тебя пока нет ни одной выплаты.', 'You do not have any payments yet.')}
                    </TableCell>
                  </TableRow>
                ) : null}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>

      <AddPaymentModal
        open={modalOpen}
        employees={visibleEmployees}
        fixedEmployeeId={isOwner ? null : myEmployeeId}
        onClose={() => setModalOpen(false)}
        onSubmit={handleAddPayment}
      />

      <EditPaymentModal
        open={editingPayment !== null}
        initial={editingPayment}
        onClose={() => setEditingPayment(null)}
        onSubmit={handleEditPayment}
      />
    </div>
  );
}
