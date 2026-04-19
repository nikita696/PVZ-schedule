import type { MonthStatus } from '../domain/types';
import type { AppLanguage } from '../context/LanguageContext';
import { pickByLanguage } from '../lib/i18n';

export const getMonthStatusLabels = (language: AppLanguage): Record<MonthStatus, string> => ({
  draft: pickByLanguage(language, 'Черновик', 'Draft'),
  pending_approval: pickByLanguage(language, 'На утверждении', 'Pending approval'),
  approved: pickByLanguage(language, 'Утверждён', 'Approved'),
  closed: pickByLanguage(language, 'Закрыт', 'Closed'),
});

export const getDashboardCopy = (language: AppLanguage) => ({
  common: {
    adminBadge: pickByLanguage(language, 'Панель администратора', 'Admin panel'),
    employeeBadge: pickByLanguage(language, 'Личный кабинет', 'Workspace'),
    signedInAs: pickByLanguage(language, 'Сейчас вошёл как', 'Signed in as'),
    unknownUser: pickByLanguage(language, 'Пользователь', 'User'),
    undefinedRole: pickByLanguage(language, 'Роль не определена', 'Role not defined'),
    selectEmployee: pickByLanguage(language, 'Выбери сотрудника', 'Choose employee'),
    exportExcel: pickByLanguage(language, 'Экспорт Excel', 'Export Excel'),
    myPayslip: pickByLanguage(language, 'Мой расчётный лист', 'My payslip'),
    displayNameTitle: pickByLanguage(language, 'Как тебя показывать в системе', 'How to show your name in the app'),
    displayNamePlaceholder: pickByLanguage(language, 'Твоё имя в кабинете', 'Your display name'),
    saveName: pickByLanguage(language, 'Сохранить имя', 'Save name'),
    savingName: pickByLanguage(language, 'Сохраняю...', 'Saving...'),
    emptyEmployeeName: pickByLanguage(language, 'Сотрудник', 'Employee'),
  },
  messages: {
    employeeNameRequired: pickByLanguage(language, 'Укажи имя сотрудника.', 'Enter employee name.'),
    workEmailRequired: pickByLanguage(language, 'Укажи рабочий email.', 'Enter work email.'),
    rateRequired: pickByLanguage(language, 'Укажи корректную ставку.', 'Enter a valid rate.'),
    employeeAdded: pickByLanguage(language, 'Сотрудник добавлен.', 'Employee added.'),
    ownNameUpdated: pickByLanguage(language, 'Имя обновлено.', 'Display name updated.'),
    employeeArchived: pickByLanguage(language, 'Сотрудник отправлен в архив.', 'Employee moved to archive.'),
    deleteArchivedConfirm: (employeeName: string) => pickByLanguage(
      language,
      `Удалить архивного сотрудника "${employeeName}"? История может быть потеряна.`,
      `Delete archived employee "${employeeName}"? Historical data may be lost.`,
    ),
    archivedDeleted: pickByLanguage(language, 'Архивный сотрудник удалён.', 'Archived employee deleted.'),
    rateUpdated: pickByLanguage(language, 'Ставка обновлена.', 'Rate updated.'),
    payslipExported: pickByLanguage(language, 'Расчётный лист выгружен.', 'Payslip exported.'),
  },
  admin: {
    title: pickByLanguage(language, 'Сотрудники, график и выплаты', 'Team, schedule, and payments'),
    description: pickByLanguage(language, 'Здесь собрана управленческая сводка по команде, графику и заявкам на выплаты.', 'This is the management overview for the team, schedule, and payment requests.'),
    stats: {
      workedDays: pickByLanguage(language, 'Отработано дней', 'Worked days'),
      workedDaysHint: pickByLanguage(language, 'месяц / всего', 'month / total'),
      earnedActual: pickByLanguage(language, 'Начислено', 'Accrued'),
      paidApproved: pickByLanguage(language, 'Выплачено', 'Paid'),
      dueNow: pickByLanguage(language, 'Текущий долг', 'Current balance'),
      pendingPayments: pickByLanguage(language, 'Заявок на выплату', 'Payment requests'),
    },
    today: {
      title: pickByLanguage(language, 'Сегодня', 'Today'),
      planned: pickByLanguage(language, 'На смене', 'On shift'),
      sick: pickByLanguage(language, 'Больничный', 'Sick leave'),
      dayOff: pickByLanguage(language, 'Выходной', 'Day off'),
      coverage: pickByLanguage(language, 'Покрытие дня', 'Day coverage'),
      nobody: pickByLanguage(language, 'никого', 'nobody'),
      none: pickByLanguage(language, 'нет', 'none'),
      issue: pickByLanguage(language, 'нет назначенной смены', 'no assigned shift'),
      closed: pickByLanguage(language, 'день закрыт', 'day covered'),
    },
  },
  employee: {
    title: pickByLanguage(language, 'Мой график, выплаты и расчёт', 'My schedule, payments, and summary'),
    description: pickByLanguage(language, 'Здесь собрана твоя личная сводка: заработок, выплаты и быстрый доступ к расчётному листу.', 'Your personal summary lives here: earnings, payments, and quick access to the payslip.'),
    unlinked: pickByLanguage(language, 'Этот аккаунт пока не связан с сотрудником. Попроси администратора завершить настройку профиля.', 'This account is not linked to an employee yet. Ask the admin to finish the profile setup.'),
    stats: {
      workedCount: pickByLanguage(language, 'Отработано дней', 'Worked days'),
      workedCountHint: pickByLanguage(language, 'месяц / всего', 'month / total'),
      earnedActual: pickByLanguage(language, 'Заработано', 'Earned'),
      paidApproved: pickByLanguage(language, 'Выплачено', 'Paid'),
      dueNow: pickByLanguage(language, 'Долг ПВЗ', 'Amount due'),
      forecastTotal: pickByLanguage(language, 'Потенциал по графику', 'Planned total'),
      sickCount: pickByLanguage(language, 'Больничные', 'Sick days'),
      dayOffCount: pickByLanguage(language, 'Выходные', 'Days off'),
    },
    pendingPayments: (pendingCount: number) => pickByLanguage(language, `Выплат на подтверждении: ${pendingCount}`, `Pending payments: ${pendingCount}`),
    exportTitle: pickByLanguage(language, 'Расчётный лист', 'Payslip'),
    downloadPayslip: pickByLanguage(language, 'Скачать расчётный лист', 'Download payslip'),
  },
});
