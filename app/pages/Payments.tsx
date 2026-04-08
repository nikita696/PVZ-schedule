import { CheckCircle2, Pencil, Trash2, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AddPaymentModal } from '../components/AddPaymentModal';
import { BottomNav } from '../components/BottomNav';
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

const money = (value: number) => new Intl.NumberFormat('ru-RU', {
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
  const {
    employees,
    payments,
    addPayment,
    updatePayment,
    deletePayment,
    confirmPayment,
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
    visiblePayments.filter((payment) => payment.status === 'entered').length
  ), [visiblePayments]);

  const handleAddPayment = async (input: Parameters<typeof addPayment>[0]) => {
    const result = await addPayment(input);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setModalOpen(false);
    toast.success(result.message ?? 'Выплата сохранена.');
  };

  const handleDeletePayment = async (id: string) => {
    const confirmed = window.confirm('Удалить выплату? Это действие нельзя отменить.');
    if (!confirmed) return;

    const result = await deletePayment(id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? 'Выплата удалена.');
  };

  const handleConfirmPayment = async (id: string) => {
    const result = await confirmPayment(id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? 'Выплата подтверждена.');
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
    toast.success(result.message ?? 'Выплата обновлена.');
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <main className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 sm:px-6">
        <Card className="border-orange-100 bg-[radial-gradient(circle_at_top_left,#fff7ed,white_55%)]">
          <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="w-fit rounded-full bg-orange-100 px-3 py-1 text-xs font-semibold text-orange-700">
                Выплаты
              </div>
              <h1 className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">
                {isOwner ? 'Журнал выплат по ПВЗ' : 'Мои выплаты'}
              </h1>
              <p className="mt-1 text-sm text-stone-600">
                {isOwner
                  ? 'Владелец подтверждает выплаты сотрудников, внесенные вручную.'
                  : 'Вы можете добавлять и редактировать свои выплаты до подтверждения владельцем.'}
              </p>
            </div>

            <Button onClick={() => setModalOpen(true)} className="bg-orange-600 hover:bg-orange-500">
              <Wallet className="h-4 w-4" />
              Добавить выплату
            </Button>
          </CardContent>
        </Card>

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Всего выплат</div>
              <div className="mt-2 text-2xl font-semibold">{visiblePayments.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Ожидают подтверждения</div>
              <div className="mt-2 text-2xl font-semibold text-amber-700">{pendingCount}</div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="text-xs text-muted-foreground">Подтверждено</div>
              <div className="mt-2 text-2xl font-semibold text-emerald-700">
                {visiblePayments.filter((payment) => payment.status === 'confirmed').length}
              </div>
            </CardContent>
          </Card>
        </section>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <CardTitle>Журнал выплат</CardTitle>
            {isOwner ? (
              <select
                className="h-10 rounded-md border bg-input-background px-3 text-sm"
                value={selectedEmployeeId}
                onChange={(event) => setSelectedEmployeeId(event.target.value)}
              >
                <option value="all">Все сотрудники</option>
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
                  <TableHead>Дата</TableHead>
                  <TableHead>Сотрудник</TableHead>
                  <TableHead>Сумма</TableHead>
                  <TableHead>Комментарий</TableHead>
                  <TableHead>Статус</TableHead>
                  <TableHead className="w-[220px]">Действия</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiblePayments.map((payment) => {
                  const employee = employees.find((item) => item.id === payment.employeeId);
                  const canEdit = isOwner || payment.status === 'entered';
                  const canDelete = isOwner || payment.status === 'entered';
                  const canConfirm = isOwner && payment.status === 'entered';

                  return (
                    <TableRow key={payment.id}>
                      <TableCell>{payment.date}</TableCell>
                      <TableCell>{employee?.name ?? 'Сотрудник'}</TableCell>
                      <TableCell>{money(payment.amount)}</TableCell>
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
                            Подтвердить
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
                            Изменить
                          </Button>
                        ) : null}
                        {canDelete ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => void handleDeletePayment(payment.id)}
                          >
                            <Trash2 className="h-4 w-4 text-rose-600" />
                            Удалить
                          </Button>
                        ) : null}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {visiblePayments.length === 0 ? (
              <p className="pt-4 text-sm text-muted-foreground">Пока нет ни одной выплаты.</p>
            ) : null}
          </CardContent>
        </Card>
      </main>

      <BottomNav />

      <AddPaymentModal
        open={modalOpen}
        employees={visibleEmployees}
        fixedEmployeeId={isOwner ? null : myEmployeeId}
        onClose={() => setModalOpen(false)}
        onSubmit={handleAddPayment}
      />

      <EditPaymentModal
        open={Boolean(editingPayment)}
        initial={editingPayment}
        onClose={() => setEditingPayment(null)}
        onSubmit={handleEditPayment}
      />
    </div>
  );
}
