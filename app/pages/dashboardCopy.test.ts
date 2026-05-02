import { beforeEach, describe, expect, it } from 'vitest';
import { getMonthStatusLabels, getDashboardCopy } from './dashboardCopy';

describe('dashboardCopy', () => {
  beforeEach(() => {
    // no-op, explicit language per test
  });

  it('keeps month status labels readable in Russian', () => {
    expect(getMonthStatusLabels('ru')).toEqual({
      draft: 'Черновик',
      pending_approval: 'На утверждении',
      approved: 'Утверждён',
      closed: 'Закрыт',
    });
  });

  it('keeps display name card copy shared for both languages', () => {
    const ru = getDashboardCopy('ru');
    const en = getDashboardCopy('en');

    expect(ru.common.displayNameTitle).toBe('Как тебя показывать в системе');
    expect(ru.common.displayNamePlaceholder).toBe('Твоё имя в кабинете');
    expect(ru.common.saveName).toBe('Сохранить имя');
    expect(en.common.displayNameTitle).toBe('How to show your name in the app');
    expect(en.common.displayNamePlaceholder).toBe('Your display name');
    expect(en.common.saveName).toBe('Save name');
  });

  it('keeps worked days summary copy readable in both languages', () => {
    const ru = getDashboardCopy('ru');
    const en = getDashboardCopy('en');

    expect(ru.employee.stats.workedCount).toBe('Отработано дней');
    expect(ru.employee.stats.workedCountHint).toBe('мои смены / дней по графику / отработано всего');
    expect(en.employee.stats.workedCount).toBe('Worked days');
    expect(en.employee.stats.workedCountHint).toBe('my shifts / scheduled shifts / worked total');
  });

  it('keeps debt calculator copy readable in both languages', () => {
    const ru = getDashboardCopy('ru');
    const en = getDashboardCopy('en');

    expect(ru.employee.debtCard.title).toBe('Компания должна на сегодня');
    expect(ru.employee.debtCard.totalShifts).toBe('Смен всего');
    expect(ru.employee.debtCard.currentMonthShifts).toBe('Смен в этом месяце');
    expect(en.employee.debtCard.title).toBe('Amount due today');
    expect(en.employee.debtCard.totalShifts).toBe('Total shifts');
    expect(en.employee.debtCard.currentMonthShifts).toBe('Shifts this month');
  });

  it('keeps key dashboard copy free from mojibake markers', () => {
    const ru = getDashboardCopy('ru');
    const en = getDashboardCopy('en');
    const samples = [
      ru.admin.title,
      ru.admin.description,
      ru.admin.today.title,
      ru.employee.title,
      ru.employee.description,
      ru.employee.unlinked,
      ru.employee.debtCard.title,
      ru.employee.debtCard.helper,
      ru.employee.debtCard.formula('1000 ₽', '500 ₽'),
      ru.employee.stats.workedCountHint,
      ru.messages.employeeAdded,
      ru.messages.ownNameUpdated,
      en.admin.title,
      en.employee.title,
      en.employee.debtCard.title,
      en.messages.employeeAdded,
    ];

    for (const sample of samples) {
      expect(sample).not.toMatch(/Р[А-Яа-яA-Za-z]|С[Ѓђџ]/u);
    }
  });
});
