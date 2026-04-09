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
  updateEmployeeRateRemote,
  updatePaymentRemote,
  upsertShiftRemote,
} from '../data/appRepository';
import {
  getCompanyMonthlyBreakdown,
  getEmployeeLifetimeStats,
  getEmployeeMonthlyBreakdown,
  getEmployeeStats,
} from '../domain/payroll';
import type {
  AddPaymentInput,
  AppDataStatus,
  Employee,
  EmployeeRateHistory,
  EmployeeStats,
  MonthlyBreakdownRow,
  MonthStatus,
  Payment,
  ScheduleMonth,
  Shift,
  ShiftEditorStatus,
  UserAccess,
} from '../domain/types';
import { createBackupPayload, parseBackupPayload } from '../lib/backup';
import { loadUiPreferences, saveUiPreferences } from '../lib/preferences';
import { errorResult, okResult, type ActionResult } from '../lib/result';
import { exportEmployeePayslipXlsx as exportEmployeePayslipXlsxFile } from '../lib/xlsx';
import { useAuth } from './AuthContext';

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
  selectedMonth: number;
  selectedYear: number;
  selectedMonthStatus: MonthStatus;
  status: AppDataStatus;
  error: string | null;
  isAdmin: boolean;
  isOwner: boolean;
  myEmployeeId: string | null;
  canEditSelectedMonth: boolean;
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
  updateEmployeeRate: (id: string, dailyRate: number) => Promise<ActionResult<void>>;
  exportEmployeePayslipXlsx: (employeeId: string, month: number, year: number) => Promise<ActionResult<void>>;
  getEmployeeStats: (employeeId: string, month: number, year: number) => EmployeeStats;
  getEmployeeLifetimeStats: (employeeId: string) => EmployeeStats;
  getEmployeeMonthlyBreakdown: (employeeId: string, year: number) => MonthlyBreakdownRow[];
  getCompanyMonthlyBreakdown: (year: number) => MonthlyBreakdownRow[];
  exportBackup: () => object;
  importAppState: (payload: unknown) => Promise<ActionResult<void>>;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const sortEmployees = (items: Employee[]): Employee[] => (
  [...items].sort((left, right) => {
    if (left.archived !== right.archived) {
      return Number(left.archived) - Number(right.archived);
    }

    return left.name.localeCompare(right.name);
  })
);

const sortRateHistory = (items: EmployeeRateHistory[]): EmployeeRateHistory[] => (
  [...items].sort((left, right) => {
    if (left.employeeId !== right.employeeId) {
      return left.employeeId.localeCompare(right.employeeId);
    }

    return left.validFrom.localeCompare(right.validFrom);
  })
);

const sortScheduleMonths = (items: ScheduleMonth[]): ScheduleMonth[] => (
  [...items].sort((left, right) => (
    left.year === right.year ? left.month - right.month : left.year - right.year
  ))
);

const sortShifts = (items: Shift[]): Shift[] => (
  [...items].sort((left, right) => left.date.localeCompare(right.date))
);

const sortPayments = (items: Payment[]): Payment[] => (
  [...items].sort((left, right) => {
    if (left.date !== right.date) {
      return right.date.localeCompare(left.date);
    }

    return right.createdAt.localeCompare(left.createdAt);
  })
);

