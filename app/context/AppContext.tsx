import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  archiveEmployeeRemote,
  createEmployee,
  createPaymentRemote,
  deletePaymentRemote,
  deleteShiftRemote,
  fetchAppData,
  replaceUserDataRemote,
  updateEmployeeRateRemote,
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
  EmployeeStats,
  MonthlyBreakdownRow,
  Payment,
  Shift,
  ShiftStatus,
} from '../domain/types';
import { createBackupPayload, parseBackupPayload } from '../lib/backup';
import { loadUiPreferences, saveUiPreferences } from '../lib/preferences';
import { errorResult, okResult, type ActionResult } from '../lib/result';
import { useAuth } from './AuthContext';

interface AppContextType {
  employees: Employee[];
  shifts: Shift[];
  payments: Payment[];
  selectedMonth: number;
  selectedYear: number;
  status: AppDataStatus;
  error: string | null;
  setSelectedMonth: (month: number) => void;
  setSelectedYear: (year: number) => void;
  refreshData: () => Promise<ActionResult<void>>;
  updateShift: (employeeId: string, date: string, status: ShiftStatus) => Promise<ActionResult<void>>;
  addPayment: (payment: AddPaymentInput) => Promise<ActionResult<void>>;
  deletePayment: (id: string) => Promise<ActionResult<void>>;
  addEmployee: (name: string, dailyRate: number) => Promise<ActionResult<void>>;
  removeEmployee: (id: string) => Promise<ActionResult<void>>;
  updateEmployeeRate: (id: string, dailyRate: number) => Promise<ActionResult<void>>;
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
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
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
      setShifts([]);
      setPayments([]);
      setStatus('error');
      setError('Supabase не настроен. Добавьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY.');
      return;
    }

    if (authStatus !== 'authenticated' || !user) {
      setEmployees([]);
      setShifts([]);
      setPayments([]);
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
      setShifts(sortShifts(result.data.shifts));
      setPayments(sortPayments(result.data.payments));
      setStatus('ready');
      setError(null);
    })();

    return () => {
      isActive = false;
    };
  }, [authStatus, user]);

  const requireUser = (): ActionResult<string> => {
    if (!user) {
      return errorResult('Сначала нужно войти в аккаунт.');
    }

    return okResult(user.id);
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
    setShifts(sortShifts(result.data.shifts));
    setPayments(sortPayments(result.data.payments));
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

  const addEmployee = async (name: string, dailyRate: number): Promise<ActionResult<void>> => {
    const userResult = requireUser();
    if (!userResult.ok) return userResult;

    const result = await createEmployee(userResult.data, name, dailyRate);
    if (!result.ok) {
      setError(result.error);
      return errorResult(result.error);
    }

    setEmployees((prev) => sortEmployees([...prev, result.data]));
    setError(null);
    return okResult(undefined, result.message);
  };

  const removeEmployee = async (id: string): Promise<ActionResult<void>> => {
    const userResult = requireUser();
    if (!userResult.ok) return userResult;

    const result = await archiveEmployeeRemote(userResult.data, id);
    if (!result.ok) {
      setError(result.error);
      return errorResult(result.error);
    }

    setEmployees((prev) => sortEmployees(prev.map((employee) => (
      employee.id === id ? result.data : employee
    ))));
    setError(null);
    return okResult(undefined, result.message);
  };

  const updateEmployeeRate = async (id: string, dailyRate: number): Promise<ActionResult<void>> => {
    const userResult = requireUser();
    if (!userResult.ok) return userResult;

    const result = await updateEmployeeRateRemote(userResult.data, id, dailyRate);
    if (!result.ok) {
      setError(result.error);
      return errorResult(result.error);
    }

    setEmployees((prev) => sortEmployees(prev.map((employee) => (
      employee.id === id ? result.data : employee
    ))));
    setError(null);
    return okResult(undefined, result.message);
  };

  const updateShift = async (
    employeeId: string,
    date: string,
    nextStatus: ShiftStatus,
  ): Promise<ActionResult<void>> => {
    const userResult = requireUser();
    if (!userResult.ok) return userResult;

    if (nextStatus === 'none') {
      const result = await deleteShiftRemote(userResult.data, employeeId, date);
      if (!result.ok) {
        setError(result.error);
        return errorResult(result.error);
      }

      setShifts((prev) => prev.filter((shift) => !(shift.employeeId === employeeId && shift.date === date)));
      setError(null);
      return okResult(undefined);
    }

    const employee = employees.find((item) => item.id === employeeId);
    if (!employee) {
      return errorResult('Сотрудник не найден.');
    }

    const result = await upsertShiftRemote(
      userResult.data,
      employeeId,
      date,
      nextStatus,
      employee.dailyRate,
    );

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

  const addPayment = async (payment: AddPaymentInput): Promise<ActionResult<void>> => {
    const userResult = requireUser();
    if (!userResult.ok) return userResult;

    const result = await createPaymentRemote(userResult.data, payment);
    if (!result.ok) {
      setError(result.error);
      return errorResult(result.error);
    }

    setPayments((prev) => sortPayments([result.data, ...prev]));
    setError(null);
    return okResult(undefined, result.message);
  };

  const deletePayment = async (id: string): Promise<ActionResult<void>> => {
    const userResult = requireUser();
    if (!userResult.ok) return userResult;

    const result = await deletePaymentRemote(userResult.data, id);
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
    shifts,
    payments,
    preferences,
  });

  const importAppState = async (payload: unknown): Promise<ActionResult<void>> => {
    const userResult = requireUser();
    if (!userResult.ok) return userResult;

    const importedData = parseBackupPayload(payload);
    if (!importedData) {
      return errorResult('Файл резервной копии поврежден или создан не в PVZ Schedule.');
    }

    setStatus('loading');
    const result = await replaceUserDataRemote(userResult.data, importedData);
    if (!result.ok) {
      setStatus('ready');
      setError(result.error);
      return errorResult(result.error);
    }

    setEmployees(sortEmployees(result.data.employees));
    setShifts(sortShifts(result.data.shifts));
    setPayments(sortPayments(result.data.payments));
    setPreferences({
      selectedMonth: importedData.selectedMonth,
      selectedYear: importedData.selectedYear,
    });
    setStatus('ready');
    setError(null);
    return okResult(undefined, 'Резервная копия успешно импортирована.');
  };

  const payrollSource = {
    employees,
    shifts,
    payments,
  };

  const value: AppContextType = {
    employees,
    shifts,
    payments,
    selectedMonth: preferences.selectedMonth,
    selectedYear: preferences.selectedYear,
    status,
    error,
    setSelectedMonth,
    setSelectedYear,
    refreshData,
    updateShift,
    addPayment,
    deletePayment,
    addEmployee,
    removeEmployee,
    updateEmployeeRate,
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
