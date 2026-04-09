const ERROR_RULES: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /invalid login credentials/i, message: 'Неверный email или пароль.' },
  { pattern: /email not confirmed/i, message: 'Подтверди email перед входом.' },
  { pattern: /user already registered/i, message: 'Пользователь с таким email уже зарегистрирован.' },
  { pattern: /password should be at least/i, message: 'Пароль слишком короткий.' },
  { pattern: /duplicate key value violates unique constraint/i, message: 'Такая запись уже существует.' },
  { pattern: /violates row-level security policy/i, message: 'Недостаточно прав для этого действия.' },
  { pattern: /permission denied/i, message: 'Недостаточно прав для этого действия.' },
  { pattern: /AUTH_REQUIRED/i, message: 'Сначала войди в аккаунт.' },
  { pattern: /EMAIL_NOT_FOUND/i, message: 'Сотрудник с таким email не найден среди ожидающих активацию.' },
  { pattern: /EMAIL_NOT_CONFIRMED/i, message: 'Подтверди email и повтори активацию аккаунта.' },
  { pattern: /EMPLOYEE_NOT_FOUND/i, message: 'Сотрудник не найден.' },
  { pattern: /EMPLOYEE_ARCHIVED/i, message: 'Сотрудник в архиве и не может быть активирован.' },
  { pattern: /EMPLOYEE_ALREADY_LINKED/i, message: 'Этот аккаунт уже привязан к сотруднику.' },
  { pattern: /DUPLICATE_EMAIL_MATCH/i, message: 'Найдено несколько сотрудников с этим email. Нужна проверка у администратора.' },
  { pattern: /PROFILE_ALREADY_BOUND/i, message: 'Этот аккаунт уже связан с другим профилем.' },
  { pattern: /FORBIDDEN/i, message: 'Недостаточно прав для этого действия.' },
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
