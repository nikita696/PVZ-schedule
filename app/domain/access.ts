import type { Employee, Payment, Shift, UserAccess } from './types';

export const filterVisibleEmployees = (employees: Employee[], access: UserAccess): Employee[] => {
  if (access.role === 'owner') return employees;
  return employees.filter((employee) => employee.id === access.employeeId);
};

export const filterVisibleShifts = (shifts: Shift[], access: UserAccess): Shift[] => {
  if (access.role === 'owner') return shifts;
  return shifts.filter((shift) => shift.employeeId === access.employeeId);
};

export const filterVisiblePayments = (payments: Payment[], access: UserAccess): Payment[] => {
  if (access.role === 'owner') return payments;
  return payments.filter((payment) => payment.employeeId === access.employeeId);
};

export const canConfirmPayment = (payment: Payment, access: UserAccess): boolean => (
  access.role === 'owner' && payment.status === 'entered'
);

export const canEditPayment = (payment: Payment, access: UserAccess): boolean => {
  if (access.role === 'owner') return true;
  return payment.status === 'entered' && payment.employeeId === access.employeeId;
};

export const canDeletePayment = (payment: Payment, access: UserAccess): boolean => (
  canEditPayment(payment, access)
);

