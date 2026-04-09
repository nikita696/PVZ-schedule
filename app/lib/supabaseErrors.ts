const ERROR_RULES: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /invalid login credentials/i, message: 'Неверный email или способ входа.' },
  { pattern: /email not confirmed/i, message: 'Подтверди email и попробуй снова.' },
  { pattern: /user not found/i, message: 'Пользователь не найден. Сначала зарегистрируйся.' },
  { pattern: /signups not allowed for otp/i, message: 'Пользователь не найден. Сначала зарегистрируйся.' },
  { pattern: /otp has expired|token has expired|otp_expired/i, message: 'Ссылка для входа истекла. Запроси новую.' },
  { pattern: /user already registered|ACCOUNT_ALREADY_EXISTS/i, message: 'Аккаунт с таким email уже существует.' },
  { pattern: /duplicate key value violates unique constraint/i, message: 'Такая запись уже существует.' },
  { pattern: /violates row-level security policy|permission denied|PERMISSION_DENIED/i, message: 'Недостаточно прав для этого действия.' },
  { pattern: /AUTH_REQUIRED/i, message: 'Сначала войди в аккаунт.' },
  { pattern: /EMAIL_REQUIRED/i, message: 'Нужен email от провайдера входа.' },
  { pattern: /INVALID_ROLE/i, message: 'Указана неверная роль.' },
  { pattern: /EMAIL_NOT_CONFIRMED/i, message: 'Подтверди email через провайдера входа.' },
  { pattern: /REGISTRATION_NOT_FOUND|REGISTRATION_REQUIRED/i, message: 'Для этого аккаунта не найдена регистрация. Выбери роль и войди ещё раз.' },
  { pattern: /ADMIN_ALREADY_EXISTS/i, message: 'Администратор уже зарегистрирован. Войди под его аккаунтом.' },
  { pattern: /ADMIN_REQUIRED/i, message: 'Сначала должен зарегистрироваться администратор.' },
  { pattern: /PROFILE_REQUIRED/i, message: 'Профиль ещё не готов. Попробуй войти ещё раз.' },
  { pattern: /PROFILE_DISABLED/i, message: 'Твой профиль отключён. Обратись к администратору.' },
  { pattern: /EMPLOYEE_ALREADY_LINKED/i, message: 'Этот сотрудник уже привязан к другому аккаунту.' },
  { pattern: /EMPLOYEE_EMAIL_EXISTS/i, message: 'Сотрудник с таким email уже существует.' },
  { pattern: /EMPLOYEE_NOT_FOUND/i, message: 'Сотрудник не найден.' },
  { pattern: /EMPLOYEE_OUTSIDE_EMPLOYMENT_WINDOW/i, message: 'Нельзя менять смены вне периода работы сотрудника.' },
  { pattern: /OWNER_EMPLOYEE_CANNOT_BE_ARCHIVED/i, message: 'Нельзя архивировать владельца ПВЗ.' },
  { pattern: /INVALID_RATE/i, message: 'Укажи корректную ставку.' },
  { pattern: /INVALID_PAYMENT_AMOUNT/i, message: 'Укажи корректную сумму выплаты.' },
  { pattern: /PAYMENT_NOT_FOUND/i, message: 'Выплата не найдена.' },
  { pattern: /PAYMENT_STATUS_INVALID/i, message: 'Для этой выплаты такое действие уже недоступно.' },
  { pattern: /APPROVED_PAYMENT_CANNOT_BE_DELETED/i, message: 'Подтверждённую выплату удалять нельзя.' },
  { pattern: /INVALID_SHIFT_STATUS/i, message: 'Указан неверный статус смены.' },
  { pattern: /INVALID_MONTH_STATUS/i, message: 'Указан неверный статус месяца.' },
  { pattern: /INVALID_MONTH/i, message: 'Указан неверный месяц.' },
  { pattern: /MONTH_LOCKED/i, message: 'Этот месяц уже закрыт для редактирования.' },
  { pattern: /MONTH_HAS_EMPTY_DAYS/i, message: 'Нельзя утвердить месяц, пока есть дни без назначенной смены.' },
  { pattern: /MONTH_MUST_BE_APPROVED_FIRST/i, message: 'Сначала утверди месяц, а потом закрывай его.' },
  { pattern: /EMPLOYEE_NAME_REQUIRED/i, message: 'Укажи имя сотрудника.' },
  { pattern: /unsupported provider|provider is not enabled|custom provider/i, message: 'Yandex ID ещё не настроен в Supabase Auth.' },
  { pattern: /access_denied/i, message: 'Провайдер входа отклонил авторизацию.' },
];

export const translateSupabaseError = (
  message: string,
  fallback = 'Что-то пошло не так. Попробуй ещё раз.',
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
