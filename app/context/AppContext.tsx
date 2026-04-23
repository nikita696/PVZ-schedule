import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  archiveEmployeeRemote,
  confirmPaymentRemote,
  createEmployee,
  createPaymentRemote,
  deleteArchivedEmployeeRemote,
  deletePaymentRemote,
  deleteShiftRemote,
  fetchAppData,
  rejectPaymentRemote,
  replaceUserDataRemote,
  setScheduleMonthStatusRemote,
  updateCurrentUserNameRemote,
  updateEmployeeNameRemote,
  updateEmployeeHiredAtRemote,
  updateEmployeeRateRemote,
  updatePaymentRemote,
  upsertShiftRemote,
} from '../data/appRepository';
import {
  getCompanyMonthlyBreakdown,
  getEmployeeDebtSnapshot,
  getEmployeeLifetimeStats,
  getEmployeeMonthlyBreakdown,
  getEmployeeStats,
} from '../domain/payroll';
import type {
  AddPaymentInput,
  AppDataStatus,
  EmployeeDebtSnapshot,
  Employee,
  EmployeeRateHistory,
  EmployeeStats,
  MonthlyBreakdownRow,
  MonthStatus,
  Payment,
  ScheduleMonth,
  SessionIdentity,
  Shift,
  ShiftEditorStatus,
  UserAccess,
} from '../domain/types';
import { createBackupPayload, parseBackupPayload } from '../lib/backup';
import { getLocalISODate } from '../lib/date';
import { loadUiPreferences, saveUiPreferences } from '../lib/preferences';
import { errorResult, okResult, type ActionResult } from '../lib/result';
import { buildInitials, buildSessionIdentity, getRoleLabel } from '../lib/sessionIdentity';
import {
  createEmptyAppDataState,
  normalizeAppDataState,
  withArchivedEmployee,
  withCurrentUserNameUpdated,
  withEmployeeAdded,
  withEmployeeRateUpdated,
  withEmployeeUpdated,
  withPaymentAdded,
  withPaymentUpdated,
  withScheduleMonthUpdated,
  withShiftUpserted,
  withoutEmployee,
  withoutPayment,
  withoutShift,
  type AppDataState,
} from './appState';
import { useAuth } from './AuthContext';
import { useLanguage } from './LanguageContext';

interface AddEmployeeInput {
  name: string;
  workEmail: string;
  dailyRate: number;
  hiredAt: string | null;
}

