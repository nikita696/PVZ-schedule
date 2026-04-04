import React, { createContext, useContext, useEffect, useMemo, useRef, useState, ReactNode } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type ShiftStatus = 'working' | 'day-off' | 'sick' | 'no-show' | 'none';
type SyncStatus = 'local' | 'syncing' | 'synced' | 'error';

export interface Employee {
  id: string;
  name: string;
  dailyRate: number;
  archived?: boolean;
}

export interface Shift {
  employeeId: string;
  date: string;
  status: ShiftStatus;
  dailyRate?: number;
}

export interface Payment {
  id: string;
  employeeId: string;
  amount: number;
  date: string;
  comment: string;
}

interface PersistedState {
  employees: Employee[];
  shifts: Shift[];
  payments: Payment[];
  selectedMonth: number;
  selectedYear: number;
}

interface EmployeeStats {
  shiftsWorked: number;
  earned: number;
  paid: number;
  due: number;
}

interface AppContextType extends PersistedState {
  setSelectedMonth: (month: number) => void;
  setSelectedYear: (year: number) => void;
  updateShift: (employeeId: string, date: string, status: ShiftStatus) => void;
  addPayment: (payment: Omit<Payment, 'id'>) => void;
  deletePayment: (id: string) => void;
  addEmployee: (name: string, dailyRate: number) => void;
  removeEmployee: (id: string) => void;
  updateEmployeeRate: (id: string, dailyRate: number) => void;
  getEmployeeStats: (employeeId: string, month: number, year: number) => EmployeeStats;
  getEmployeeLifetimeStats: (employeeId: string) => EmployeeStats;
  syncStatus: SyncStatus;
  syncError: string | null;
}

const AppContext = createContext<AppContextType | undefined>(undefined);
const STORAGE_KEY = 'pvz-schedule-state-v2';
const SUPABASE_TABLE = 'app_state';
const SUPABASE_ROW_ID = 'main';

const now = new Date();

const defaultState: PersistedState = {
  employees: [
    { id: 'pavel', name: 'Павел', dailyRate: 2500, archived: false },
    { id: 'nikita', name: 'Никита', dailyRate: 2500, archived: false },
  ],
  shifts: [],
  payments: [],
  selectedMonth: now.getMonth() + 1,
  selectedYear: now.getFullYear(),
};

const makeSupabase = (): SupabaseClient | null => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
};

const parseLocalDate = (dateString: string): Date => {
  const [y, m, d] = dateString.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0, 0);
};

const isWorkedByToday = (date: Date): boolean => {
  const today = new Date();
  const todayLocal = new Date(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59, 999);
  return date <= todayLocal;
};

const loadFromLocalStorage = (): { state: PersistedState; updatedAt: string } => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { state: defaultState, updatedAt: new Date(0).toISOString() };

    const parsed = JSON.parse(raw);
    if (parsed?.state) {
      return {
        state: { ...defaultState, ...parsed.state },
        updatedAt: parsed.updatedAt || new Date(0).toISOString(),
      };
    }

    return { state: { ...defaultState, ...parsed }, updatedAt: new Date(0).toISOString() };
  } catch {
    return { state: defaultState, updatedAt: new Date(0).toISOString() };
  }
};

