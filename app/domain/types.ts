export type ShiftStatus = 'working' | 'day-off' | 'sick' | 'no-show' | 'none';

export type AppDataStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface Employee {
  id: string;
  userId: string;
  name: string;
  dailyRate: number;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Shift {
  id: string;
  userId: string;
  employeeId: string;
  date: string;
  status: ShiftStatus;
  rateSnapshot: number;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  userId: string;
  employeeId: string;
  amount: number;
  date: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeStats {
  shiftsWorked: number;
  earned: number;
  paid: number;
  due: number;
}

export interface MonthlyBreakdownRow {
  month: number;
  shiftsWorked: number;
  accrued: number;
  paid: number;
  delta: number;
  balanceEnd: number;
}

export interface UiPreferences {
  selectedMonth: number;
  selectedYear: number;
}

export interface AppDataSnapshot {
  employees: Employee[];
  shifts: Shift[];
  payments: Payment[];
  preferences: UiPreferences;
}

export interface AddPaymentInput {
  employeeId: string;
  amount: number;
  date: string;
  comment: string;
}

export interface ImportedEmployee {
  id: string;
  name: string;
  dailyRate: number;
  archived: boolean;
}

export interface ImportedShift {
  employeeId: string;
  date: string;
  status: ShiftStatus;
  rateSnapshot: number;
}

export interface ImportedPayment {
  employeeId: string;
  amount: number;
  date: string;
  comment: string;
}

export interface ImportedAppData {
  employees: ImportedEmployee[];
  shifts: ImportedShift[];
  payments: ImportedPayment[];
  selectedMonth: number;
  selectedYear: number;
}
