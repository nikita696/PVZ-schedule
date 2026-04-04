import React, { createContext, useContext, useState, ReactNode } from 'react';

export type ShiftStatus = 'working' | 'day-off' | 'sick' | 'no-show' | 'none';

export interface Employee {
  id: string;
  name: string;
  dailyRate: number;
}

export interface Shift {
  employeeId: string;
  date: string; // YYYY-MM-DD
  status: ShiftStatus;
}

export interface Payment {
  id: string;
  employeeId: string;
  amount: number;
  date: string; // YYYY-MM-DD
  comment: string;
}

interface AppContextType {
  employees: Employee[];
  shifts: Shift[];
  payments: Payment[];
  selectedMonth: number;
  selectedYear: number;
  setSelectedMonth: (month: number) => void;
  setSelectedYear: (year: number) => void;
  updateShift: (employeeId: string, date: string, status: ShiftStatus) => void;
  addPayment: (payment: Omit<Payment, 'id'>) => void;
  deletePayment: (id: string) => void;
  getEmployeeStats: (employeeId: string, month: number, year: number) => {
    shiftsWorked: number;
    earned: number;
    paid: number;
    due: number;
  };
}

const AppContext = createContext<AppContextType | undefined>(undefined);

// Mock data
const initialEmployees: Employee[] = [
  { id: 'pavel', name: 'Pavel', dailyRate: 2500 },
  { id: 'nikita', name: 'Nikita', dailyRate: 2500 },
];

// Generate mock shifts for March 2026
const generateInitialShifts = (): Shift[] => {
  const shifts: Shift[] = [];
  const daysInMarch = 31;
  
  for (let day = 1; day <= daysInMarch; day++) {
    const date = `2026-03-${String(day).padStart(2, '0')}`;
    
    // Pavel works most days
    if (day <= 15) {
      shifts.push({ employeeId: 'pavel', date, status: 'working' });
    } else if (day === 16 || day === 17) {
      shifts.push({ employeeId: 'pavel', date, status: 'sick' });
    } else if (day % 2 === 0) {
      shifts.push({ employeeId: 'pavel', date, status: 'day-off' });
    } else {
      shifts.push({ employeeId: 'pavel', date, status: 'working' });
    }
    
    // Nikita works alternating days mostly
    if (day <= 14) {
      shifts.push({ employeeId: 'nikita', date, status: 'working' });
    } else if (day === 15) {
      shifts.push({ employeeId: 'nikita', date, status: 'no-show' });
    } else if (day % 2 === 1) {
      shifts.push({ employeeId: 'nikita', date, status: 'working' });
    } else {
      shifts.push({ employeeId: 'nikita', date, status: 'day-off' });
    }
  }
  
  return shifts;
};

const initialPayments: Payment[] = [
  {
    id: '1',
    employeeId: 'pavel',
    amount: 7000,
    date: '2026-03-10',
    comment: 'salary',
  },
  {
    id: '2',
    employeeId: 'pavel',
    amount: 3000,
    date: '2026-03-25',
    comment: 'advance',
  },
  {
    id: '3',
    employeeId: 'nikita',
    amount: 5000,
    date: '2026-03-31',
    comment: 'manual payout',
  },
];

export function AppProvider({ children }: { children: ReactNode }) {
  const [employees] = useState<Employee[]>(initialEmployees);
  const [shifts, setShifts] = useState<Shift[]>(generateInitialShifts());
  const [payments, setPayments] = useState<Payment[]>(initialPayments);
  const [selectedMonth, setSelectedMonth] = useState(3); // March
  const [selectedYear, setSelectedYear] = useState(2026);

  const updateShift = (employeeId: string, date: string, status: ShiftStatus) => {
    setShifts((prevShifts) => {
      const existingIndex = prevShifts.findIndex(
        (s) => s.employeeId === employeeId && s.date === date
      );

      if (existingIndex >= 0) {
        const newShifts = [...prevShifts];
        newShifts[existingIndex] = { employeeId, date, status };
        return newShifts;
      } else {
        return [...prevShifts, { employeeId, date, status }];
      }
    });
  };

  const addPayment = (payment: Omit<Payment, 'id'>) => {
    const newPayment: Payment = {
      ...payment,
      id: Date.now().toString(),
    };
    setPayments((prev) => [newPayment, ...prev]);
  };

  const deletePayment = (id: string) => {
    setPayments((prev) => prev.filter((p) => p.id !== id));
  };

  const getEmployeeStats = (employeeId: string, month: number, year: number) => {
    const employee = employees.find((e) => e.id === employeeId);
    if (!employee) return { shiftsWorked: 0, earned: 0, paid: 0, due: 0 };

    // Filter shifts for the selected month/year
    const monthShifts = shifts.filter((shift) => {
      if (shift.employeeId !== employeeId) return false;
      const shiftDate = new Date(shift.date);
      return (
        shiftDate.getMonth() + 1 === month &&
        shiftDate.getFullYear() === year &&
        shift.status === 'working'
      );
    });

    const shiftsWorked = monthShifts.length;
    const earned = shiftsWorked * employee.dailyRate;

    // Calculate total paid for this month
    const monthPayments = payments.filter((payment) => {
      if (payment.employeeId !== employeeId) return false;
      const paymentDate = new Date(payment.date);
      return (
        paymentDate.getMonth() + 1 === month &&
        paymentDate.getFullYear() === year
      );
    });

    const paid = monthPayments.reduce((sum, p) => sum + p.amount, 0);
    const due = earned - paid;

    return { shiftsWorked, earned, paid, due };
  };

  return (
    <AppContext.Provider
      value={{
        employees,
        shifts,
        payments,
        selectedMonth,
        selectedYear,
        setSelectedMonth,
        setSelectedYear,
        updateShift,
        addPayment,
        deletePayment,
        getEmployeeStats,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
}
