import type {
  AddPaymentInput,
  Employee,
  ImportedAppData,
  Payment,
  PaymentStatus,
  Shift,
  ShiftStatusDb,
  UserAccess,
} from '../domain/types';
import { errorResult, okResult, type ActionResult } from '../lib/result';
import { supabase, type Database } from '../lib/supabase';
import { translateSupabaseError } from '../lib/supabaseErrors';

type EmployeeRow = Database['public']['Tables']['employees']['Row'];
type ShiftRow = Database['public']['Tables']['shifts']['Row'];
type PaymentRow = Database['public']['Tables']['payments']['Row'];

export interface AppDataRows {
  employees: Employee[];
  shifts: Shift[];
  payments: Payment[];
  access: UserAccess;
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
  authUserId: row.auth_user_id,
  isOwner: row.is_owner,
  hiredAt: row.hired_at,
  name: row.name,
  dailyRate: row.daily_rate,
  archived: row.archived,
  archivedAt: row.archived_at,
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
  status: row.status,
  createdByAuthUserId: row.created_by_auth_user_id,
  confirmedByAuthUserId: row.confirmed_by_auth_user_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const normalizeError = (message: string) => translateSupabaseError(message);

const fetchOwnerData = async (ownerUserId: string): Promise<ActionResult<{
  employees: Employee[];
  shifts: Shift[];
  payments: Payment[];
}>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const client = clientResult.data;
  const [employeesResult, shiftsResult, paymentsResult] = await Promise.all([
    client
      .from('employees')
      .select('*')
      .eq('user_id', ownerUserId)
      .order('archived', { ascending: true })
      .order('name', { ascending: true }),
    client
      .from('shifts')
      .select('*')
      .eq('user_id', ownerUserId)
      .order('work_date', { ascending: true }),
    client
      .from('payments')
      .select('*')
      .eq('user_id', ownerUserId)
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

const fetchEmployeeData = async (employee: Employee): Promise<ActionResult<{
  employees: Employee[];
  shifts: Shift[];
  payments: Payment[];
}>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const client = clientResult.data;
  const [shiftsResult, paymentsResult] = await Promise.all([
    client
      .from('shifts')
      .select('*')
      .eq('employee_id', employee.id)
      .order('work_date', { ascending: true }),
    client
      .from('payments')
      .select('*')
      .eq('employee_id', employee.id)
      .order('payment_date', { ascending: false })
      .order('created_at', { ascending: false }),
  ]);

  if (shiftsResult.error) return errorResult(normalizeError(shiftsResult.error.message));
  if (paymentsResult.error) return errorResult(normalizeError(paymentsResult.error.message));

  return okResult({
    employees: [employee],
    shifts: (shiftsResult.data ?? []).map(mapShift),
    payments: (paymentsResult.data ?? []).map(mapPayment),
  });
};

export const fetchAppData = async (authUserId: string): Promise<ActionResult<AppDataRows>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const client = clientResult.data;
  const ownerEmployeesResult = await client
    .from('employees')
    .select('*')
    .eq('user_id', authUserId)
    .order('archived', { ascending: true })
    .order('name', { ascending: true });

  if (ownerEmployeesResult.error) {
    return errorResult(normalizeError(ownerEmployeesResult.error.message));
  }

  const ownerEmployees = (ownerEmployeesResult.data ?? []).map(mapEmployee);
  if (ownerEmployees.length > 0) {
    const ownerDataResult = await fetchOwnerData(authUserId);
    if (!ownerDataResult.ok) return ownerDataResult;

    return okResult({
      ...ownerDataResult.data,
      access: {
        role: 'owner',
        ownerUserId: authUserId,
        employeeId: null,
      },
    });
  }

  const linkedEmployeeResult = await client
    .from('employees')
    .select('*')
    .eq('auth_user_id', authUserId)
    .limit(1)
    .maybeSingle();

  if (linkedEmployeeResult.error) {
    return errorResult(normalizeError(linkedEmployeeResult.error.message));
  }

  if (linkedEmployeeResult.data) {
    const employee = mapEmployee(linkedEmployeeResult.data);
    const employeeDataResult = await fetchEmployeeData(employee);
    if (!employeeDataResult.ok) return employeeDataResult;

    return okResult({
      ...employeeDataResult.data,
      access: {
        role: 'employee',
        ownerUserId: employee.userId,
        employeeId: employee.id,
      },
    });
  }

  return okResult({
    employees: [],
    shifts: [],
    payments: [],
    access: {
      role: 'owner',
      ownerUserId: authUserId,
      employeeId: null,
    },
  });
};

export const createEmployee = async (
  ownerUserId: string,
  name: string,
  dailyRate: number,
): Promise<ActionResult<Employee>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from('employees')
    .insert({
      user_id: ownerUserId,
      name,
      daily_rate: dailyRate,
      archived: false,
      is_owner: false,
    })
    .select('*')
    .single();

