export type ShiftStatusDb = 'planned-work' | 'worked' | 'day-off' | 'vacation' | 'sick' | 'no-show';
export type ShiftStatus = ShiftStatusDb | 'none';
export type PaymentStatus = 'entered' | 'confirmed';
export type UserRole = 'owner' | 'employee';

export type AppDataStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface Employee {
  id: string;
  userId: string;
  authUserId: string | null;
  isOwner: boolean;
  hiredAt: string | null;
  name: string;
  dailyRate: number;
  archived: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Shift {
  id: string;
  userId: string;
  employeeId: string;
  date: string;
  status: ShiftStatusDb;
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
  status: PaymentStatus;
  createdByAuthUserId: string | null;
  confirmedByAuthUserId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeStats {
  workedCount: number;
  plannedCount: number;
  sickCount: number;
  vacationCount: number;
  earnedActual: number;
  paidConfirmed: number;
  dueNow: number;
  forecastTotal: number;
}

export interface MonthlyBreakdownRow {
  month: number;
  workedCount: number;
  sickCount: number;
  vacationCount: number;
  earnedActual: number;
  paidConfirmed: number;
  forecastTotal: number;
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
  status?: PaymentStatus;
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
  status: ShiftStatusDb;
  rateSnapshot: number;
}

export interface ImportedPayment {
  employeeId: string;
  amount: number;
  date: string;
  comment: string;
  status?: PaymentStatus;
}

export interface ImportedAppData {
  employees: ImportedEmployee[];
  shifts: ImportedShift[];
  payments: ImportedPayment[];
  selectedMonth: number;
  selectedYear: number;
}

export interface UserAccess {
  role: UserRole;
  ownerUserId: string;
  employeeId: string | null;
}