export function AppProvider({ children }: { children: ReactNode }) {
  const { status: authStatus, user } = useAuth();
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [rateHistory, setRateHistory] = useState<EmployeeRateHistory[]>([]);
  const [scheduleMonths, setScheduleMonths] = useState<ScheduleMonth[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [access, setAccess] = useState<UserAccess | null>(null);
  const [preferences, setPreferences] = useState(() => loadUiPreferences());
  const [status, setStatus] = useState<AppDataStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    saveUiPreferences(preferences);
  }, [preferences]);

  useEffect(() => {
    if (authStatus === 'loading') {
      setStatus('loading');
      setError(null);
      return;
    }

    if (authStatus === 'missing-config') {
      setEmployees([]);
      setRateHistory([]);
      setScheduleMonths([]);
      setShifts([]);
      setPayments([]);
      setAccess(null);
      setStatus('error');
      setError('Supabase не настроен. Проверь `VITE_SUPABASE_URL` и `VITE_SUPABASE_ANON_KEY`.');
      return;
    }

    if (authStatus !== 'authenticated' || !user) {
      setEmployees([]);
      setRateHistory([]);
      setScheduleMonths([]);
      setShifts([]);
      setPayments([]);
      setAccess(null);
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

      setEmployees(sortEmployees(result.data.employees));
      setRateHistory(sortRateHistory(result.data.rateHistory));
      setScheduleMonths(sortScheduleMonths(result.data.scheduleMonths));
      setShifts(sortShifts(result.data.shifts));
      setPayments(sortPayments(result.data.payments));
      setAccess(result.data.access);
      setStatus('ready');
      setError(null);
    })();

    return () => {
      isActive = false;
    };
  }, [authStatus, user]);

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

  const requireUser = (): ActionResult<string> => {
    if (!user) {
      return errorResult('Сначала войди в аккаунт.');
    }

    return okResult(user.id);
  };

  const requireAccess = (): ActionResult<UserAccess> => {
    if (!access) {
      return errorResult('Профиль еще не создан. Заверши регистрацию через письмо.');
    }

    return okResult(access);
  };

  const requireAdmin = (): ActionResult<UserAccess> => {
    const accessResult = requireAccess();
    if (!accessResult.ok) return accessResult;
    if (accessResult.data.role !== 'admin') {
      return errorResult('Недостаточно прав для этого действия.');
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
      return errorResult('Можно менять только свои пожелания по сменам.');
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

    setEmployees(sortEmployees(result.data.employees));
    setRateHistory(sortRateHistory(result.data.rateHistory));
    setScheduleMonths(sortScheduleMonths(result.data.scheduleMonths));
    setShifts(sortShifts(result.data.shifts));
    setPayments(sortPayments(result.data.payments));
    setAccess(result.data.access);
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

  const setSelectedMonthStatus = async (nextStatus: MonthStatus): Promise<ActionResult<void>> => {
    const adminResult = requireAdmin();
    if (!adminResult.ok) return adminResult;

    const result = await setScheduleMonthStatusRemote(preferences.selectedYear, preferences.selectedMonth, nextStatus);
    if (!result.ok) {
      setError(result.error);
      return errorResult(result.error);
    }

    setScheduleMonths((prev) => {
      const withoutCurrent = prev.filter((item) => !(
        item.year === result.data.year && item.month === result.data.month
      ));

      return sortScheduleMonths([...withoutCurrent, result.data]);
    });
    setError(null);
    return okResult(undefined);
  };

  const addEmployee = async (input: AddEmployeeInput): Promise<ActionResult<void>> => {
    const adminResult = requireAdmin();
    if (!adminResult.ok) return adminResult;

    const result = await createEmployee({
      access: adminResult.data,
      ...input,
    });
    if (!result.ok) {
      setError(result.error);
      return errorResult(result.error);
    }

    setEmployees((prev) => sortEmployees([...prev, result.data]));
    setRateHistory((prev) => sortRateHistory([
      ...prev,
      {
        id: `local-rate:${result.data.id}:${result.data.hiredAt ?? result.data.createdAt.slice(0, 10)}`,
        employeeId: result.data.id,
        organizationId: result.data.organizationId,
        rate: result.data.dailyRate,
        validFrom: result.data.hiredAt ?? result.data.createdAt.slice(0, 10),
        validTo: result.data.terminatedAt,
        createdByProfileId: access?.profileId ?? null,
        createdAt: result.data.createdAt,
      },
    ]));
    setError(null);
    return okResult(undefined, result.message);
  };

  const removeEmployee = async (id: string): Promise<ActionResult<void>> => {
    const adminResult = requireAdmin();
    if (!adminResult.ok) return adminResult;

    const result = await archiveEmployeeRemote(adminResult.data, id);
    if (!result.ok) {
      setError(result.error);
      return errorResult(result.error);
    }

    setEmployees((prev) => sortEmployees(prev.map((employee) => (
      employee.id === id ? result.data : employee
    ))));
    setRateHistory((prev) => prev.map((item) => (
      item.employeeId === id && item.validTo === null
        ? { ...item, validTo: result.data.terminatedAt }
        : item
    )));
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

    setEmployees((prev) => prev.filter((employee) => employee.id !== id));
    setRateHistory((prev) => prev.filter((item) => item.employeeId !== id));
    setShifts((prev) => prev.filter((shift) => shift.employeeId !== id));
    setPayments((prev) => prev.filter((payment) => payment.employeeId !== id));
    setError(null);
    return okResult(undefined, result.message);
  };

  const updateEmployeeRate = async (id: string, dailyRate: number): Promise<ActionResult<void>> => {
    const adminResult = requireAdmin();
    if (!adminResult.ok) return adminResult;

    const result = await updateEmployeeRateRemote(adminResult.data, id, dailyRate);
    if (!result.ok) {
      setError(result.error);
      return errorResult(result.error);
    }

    const effectiveFrom = new Date().toISOString().slice(0, 10);

    setEmployees((prev) => sortEmployees(prev.map((employee) => (
      employee.id === id ? result.data : employee
    ))));
    setRateHistory((prev) => {
      const closedPrev = prev.map((item) => (
        item.employeeId === id && item.validTo === null && item.validFrom < effectiveFrom
          ? { ...item, validTo: effectiveFrom }
          : item
      ));

      return sortRateHistory([
        ...closedPrev.filter((item) => !(item.employeeId === id && item.validFrom === effectiveFrom)),
        {
          id: `local-rate:${id}:${effectiveFrom}`,
          employeeId: id,
          organizationId: result.data.organizationId,
          rate: dailyRate,
          validFrom: effectiveFrom,
          validTo: null,
          createdByProfileId: access?.profileId ?? null,
          createdAt: new Date().toISOString(),
        },
      ]);
    });
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
      return errorResult('Этот месяц уже закрыт для редактирования.');
    }

    if (nextStatus === 'none') {
      const result = await deleteShiftRemote(editorResult.data, employeeId, date);
      if (!result.ok) {
        setError(result.error);
        return errorResult(result.error);
      }

      setShifts((prev) => prev.filter((shift) => !(shift.employeeId === employeeId && shift.date === date)));
      setError(null);
      return okResult(undefined);
    }

    const result = await upsertShiftRemote(editorResult.data, employeeId, date, nextStatus);

    if (!result.ok) {
      setError(result.error);
      return errorResult(result.error);
    }

    setShifts((prev) => {
      const otherShifts = prev.filter((shift) => !(shift.employeeId === employeeId && shift.date === date));
      return sortShifts([...otherShifts, result.data]);
    });
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
      return errorResult('Не удалось определить сотрудника для выплаты.');
    }

    const result = await createPaymentRemote({
      authUserId: userResult.data,
      access: accessResult.data,
      input: {
        ...input,
        employeeId,
      },
    });

    if (!result.ok) {
      setError(result.error);
      return errorResult(result.error);
    }

    setPayments((prev) => sortPayments([result.data, ...prev]));
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

    setPayments((prev) => sortPayments(prev.map((payment) => (
      payment.id === paymentId ? result.data : payment
    ))));
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

    setPayments((prev) => sortPayments(prev.map((payment) => (
      payment.id === paymentId ? result.data : payment
    ))));
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

    setPayments((prev) => sortPayments(prev.map((payment) => (
      payment.id === paymentId ? result.data : payment
    ))));
    setError(null);
    return okResult(undefined, result.message);
  };

  const deletePayment = async (id: string): Promise<ActionResult<void>> => {
    const result = await deletePaymentRemote(id);
    if (!result.ok) {
      setError(result.error);
      return errorResult(result.error);
    }

    setPayments((prev) => prev.filter((payment) => payment.id !== id));
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
      return errorResult('Сотрудник не найден.');
    }

    if (access?.role === 'employee' && access.employeeId !== employeeId) {
      return errorResult('Можно выгрузить только свой расчетный лист.');
    }

    await exportEmployeePayslipXlsxFile({
      employee,
      month,
      year,
      shifts: shifts.filter((shift) => shift.employeeId === employeeId),
      payments: payments.filter((payment) => payment.employeeId === employeeId),
      rateHistory: rateHistory.filter((item) => item.employeeId === employeeId),
      stats: getEmployeeStats(payrollSource, employeeId, month, year),
    });

    return okResult(undefined, 'Excel-файл выгружен.');
  };

  const importAppState = async (payload: unknown): Promise<ActionResult<void>> => {
    const adminResult = requireAdmin();
    if (!adminResult.ok) return adminResult;
    const userResult = requireUser();
    if (!userResult.ok) return userResult;

    const importedData = parseBackupPayload(payload);
    if (!importedData) {
      return errorResult('Файл не похож на backup PVZ Schedule.');
    }

    setStatus('loading');
    const result = await replaceUserDataRemote(adminResult.data, userResult.data, importedData);
    if (!result.ok) {
      setStatus('ready');
      setError(result.error);
      return errorResult(result.error);
    }

    setEmployees(sortEmployees(result.data.employees));
    setRateHistory(sortRateHistory(result.data.rateHistory));
    setScheduleMonths(sortScheduleMonths(result.data.scheduleMonths));
    setShifts(sortShifts(result.data.shifts));
    setPayments(sortPayments(result.data.payments));
    setAccess(result.data.access);
    setPreferences({
      selectedMonth: importedData.selectedMonth,
      selectedYear: importedData.selectedYear,
    });
    setStatus('ready');
    setError(null);
    return okResult(undefined, 'Backup успешно импортирован.');
  };

  const value: AppContextType = {
    employees,
    rateHistory,
    scheduleMonths,
    shifts,
    payments,
    access,
    selectedMonth: preferences.selectedMonth,
    selectedYear: preferences.selectedYear,
    selectedMonthStatus,
    status,
    error,
    isAdmin: access?.role === 'admin',
    isOwner: access?.role === 'admin',
    myEmployeeId: access?.employeeId ?? null,
    canEditSelectedMonth,
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
    updateEmployeeRate,
    exportEmployeePayslipXlsx,
    getEmployeeStats: (employeeId, month, year) => getEmployeeStats(payrollSource, employeeId, month, year),
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
