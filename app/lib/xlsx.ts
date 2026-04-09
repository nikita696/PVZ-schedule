import type { Employee, EmployeeRateHistory, EmployeeStats, Payment, Shift } from '../domain/types';
import { SHIFT_STATUS_LABEL, isShiftLikeStatus } from '../domain/shiftStatus';

const PAYMENT_STATUS_LABEL: Record<Payment['status'], string> = {
  pending: 'На подтверждении',
  approved: 'Подтверждена',
  rejected: 'Отклонена',
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
  rateHistory?: EmployeeRateHistory[];
}

export const exportEmployeePayslipXlsx = async (input: ExportEmployeePayslipInput): Promise<void> => {
  const XLSX = await import('xlsx');

  const filteredShifts = input.shifts
    .filter((shift) => {
      const [year, month] = shift.date.split('-').map(Number);
      return year === input.year && month === input.month;
    })
    .sort((left, right) => left.date.localeCompare(right.date));

  const approvedPayments = input.payments
    .filter((payment) => {
      const [year, month] = payment.date.split('-').map(Number);
      return year === input.year && month === input.month && payment.status === 'approved';
    })
    .sort((left, right) => left.date.localeCompare(right.date));

  const ratesForPeriod = (input.rateHistory ?? [])
    .filter((item) => item.employeeId === input.employee.id)
    .filter((item) => (
      item.validFrom <= `${input.year}-${String(input.month).padStart(2, '0')}-31`
      && (item.validTo === null || item.validTo >= `${input.year}-${String(input.month).padStart(2, '0')}-01`)
    ))
    .sort((left, right) => left.validFrom.localeCompare(right.validFrom));

  const shiftRows = filteredShifts.map((shift) => {
    const effectiveStatus = shift.actualStatus ?? shift.approvedStatus ?? shift.requestedStatus ?? shift.status;
    return [
      shift.date,
      SHIFT_STATUS_LABEL[effectiveStatus],
      shift.rateSnapshot,
      isShiftLikeStatus(effectiveStatus) ? shift.rateSnapshot : 0,
    ];
  });

  const paymentRows = approvedPayments.map((payment) => [
    payment.date,
    payment.amount,
    payment.comment,
    PAYMENT_STATUS_LABEL[payment.status],
  ]);

  const rateRows = ratesForPeriod.length > 0
    ? ratesForPeriod.map((item) => [
        `${item.validFrom} — ${item.validTo ?? 'по настоящее время'}`,
        money(item.rate),
      ])
    : [[`Текущая ставка`, money(input.employee.dailyRate)]];

  const rows: Array<Array<string | number>> = [
    ['Расчетный лист'],
    [],
    ['Сотрудник', input.employee.name],
    ['Период', `${String(input.month).padStart(2, '0')}.${input.year}`],
    [],
    ['Ставки за период'],
    ['Интервал', 'Ставка'],
    ...rateRows,
    [],
    ['Смены'],
    ['Дата', 'Статус', 'Ставка на дату', 'Учитывается в заработке'],
    ...shiftRows,
    [],
    ['Итоги'],
    ['Утвержденных смен', input.stats.workedCount],
    ['Плановых смен', input.stats.plannedCount],
    ['Больничных', input.stats.sickCount],
    ['Выходных / без смены', input.stats.dayOffCount],
    ['Заработано по факту', money(input.stats.earnedActual)],
    ['Выплачено', money(input.stats.paidApproved)],
    ['Долг ПВЗ', money(input.stats.dueNow)],
    ['Потенциал по графику', money(input.stats.forecastTotal)],
    [],
    ['Подтвержденные выплаты'],
    ['Дата', 'Сумма', 'Комментарий', 'Статус'],
    ...paymentRows,
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Расчетный лист');

  const safeEmployeeName = input.employee.name.replace(/[\\/:*?"<>|]/g, '_');
  const fileName = `Расчетный лист - ${safeEmployeeName} - ${input.year}-${String(input.month).padStart(2, '0')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};
