import type { Employee, Payment, Shift, UserAccess } from './types';

export const filterVisibleEmployees = (employees: Employee[], access: UserAccess): Employee[] => {
  void access;
  return employees;
};

export const filterVisibleShifts = (shifts: Shift[], access: UserAccess): Shift[] => {
  void access;
  return shifts;
};

export const filterVisiblePayments = (payments: Payment[], access: UserAccess): Payment[] => {
  if (access.role === 'admin') return payments;
  return payments.filter((payment) => payment.employeeId === access.employeeId);
};

export const canConfirmPayment = (payment: Payment, access: UserAccess): boolean => (
  access.role === 'admin' && payment.status === 'pending'
);

export const canRejectPayment = (payment: Payment, access: UserAccess): boolean => (
  access.role === 'admin' && payment.status === 'pending'
);

export const canEditPayment = (payment: Payment, access: UserAccess): boolean => {
  if (access.role === 'admin') return true;
  return payment.status === 'pending' && payment.employeeId === access.employeeId;
};

export const canDeletePayment = (payment: Payment, access: UserAccess): boolean => {
  if (access.role === 'admin') return payment.status !== 'approved';
  return payment.status === 'pending' && payment.employeeId === access.employeeId;
};
