import type { Employee, EmployeeStats, Payment, Shift } from '../domain/types';

const STATUS_LABEL: Record<Shift['status'], string> = {
  'planned-work': 'Запланирована',
  worked: 'Отработана',
  'day-off': 'Выходной',
  vacation: 'Отпуск',
  sick: 'Больничный',
  'no-show': 'Не вышел',
};

const PAYMENT_STATUS_LABEL: Record<Payment['status'], string> = {
  entered: 'Внесена сотрудником',
  confirmed: 'Подтверждена',
};

const money = (value: number): string => (
  new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value)
);

export interface ExportEmployeePayslipInput {
  employee: Employee;
  month: number;
  year: number;
  shifts: Shift[];
  payments: Payment[];
  stats: EmployeeStats;
}

export const exportEmployeePayslipXlsx = async (input: ExportEmployeePayslipInput): Promise<void> => {
  const XLSX = await import('xlsx');

  const filteredShifts = input.shifts
    .filter((shift) => {
      const [year, month] = shift.date.split('-').map(Number);
      return year === input.year && month === input.month;
    })
    .sort((left, right) => left.date.localeCompare(right.date));

  const filteredPayments = input.payments
    .filter((payment) => {
      const [year, month] = payment.date.split('-').map(Number);
      return year === input.year && month === input.month;
    })
    .sort((left, right) => left.date.localeCompare(right.date));

  const rows: Array<Array<string | number>> = [
    ['Расчетный лист'],
    [],
    ['Сотрудник', input.employee.name],
    ['Месяц', `${String(input.month).padStart(2, '0')}.${input.year}`],
    ['Ставка', input.employee.dailyRate],
    [],
    ['Смены'],
    ['Дата', 'Статус', 'Ставка за смену', 'Сумма по смене'],
    ...filteredShifts.map((shift) => [
      shift.date,
      STATUS_LABEL[shift.status],
      shift.rateSnapshot,
      shift.status === 'worked' || shift.status === 'planned-work' ? shift.rateSnapshot : 0,
    ]),
    [],
    ['Сводка'],
    ['Отработано смен', input.stats.workedCount],
    ['Больничных', input.stats.sickCount],
    ['Отпускных дней', input.stats.vacationCount],
    ['Заработано (факт)', money(input.stats.earnedActual)],
    ['Выплачено (подтверждено)', money(input.stats.paidConfirmed)],
    ['К выплате сейчас', money(input.stats.dueNow)],
    ['Прогноз по текущему графику', money(input.stats.forecastTotal)],
    [],
    ['Выплаты'],
    ['Дата', 'Сумма', 'Комментарий', 'Статус'],
    ...filteredPayments.map((payment) => [
      payment.date,
      payment.amount,
      payment.comment,
      PAYMENT_STATUS_LABEL[payment.status],
    ]),
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Расчетный лист');

  const safeEmployeeName = input.employee.name.replace(/[\\/:*?"<>|]/g, '_');
  const fileName = `Расчетный лист - ${safeEmployeeName} - ${input.year}-${String(input.month).padStart(2, '0')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};
