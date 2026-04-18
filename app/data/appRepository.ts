import { normalizeShiftStatus, type LegacyShiftStatus } from '../domain/shiftStatus';
import type {
  AddPaymentInput,
  Employee,
  EmployeeRateHistory,
  ImportedAppData,
  MonthStatus,
  Payment,
  PaymentStatus,
  ScheduleMonth,
  Shift,
  ShiftStatusDb,
  UserAccess,
} from '../domain/types';
import { getLocalISODate } from '../lib/date';
import { pickCurrentLanguage } from '../lib/i18n';
import { errorResult, okResult, type ActionResult } from '../lib/result';
import { supabase, type Database } from '../lib/supabase';
import { translateSupabaseError } from '../lib/supabaseErrors';

type OrganizationRow = Database['public']['Tables']['organizations']['Row'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];
type EmployeeRow = Database['public']['Tables']['employees']['Row'];
type RateHistoryRow = Database['public']['Tables']['employee_rate_history']['Row'];
type ScheduleMonthRow = Database['public']['Tables']['schedule_months']['Row'];
type ShiftRow = Database['public']['Tables']['shifts']['Row'];
type PaymentRow = Database['public']['Tables']['payments']['Row'];

export interface AppDataRows {
  employees: Employee[];
  rateHistory: EmployeeRateHistory[];
  scheduleMonths: ScheduleMonth[];
  shifts: Shift[];
  payments: Payment[];
  access: UserAccess | null;
}

interface AccessContext {
  profile: ProfileRow;
  organization: OrganizationRow;
  access: UserAccess;
}

const scoreLinkedEmployee = (
  row: EmployeeRow,
  authUserId: string,
  role: UserAccess['role'],
): number => {
  let score = 0;

  if (row.profile_id === authUserId) score += 8;
  if (row.auth_user_id === authUserId) score += 6;
  if (row.status === 'active') score += 4;
  if (role === 'admin' && row.is_owner) score += 3;
  if (role === 'employee' && !row.is_owner) score += 3;

  return score;
};

const pickLinkedEmployee = (
  rows: EmployeeRow[],
  authUserId: string,
  role: UserAccess['role'],
): EmployeeRow | null => {
  if (rows.length === 0) {
    return null;
  }

  return [...rows].sort((left, right) => {
    const scoreDiff = scoreLinkedEmployee(right, authUserId, role) - scoreLinkedEmployee(left, authUserId, role);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }

    return left.created_at.localeCompare(right.created_at);
  })[0] ?? null;
};

const LEGACY_SHIFT_STATUSES = new Set<LegacyShiftStatus>([
  'working',
  'planned-work',
  'worked',
  'day-off',
  'vacation',
  'sick',
  'no-show',
  'shift',
  'day_off',
  'sick_leave',
  'no_show',
  'replacement',
  'no_shift',
  'none',
]);

const getClient = () => {
  if (!supabase) {
    return errorResult(pickCurrentLanguage(
      'Supabase не настроен. Проверь VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.',
      'Supabase is not configured. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.',
    ));
  }

  return okResult(supabase);
};

const normalizeError = (message: string) => translateSupabaseError(message);

const isLegacyShiftStatus = (value: unknown): value is LegacyShiftStatus => (
  typeof value === 'string' && LEGACY_SHIFT_STATUSES.has(value as LegacyShiftStatus)
);

const normalizeShiftValue = (value: unknown, workDate: string): ShiftStatusDb | null => {
  if (!isLegacyShiftStatus(value)) return null;
  return normalizeShiftStatus(value, workDate);
};

const normalizePaymentStatus = (value: unknown): PaymentStatus => {
  if (value === 'approved' || value === 'rejected' || value === 'pending') return value;
  if (value === 'confirmed') return 'approved';
  if (value === 'pending_confirmation') return 'pending';
  return 'pending';
};

const isMissingRelationError = (message: string): boolean => (
  /does not exist|relation .* does not exist/i.test(message)
);

const isMissingFunctionError = (message: string): boolean => (
  /function .* does not exist|does not exist/i.test(message)
);

