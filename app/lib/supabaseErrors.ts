import { pickCurrentLanguage } from './i18n';

const localized = (ru: string, en: string) => pickCurrentLanguage(ru, en);

const ERROR_RULES: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /invalid login credentials/i, message: localized('Неверный email или способ входа.', 'Incorrect email or sign-in method.') },
  { pattern: /email not confirmed/i, message: localized('Подтверди email и попробуй снова.', 'Confirm your email and try again.') },
  { pattern: /user not found/i, message: localized('Пользователь не найден. Сначала зарегистрируйся.', 'User not found. Register first.') },
  { pattern: /signups not allowed for otp/i, message: localized('Пользователь не найден. Сначала зарегистрируйся.', 'User not found. Register first.') },
  { pattern: /otp has expired|token has expired|otp_expired/i, message: localized('Ссылка для входа истекла. Запроси новую.', 'The sign-in link has expired. Request a new one.') },
  { pattern: /user already registered|ACCOUNT_ALREADY_EXISTS/i, message: localized('Аккаунт с таким email уже существует.', 'An account with this email already exists.') },
  { pattern: /duplicate key value violates unique constraint/i, message: localized('Такая запись уже существует.', 'This record already exists.') },
  { pattern: /violates row-level security policy|permission denied|PERMISSION_DENIED/i, message: localized('Недостаточно прав для этого действия.', 'You do not have permission for this action.') },
  { pattern: /AUTH_REQUIRED/i, message: localized('Сначала войди в аккаунт.', 'Sign in first.') },
  { pattern: /EMAIL_REQUIRED/i, message: localized('Нужен email от провайдера входа.', 'An email from the sign-in provider is required.') },
  { pattern: /INVALID_ROLE/i, message: localized('Указана неверная роль.', 'Invalid role.') },
  { pattern: /EMAIL_NOT_CONFIRMED/i, message: localized('Подтверди email через провайдера входа.', 'Confirm your email through the sign-in provider.') },
  { pattern: /REGISTRATION_NOT_FOUND|REGISTRATION_REQUIRED/i, message: localized('Для этого аккаунта не найдена регистрация. Выбери роль и войди ещё раз.', 'No registration was found for this account. Choose a role and sign in again.') },
  { pattern: /ADMIN_ALREADY_EXISTS/i, message: localized('Администратор уже зарегистрирован. Войди под его аккаунтом.', 'An administrator is already registered. Sign in with that account.') },
  { pattern: /ADMIN_REQUIRED/i, message: localized('Сначала должен зарегистрироваться администратор.', 'An administrator must register first.') },
  { pattern: /PROFILE_REQUIRED/i, message: localized('Профиль ещё не готов. Попробуй войти ещё раз.', 'The profile is not ready yet. Try signing in again.') },
  { pattern: /PROFILE_DISABLED/i, message: localized('Твой профиль отключён. Обратись к администратору.', 'Your profile is disabled. Contact the administrator.') },
  { pattern: /EMPLOYEE_ALREADY_LINKED/i, message: localized('Этот сотрудник уже привязан к другому аккаунту.', 'This employee is already linked to another account.') },
  { pattern: /EMPLOYEE_EMAIL_EXISTS/i, message: localized('Сотрудник с таким email уже существует.', 'An employee with this email already exists.') },
  { pattern: /EMPLOYEE_NOT_FOUND/i, message: localized('Сотрудник не найден.', 'Employee not found.') },
  { pattern: /EMPLOYEE_OUTSIDE_EMPLOYMENT_WINDOW/i, message: localized('Нельзя менять смены вне периода работы сотрудника.', 'You cannot change shifts outside the employee work period.') },
  { pattern: /EMPLOYEE_HAS_SHIFTS_BEFORE_HIRE_DATE/i, message: localized('Нельзя сдвинуть дату трудоустройства позже уже существующих смен сотрудника.', 'You cannot move the hire date past the employee shifts that already exist.') },
  { pattern: /OWNER_EMPLOYEE_CANNOT_BE_ARCHIVED/i, message: localized('Нельзя архивировать владельца ПВЗ.', 'The PVZ owner cannot be archived.') },
  { pattern: /INVALID_EMPLOYMENT_DATE/i, message: localized('Проверь дату трудоустройства. Она не должна быть позже даты увольнения.', 'Check the hire date. It cannot be later than the termination date.') },
  { pattern: /INVALID_RATE/i, message: localized('Укажи корректную ставку.', 'Enter a valid rate.') },
  { pattern: /INVALID_PAYMENT_AMOUNT/i, message: localized('Укажи корректную сумму выплаты.', 'Enter a valid payment amount.') },
  { pattern: /PAYMENT_NOT_FOUND/i, message: localized('Выплата не найдена.', 'Payment not found.') },
  { pattern: /PAYMENT_STATUS_INVALID/i, message: localized('Для этой выплаты такое действие уже недоступно.', 'This payment action is no longer available.') },
  { pattern: /APPROVED_PAYMENT_CANNOT_BE_DELETED/i, message: localized('Подтверждённую выплату удалять нельзя.', 'Approved payments cannot be deleted.') },
  { pattern: /INVALID_SHIFT_STATUS/i, message: localized('Указан неверный статус смены.', 'Invalid shift status.') },
  { pattern: /INVALID_MONTH_STATUS/i, message: localized('Указан неверный статус месяца.', 'Invalid month status.') },
  { pattern: /INVALID_MONTH/i, message: localized('Указан неверный месяц.', 'Invalid month.') },
  { pattern: /MONTH_LOCKED/i, message: localized('Этот месяц уже закрыт для редактирования.', 'This month is already locked for editing.') },
  { pattern: /MONTH_HAS_EMPTY_DAYS/i, message: localized('Нельзя утвердить месяц, пока есть дни без назначенной смены.', 'You cannot approve the month while some days have no assigned shift.') },
  { pattern: /MONTH_MUST_BE_APPROVED_FIRST/i, message: localized('Сначала утверди месяц, а потом закрывай его.', 'Approve the month before closing it.') },
  { pattern: /EMPLOYEE_NAME_REQUIRED/i, message: localized('Укажи имя сотрудника.', 'Enter employee name.') },
  { pattern: /EMPLOYEE_NAME_TOO_LONG/i, message: localized('Имя сотрудника слишком длинное. Сделай его короче.', 'The employee name is too long. Make it shorter.') },
  { pattern: /DISPLAY_NAME_REQUIRED/i, message: localized('Укажи имя для профиля.', 'Enter a display name for the profile.') },
  { pattern: /DISPLAY_NAME_TOO_LONG/i, message: localized('Имя слишком длинное. Сделай его короче.', 'The name is too long. Make it shorter.') },
  { pattern: /unsupported provider|provider is not enabled|custom provider/i, message: localized('Yandex ID ещё не настроен в Supabase Auth.', 'Yandex ID is not configured in Supabase Auth yet.') },
  { pattern: /access_denied/i, message: localized('Провайдер входа отклонил авторизацию.', 'The sign-in provider denied authorization.') },
];

export const translateSupabaseError = (
  message: string,
  fallback = localized('Что-то пошло не так. Попробуй ещё раз.', 'Something went wrong. Please try again.'),
): string => {
  const normalized = message?.trim();
  if (!normalized) return fallback;

  for (const rule of ERROR_RULES) {
    if (rule.pattern.test(normalized)) {
      return rule.message;
    }
  }

  if (/[A-Za-z]/.test(normalized) && !/[А-Яа-яЁё]/.test(normalized)) {
    return fallback;
  }

  return normalized;
};
