import { Trash2, Wallet } from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AddPaymentModal } from '../components/AddPaymentModal';
import { BottomNav } from '../components/BottomNav';
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

export default function PaymentsPage() {
  const {
    employees,
    payments,
    addPayment,
    deletePayment,
    getEmployeeLifetimeStats,
  } = useApp();

  const [selectedEmployeeId, setSelectedEmployeeId] = useState('all');
  const [modalOpen, setModalOpen] = useState(false);

  const activeEmployees = employees.filter((employee) => !employee.archived);

  const visiblePayments = useMemo(() => (
    selectedEmployeeId === 'all'
      ? payments
      : payments.filter((payment) => payment.employeeId === selectedEmployeeId)
  ), [payments, selectedEmployeeId]);

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
    const result = await deletePayment(id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(result.message ?? 'Выплата удалена.');
  };

  return (
    <div className="min-h-screen bg-stone-50">
      <main className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6">
        <Card className="border-orange-100 bg-[radial-gradient(circle_at_top_left,#fff7ed,white_55%)]">
          <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="w-fit rounded-full bg-orange-100 px-4 py-1.5 text-sm font-semibold text-orange-700">
                Выплаты
              </div>
              <h1 className="mt-3 text-3xl font-semibold tracking-tight text-stone-900">
                История выплат и текущая задолженность
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-stone-600">
                Фиксируйте авансы, зарплату и корректировки. Баланс ниже считается по всем
                отработанным сменам и всем сохраненным выплатам.
              </p>
            </div>

            <Button onClick={() => setModalOpen(true)} className="bg-orange-600 hover:bg-orange-500">
              <Wallet className="h-4 w-4" />
              Добавить выплату
            </Button>
          </CardContent>
        </Card>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {activeEmployees.map((employee) => {
            const stats = getEmployeeLifetimeStats(employee.id);
            return (
              <Card key={employee.id}>
                <CardContent className="p-5">
                  <div className="text-sm text-muted-foreground">{employee.name}</div>
                  <div className="mt-3 text-2xl font-semibold">{money(stats.due)}</div>
                  <div className="mt-2 text-xs text-muted-foreground">
                    Общий долг | Начислено {money(stats.earned)} | Выплачено {money(stats.paid)}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </section>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-4 space-y-0">
            <CardTitle>Журнал выплат</CardTitle>
            <select
              className="h-10 rounded-md border bg-input-background px-3 text-sm"
              value={selectedEmployeeId}
              onChange={(event) => setSelectedEmployeeId(event.target.value)}
            >
              <option value="all">Все сотрудники</option>
              {employees.map((employee) => (
                <option key={employee.id} value={employee.id}>
                  {employee.name}
                </option>
              ))}
            </select>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Дата</TableHead>
                  <TableHead>Сотрудник</TableHead>
                  <TableHead>Сумма</TableHead>
                  <TableHead>Комментарий</TableHead>
                  <TableHead className="w-[80px]">Действие</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {visiblePayments.map((payment) => {
                  const employee = employees.find((item) => item.id === payment.employeeId);

                  return (
                    <TableRow key={payment.id}>
                      <TableCell>{payment.date}</TableCell>
                      <TableCell>{employee?.name ?? 'Неизвестный сотрудник'}</TableCell>
                      <TableCell>{money(payment.amount)}</TableCell>
                      <TableCell>{payment.comment || '-'}</TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => void handleDeletePayment(payment.id)}
                        >
                          <Trash2 className="h-4 w-4 text-rose-600" />
                        </Button>
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
        employees={activeEmployees}
        onClose={() => setModalOpen(false)}
        onSubmit={handleAddPayment}
      />
    </div>
  );
}
