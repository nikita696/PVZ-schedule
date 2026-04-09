const ERROR_RULES: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /invalid login credentials/i, message: 'Неверный email или ссылка устарела.' },
  { pattern: /email not confirmed/i, message: 'Подтверди email и попробуй снова.' },
  { pattern: /user not found/i, message: 'Пользователь не найден. Сначала зарегистрируйся.' },
  { pattern: /signups not allowed for otp/i, message: 'Пользователь не найден. Сначала зарегистрируйся.' },
  { pattern: /otp has expired|token has expired/i, message: 'Ссылка устарела. Запроси новую.' },
  { pattern: /user already registered/i, message: 'Пользователь с таким email уже зарегистрирован.' },
  { pattern: /duplicate key value violates unique constraint/i, message: 'Такая запись уже существует.' },
  { pattern: /violates row-level security policy|permission denied/i, message: 'Недостаточно прав для этого действия.' },
  { pattern: /AUTH_REQUIRED/i, message: 'Сначала войди в аккаунт.' },
  { pattern: /EMAIL_REQUIRED/i, message: 'Введи email.' },
  { pattern: /INVALID_ROLE/i, message: 'Неизвестная роль регистрации.' },
  { pattern: /EMAIL_NOT_CONFIRMED/i, message: 'Подтверди email в письме и повтори вход.' },
  { pattern: /REGISTRATION_NOT_FOUND/i, message: 'Аккаунт не зарегистрирован. Заполни форму регистрации.' },
  { pattern: /ADMIN_ALREADY_EXISTS/i, message: 'Администратор уже зарегистрирован. Выбери роль сотрудника.' },
  { pattern: /ADMIN_REQUIRED/i, message: 'Сначала должен зарегистрироваться администратор.' },
  { pattern: /EMPLOYEE_ALREADY_LINKED/i, message: 'Этот аккаунт уже привязан к сотруднику.' },
];

export const translateSupabaseError = (
  message: string,
  fallback = 'Ошибка сервера. Попробуй еще раз.',
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
