import type { AddPaymentInput, Employee, ImportedAppData, Payment, Shift, ShiftStatus } from '../domain/types';
import { errorResult, okResult, type ActionResult } from '../lib/result';
import { supabase, type Database } from '../lib/supabase';

type EmployeeRow = Database['public']['Tables']['employees']['Row'];
type ShiftRow = Database['public']['Tables']['shifts']['Row'];
type PaymentRow = Database['public']['Tables']['payments']['Row'];

interface AppDataRows {
  employees: Employee[];
  shifts: Shift[];
  payments: Payment[];
}

const getClient = () => {
  if (!supabase) {
    return errorResult('Supabase не настроен. Добавьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.');
  }

  return okResult(supabase);
};

const mapEmployee = (row: EmployeeRow): Employee => ({
  id: row.id,
  userId: row.user_id,
  name: row.name,
  dailyRate: row.daily_rate,
  archived: row.archived,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapShift = (row: ShiftRow): Shift => ({
  id: row.id,
  userId: row.user_id,
  employeeId: row.employee_id,
  date: row.work_date,
  status: row.status,
  rateSnapshot: row.rate_snapshot,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapPayment = (row: PaymentRow): Payment => ({
  id: row.id,
  userId: row.user_id,
  employeeId: row.employee_id,
  amount: row.amount,
  date: row.payment_date,
  comment: row.comment,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const normalizeError = (message: string) => (
  message || 'Непредвиденная ошибка сервера. Попробуйте еще раз.'
);

export const fetchAppData = async (userId: string): Promise<ActionResult<AppDataRows>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const client = clientResult.data;
  const [employeesResult, shiftsResult, paymentsResult] = await Promise.all([
    client
      .from('employees')
      .select('*')
      .eq('user_id', userId)
      .order('archived', { ascending: true })
      .order('name', { ascending: true }),
    client
      .from('shifts')
      .select('*')
      .eq('user_id', userId)
      .order('work_date', { ascending: true }),
    client
      .from('payments')
      .select('*')
      .eq('user_id', userId)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false }),
  ]);

  if (employeesResult.error) return errorResult(normalizeError(employeesResult.error.message));
  if (shiftsResult.error) return errorResult(normalizeError(shiftsResult.error.message));
  if (paymentsResult.error) return errorResult(normalizeError(paymentsResult.error.message));

  return okResult({
    employees: (employeesResult.data ?? []).map(mapEmployee),
    shifts: (shiftsResult.data ?? []).map(mapShift),
    payments: (paymentsResult.data ?? []).map(mapPayment),
  });
};

export const createEmployee = async (
  userId: string,
  name: string,
  dailyRate: number,
): Promise<ActionResult<Employee>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from('employees')
    .insert({
      user_id: userId,
      name,
      daily_rate: dailyRate,
      archived: false,
    })
    .select('*')
    .single();

  if (error) return errorResult(normalizeError(error.message));
  return okResult(mapEmployee(data), 'Сотрудник создан.');
};

export const updateEmployeeRateRemote = async (
  userId: string,
  employeeId: string,
  dailyRate: number,
): Promise<ActionResult<Employee>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from('employees')
    .update({
      daily_rate: dailyRate,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('id', employeeId)
    .select('*')
    .single();

  if (error) return errorResult(normalizeError(error.message));
  return okResult(mapEmployee(data), 'Ставка за смену обновлена.');
};

export const archiveEmployeeRemote = async (
  userId: string,
  employeeId: string,
): Promise<ActionResult<Employee>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from('employees')
    .update({
      archived: true,
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
    .eq('id', employeeId)
    .select('*')
    .single();

  if (error) return errorResult(normalizeError(error.message));
  return okResult(mapEmployee(data), 'Сотрудник отправлен в архив.');
};

export const upsertShiftRemote = async (
  userId: string,
  employeeId: string,
  date: string,
  status: Exclude<ShiftStatus, 'none'>,
  rateSnapshot: number,
): Promise<ActionResult<Shift>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from('shifts')
    .upsert({
      user_id: userId,
      employee_id: employeeId,
      work_date: date,
      status,
      rate_snapshot: rateSnapshot,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,employee_id,work_date' })
    .select('*')
    .single();

  if (error) return errorResult(normalizeError(error.message));
  return okResult(mapShift(data));
};

export const deleteShiftRemote = async (
  userId: string,
  employeeId: string,
  date: string,
): Promise<ActionResult<void>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data
    .from('shifts')
    .delete()
    .eq('user_id', userId)
    .eq('employee_id', employeeId)
    .eq('work_date', date);

  if (error) return errorResult(normalizeError(error.message));
  return okResult(undefined);
};

export const createPaymentRemote = async (
  userId: string,
  input: AddPaymentInput,
): Promise<ActionResult<Payment>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from('payments')
    .insert({
      user_id: userId,
      employee_id: input.employeeId,
      amount: input.amount,
      payment_date: input.date,
      comment: input.comment,
    })
    .select('*')
    .single();

  if (error) return errorResult(normalizeError(error.message));
  return okResult(mapPayment(data), 'Выплата сохранена.');
};

export const deletePaymentRemote = async (
  userId: string,
  paymentId: string,
): Promise<ActionResult<void>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data
    .from('payments')
    .delete()
    .eq('user_id', userId)
    .eq('id', paymentId);

  if (error) return errorResult(normalizeError(error.message));
  return okResult(undefined, 'Выплата удалена.');
};

export const replaceUserDataRemote = async (
  userId: string,
  importedData: ImportedAppData,
): Promise<ActionResult<AppDataRows>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const employeeByLegacyId = new Map(importedData.employees.map((employee) => [employee.id, employee]));

  for (const shift of importedData.shifts) {
    if (!employeeByLegacyId.has(shift.employeeId)) {
      return errorResult('В импорте есть смены, привязанные к несуществующим сотрудникам.');
    }
  }

  for (const payment of importedData.payments) {
    if (!employeeByLegacyId.has(payment.employeeId)) {
      return errorResult('В импорте есть выплаты, привязанные к несуществующим сотрудникам.');
    }
  }

  const client = clientResult.data;
  const employeeIdMap = new Map(importedData.employees.map((employee) => [employee.id, crypto.randomUUID()]));

  const employeesPayload = importedData.employees.map((employee) => ({
    id: employeeIdMap.get(employee.id)!,
    user_id: userId,
    name: employee.name,
    daily_rate: employee.dailyRate,
    archived: employee.archived,
  }));

  const shiftsPayload = importedData.shifts
    .filter((shift) => shift.status !== 'none')
    .map((shift) => ({
      id: crypto.randomUUID(),
      user_id: userId,
      employee_id: employeeIdMap.get(shift.employeeId)!,
      work_date: shift.date,
      status: shift.status as Exclude<ShiftStatus, 'none'>,
      rate_snapshot: shift.rateSnapshot,
    }));

  const paymentsPayload = importedData.payments.map((payment) => ({
    id: crypto.randomUUID(),
    user_id: userId,
    employee_id: employeeIdMap.get(payment.employeeId)!,
    amount: payment.amount,
    payment_date: payment.date,
    comment: payment.comment,
  }));

  const deletePayments = await client.from('payments').delete().eq('user_id', userId);
  if (deletePayments.error) return errorResult(normalizeError(deletePayments.error.message));

  const deleteShifts = await client.from('shifts').delete().eq('user_id', userId);
  if (deleteShifts.error) return errorResult(normalizeError(deleteShifts.error.message));

  const deleteEmployees = await client.from('employees').delete().eq('user_id', userId);
  if (deleteEmployees.error) return errorResult(normalizeError(deleteEmployees.error.message));

  if (employeesPayload.length > 0) {
    const insertEmployees = await client.from('employees').insert(employeesPayload);
    if (insertEmployees.error) return errorResult(normalizeError(insertEmployees.error.message));
  }

  if (shiftsPayload.length > 0) {
    const insertShifts = await client.from('shifts').insert(shiftsPayload);
    if (insertShifts.error) return errorResult(normalizeError(insertShifts.error.message));
  }

  if (paymentsPayload.length > 0) {
    const insertPayments = await client.from('payments').insert(paymentsPayload);
    if (insertPayments.error) return errorResult(normalizeError(insertPayments.error.message));
  }

  return fetchAppData(userId);
};