const mapEmployee = (row: EmployeeRow): Employee => ({
  id: row.id,
  userId: row.user_id,
  organizationId: row.organization_id,
  profileId: row.profile_id,
  authUserId: row.auth_user_id,
  workEmail: row.work_email,
  status: row.status === 'archived' ? 'archived' : 'active',
  createdByProfileId: row.created_by_profile_id,
  isOwner: row.is_owner,
  hiredAt: row.hired_at,
  terminatedAt: row.terminated_at ?? null,
  name: row.name,
  dailyRate: row.daily_rate,
  archived: row.archived || row.status === 'archived',
  archivedAt: row.archived_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapRateHistory = (row: RateHistoryRow): EmployeeRateHistory => ({
  id: row.id,
  employeeId: row.employee_id,
  organizationId: row.organization_id,
  rate: row.rate,
  validFrom: row.valid_from,
  validTo: row.valid_to,
  createdByProfileId: row.created_by_profile_id,
  createdAt: row.created_at,
});

const mapScheduleMonth = (row: ScheduleMonthRow): ScheduleMonth => ({
  id: row.id,
  organizationId: row.organization_id,
  year: row.year,
  month: row.month,
  status: row.status,
  approvedByProfileId: row.approved_by_profile_id,
  approvedAt: row.approved_at,
  closedByProfileId: row.closed_by_profile_id,
  closedAt: row.closed_at,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const mapShift = (row: ShiftRow): Shift => {
  const requestedStatus = normalizeShiftValue(row.requested_status ?? row.status, row.work_date);
  const approvedStatus = normalizeShiftValue(row.approved_status ?? row.status, row.work_date);
  const actualStatus = normalizeShiftValue(row.actual_status, row.work_date);
  const status = normalizeShiftValue(row.status, row.work_date) ?? approvedStatus ?? requestedStatus ?? 'no_shift';

  return {
    id: row.id,
    userId: row.user_id,
    organizationId: row.organization_id,
    employeeId: row.employee_id,
    date: row.work_date,
    status,
    requestedStatus,
    approvedStatus,
    actualStatus,
    rateSnapshot: row.rate_snapshot,
    createdByProfileId: row.created_by_profile_id,
    requestedByProfileId: row.requested_by_profile_id ?? row.created_by_profile_id,
    approvedByProfileId: row.approved_by_profile_id ?? null,
    actualByProfileId: row.actual_by_profile_id ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
};

const mapPayment = (row: PaymentRow): Payment => ({
  id: row.id,
  userId: row.user_id,
  organizationId: row.organization_id,
  employeeId: row.employee_id,
  amount: row.amount,
  date: row.payment_date,
  comment: row.comment,
  status: normalizePaymentStatus(row.status),
  requestedByAuthUserId: row.requested_by_auth_user_id ?? row.created_by_auth_user_id,
  approvedByAuthUserId: row.approved_by_auth_user_id ?? row.confirmed_by_auth_user_id,
  requestedByProfileId: row.requested_by_profile_id ?? row.created_by_profile_id,
  approvedByProfileId: row.approved_by_profile_id ?? row.confirmed_by_profile_id,
  approvedAt: row.approved_at ?? (row.status === 'confirmed' ? row.updated_at : null),
  editedByAdmin: row.edited_by_admin ?? false,
  createdAt: row.created_at,
  updatedAt: row.updated_at,
});

const deriveRateHistoryFallback = (employees: Employee[]): EmployeeRateHistory[] => employees.map((employee) => ({
  id: `fallback-rate:${employee.id}`,
  employeeId: employee.id,
  organizationId: employee.organizationId,
  rate: employee.dailyRate,
  validFrom: employee.hiredAt ?? employee.createdAt.slice(0, 10),
  validTo: employee.terminatedAt,
  createdByProfileId: employee.createdByProfileId,
  createdAt: employee.createdAt,
}));

const deriveScheduleMonthFallback = (
  organizationId: string,
  shifts: Shift[],
  payments: Payment[],
): ScheduleMonth[] => {
  const unique = new Map<string, ScheduleMonth>();

  const register = (date: string) => {
    const [year, month] = date.split('-').map(Number);
    const key = `${year}-${month}`;
    if (unique.has(key)) return;

    unique.set(key, {
      id: `fallback-month:${organizationId}:${key}`,
      organizationId,
      year,
      month,
      status: 'draft',
      approvedByProfileId: null,
      approvedAt: null,
      closedByProfileId: null,
      closedAt: null,
      createdAt: new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`).toISOString(),
      updatedAt: new Date(`${year}-${String(month).padStart(2, '0')}-01T00:00:00.000Z`).toISOString(),
    });
  };

  shifts.forEach((shift) => register(shift.date));
  payments.forEach((payment) => register(payment.date));

  return [...unique.values()].sort((left, right) => (
    left.year === right.year ? left.month - right.month : left.year - right.year
  ));
};

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
  if (!profile || !profile.is_active) {
    const ensureResult = await client.rpc('ensure_profile_from_auth');
    if (ensureResult.error) {
      if (/REGISTRATION_NOT_FOUND|REGISTRATION_REQUIRED/i.test(ensureResult.error.message)) {
        return profile?.is_active === false
          ? errorResult(normalizeError('PROFILE_DISABLED'))
          : okResult(null);
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
    return errorResult(normalizeError('PROFILE_DISABLED'));
  }

  const membershipResult = await client.rpc('ensure_profile_membership');
  if (membershipResult.error && !isMissingFunctionError(membershipResult.error.message)) {
    return errorResult(normalizeError(membershipResult.error.message));
  }

  const organizationResult = await client
    .from('organizations')
    .select('*')
    .eq('id', profile.organization_id)
    .single();

  if (organizationResult.error) {
    return errorResult(normalizeError(organizationResult.error.message));
  }

  const employeeResult = await client
    .from('employees')
    .select('*')
    .eq('organization_id', profile.organization_id)
    .or(`profile_id.eq.${authUserId},auth_user_id.eq.${authUserId}`)
    .neq('status', 'archived')
    .order('created_at', { ascending: true });

  if (employeeResult.error) {
    return errorResult(normalizeError(employeeResult.error.message));
  }

  const linkedEmployee = pickLinkedEmployee(employeeResult.data ?? [], authUserId, profile.role);

  const ownerUserId = organizationResult.data.created_by ?? authUserId;

  return okResult({
    profile,
    organization: organizationResult.data,
    access: {
      role: profile.role,
      organizationId: profile.organization_id,
      ownerUserId,
      profileId: profile.id,
      profileDisplayName: profile.display_name ?? null,
      employeeId: linkedEmployee?.id ?? null,
    },
  });
};

const fetchScopedData = async (access: UserAccess): Promise<ActionResult<Omit<AppDataRows, 'access'>>> => {
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

  const [employeesResult, shiftsResult, paymentsResult, rateHistoryResult, scheduleMonthsResult] = await Promise.all([
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
    client
      .from('employee_rate_history')
      .select('*')
      .eq('organization_id', access.organizationId)
      .order('valid_from', { ascending: true }),
    client
      .from('schedule_months')
      .select('*')
      .eq('organization_id', access.organizationId)
      .order('year', { ascending: true })
      .order('month', { ascending: true }),
  ]);

  if (employeesResult.error) return errorResult(normalizeError(employeesResult.error.message));
  if (shiftsResult.error) return errorResult(normalizeError(shiftsResult.error.message));
  if (paymentsResult.error) return errorResult(normalizeError(paymentsResult.error.message));

  const employees = (employeesResult.data ?? []).map(mapEmployee);
  const shifts = (shiftsResult.data ?? []).map(mapShift);
  const payments = (paymentsResult.data ?? []).map(mapPayment);

  const rateHistory = rateHistoryResult.error
    ? isMissingRelationError(rateHistoryResult.error.message)
      ? deriveRateHistoryFallback(employees)
      : null
    : (rateHistoryResult.data ?? []).map(mapRateHistory);

  if (!rateHistory) {
    return errorResult(normalizeError(rateHistoryResult.error!.message));
  }

  const scheduleMonths = scheduleMonthsResult.error
    ? isMissingRelationError(scheduleMonthsResult.error.message)
      ? deriveScheduleMonthFallback(access.organizationId, shifts, payments)
      : null
    : (scheduleMonthsResult.data ?? []).map(mapScheduleMonth);

  if (!scheduleMonths) {
    return errorResult(normalizeError(scheduleMonthsResult.error!.message));
  }

  return okResult({
    employees,
    rateHistory,
    scheduleMonths,
    shifts,
    payments,
  });
};

export const fetchAppData = async (authUserId: string): Promise<ActionResult<AppDataRows>> => {
  const accessResult = await fetchAccessContext(authUserId);
  if (!accessResult.ok) return accessResult;

  if (!accessResult.data) {
    return okResult({
      employees: [],
      rateHistory: [],
      scheduleMonths: [],
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

interface EnsureProfileFromAuthInput {
  desiredRole?: 'admin' | 'employee' | null;
  displayName?: string | null;
}

export const ensureProfileFromAuthRemote = async (
  input: EnsureProfileFromAuthInput = {},
): Promise<ActionResult<{ organizationId: string; role: 'admin' | 'employee' }>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc('ensure_profile_from_auth', {
    desired_role_input: input.desiredRole ?? null,
    display_name_input: input.displayName?.trim() || null,
  });

  if (error) {
    return errorResult(normalizeError(error.message));
  }

  return okResult({
    organizationId: data.organization_id,
    role: data.role,
  });
};

interface CreateEmployeeInput {
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

  const { data, error } = await clientResult.data.rpc('create_employee_record', {
    name_input: input.name.trim(),
    work_email_input: input.workEmail.trim().toLowerCase(),
    daily_rate_input: input.dailyRate,
    hired_at_input: input.hiredAt,
  });

  if (error) return errorResult(normalizeError(error.message));
    return okResult(mapEmployee(data), pickCurrentLanguage('Сотрудник добавлен.', 'Employee added.'));
};

export const updateEmployeeRateRemote = async (
  employeeId: string,
  dailyRate: number,
): Promise<ActionResult<Employee>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc('update_employee_rate_record', {
    employee_id_input: employeeId,
    daily_rate_input: dailyRate,
    valid_from_input: getLocalISODate(),
  });

  if (error) return errorResult(normalizeError(error.message));
  return okResult(mapEmployee(data), pickCurrentLanguage('Ставка обновлена.', 'Rate updated.'));
};

export const updateEmployeeNameRemote = async (
  employeeId: string,
  name: string,
): Promise<ActionResult<Employee>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc('update_employee_name_record', {
    employee_id_input: employeeId,
    name_input: name.trim(),
  });

  if (error) return errorResult(normalizeError(error.message));
  return okResult(mapEmployee(data), pickCurrentLanguage('Имя сотрудника обновлено.', 'Employee name updated.'));
};

export const updateEmployeeHiredAtRemote = async (
  employeeId: string,
  hiredAt: string,
): Promise<ActionResult<Employee>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc('update_employee_hired_at_record', {
    employee_id_input: employeeId,
    hired_at_input: hiredAt,
  });

  if (error) return errorResult(normalizeError(error.message));
  return okResult(mapEmployee(data), pickCurrentLanguage('Дата трудоустройства обновлена.', 'Hire date updated.'));
};

interface UpdateCurrentUserNameResult {
  employee: Employee | null;
  displayName: string;
}

export const updateCurrentUserNameRemote = async (
  displayName: string,
): Promise<ActionResult<UpdateCurrentUserNameResult>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc('update_current_user_display_name', {
    display_name_input: displayName.trim(),
  });

  if (error) {
    return errorResult(normalizeError(error.message));
  }

  return okResult({
    employee: data.employee ? mapEmployee(data.employee as EmployeeRow) : null,
    displayName: typeof data.display_name === 'string' ? data.display_name : displayName.trim(),
    }, pickCurrentLanguage('Имя обновлено.', 'Display name updated.'));
};

export const archiveEmployeeRemote = async (
  employeeId: string,
): Promise<ActionResult<Employee>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc('archive_employee_record', {
    employee_id_input: employeeId,
  });

  if (error) return errorResult(normalizeError(error.message));
  return okResult(mapEmployee(data), pickCurrentLanguage('Сотрудник отправлен в архив.', 'Employee moved to archive.'));
};

export const deleteArchivedEmployeeRemote = async (
  access: UserAccess,
  employeeId: string,
): Promise<ActionResult<void>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data
    .from('employees')
    .delete()
    .eq('organization_id', access.organizationId)
    .eq('id', employeeId)
    .eq('status', 'archived');

  if (error) return errorResult(normalizeError(error.message));
    return okResult(undefined, pickCurrentLanguage('Архивный сотрудник удален.', 'Archived employee deleted.'));
};

export const upsertShiftRemote = async (
  employeeId: string,
  date: string,
  status: ShiftStatusDb,
): Promise<ActionResult<Shift>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc('upsert_shift_entry', {
    employee_id_input: employeeId,
    work_date_input: date,
    status_input: status,
  });

  if (error) return errorResult(normalizeError(error.message));
  return okResult(mapShift(data));
};

export const deleteShiftRemote = async (
  employeeId: string,
  date: string,
): Promise<ActionResult<void>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data.rpc('delete_shift_entry', {
    employee_id_input: employeeId,
    work_date_input: date,
  });

  if (error) return errorResult(normalizeError(error.message));
  return okResult(undefined);
};

interface CreatePaymentOptions {
  input: AddPaymentInput;
}

export const createPaymentRemote = async (
  options: CreatePaymentOptions,
): Promise<ActionResult<Payment>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc('create_payment_record', {
    employee_id_input: options.input.employeeId,
    amount_input: options.input.amount,
    payment_date_input: options.input.date,
    comment_input: options.input.comment,
  });

  if (error) return errorResult(normalizeError(error.message));
  return okResult(mapPayment(data), pickCurrentLanguage('Выплата сохранена.', 'Payment saved.'));
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

  const { data, error } = await clientResult.data.rpc('update_payment_record', {
    payment_id_input: paymentId,
    amount_input: patch.amount ?? null,
    payment_date_input: patch.date ?? null,
    comment_input: patch.comment ?? null,
  });

  if (error) return errorResult(normalizeError(error.message));
    return okResult(mapPayment(data), pickCurrentLanguage('Выплата обновлена.', 'Payment updated.'));
};

export const confirmPaymentRemote = async (
  paymentId: string,
): Promise<ActionResult<Payment>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc('approve_payment_record', {
    payment_id_input: paymentId,
  });

  if (error) return errorResult(normalizeError(error.message));
    return okResult(mapPayment(data), pickCurrentLanguage('Выплата подтверждена.', 'Payment approved.'));
};

export const rejectPaymentRemote = async (
  paymentId: string,
): Promise<ActionResult<Payment>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc('reject_payment_record', {
    payment_id_input: paymentId,
  });

  if (error) return errorResult(normalizeError(error.message));
    return okResult(mapPayment(data), pickCurrentLanguage('Выплата отклонена.', 'Payment rejected.'));
};

export const deletePaymentRemote = async (
  paymentId: string,
): Promise<ActionResult<void>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { error } = await clientResult.data.rpc('delete_payment_record', {
    payment_id_input: paymentId,
  });

  if (error) return errorResult(normalizeError(error.message));
    return okResult(undefined, pickCurrentLanguage('Выплата удалена.', 'Payment deleted.'));
};

export const setScheduleMonthStatusRemote = async (
  year: number,
  month: number,
  status: MonthStatus,
): Promise<ActionResult<ScheduleMonth>> => {
  const clientResult = getClient();
  if (!clientResult.ok) return clientResult;

  const { data, error } = await clientResult.data.rpc('set_schedule_month_status', {
    year_input: year,
    month_input: month,
    status_input: status,
  });

  if (error) return errorResult(normalizeError(error.message));
  return okResult(mapScheduleMonth(data));
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
      return errorResult(pickCurrentLanguage('В backup есть смены с неизвестными сотрудниками.', 'The backup contains shifts with unknown employees.'));
    }
  }

  for (const payment of importedData.payments) {
    if (!employeeByLegacyId.has(payment.employeeId)) {
      return errorResult(pickCurrentLanguage('В backup есть выплаты с неизвестными сотрудниками.', 'The backup contains payments with unknown employees.'));
    }
  }

  const client = clientResult.data;
  const employeeIdMap = new Map(importedData.employees.map((employee) => [employee.id, crypto.randomUUID()]));
  const nowIso = new Date().toISOString();

  const employeesPayload = importedData.employees.map((employee) => ({
    id: employeeIdMap.get(employee.id)!,
    user_id: access.ownerUserId,
    organization_id: access.organizationId,
    profile_id: null,
    auth_user_id: null,
    work_email: null,
    status: employee.archived ? 'archived' : 'active',
    created_by_profile_id: access.profileId,
    is_owner: false,
    hired_at: employee.hiredAt,
    terminated_at: employee.terminatedAt,
    name: employee.name,
    daily_rate: employee.dailyRate,
    archived: employee.archived,
    archived_at: employee.archived ? nowIso : null,
  } satisfies Database['public']['Tables']['employees']['Insert']));

  const rateHistoryPayload = importedData.rateHistory.map((item) => ({
    id: crypto.randomUUID(),
    organization_id: access.organizationId,
    employee_id: employeeIdMap.get(item.employeeId)!,
    rate: item.rate,
    valid_from: item.validFrom,
    valid_to: item.validTo,
    created_by_profile_id: access.profileId,
  } satisfies Database['public']['Tables']['employee_rate_history']['Insert']));

  const scheduleMonthsPayload = importedData.scheduleMonths.map((item) => ({
    id: crypto.randomUUID(),
    organization_id: access.organizationId,
    year: item.year,
    month: item.month,
    status: item.status,
    approved_by_profile_id: item.status === 'approved' || item.status === 'closed' ? access.profileId : null,
    approved_at: item.status === 'approved' || item.status === 'closed' ? nowIso : null,
    closed_by_profile_id: item.status === 'closed' ? access.profileId : null,
    closed_at: item.status === 'closed' ? nowIso : null,
  } satisfies Database['public']['Tables']['schedule_months']['Insert']));

  const shiftsPayload = importedData.shifts.map((shift) => {
    const approvedStatus = shift.approvedStatus ?? shift.requestedStatus ?? shift.actualStatus ?? 'no_shift';
    return {
      id: crypto.randomUUID(),
      user_id: access.ownerUserId,
      organization_id: access.organizationId,
      employee_id: employeeIdMap.get(shift.employeeId)!,
      work_date: shift.date,
      status: approvedStatus,
      requested_status: shift.requestedStatus,
      approved_status: shift.approvedStatus,
      actual_status: shift.actualStatus,
      rate_snapshot: shift.rateSnapshot,
      created_by_profile_id: access.profileId,
      requested_by_profile_id: access.profileId,
      approved_by_profile_id: access.profileId,
      actual_by_profile_id: shift.actualStatus ? access.profileId : null,
    } satisfies Database['public']['Tables']['shifts']['Insert'];
  });

  const paymentsPayload = importedData.payments.map((payment) => ({
    id: crypto.randomUUID(),
    user_id: access.ownerUserId,
    organization_id: access.organizationId,
    employee_id: employeeIdMap.get(payment.employeeId)!,
    amount: payment.amount,
    payment_date: payment.date,
    comment: payment.comment,
    status: payment.status ?? 'approved',
    requested_by_auth_user_id: authUserId,
    approved_by_auth_user_id: payment.status === 'approved' ? authUserId : null,
    requested_by_profile_id: access.profileId,
    approved_by_profile_id: payment.status === 'approved' ? access.profileId : null,
    approved_at: payment.status === 'approved' ? nowIso : null,
    edited_by_admin: false,
  } satisfies Database['public']['Tables']['payments']['Insert']));

  const deletePayments = await client.from('payments').delete().eq('organization_id', access.organizationId);
  if (deletePayments.error) return errorResult(normalizeError(deletePayments.error.message));

  const deleteShifts = await client.from('shifts').delete().eq('organization_id', access.organizationId);
  if (deleteShifts.error) return errorResult(normalizeError(deleteShifts.error.message));

  const deleteMonths = await client.from('schedule_months').delete().eq('organization_id', access.organizationId);
  if (deleteMonths.error && !isMissingRelationError(deleteMonths.error.message)) {
    return errorResult(normalizeError(deleteMonths.error.message));
  }

  const deleteRates = await client.from('employee_rate_history').delete().eq('organization_id', access.organizationId);
  if (deleteRates.error && !isMissingRelationError(deleteRates.error.message)) {
    return errorResult(normalizeError(deleteRates.error.message));
  }

  const deleteEmployees = await client.from('employees').delete().eq('organization_id', access.organizationId).eq('is_owner', false);
  if (deleteEmployees.error) return errorResult(normalizeError(deleteEmployees.error.message));

  if (employeesPayload.length > 0) {
    const insertEmployees = await client.from('employees').insert(employeesPayload);
    if (insertEmployees.error) return errorResult(normalizeError(insertEmployees.error.message));
  }

  if (rateHistoryPayload.length > 0) {
    const insertRates = await client.from('employee_rate_history').insert(rateHistoryPayload);
    if (insertRates.error && !isMissingRelationError(insertRates.error.message)) {
      return errorResult(normalizeError(insertRates.error.message));
    }
  }

  if (scheduleMonthsPayload.length > 0) {
    const insertMonths = await client.from('schedule_months').insert(scheduleMonthsPayload);
    if (insertMonths.error && !isMissingRelationError(insertMonths.error.message)) {
      return errorResult(normalizeError(insertMonths.error.message));
    }
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




