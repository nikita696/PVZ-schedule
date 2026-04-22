import type {
  Employee,
  EmployeeRateHistory,
  Payment,
  ScheduleMonth,
  Shift,
  UserAccess,
} from '../domain/types';

export interface AppDataState {
  employees: Employee[];
  rateHistory: EmployeeRateHistory[];
  scheduleMonths: ScheduleMonth[];
  shifts: Shift[];
  payments: Payment[];
  access: UserAccess | null;
}

export const createEmptyAppDataState = (): AppDataState => ({
  employees: [],
  rateHistory: [],
  scheduleMonths: [],
  shifts: [],
  payments: [],
  access: null,
});

export const sortEmployees = (items: Employee[]): Employee[] => (
  [...items].sort((left, right) => {
    if (left.archived !== right.archived) {
      return Number(left.archived) - Number(right.archived);
    }

    return left.name.localeCompare(right.name);
  })
);

export const sortRateHistory = (items: EmployeeRateHistory[]): EmployeeRateHistory[] => (
  [...items].sort((left, right) => {
    if (left.employeeId !== right.employeeId) {
      return left.employeeId.localeCompare(right.employeeId);
    }

    return left.validFrom.localeCompare(right.validFrom);
  })
);

export const sortScheduleMonths = (items: ScheduleMonth[]): ScheduleMonth[] => (
  [...items].sort((left, right) => (
    left.year === right.year ? left.month - right.month : left.year - right.year
  ))
);

export const sortShifts = (items: Shift[]): Shift[] => (
  [...items].sort((left, right) => left.date.localeCompare(right.date))
);

export const sortPayments = (items: Payment[]): Payment[] => (
  [...items].sort((left, right) => {
    if (left.date !== right.date) {
      return right.date.localeCompare(left.date);
    }

    return right.createdAt.localeCompare(left.createdAt);
  })
);

const replaceById = <T extends { id: string }>(items: T[], nextItem: T): T[] => (
  items.map((item) => (item.id === nextItem.id ? nextItem : item))
);

export const normalizeAppDataState = (state: AppDataState): AppDataState => ({
  employees: sortEmployees(state.employees),
  rateHistory: sortRateHistory(state.rateHistory),
  scheduleMonths: sortScheduleMonths(state.scheduleMonths),
  shifts: sortShifts(state.shifts),
  payments: sortPayments(state.payments),
  access: state.access,
});

export const buildLocalRateHistoryEntry = (
  employee: Employee,
  profileId: string | null,
  validFrom: string,
  createdAt: string = employee.createdAt,
): EmployeeRateHistory => ({
  id: `local-rate:${employee.id}:${validFrom}`,
  employeeId: employee.id,
  organizationId: employee.organizationId,
  rate: employee.dailyRate,
  validFrom,
  validTo: employee.terminatedAt,
  createdByProfileId: profileId,
  createdAt,
});

export const withCurrentUserNameUpdated = (
  state: AppDataState,
  displayName: string,
  employee: Employee | null,
): AppDataState => ({
  ...state,
  employees: employee
    ? sortEmployees(replaceById(state.employees, employee))
    : state.employees,
  access: state.access
    ? { ...state.access, profileDisplayName: displayName }
    : state.access,
});

export const withScheduleMonthUpdated = (
  state: AppDataState,
  nextMonth: ScheduleMonth,
): AppDataState => ({
  ...state,
  scheduleMonths: sortScheduleMonths([
    ...state.scheduleMonths.filter((item) => !(
      item.year === nextMonth.year && item.month === nextMonth.month
    )),
    nextMonth,
  ]),
});

export const withEmployeeAdded = (
  state: AppDataState,
  employee: Employee,
  profileId: string | null,
): AppDataState => {
  const validFrom = employee.hiredAt ?? employee.createdAt.slice(0, 10);

  return {
    ...state,
    employees: sortEmployees([...state.employees, employee]),
    rateHistory: sortRateHistory([
      ...state.rateHistory,
      buildLocalRateHistoryEntry(employee, profileId, validFrom),
    ]),
  };
};

export const withEmployeeUpdated = (
  state: AppDataState,
  employee: Employee,
): AppDataState => ({
  ...state,
  employees: sortEmployees(replaceById(state.employees, employee)),
});

export const withArchivedEmployee = (
  state: AppDataState,
  employee: Employee,
): AppDataState => ({
  ...state,
  employees: sortEmployees(replaceById(state.employees, employee)),
  rateHistory: sortRateHistory(state.rateHistory.map((item) => (
    item.employeeId === employee.id && item.validTo === null
      ? { ...item, validTo: employee.terminatedAt }
      : item
  ))),
});

export const withoutEmployee = (
  state: AppDataState,
  employeeId: string,
): AppDataState => ({
  ...state,
  employees: state.employees.filter((employee) => employee.id !== employeeId),
  rateHistory: state.rateHistory.filter((item) => item.employeeId !== employeeId),
  shifts: state.shifts.filter((shift) => shift.employeeId !== employeeId),
  payments: state.payments.filter((payment) => payment.employeeId !== employeeId),
});

export const withEmployeeRateUpdated = (
  state: AppDataState,
  employee: Employee,
  effectiveFrom: string,
  profileId: string | null,
  createdAt: string,
): AppDataState => {
  const closedPrev = state.rateHistory.map((item) => (
    item.employeeId === employee.id && item.validTo === null && item.validFrom < effectiveFrom
      ? { ...item, validTo: effectiveFrom }
      : item
  ));

  return {
    ...state,
    employees: sortEmployees(replaceById(state.employees, employee)),
    rateHistory: sortRateHistory([
      ...closedPrev.filter((item) => !(
        item.employeeId === employee.id && item.validFrom === effectiveFrom
      )),
      buildLocalRateHistoryEntry(employee, profileId, effectiveFrom, createdAt),
    ]),
  };
};

export const withoutShift = (
  state: AppDataState,
  employeeId: string,
  date: string,
): AppDataState => ({
  ...state,
  shifts: state.shifts.filter((shift) => !(
    shift.employeeId === employeeId && shift.date === date
  )),
});

export const withShiftUpserted = (
  state: AppDataState,
  shift: Shift,
): AppDataState => ({
  ...state,
  shifts: sortShifts([
    ...state.shifts.filter((item) => !(
      item.employeeId === shift.employeeId && item.date === shift.date
    )),
    shift,
  ]),
});

export const withPaymentAdded = (
  state: AppDataState,
  payment: Payment,
): AppDataState => ({
  ...state,
  payments: sortPayments([payment, ...state.payments]),
});

export const withPaymentUpdated = (
  state: AppDataState,
  payment: Payment,
): AppDataState => ({
  ...state,
  payments: sortPayments(replaceById(state.payments, payment)),
});

export const withoutPayment = (
  state: AppDataState,
  paymentId: string,
): AppDataState => ({
  ...state,
  payments: state.payments.filter((payment) => payment.id !== paymentId),
});
