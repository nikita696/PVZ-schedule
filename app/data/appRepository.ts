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

type OrganizationRow = Database['public']['Tables']['organizations']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type EmployeeRow = Database['public']['Tables']['employees']['Row'];
type ShiftRow = Database['public']['Tables']['shifts']['Row'];
type PaymentRow = Database['public']['Tables']['payments']['Row'];

export interface AppDataRows {
  employees: Employee[];
  shifts: Shift[];
  payments: Payment[];
  access: UserAccess | null;
}

interface AccessContext {
  profile: ProfileRow;
  organization: OrganizationRow;
  access: UserAccess;
}

const getClient = () => {
  if (!supabase) {
    return errorResult('Supabase не настроен. Добавьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.');
  }

  return okResult(supabase);
};

const normalizeError = (message: string) => translateSupabaseError(message);

const mapEmployee = (row: EmployeeRow): Employee => ({
  id: row.id,
  userId: row.user_id,
  organizationId: row.organization_id,
  profileId: row.profile_id,
  authUserId: row.auth_user_id,
  workEmail: row.work_email,
  status: row.status,
  createdByProfileId: row.created_by_profile_id,
  isOwner: row.is_owner,
  hiredAt: row.hired_at,
  name: row.name,
  dailyRate: row.daily_rate,
  archived: row.archived || row.status === 'archived',
  archivedAt: row.archived_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapShift = (row: ShiftRow): Shift => ({
  id: row.id,
  userId: row.user_id,
  organizationId: row.organization_id,
  employeeId: row.employee_id,
  date: row.work_date,
  status: row.status,
  rateSnapshot: row.rate_snapshot,
  createdByProfileId: row.created_by_profile_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapPayment = (row: PaymentRow): Payment => ({
  id: row.id,
  userId: row.user_id,
  organizationId: row.organization_id,
  employeeId: row.employee_id,
  amount: row.amount,
  date: row.payment_date,
  comment: row.comment,
  status: row.status,
  createdByAuthUserId: row.created_by_auth_user_id,
  confirmedByAuthUserId: row.confirmed_by_auth_user_id,
  createdByProfileId: row.created_by_profile_id,
  confirmedByProfileId: row.confirmed_by_profile_id,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const fetchAccessContext = async (authUserId: string): Promise<ActionResult<AccessContext | null>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const client = clientResult.data;
  const profileResult = await client
    .from('profiles')
    .select('*')
    .eq('id', authUserId)
    .maybeSingle();

  if (profileResult.error) {
    return errorResult(normalizeError(profileResult.error.message));
  }

  let profile = profileResult.data;
  if (!profile) {
    const ensureResult = await client.rpc('ensure_profile_from_registration');
    if (ensureResult.error) {
      if (/REGISTRATION_NOT_FOUND/i.test(ensureResult.error.message)) {
        return okResult(null);
      }

      return errorResult(normalizeError(ensureResult.error.message));
    }

    const refreshedProfileResult = await client
      .from('profiles')
      .select('*')
      .eq('id', authUserId)
      .maybeSingle();

    if (refreshedProfileResult.error) {
      return errorResult(normalizeError(refreshedProfileResult.error.message));
    }

    profile = refreshedProfileResult.data;
    if (!profile) {
      return okResult(null);
    }
  }

  if (!profile.is_active) {
    return errorResult('Профиль пользователя отключен. Обратись к администратору.');
  }

  const organizationResult = await client
    .from('organizations')
    .select('*')
    .eq('id', profile.organization_id)
    .single();

  if (organizationResult.error) {
    return errorResult(normalizeError(organizationResult.error.message));
  }

  let employeeId: string | null = null;
  if (profile.role === 'employee') {
    const employeeResult = await client
      .from('employees')
      .select('id')
      .eq('organization_id', profile.organization_id)
      .eq('profile_id', authUserId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();

    if (employeeResult.error) {
      return errorResult(normalizeError(employeeResult.error.message));
    }

    employeeId = employeeResult.data?.id ?? null;
  }

  const ownerUserId = organizationResult.data.created_by ?? authUserId;
  return okResult({
    profile,
    organization: organizationResult.data,
    access: {
      role: profile.role,
      organizationId: profile.organization_id,
      ownerUserId,
      profileId: profile.id,
      employeeId,
    },
  });
};

const fetchScopedData = async (access: UserAccess): Promise<ActionResult<{
  employees: Employee[];
  shifts: Shift[];
  payments: Payment[];
}>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const client = clientResult.data;
  const paymentsQuery = client
    .from('payments')
    .select('*')
    .eq('organization_id', access.organizationId)
    .order('payment_date', { ascending: false })
    .order('created_at', { ascending: false });

  const scopedPaymentsQuery = access.role === 'employee' && access.employeeId
    ? paymentsQuery.eq('employee_id', access.employeeId)
    : paymentsQuery;

  const [employeesResult, shiftsResult, paymentsResult] = await Promise.all([
    client
      .from('employees')
      .select('*')
      .eq('organization_id', access.organizationId)
      .order('archived', { ascending: true })
      .order('name', { ascending: true }),
    client
      .from('shifts')
      .select('*')
      .eq('organization_id', access.organizationId)
      .order('work_date', { ascending: true }),
    scopedPaymentsQuery,
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

export const fetchAppData = async (authUserId: string): Promise<ActionResult<AppDataRows>> => {
  const accessResult = await fetchAccessContext(authUserId);
  if (!accessResult.ok) return accessResult;

  if (!accessResult.data) {
    return okResult({
      employees: [],
      shifts: [],
      payments: [],
      access: null,
    });
  }

  const dataResult = await fetchScopedData(accessResult.data.access);
  if (!dataResult.ok) return dataResult;

  return okResult({
    ...dataResult.data,
    access: accessResult.data.access,
  });
};

interface RequestRegistrationInput {
  email: string;
  role: 'admin' | 'employee';
  displayName: string | null;
}

export const requestRegistrationRemote = async (
  input: RequestRegistrationInput,
): Promise<ActionResult<void>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const normalizedEmail = input.email.trim().toLowerCase();
  if (!normalizedEmail) {
    return errorResult('Введи email.');
  }

  const { error } = await clientResult.data.rpc('request_registration', {
    email_input: normalizedEmail,
    desired_role_input: input.role,
    display_name_input: input.displayName?.trim() || null,
  });

  if (error) return errorResult(normalizeError(error.message));

  return okResult(
    undefined,
    'Письмо со ссылкой отправлено. Перейди по ссылке в почте, чтобы завершить вход.',
  );
};

export const activateEmployeeAccountRemote = async (): Promise<ActionResult<void>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data.rpc('activate_employee_account');
  if (error) return errorResult(normalizeError(error.message));

  return okResult(undefined, 'Аккаунт сотрудника активирован.');
};

export const bootstrapAdminAccountRemote = async (
  organizationName: string | null,
  displayName: string | null,
): Promise<ActionResult<void>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data.rpc('bootstrap_admin_account', {
    organization_name_input: organizationName,
    display_name_input: displayName,
  });

  if (error) return errorResult(normalizeError(error.message));
  return okResult(undefined, 'Профиль администратора создан.');
};

interface CreateEmployeeInput {
  access: UserAccess;
  name: string;
  workEmail: string;
  dailyRate: number;
  hiredAt: string | null;
}

export const createEmployee = async (
  input: CreateEmployeeInput,
): Promise<ActionResult<Employee>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const normalizedName = input.name.trim();
  const normalizedEmail = input.workEmail.trim().toLowerCase();

  if (!normalizedName) {
    return errorResult('Введите имя сотрудника.');
  }

  if (!normalizedEmail) {
    return errorResult('Введите рабочий email сотрудника.');
  }

  const duplicateResult = await clientResult.data
    .from('employees')
    .select('id')
    .eq('organization_id', input.access.organizationId)
    .neq('status', 'archived')
    .ilike('work_email', normalizedEmail)
    .limit(1)
    .maybeSingle();

  if (duplicateResult.error) {
    return errorResult(normalizeError(duplicateResult.error.message));
  }

  if (duplicateResult.data) {
    return errorResult('Сотрудник с таким email уже существует.');
  }

  const { data, error } = await clientResult.data
    .from('employees')
    .insert({
      user_id: input.access.ownerUserId,
      organization_id: input.access.organizationId,
      name: normalizedName,
      work_email: normalizedEmail,
      daily_rate: input.dailyRate,
      hired_at: input.hiredAt,
      status: 'pending',
      archived: false,
      archived_at: null,
      is_owner: false,
      created_by_profile_id: input.access.profileId,
    })
    .select('*')
    .single();

  if (error) return errorResult(normalizeError(error.message));
  return okResult(mapEmployee(data), 'Сотрудник создан.');
};

export const updateEmployeeRateRemote = async (
  access: UserAccess,
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
    .eq('organization_id', access.organizationId)
    .eq('id', employeeId)
    .select('*')
    .single();

  if (error) return errorResult(normalizeError(error.message));
  return okResult(mapEmployee(data), 'Ставка за смену обновлена.');
};

export const archiveEmployeeRemote = async (
  access: UserAccess,
  employeeId: string,
): Promise<ActionResult<Employee>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const now = new Date().toISOString();
  const { data, error } = await clientResult.data
    .from('employees')
    .update({
      status: 'archived',
      archived: true,
      archived_at: now,
      updated_at: now,
    })
    .eq('organization_id', access.organizationId)
    .eq('id', employeeId)
    .select('*')
    .single();

  if (error) return errorResult(normalizeError(error.message));
  return okResult(mapEmployee(data), 'Сотрудник отправлен в архив.');
};

export const deleteArchivedEmployeeRemote = async (
  access: UserAccess,
  employeeId: string,
): Promise<ActionResult<void>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const client = clientResult.data;
  const employeeResult = await client
    .from('employees')
    .select('status,is_owner')
    .eq('organization_id', access.organizationId)
    .eq('id', employeeId)
    .single();

  if (employeeResult.error) return errorResult(normalizeError(employeeResult.error.message));
  if (employeeResult.data.status !== 'archived') {
    return errorResult('Удаление доступно только для архивных сотрудников.');
  }

  if (employeeResult.data.is_owner) {
    return errorResult('Нельзя удалить профиль владельца.');
  }

  const { error } = await client
    .from('employees')
    .delete()
    .eq('organization_id', access.organizationId)
    .eq('id', employeeId)
    .eq('status', 'archived');

  if (error) return errorResult(normalizeError(error.message));
  return okResult(undefined, 'Архивный сотрудник и его данные удалены.');
};

export const upsertShiftRemote = async (
  access: UserAccess,
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
      user_id: access.ownerUserId,
      organization_id: access.organizationId,
      employee_id: employeeId,
      work_date: date,
      status,
      rate_snapshot: rateSnapshot,
      created_by_profile_id: access.profileId,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,employee_id,work_date' })
    .select('*')
    .single();

  if (error) return errorResult(normalizeError(error.message));
  return okResult(mapShift(data));
};

export const deleteShiftRemote = async (
  access: UserAccess,
  employeeId: string,
  date: string,
): Promise<ActionResult<void>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data
    .from('shifts')
    .delete()
    .eq('organization_id', access.organizationId)
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

  const isAdmin = options.access.role === 'admin';
  const status: PaymentStatus = isAdmin ? options.input.status ?? 'confirmed' : 'pending_confirmation';
  const confirmedByAuthUserId = status === 'confirmed' ? options.authUserId : null;
  const confirmedByProfileId = status === 'confirmed' ? options.access.profileId : null;

  const { data, error } = await clientResult.data
    .from('payments')
    .insert({
      user_id: options.access.ownerUserId,
      organization_id: options.access.organizationId,
      employee_id: options.input.employeeId,
      amount: options.input.amount,
      payment_date: options.input.date,
      comment: options.input.comment,
      status,
      created_by_auth_user_id: options.authUserId,
      confirmed_by_auth_user_id: confirmedByAuthUserId,
      created_by_profile_id: options.access.profileId,
      confirmed_by_profile_id: confirmedByProfileId,
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
    status: PaymentStatus;
    confirmedByAuthUserId: string | null;
    confirmedByProfileId: string | null;
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
  if (typeof patch.status === 'string') updatePayload.status = patch.status;
  if (patch.confirmedByAuthUserId !== undefined) updatePayload.confirmed_by_auth_user_id = patch.confirmedByAuthUserId;
  if (patch.confirmedByProfileId !== undefined) updatePayload.confirmed_by_profile_id = patch.confirmedByProfileId;

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
  profileId: string,
): Promise<ActionResult<Payment>> => (
  updatePaymentRemote(paymentId, {
    status: 'confirmed',
    confirmedByAuthUserId: authUserId,
    confirmedByProfileId: profileId,
  })
);

export const rejectPaymentRemote = async (
  paymentId: string,
  profileId: string,
): Promise<ActionResult<Payment>> => (
  updatePaymentRemote(paymentId, {
    status: 'rejected',
    confirmedByAuthUserId: null,
    confirmedByProfileId: profileId,
  })
);

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
  access: UserAccess,
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

  const employeesPayload = importedData.employees.map((employee) => {
    const archivedAt = employee.archived ? new Date().toISOString() : null;
    return {
      id: employeeIdMap.get(employee.id)!,
      user_id: access.ownerUserId,
      organization_id: access.organizationId,
      profile_id: null,
      auth_user_id: null,
      work_email: null,
      status: employee.archived ? 'archived' : 'active',
      created_by_profile_id: access.profileId,
      name: employee.name,
      daily_rate: employee.dailyRate,
      archived: employee.archived,
      archived_at: archivedAt,
      is_owner: false,
    } satisfies Database['public']['Tables']['employees']['Insert'];
  });

  const shiftsPayload = importedData.shifts.map((shift) => ({
    id: crypto.randomUUID(),
    user_id: access.ownerUserId,
    organization_id: access.organizationId,
    employee_id: employeeIdMap.get(shift.employeeId)!,
    work_date: shift.date,
    status: shift.status,
    rate_snapshot: shift.rateSnapshot,
    created_by_profile_id: access.profileId,
  } satisfies Database['public']['Tables']['shifts']['Insert']));

  const paymentsPayload = importedData.payments.map((payment) => {
    const normalizedStatus = payment.status === 'pending_confirmation' || payment.status === 'rejected'
      ? payment.status
      : 'confirmed';

    return {
      id: crypto.randomUUID(),
      user_id: access.ownerUserId,
      organization_id: access.organizationId,
      employee_id: employeeIdMap.get(payment.employeeId)!,
      amount: payment.amount,
      payment_date: payment.date,
      comment: payment.comment,
      status: normalizedStatus,
      created_by_auth_user_id: authUserId,
      confirmed_by_auth_user_id: normalizedStatus === 'confirmed' ? authUserId : null,
      created_by_profile_id: access.profileId,
      confirmed_by_profile_id: normalizedStatus === 'confirmed' ? access.profileId : null,
    } satisfies Database['public']['Tables']['payments']['Insert'];
  });

  const deletePayments = await client.from('payments').delete().eq('organization_id', access.organizationId);
  if (deletePayments.error) return errorResult(normalizeError(deletePayments.error.message));

  const deleteShifts = await client.from('shifts').delete().eq('organization_id', access.organizationId);
  if (deleteShifts.error) return errorResult(normalizeError(deleteShifts.error.message));

  const deleteEmployees = await client.from('employees').delete().eq('organization_id', access.organizationId);
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

  return fetchAppData(authUserId);
};
