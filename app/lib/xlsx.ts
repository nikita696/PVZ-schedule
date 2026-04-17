import type { Employee, EmployeeRateHistory, EmployeeStats, Payment, Shift } from '../domain/types';
import { getCurrentLanguage, getLocaleByLanguage, pickByLanguage } from './i18n';
import { getShiftStatusLabel, isShiftLikeStatus } from '../domain/shiftStatus';

const PAYMENT_STATUS_LABEL = (status: Payment['status']): string => {
  const language = getCurrentLanguage();

  switch (status) {
    case 'pending':
      return pickByLanguage(language, 'На подтверждении', 'Pending');
    case 'approved':
      return pickByLanguage(language, 'Подтверждена', 'Approved');
    case 'rejected':
      return pickByLanguage(language, 'Отклонена', 'Rejected');
    default:
      return pickByLanguage(language, 'На подтверждении', 'Pending');
  }
};

const money = (value: number): string => {
  const language = getCurrentLanguage();

  return new Intl.NumberFormat(getLocaleByLanguage(language), {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(value);
};

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
  const language = getCurrentLanguage();
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
      getShiftStatusLabel(effectiveStatus, language),
      shift.rateSnapshot,
      isShiftLikeStatus(effectiveStatus) ? shift.rateSnapshot : 0,
    ];
  });

  const paymentRows = approvedPayments.map((payment) => [
    payment.date,
    payment.amount,
    payment.comment,
    PAYMENT_STATUS_LABEL(payment.status),
  ]);

  const rateRows = ratesForPeriod.length > 0
    ? ratesForPeriod.map((item) => [
        `${item.validFrom} — ${item.validTo ?? pickByLanguage(language, 'по настоящее время', 'up to now')}`,
        money(item.rate),
      ])
    : [[pickByLanguage(language, 'Текущая ставка', 'Current rate'), money(input.employee.dailyRate)]];

  const rows: Array<Array<string | number>> = [
    [pickByLanguage(language, 'Расчетный лист', 'Payslip')],
    [],
    [pickByLanguage(language, 'Сотрудник', 'Employee'), input.employee.name],
    [pickByLanguage(language, 'Период', 'Period'), `${String(input.month).padStart(2, '0')}.${input.year}`],
    [],
    [pickByLanguage(language, 'Ставки за период', 'Rates for the period')],
    [pickByLanguage(language, 'Интервал', 'Interval'), pickByLanguage(language, 'Ставка', 'Rate')],
    ...rateRows,
    [],
    [pickByLanguage(language, 'Смены', 'Shifts')],
    [
      pickByLanguage(language, 'Дата', 'Date'),
      pickByLanguage(language, 'Статус', 'Status'),
      pickByLanguage(language, 'Ставка на дату', 'Rate on date'),
      pickByLanguage(language, 'Учитывается в заработке', 'Included in earnings'),
    ],
    ...shiftRows,
    [],
    [pickByLanguage(language, 'Итоги', 'Totals')],
    [pickByLanguage(language, 'Утвержденных смен', 'Approved shifts'), input.stats.workedCount],
    [pickByLanguage(language, 'Плановых смен', 'Planned shifts'), input.stats.plannedCount],
    [pickByLanguage(language, 'Больничных', 'Sick days'), input.stats.sickCount],
    [pickByLanguage(language, 'Выходных / без смены', 'Days off / no shift'), input.stats.dayOffCount],
    [pickByLanguage(language, 'Заработано по факту', 'Earned so far'), money(input.stats.earnedActual)],
    [pickByLanguage(language, 'Выплачено', 'Paid'), money(input.stats.paidApproved)],
    [pickByLanguage(language, 'Долг ПВЗ', 'Current balance'), money(input.stats.dueNow)],
    [pickByLanguage(language, 'Потенциал по графику', 'Forecast by schedule'), money(input.stats.forecastTotal)],
    [],
    [pickByLanguage(language, 'Подтвержденные выплаты', 'Approved payments')],
    [
      pickByLanguage(language, 'Дата', 'Date'),
      pickByLanguage(language, 'Сумма', 'Amount'),
      pickByLanguage(language, 'Комментарий', 'Comment'),
      pickByLanguage(language, 'Статус', 'Status'),
    ],
    ...paymentRows,
  ];

  const worksheet = XLSX.utils.aoa_to_sheet(rows);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, pickByLanguage(language, 'Расчетный лист', 'Payslip'));

  const safeEmployeeName = input.employee.name.replace(/[\\/:*?"<>|]/g, '_');
  const fileName = `${pickByLanguage(language, 'Расчетный лист', 'Payslip')} - ${safeEmployeeName} - ${input.year}-${String(input.month).padStart(2, '0')}.xlsx`;
  XLSX.writeFile(workbook, fileName);
};