interface AppContextType {
  employees: Employee[];
  rateHistory: EmployeeRateHistory[];
  scheduleMonths: ScheduleMonth[];
  shifts: Shift[];
  payments: Payment[];
  access: UserAccess | null;
  currentUserSummary: SessionIdentity | null;
  selectedMonth: number;
  selectedYear: number;
  selectedMonthStatus: MonthStatus;
  status: AppDataStatus;
  error: string | null;
  isAdmin: boolean;
  isOwner: boolean;
  myEmployeeId: string | null;
  canEditSelectedMonth: boolean;
  updateCurrentUserName: (displayName: string) => Promise<ActionResult<void>>;
  setSelectedMonth: (month: number) => void;
  setSelectedYear: (year: number) => void;
  refreshData: () => Promise<ActionResult<void>>;
  setSelectedMonthStatus: (status: MonthStatus) => Promise<ActionResult<void>>;
  updateShift: (employeeId: string, date: string, status: ShiftEditorStatus) => Promise<ActionResult<void>>;
  addPayment: (payment: AddPaymentInput) => Promise<ActionResult<void>>;
  updatePayment: (
    paymentId: string,
    patch: Partial<{ amount: number; date: string; comment: string }>,
  ) => Promise<ActionResult<void>>;
  confirmPayment: (paymentId: string) => Promise<ActionResult<void>>;
  rejectPayment: (paymentId: string) => Promise<ActionResult<void>>;
  deletePayment: (id: string) => Promise<ActionResult<void>>;
  addEmployee: (input: AddEmployeeInput) => Promise<ActionResult<void>>;
  removeEmployee: (id: string) => Promise<ActionResult<void>>;
  deleteArchivedEmployee: (id: string) => Promise<ActionResult<void>>;
  updateEmployeeName: (id: string, name: string) => Promise<ActionResult<void>>;
  updateEmployeeRate: (id: string, dailyRate: number) => Promise<ActionResult<void>>;
  updateEmployeeHireDate: (id: string, hiredAt: string) => Promise<ActionResult<void>>;
  exportEmployeePayslipXlsx: (employeeId: string, month: number, year: number) => Promise<ActionResult<void>>;
  getEmployeeStats: (employeeId: string, month: number, year: number) => EmployeeStats;
  getEmployeeDebtSnapshot: (employeeId: string) => EmployeeDebtSnapshot;
  getEmployeeLifetimeStats: (employeeId: string) => EmployeeStats;
  getEmployeeMonthlyBreakdown: (employeeId: string, year: number) => MonthlyBreakdownRow[];
  getCompanyMonthlyBreakdown: (year: number) => MonthlyBreakdownRow[];
  exportBackup: () => object;
  importAppState: (payload: unknown) => Promise<ActionResult<void>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export function AppProvider({ children }: { children: ReactNode }) {
  const {
    status: authStatus,
    user,
    sessionIdentity,
    isCompletingAuth,
    rememberResolvedIdentity,
  } = useAuth();
  const { t } = useLanguage();
  const [appData, setAppData] = useState<AppDataState>(createEmptyAppDataState);
  const [preferences, setPreferences] = useState(() => loadUiPreferences());
  const [status, setStatus] = useState<AppDataStatus>('idle');
  const [error, setError] = useState<string | null>(null);
  const [displayNameOverride, setDisplayNameOverride] = useState<string | null>(null);
  const { employees, rateHistory, scheduleMonths, shifts, payments, access } = appData;

  useEffect(() => {
    saveUiPreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    setDisplayNameOverride(null);
  }, [user?.id]);

  useEffect(() => {
    if (authStatus === 'loading' || isCompletingAuth) {
      setStatus('loading');
      setError(null);
      return;
    }

    if (authStatus === 'missing-config') {
      setAppData(createEmptyAppDataState());
      setStatus('error');
      setError(t('Supabase не настроен. Проверь `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`.', 'Supabase is not configured. Check `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.'));
      return;
    }

    if (authStatus !== 'authenticated' || !user) {
      setAppData(createEmptyAppDataState());
      setStatus('idle');
      setError(null);
      return;
    }

    let isActive = true;
    setStatus('loading');
    setError(null);

    void (async () => {
      const result = await fetchAppData(user.id);
      if (!isActive) return;

      if (!result.ok) {
        setStatus('error');
        setError(result.error);
        return;
      }

      setAppData(normalizeAppDataState(result.data));
      setStatus('ready');
      setError(null);
    })();

    return () => {
      isActive = false;
    };
  }, [authStatus, isCompletingAuth, t, user]);

  useEffect(() => {
    if (authStatus !== 'authenticated' || !access) {
      return;
    }

    rememberResolvedIdentity({
      role: access.role,
      isOwner: access.role === 'admin',
    });
  }, [access, authStatus, rememberResolvedIdentity]);

  const selectedMonthStatus = useMemo<MonthStatus>(() => {
    const found = scheduleMonths.find((item) => (
      item.month === preferences.selectedMonth && item.year === preferences.selectedYear
    ));

    return found?.status ?? 'draft';
  }, [preferences.selectedMonth, preferences.selectedYear, scheduleMonths]);

  const canEditSelectedMonth = useMemo(() => {
    if (!access) return false;
    if (access.role === 'admin') return selectedMonthStatus !== 'closed';
    return selectedMonthStatus === 'draft';
  }, [access, selectedMonthStatus]);

  const currentUserSummary = useMemo<SessionIdentity | null>(() => {
    if (!user) {
      return null;
    }

    const linkedEmployee = access?.employeeId
      ? employees.find((employee) => employee.id === access.employeeId) ?? null
      : null;

    const fallbackIdentity = buildSessionIdentity(user, access ? {
      role: access.role,
      isOwner: access.role === 'admin',
    } : undefined);

    const baseIdentity = sessionIdentity ?? fallbackIdentity;
    if (!baseIdentity) {
      return null;
    }

    const resolvedRole = access?.role ?? baseIdentity.role ?? null;
    const resolvedDisplayName = (
      displayNameOverride?.trim()
      || access?.profileDisplayName?.trim()
      || linkedEmployee?.name?.trim()
      || baseIdentity.displayName
      || t('Пользователь', 'User')
    );

    return {
      ...baseIdentity,
      displayName: resolvedDisplayName,
      initials: buildInitials(resolvedDisplayName, baseIdentity.email),
      role: resolvedRole,
      roleLabel: getRoleLabel(resolvedRole),
      isOwner: resolvedRole === 'admin',
    };
  }, [access, displayNameOverride, employees, sessionIdentity, t, user]);

  const requireUser = (): ActionResult<string> => {
    if (!user) {
      return errorResult(t('Сначала войди в аккаунт.', 'Sign in first.'));
    }

    return okResult(user.id);
  };

  const requireAccess = (): ActionResult<UserAccess> => {
    if (!access) {
      return errorResult(t('Профиль ещё не привязан к этому email. Проверь аккаунт или забери подготовленную передачу прав.', 'The profile is not linked to this email yet. Check the account or claim the prepared owner transfer.'));
    }

    return okResult(access);
  };

  const requireAdmin = (): ActionResult<UserAccess> => {
    const accessResult = requireAccess();
    if (!accessResult.ok) return accessResult;
    if (accessResult.data.role !== 'admin') {
      return errorResult(t('Недостаточно прав для этого действия.', 'You do not have permission for this action.'));
    }

    return okResult(accessResult.data);
  };

  const requireShiftEditor = (employeeId: string): ActionResult<UserAccess> => {
    const accessResult = requireAccess();
    if (!accessResult.ok) return accessResult;

    if (accessResult.data.role === 'admin') {
      return accessResult;
    }

    if (!accessResult.data.employeeId || accessResult.data.employeeId !== employeeId) {
      return errorResult(t('Можно менять только свои пожелания по сменам.', 'You can only edit your own shift preferences.'));
    }

    return accessResult;
  };

  const refreshData = async (): Promise<ActionResult<void>> => {
    const userResult = requireUser();
    if (!userResult.ok) return userResult;

    setStatus('loading');
    const result = await fetchAppData(userResult.data);
    if (!result.ok) {
      setStatus('error');
      setError(result.error);
      return errorResult(result.error);
    }

    setAppData(normalizeAppDataState(result.data));
    setStatus('ready');
    setError(null);
    return okResult(undefined);
  };

  const setSelectedMonth = (month: number) => {
    if (month < 1 || month > 12) return;
    setPreferences((prev) => ({ ...prev, selectedMonth: month }));
  };

  const setSelectedYear = (year: number) => {
    if (!Number.isInteger(year)) return;
    setPreferences((prev) => ({ ...prev, selectedYear: year }));
  };

  const updateCurrentUserName = async (displayName: string): Promise<ActionResult<void>> => {
    const accessResult = requireAccess();
    if (!accessResult.ok) return accessResult;

    const trimmedName = displayName.trim();
    if (!trimmedName) {
      return errorResult(t('Укажи имя для профиля.', 'Enter a display name for the profile.'));
    }

    const result = await updateCurrentUserNameRemote(trimmedName);
    if (!result.ok) {
      setError(result.error);
      return errorResult(result.error);
    }

    setAppData((prev) => withCurrentUserNameUpdated(
      prev,
      result.data.displayName,
      result.data.employee,
    ));
    setDisplayNameOverride(result.data.displayName);
    setError(null);
    return okResult(undefined, result.message);
  };

  const setSelectedMonthStatus = async (nextStatus: MonthStatus): Promise<ActionResult<void>> => {
    const adminResult = requireAdmin();
    if (!adminResult.ok) return adminResult;

    const result = await setScheduleMonthStatusRemote(preferences.selectedYear, preferences.selectedMonth, nextStatus);
    if (!result.ok) {
      setError(result.error);
      return errorResult(result.error);
    }

    setAppData((prev) => withScheduleMonthUpdated(prev, result.data));
    setError(null);
    return okResult(undefined);
  };

  const addEmployee = async (input: AddEmployeeInput): Promise<ActionResult<void>> => {
    const adminResult = requireAdmin();
    if (!adminResult.ok) return adminResult;

    const result = await createEmployee({
      ...input,
    });
    if (!result.ok) {
      setError(result.error);
      return errorResult(result.error);
    }

    setAppData((prev) => withEmployeeAdded(prev, result.data, access?.profileId ?? null));
    setError(null);
    return okResult(undefined, result.message);
  };

  const removeEmployee = async (id: string): Promise<ActionResult<void>> => {
    const adminResult = requireAdmin();
    if (!adminResult.ok) return adminResult;

    const result = await archiveEmployeeRemote(id);
    if (!result.ok) {
      setError(result.error);
      return errorResult(result.error);
    }

    setAppData((prev) => withArchivedEmployee(prev, result.data));
    setError(null);
    return okResult(undefined, result.message);
  };

  const deleteArchivedEmployee = async (id: string): Promise<ActionResult<void>> => {
    const adminResult = requireAdmin();
    if (!adminResult.ok) return adminResult;

    const result = await deleteArchivedEmployeeRemote(adminResult.data, id);
    if (!result.ok) {
      setError(result.error);
      return errorResult(result.error);
    }

    setAppData((prev) => withoutEmployee(prev, id));
    setError(null);
    return okResult(undefined, result.message);
  };

  const updateEmployeeRate = async (id: string, dailyRate: number): Promise<ActionResult<void>> => {
    const adminResult = requireAdmin();
    if (!adminResult.ok) return adminResult;

    const result = await updateEmployeeRateRemote(id, dailyRate);
    if (!result.ok) {
      setError(result.error);
      return errorResult(result.error);
    }

    const effectiveFrom = getLocalISODate();
    const createdAt = new Date().toISOString();

    setAppData((prev) => withEmployeeRateUpdated(
      prev,
      result.data,
      effectiveFrom,
      access?.profileId ?? null,
      createdAt,
    ));
    setError(null);
    return okResult(undefined, result.message);
  };

  const updateEmployeeName = async (id: string, name: string): Promise<ActionResult<void>> => {
    const adminResult = requireAdmin();
    if (!adminResult.ok) return adminResult;

    const normalizedName = name.trim();
    if (!normalizedName) {
      return errorResult(t('Укажи имя сотрудника.', 'Enter employee name.'));
    }

    const result = await updateEmployeeNameRemote(id, normalizedName);
    if (!result.ok) {
      setError(result.error);
      return errorResult(result.error);
    }

    setAppData((prev) => {
      const nextState = withEmployeeUpdated(prev, result.data);
      if (access?.employeeId !== id || !nextState.access) {
        return nextState;
      }

      return {
        ...nextState,
        access: {
          ...nextState.access,
          profileDisplayName: result.data.name,
        },
      };
    });
    if (access?.employeeId === id) {
      setDisplayNameOverride(result.data.name);
    }

    setError(null);
    return okResult(undefined, result.message);
  };

  const updateEmployeeHireDate = async (id: string, hiredAt: string): Promise<ActionResult<void>> => {
    const adminResult = requireAdmin();
    if (!adminResult.ok) return adminResult;

    const normalizedDate = hiredAt.trim();
    if (!normalizedDate) {
      return errorResult(t('Укажи дату трудоустройства.', 'Enter a hire date.'));
    }

    const result = await updateEmployeeHiredAtRemote(id, normalizedDate);
    if (!result.ok) {
      setError(result.error);
      return errorResult(result.error);
    }

    setAppData((prev) => withEmployeeUpdated(prev, result.data));
    setError(null);
    return okResult(undefined, result.message);
  };

  const updateShift = async (
    employeeId: string,
    date: string,
    nextStatus: ShiftEditorStatus,
  ): Promise<ActionResult<void>> => {
    const editorResult = requireShiftEditor(employeeId);
    if (!editorResult.ok) return editorResult;

    if (!canEditSelectedMonth) {
      return errorResult(t('Этот месяц уже закрыт для редактирования.', 'This month is already locked for editing.'));
    }

    if (nextStatus === 'none') {
      const result = await deleteShiftRemote(employeeId, date);
      if (!result.ok) {
        setError(result.error);
        return errorResult(result.error);
      }

      setAppData((prev) => withoutShift(prev, employeeId, date));
      setError(null);
      return okResult(undefined);
    }

    const result = await upsertShiftRemote(employeeId, date, nextStatus);

    if (!result.ok) {
      setError(result.error);
      return errorResult(result.error);
    }

    setAppData((prev) => withShiftUpserted(prev, result.data));
    setError(null);
    return okResult(undefined);
  };

  const addPayment = async (input: AddPaymentInput): Promise<ActionResult<void>> => {
    const userResult = requireUser();
    if (!userResult.ok) return userResult;
    const accessResult = requireAccess();
    if (!accessResult.ok) return accessResult;

    const isAdmin = accessResult.data.role === 'admin';
    const employeeId = isAdmin ? input.employeeId : accessResult.data.employeeId;
    if (!employeeId) {
      return errorResult(t('Не удалось определить сотрудника для выплаты.', 'Could not determine the employee for this payment.'));
    }

    const result = await createPaymentRemote({
      input: {
        ...input,
        employeeId,
      },
    });

    if (!result.ok) {
      setError(result.error);
      return errorResult(result.error);
    }

    setAppData((prev) => withPaymentAdded(prev, result.data));
    setError(null);
    return okResult(undefined, result.message);
  };

  const updatePayment = async (
    paymentId: string,
    patch: Partial<{ amount: number; date: string; comment: string }>,
  ): Promise<ActionResult<void>> => {
    const result = await updatePaymentRemote(paymentId, patch);
    if (!result.ok) {
      setError(result.error);
      return errorResult(result.error);
    }

    setAppData((prev) => withPaymentUpdated(prev, result.data));
    setError(null);
    return okResult(undefined, result.message);
  };

  const confirmPayment = async (paymentId: string): Promise<ActionResult<void>> => {
    const adminResult = requireAdmin();
    if (!adminResult.ok) return adminResult;

    const result = await confirmPaymentRemote(paymentId);
    if (!result.ok) {
      setError(result.error);
      return errorResult(result.error);
    }

    setAppData((prev) => withPaymentUpdated(prev, result.data));
    setError(null);
    return okResult(undefined, result.message);
  };

  const rejectPayment = async (paymentId: string): Promise<ActionResult<void>> => {
    const adminResult = requireAdmin();
    if (!adminResult.ok) return adminResult;

    const result = await rejectPaymentRemote(paymentId);
    if (!result.ok) {
      setError(result.error);
      return errorResult(result.error);
    }

    setAppData((prev) => withPaymentUpdated(prev, result.data));
    setError(null);
    return okResult(undefined, result.message);
  };

  const deletePayment = async (id: string): Promise<ActionResult<void>> => {
    const result = await deletePaymentRemote(id);
    if (!result.ok) {
      setError(result.error);
      return errorResult(result.error);
    }

    setAppData((prev) => withoutPayment(prev, id));
    setError(null);
    return okResult(undefined, result.message);
  };

  const exportBackup = (): object => createBackupPayload({
    employees,
    rateHistory,
    scheduleMonths,
    shifts,
    payments,
    preferences,
  });

  const payrollSource = useMemo(() => ({
    employees,
    rateHistory,
    shifts,
    payments,
  }), [employees, payments, rateHistory, shifts]);

  const exportEmployeePayslipXlsx = async (
    employeeId: string,
    month: number,
    year: number,
  ): Promise<ActionResult<void>> => {
    const employee = employees.find((item) => item.id === employeeId);
    if (!employee) {
      return errorResult(t('Сотрудник не найден.', 'Employee not found.'));
    }

    if (access?.role === 'employee' && access.employeeId !== employeeId) {
      return errorResult(t('Можно выгрузить только свой расчётный лист.', 'You can only export your own payslip.'));
    }

    const { exportEmployeePayslipXlsx: exportEmployeePayslipXlsxFile } = await import('../lib/xlsx');

    await exportEmployeePayslipXlsxFile({
      employee,
      month,
      year,
      shifts: shifts.filter((shift) => shift.employeeId === employeeId),
      payments: payments.filter((payment) => payment.employeeId === employeeId),
      rateHistory: rateHistory.filter((item) => item.employeeId === employeeId),
      stats: getEmployeeStats(payrollSource, employeeId, month, year),
    });

    return okResult(undefined, t('Excel-файл выгружен.', 'The Excel file has been exported.'));
  };

  const importAppState = async (payload: unknown): Promise<ActionResult<void>> => {
    const adminResult = requireAdmin();
    if (!adminResult.ok) return adminResult;
    const userResult = requireUser();
    if (!userResult.ok) return userResult;

    const importedData = parseBackupPayload(payload);
    if (!importedData) {
      return errorResult(t('Файл не похож на backup PVZ Schedule.', 'This file does not look like a PVZ Schedule backup.'));
    }

    setStatus('loading');
    const result = await replaceUserDataRemote(adminResult.data, userResult.data, importedData);
    if (!result.ok) {
      setStatus('ready');
      setError(result.error);
      return errorResult(result.error);
    }

    setAppData(normalizeAppDataState(result.data));
    setPreferences({
      selectedMonth: importedData.selectedMonth,
      selectedYear: importedData.selectedYear,
    });
    setStatus('ready');
    setError(null);
    return okResult(undefined, t('Backup успешно импортирован.', 'Backup imported successfully.'));
  };

  const value: AppContextType = {
    employees,
    rateHistory,
    scheduleMonths,
    shifts,
    payments,
    access,
    currentUserSummary,
    selectedMonth: preferences.selectedMonth,
    selectedYear: preferences.selectedYear,
    selectedMonthStatus,
    status,
    error,
    isAdmin: access?.role === 'admin',
    isOwner: access?.role === 'admin',
    myEmployeeId: access?.employeeId ?? null,
    canEditSelectedMonth,
    updateCurrentUserName,
    setSelectedMonth,
    setSelectedYear,
    refreshData,
    setSelectedMonthStatus,
    updateShift,
    addPayment,
    updatePayment,
    confirmPayment,
    rejectPayment,
    deletePayment,
    addEmployee,
    removeEmployee,
    deleteArchivedEmployee,
    updateEmployeeName,
    updateEmployeeRate,
    updateEmployeeHireDate,
    exportEmployeePayslipXlsx,
    getEmployeeStats: (employeeId, month, year) => getEmployeeStats(payrollSource, employeeId, month, year),
    getEmployeeDebtSnapshot: (employeeId) => getEmployeeDebtSnapshot(payrollSource, employeeId),
    getEmployeeLifetimeStats: (employeeId) => getEmployeeLifetimeStats(payrollSource, employeeId),
    getEmployeeMonthlyBreakdown: (employeeId, year) => getEmployeeMonthlyBreakdown(payrollSource, employeeId, year),
    getCompanyMonthlyBreakdown: (year) => getCompanyMonthlyBreakdown(payrollSource, year),
    exportBackup,
    importAppState,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export const useApp = (): AppContextType => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }

  return context;
};
