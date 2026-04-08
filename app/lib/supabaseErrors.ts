const ERROR_RULES: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /invalid login credentials/i, message: 'Неверный email или пароль.' },
  { pattern: /email not confirmed/i, message: 'Подтвердите email перед входом.' },
  { pattern: /user already registered/i, message: 'Пользователь с таким email уже зарегистрирован.' },
  { pattern: /password should be at least/i, message: 'Пароль слишком короткий.' },
  { pattern: /duplicate key value violates unique constraint/i, message: 'Такая запись уже существует.' },
  { pattern: /violates row-level security policy/i, message: 'Недостаточно прав для этого действия.' },
  { pattern: /permission denied/i, message: 'Недостаточно прав для этого действия.' },
  { pattern: /AUTH_REQUIRED/i, message: 'Сначала войдите в аккаунт.' },
  { pattern: /INVITE_CODE_REQUIRED/i, message: 'Введите инвайт-код.' },
  { pattern: /ACCOUNT_ALREADY_LINKED/i, message: 'Этот аккаунт уже привязан к сотруднику.' },
  { pattern: /INVITE_NOT_FOUND/i, message: 'Инвайт-код не найден или уже недействителен.' },
  { pattern: /INVITE_ALREADY_USED/i, message: 'Инвайт-код уже использован.' },
  { pattern: /EMPLOYEE_NOT_FOUND/i, message: 'Сотрудник не найден.' },
  { pattern: /FORBIDDEN/i, message: 'Недостаточно прав для этого действия.' },
  { pattern: /EMPLOYEE_ARCHIVED/i, message: 'Сотрудник в архиве.' },
  { pattern: /EMPLOYEE_ALREADY_LINKED/i, message: 'Сотрудник уже привязан к аккаунту.' },
];

export const translateSupabaseError = (
  message: string,
  fallback = 'Ошибка сервера. Попробуйте еще раз.',
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
