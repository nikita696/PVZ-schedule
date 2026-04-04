import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export type ShiftStatus = 'working' | 'day-off' | 'sick' | 'no-show' | 'none';

export interface Employee {
  id: string;
  name: string;
  dailyRate: number;
}

export interface Shift {
  employeeId: string;
  date: string;
  status: ShiftStatus;
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
  getEmployeeStats: (employeeId: string, month: number, year: number) => EmployeeStats;
  getEmployeeLifetimeStats: (employeeId: string) => EmployeeStats;
}

const AppContext = createContext<AppContextType | undefined>(undefined);
const STORAGE_KEY = 'pvz-schedule-state-v1';
const SUPABASE_TABLE = 'app_state';
const SUPABASE_ROW_ID = 'main';

const now = new Date();

const defaultState: PersistedState = {
  employees: [
    { id: 'pavel', name: 'Павел', dailyRate: 2500 },
    { id: 'nikita', name: 'Никита', dailyRate: 2500 },
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

const loadFromLocalStorage = (): PersistedState => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    return { ...defaultState, ...JSON.parse(raw) };
  } catch {
    return defaultState;
  }
};

const isWorkedUntilToday = (shiftDate: Date, month: number, year: number): boolean => {
  const today = new Date();
  const isCurrentPeriod = today.getMonth() + 1 === month && today.getFullYear() === year;
  if (!isCurrentPeriod) return true;
  return shiftDate <= today;
};

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<PersistedState>(loadFromLocalStorage);
  const [supabase] = useState(() => makeSupabase());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    if (!supabase) return;

    (async () => {
      const { data } = await supabase
        .from(SUPABASE_TABLE)
        .select('payload')
        .eq('id', SUPABASE_ROW_ID)
        .maybeSingle();

      if (data?.payload) {
        setState({ ...defaultState, ...data.payload });
      }
    })();
  }, [supabase]);

  useEffect(() => {
    if (!supabase) return;

    const timeout = setTimeout(async () => {
      await supabase
        .from(SUPABASE_TABLE)
        .upsert({ id: SUPABASE_ROW_ID, payload: state, updated_at: new Date().toISOString() });
    }, 500);

    return () => clearTimeout(timeout);
  }, [state, supabase]);

  const updateShift = (employeeId: string, date: string, status: ShiftStatus) => {
    setState((prev) => {
      const existingIndex = prev.shifts.findIndex((s) => s.employeeId === employeeId && s.date === date);
      if (existingIndex >= 0) {
        const shifts = [...prev.shifts];
        shifts[existingIndex] = { employeeId, date, status };
        return { ...prev, shifts };
      }
      return { ...prev, shifts: [...prev.shifts, { employeeId, date, status }] };
    });
  };

  const addPayment = (payment: Omit<Payment, 'id'>) => {
    const newPayment: Payment = { ...payment, id: Date.now().toString() };
    setState((prev) => ({ ...prev, payments: [newPayment, ...prev.payments] }));
  };

  const deletePayment = (id: string) => {
    setState((prev) => ({ ...prev, payments: prev.payments.filter((p) => p.id !== id) }));
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

    const shiftsWorked = state.shifts.filter((shift) => (
      shift.employeeId === employeeId &&
      shift.status === 'working' &&
      isShiftIncluded(new Date(shift.date))
    )).length;

    const earned = shiftsWorked * employee.dailyRate;

    const paid = state.payments
      .filter((payment) => payment.employeeId === employeeId && isPaymentIncluded(new Date(payment.date)))
      .reduce((sum, p) => sum + p.amount, 0);

    return { shiftsWorked, earned, paid, due: earned - paid };
  };

  const getEmployeeStats = (employeeId: string, month: number, year: number): EmployeeStats => (
    calculateStats(
      employeeId,
      (shiftDate) =>
        shiftDate.getMonth() + 1 === month &&
        shiftDate.getFullYear() === year &&
        isWorkedUntilToday(shiftDate, month, year),
      (paymentDate) => paymentDate.getMonth() + 1 === month && paymentDate.getFullYear() === year,
    )
  );

  const getEmployeeLifetimeStats = (employeeId: string): EmployeeStats => (
    calculateStats(employeeId, () => true, () => true)
  );

  const value: AppContextType = {
    ...state,
    setSelectedMonth,
    setSelectedYear,
    updateShift,
    addPayment,
    deletePayment,
    getEmployeeStats,
    getEmployeeLifetimeStats,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp must be used within AppProvider');
  return context;
}
