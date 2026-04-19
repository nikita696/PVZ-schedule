export type ShiftStatusDb =
  | 'shift'
  | 'day_off'
  | 'sick_leave'
  | 'no_show'
  | 'replacement'
  | 'no_shift';

export type ShiftStatus = ShiftStatusDb;
export type ShiftEditorStatus = ShiftStatusDb | 'none';

export type EmployeeStatus = 'active' | 'archived';
export type PaymentStatus = 'pending' | 'approved' | 'rejected';
export type UserRole = 'admin' | 'employee';
export type ResolvedAccessState = UserRole | 'unregistered';
export type MonthStatus = 'draft' | 'pending_approval' | 'approved' | 'closed';

export type AppDataStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface Employee {
  id: string;
  userId: string;
  organizationId: string;
  profileId: string | null;
  authUserId: string | null;
  workEmail: string | null;
  status: EmployeeStatus;
  createdByProfileId: string | null;
  isOwner: boolean;
  hiredAt: string | null;
  terminatedAt: string | null;
  name: string;
  dailyRate: number;
  archived: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeRateHistory {
  id: string;
  employeeId: string;
  organizationId: string;
  rate: number;
  validFrom: string;
  validTo: string | null;
  createdByProfileId: string | null;
  createdAt: string;
}

export interface ScheduleMonth {
  id: string;
  organizationId: string;
  year: number;
  month: number;
  status: MonthStatus;
  approvedByProfileId: string | null;
  approvedAt: string | null;
  closedByProfileId: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Shift {
  id: string;
  userId: string;
  organizationId: string;
  employeeId: string;
  date: string;
  status: ShiftStatusDb;
  requestedStatus: ShiftStatusDb | null;
  approvedStatus: ShiftStatusDb | null;
  actualStatus: ShiftStatusDb | null;
  rateSnapshot: number;
  createdByProfileId: string | null;
  requestedByProfileId: string | null;
  approvedByProfileId: string | null;
  actualByProfileId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  id: string;
  userId: string;
  organizationId: string;
  employeeId: string;
  amount: number;
  date: string;
  comment: string;
  status: PaymentStatus;
  requestedByAuthUserId: string | null;
  approvedByAuthUserId: string | null;
  requestedByProfileId: string | null;
  approvedByProfileId: string | null;
  approvedAt: string | null;
  editedByAdmin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface EmployeeStats {
  workedCount: number;
  plannedCount: number;
  sickCount: number;
  dayOffCount: number;
  earnedActual: number;
  paidApproved: number;
  dueNow: number;
  forecastTotal: number;
}

export interface EmployeeDebtSnapshot {
  workedCountTotalToDate: number;
  workedCountCurrentMonthToDate: number;
  accruedToDate: number;
  paidToDate: number;
  debtToDate: number;
}

export interface MonthlyBreakdownRow {
  month: number;
  workedCount: number;
  sickCount: number;
  dayOffCount: number;
  earnedActual: number;
  paidApproved: number;
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
  rateHistory: EmployeeRateHistory[];
  scheduleMonths: ScheduleMonth[];
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
  hiredAt: string | null;
  terminatedAt: string | null;
  archived: boolean;
}

export interface ImportedEmployeeRateHistory {
  employeeId: string;
  rate: number;
  validFrom: string;
  validTo: string | null;
}

export interface ImportedScheduleMonth {
  year: number;
  month: number;
  status: MonthStatus;
}

export interface ImportedShift {
  employeeId: string;
  date: string;
  requestedStatus: ShiftStatusDb | null;
  approvedStatus: ShiftStatusDb | null;
  actualStatus: ShiftStatusDb | null;
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
  rateHistory: ImportedEmployeeRateHistory[];
  scheduleMonths: ImportedScheduleMonth[];
  shifts: ImportedShift[];
  payments: ImportedPayment[];
  selectedMonth: number;
  selectedYear: number;
}

export interface UserAccess {
  role: UserRole;
  organizationId: string;
  ownerUserId: string;
  profileId: string;
  profileDisplayName?: string | null;
  employeeId: string | null;
}

export interface SessionIdentity {
  authUserId: string;
  providerSubject: string | null;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  initials: string;
  role: UserRole | null;
  roleLabel: string | null;
  isOwner: boolean;
}

export interface RecentAccount {
  authUserId: string;
  providerSubject: string | null;
  email: string | null;
  displayName: string;
  avatarUrl: string | null;
  lastResolvedRole: UserRole | null;
  lastSignedInAt: string;
}