export function AppProvider({ children }: { children: ReactNode }) {
  const initial = loadFromLocalStorage();
  const [state, setState] = useState<PersistedState>(initial.state);
  const [supabase] = useState(() => makeSupabase());
  const [isRemoteReady, setIsRemoteReady] = useState(!supabase);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(supabase ? 'syncing' : 'local');
  const [syncError, setSyncError] = useState<string | null>(null);
  const localUpdatedAtRef = useRef(initial.updatedAt);

  useEffect(() => {
    const updatedAt = new Date().toISOString();
    localUpdatedAtRef.current = updatedAt;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ state, updatedAt }));
  }, [state]);

  useEffect(() => {
    if (!supabase) return;

    (async () => {
      try {
        setSyncStatus('syncing');
        const { data, error } = await supabase
          .from(SUPABASE_TABLE)
          .select('payload, updated_at')
          .eq('id', SUPABASE_ROW_ID)
          .maybeSingle();

        if (error) throw error;

        if (data?.payload) {
          const remoteUpdatedAt = data.updated_at || new Date(0).toISOString();
          if (new Date(remoteUpdatedAt).getTime() > new Date(localUpdatedAtRef.current).getTime()) {
            setState({ ...defaultState, ...data.payload });
            localUpdatedAtRef.current = remoteUpdatedAt;
          }
        }

        setSyncStatus('synced');
      } catch (error) {
        setSyncStatus('error');
        setSyncError('Не удалось загрузить данные из Supabase. Используется локальный режим.');
        console.error(error);
      } finally {
        setIsRemoteReady(true);
      }
    })();
  }, [supabase]);

  useEffect(() => {
    if (!supabase || !isRemoteReady) return;

    const timeout = setTimeout(async () => {
      try {
        setSyncStatus('syncing');
        const { error } = await supabase
          .from(SUPABASE_TABLE)
          .upsert({ id: SUPABASE_ROW_ID, payload: state, updated_at: localUpdatedAtRef.current });

        if (error) throw error;
        setSyncStatus('synced');
        setSyncError(null);
      } catch (error) {
        setSyncStatus('error');
        setSyncError('Не удалось синхронизировать изменения. Данные сохранены локально.');
        console.error(error);
      }
    }, 600);

    return () => clearTimeout(timeout);
  }, [state, supabase, isRemoteReady]);

  const updateShift = (employeeId: string, date: string, status: ShiftStatus) => {
    setState((prev) => {
      const employee = prev.employees.find((e) => e.id === employeeId);
      const existingIndex = prev.shifts.findIndex((s) => s.employeeId === employeeId && s.date === date);

      if (existingIndex >= 0) {
        const shifts = [...prev.shifts];
        shifts[existingIndex] = { ...shifts[existingIndex], status };
        return { ...prev, shifts };
      }

      return {
        ...prev,
        shifts: [...prev.shifts, { employeeId, date, status, dailyRate: employee?.dailyRate ?? 0 }],
      };
    });
  };

  const addPayment = (payment: Omit<Payment, 'id'>) => {
    const newPayment: Payment = { ...payment, id: Date.now().toString() };
    setState((prev) => ({ ...prev, payments: [newPayment, ...prev.payments] }));
  };

  const deletePayment = (id: string) => {
    setState((prev) => ({ ...prev, payments: prev.payments.filter((p) => p.id !== id) }));
  };

  const addEmployee = (name: string, dailyRate: number) => {
    setState((prev) => ({
      ...prev,
      employees: [...prev.employees, { id: crypto.randomUUID(), name, dailyRate, archived: false }],
    }));
  };

  const removeEmployee = (id: string) => {
    setState((prev) => ({
      ...prev,
      employees: prev.employees.map((e) => (e.id === id ? { ...e, archived: true } : e)),
    }));
  };

  const updateEmployeeRate = (id: string, dailyRate: number) => {
    setState((prev) => ({
      ...prev,
      employees: prev.employees.map((e) => (e.id === id ? { ...e, dailyRate } : e)),
    }));
  };

  const setSelectedMonth = (month: number) => {
    setState((prev) => ({ ...prev, selectedMonth: month }));
  };

  const setSelectedYear = (year: number) => {
    setState((prev) => ({ ...prev, selectedYear: year }));
  };

  const calculateStats = (
    employeeId: string,
    isShiftIncluded: (date: Date) => boolean,
    isPaymentIncluded: (date: Date) => boolean,
  ): EmployeeStats => {
    const employee = state.employees.find((e) => e.id === employeeId);
    if (!employee) return { shiftsWorked: 0, earned: 0, paid: 0, due: 0 };

    const eligibleShifts = state.shifts.filter((shift) => (
      shift.employeeId === employeeId &&
      shift.status === 'working' &&
      isShiftIncluded(parseLocalDate(shift.date))
    ));

    const shiftsWorked = eligibleShifts.length;
    const earned = eligibleShifts.reduce((sum, shift) => sum + (shift.dailyRate ?? employee.dailyRate), 0);

    const paid = state.payments
      .filter((payment) => payment.employeeId === employeeId && isPaymentIncluded(parseLocalDate(payment.date)))
      .reduce((sum, p) => sum + p.amount, 0);

    return { shiftsWorked, earned, paid, due: earned - paid };
  };

  const getEmployeeStats = (employeeId: string, month: number, year: number): EmployeeStats => (
    calculateStats(
      employeeId,
      (shiftDate) => shiftDate.getMonth() + 1 === month && shiftDate.getFullYear() === year && isWorkedByToday(shiftDate),
      (paymentDate) => paymentDate.getMonth() + 1 === month && paymentDate.getFullYear() === year,
    )
  );

  const getEmployeeLifetimeStats = (employeeId: string): EmployeeStats => (
    calculateStats(employeeId, (date) => isWorkedByToday(date), () => true)
  );

  const value = useMemo<AppContextType>(() => ({
    ...state,
    setSelectedMonth,
    setSelectedYear,
    updateShift,
    addPayment,
    deletePayment,
    addEmployee,
    removeEmployee,
    updateEmployeeRate,
    getEmployeeStats,
    getEmployeeLifetimeStats,
    syncStatus,
    syncError,
  }), [state, syncStatus, syncError]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