  if (error) return errorResult(normalizeError(error.message));
  return okResult(mapEmployee(data), 'Сотрудник создан.');
};

export const updateEmployeeRateRemote = async (
  ownerUserId: string,
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
    .eq('user_id', ownerUserId)
    .eq('id', employeeId)
    .select('*')
    .single();

  if (error) return errorResult(normalizeError(error.message));
  return okResult(mapEmployee(data), 'Ставка за смену обновлена.');
};

export const archiveEmployeeRemote = async (
  ownerUserId: string,
  employeeId: string,
): Promise<ActionResult<Employee>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const now = new Date().toISOString();
  const { data, error } = await clientResult.data
    .from('employees')
    .update({
      archived: true,
      archived_at: now,
      updated_at: now,
    })
    .eq('user_id', ownerUserId)
    .eq('id', employeeId)
    .select('*')
    .single();

  if (error) return errorResult(normalizeError(error.message));
  return okResult(mapEmployee(data), 'Сотрудник отправлен в архив.');
};

export const deleteArchivedEmployeeRemote = async (
  ownerUserId: string,
  employeeId: string,
): Promise<ActionResult<void>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const client = clientResult.data;
  const employeeResult = await client
    .from('employees')
    .select('archived,is_owner')
    .eq('user_id', ownerUserId)
    .eq('id', employeeId)
    .single();

  if (employeeResult.error) return errorResult(normalizeError(employeeResult.error.message));
  if (!employeeResult.data.archived) {
    return errorResult('Удаление доступно только для архивных сотрудников.');
  }

  if (employeeResult.data.is_owner) {
    return errorResult('Нельзя удалить профиль владельца.');
  }

  const { error } = await client
    .from('employees')
    .delete()
    .eq('user_id', ownerUserId)
    .eq('id', employeeId)
    .eq('archived', true);

  if (error) return errorResult(normalizeError(error.message));
  return okResult(undefined, 'Архивный сотрудник и его данные удалены.');
};

export const upsertShiftRemote = async (
  ownerUserId: string,
  employeeId: string,
  date: string,
  status: ShiftStatusDb,
  rateSnapshot: number,
): Promise<ActionResult<Shift>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from('shifts')
    .upsert({
      user_id: ownerUserId,
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
  ownerUserId: string,
  employeeId: string,
  date: string,
): Promise<ActionResult<void>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data
    .from('shifts')
    .delete()
    .eq('user_id', ownerUserId)
    .eq('employee_id', employeeId)
    .eq('work_date', date);

  if (error) return errorResult(normalizeError(error.message));
  return okResult(undefined);
};

interface CreatePaymentOptions {
  authUserId: string;
  access: UserAccess;
  input: AddPaymentInput;
}

export const createPaymentRemote = async (
  options: CreatePaymentOptions,
): Promise<ActionResult<Payment>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const isOwner = options.access.role === 'owner';
  const status: PaymentStatus = isOwner ? options.input.status ?? 'confirmed' : 'entered';
  const confirmedByAuthUserId = status === 'confirmed' ? options.authUserId : null;

  const { data, error } = await clientResult.data
    .from('payments')
    .insert({
      user_id: options.access.ownerUserId,
      employee_id: options.input.employeeId,
      amount: options.input.amount,
      payment_date: options.input.date,
      comment: options.input.comment,
      status,
      created_by_auth_user_id: options.authUserId,
      confirmed_by_auth_user_id: confirmedByAuthUserId,
    })
    .select('*')
    .single();

  if (error) return errorResult(normalizeError(error.message));
  return okResult(mapPayment(data), 'Выплата сохранена.');
};

export const updatePaymentRemote = async (
  paymentId: string,
  patch: Partial<{
    amount: number;
    date: string;
    comment: string;
  }>,
): Promise<ActionResult<Payment>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const updatePayload: Database['public']['Tables']['payments']['Update'] = {
    updated_at: new Date().toISOString(),
  };

  if (typeof patch.amount === 'number') updatePayload.amount = patch.amount;
  if (typeof patch.date === 'string') updatePayload.payment_date = patch.date;
  if (typeof patch.comment === 'string') updatePayload.comment = patch.comment;

  const { data, error } = await clientResult.data
    .from('payments')
    .update(updatePayload)
    .eq('id', paymentId)
    .select('*')
    .single();

  if (error) return errorResult(normalizeError(error.message));
  return okResult(mapPayment(data), 'Выплата обновлена.');
};

export const confirmPaymentRemote = async (
  paymentId: string,
  authUserId: string,
): Promise<ActionResult<Payment>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data
    .from('payments')
    .update({
      status: 'confirmed',
      confirmed_by_auth_user_id: authUserId,
      updated_at: new Date().toISOString(),
    })
    .eq('id', paymentId)
    .select('*')
    .single();

  if (error) return errorResult(normalizeError(error.message));
  return okResult(mapPayment(data), 'Выплата подтверждена.');
};

export const deletePaymentRemote = async (
  paymentId: string,
): Promise<ActionResult<void>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data
    .from('payments')
    .delete()
    .eq('id', paymentId);

  if (error) return errorResult(normalizeError(error.message));
  return okResult(undefined, 'Выплата удалена.');
};

export const replaceUserDataRemote = async (
  ownerUserId: string,
  authUserId: string,
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
    user_id: ownerUserId,
    name: employee.name,
    daily_rate: employee.dailyRate,
    archived: employee.archived,
    archived_at: employee.archived ? new Date().toISOString() : null,
    is_owner: false,
  }));

  const shiftsPayload = importedData.shifts.map((shift) => ({
    id: crypto.randomUUID(),
    user_id: ownerUserId,
    employee_id: employeeIdMap.get(shift.employeeId)!,
    work_date: shift.date,
    status: shift.status,
    rate_snapshot: shift.rateSnapshot,
  }));

  const paymentsPayload = importedData.payments.map((payment) => ({
    id: crypto.randomUUID(),
    user_id: ownerUserId,
    employee_id: employeeIdMap.get(payment.employeeId)!,
    amount: payment.amount,
    payment_date: payment.date,
    comment: payment.comment,
    status: payment.status ?? 'confirmed',
    created_by_auth_user_id: authUserId,
    confirmed_by_auth_user_id: payment.status === 'entered' ? null : authUserId,
  }));

  const deletePayments = await client.from('payments').delete().eq('user_id', ownerUserId);
  if (deletePayments.error) return errorResult(normalizeError(deletePayments.error.message));

  const deleteShifts = await client.from('shifts').delete().eq('user_id', ownerUserId);
  if (deleteShifts.error) return errorResult(normalizeError(deleteShifts.error.message));

  const deleteEmployees = await client.from('employees').delete().eq('user_id', ownerUserId);
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

  return fetchAppData(ownerUserId);
};
