const STORAGE_KEY = 'pvz-schedule-v1';

const weekdayNames = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'];
const shiftOptions = [
  { value: 'off', label: 'Выходной', hours: 0 },
  { value: 'day', label: 'Дневная (8ч)', hours: 8 },
  { value: 'night', label: 'Ночная (12ч)', hours: 12 },
  { value: 'half', label: 'Половина (4ч)', hours: 4 },
  { value: 'custom', label: 'Свои часы', hours: null },
];

const state = loadState();

const calendarEl = document.getElementById('calendar');
const monthLabel = document.getElementById('monthLabel');
const employeeForm = document.getElementById('employeeForm');
const employeeNameInput = document.getElementById('employeeName');
const employeeRateInput = document.getElementById('employeeRate');
const employeeListEl = document.getElementById('employeeList');
const payrollSummaryEl = document.getElementById('payrollSummary');
const dayTemplate = document.getElementById('dayTemplate');

document.getElementById('prevMonth').addEventListener('click', () => {
  state.currentMonth -= 1;
  normalizeMonth();
  persistAndRender();
});

document.getElementById('nextMonth').addEventListener('click', () => {
  state.currentMonth += 1;
  normalizeMonth();
  persistAndRender();
});

document.getElementById('exportCsv').addEventListener('click', exportCsv);

employeeForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const name = employeeNameInput.value.trim();
  const rate = Number(employeeRateInput.value);
  if (!name || Number.isNaN(rate) || rate < 0) return;

  state.employees.push({
    id: crypto.randomUUID(),
    name,
    rate,
  });

  employeeForm.reset();
  persistAndRender();
});

function loadState() {
  const today = new Date();
  const fallback = {
    currentYear: today.getFullYear(),
    currentMonth: today.getMonth(),
    employees: [
      { id: crypto.randomUUID(), name: 'Иван', rate: 450 },
      { id: crypto.randomUUID(), name: 'Мария', rate: 500 },
    ],
    assignments: {},
  };

  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return fallback;
    return {
      ...fallback,
      ...saved,
      employees: Array.isArray(saved.employees) ? saved.employees : fallback.employees,
      assignments: saved.assignments || {},
    };
  } catch {
    return fallback;
  }
}

function normalizeMonth() {
  if (state.currentMonth < 0) {
    state.currentYear -= 1;
    state.currentMonth = 11;
  }
  if (state.currentMonth > 11) {
    state.currentYear += 1;
    state.currentMonth = 0;
  }
}

function persistAndRender() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  render();
}

function render() {
  renderMonthLabel();
  renderEmployees();
  renderCalendar();
  renderSummary();
}

function renderMonthLabel() {
  const dt = new Date(state.currentYear, state.currentMonth, 1);
  monthLabel.textContent = dt.toLocaleDateString('ru-RU', {
    month: 'long',
    year: 'numeric',
  });
}

function renderEmployees() {
  employeeListEl.innerHTML = '';
  state.employees.forEach((employee) => {
    const item = document.createElement('li');
    item.className = 'employee-item';
    item.innerHTML = `
      <div>
        <div>${employee.name}</div>
        <div class="employee-meta">${employee.rate.toLocaleString('ru-RU')} ₽/ч</div>
      </div>
      <button class="delete-btn" data-id="${employee.id}">✕</button>
    `;
    employeeListEl.appendChild(item);
  });

  employeeListEl.querySelectorAll('.delete-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      const id = btn.dataset.id;
      state.employees = state.employees.filter((emp) => emp.id !== id);
      Object.keys(state.assignments).forEach((key) => {
        if (key.endsWith(`|${id}`)) delete state.assignments[key];
      });
      persistAndRender();
    });
  });
}

function renderCalendar() {
  calendarEl.innerHTML = '';
  weekdayNames.forEach((wd) => {
    const header = document.createElement('div');
    header.className = 'weekday-header';
    header.textContent = wd;
    calendarEl.appendChild(header);
  });

  const first = new Date(state.currentYear, state.currentMonth, 1);
  const daysInMonth = new Date(state.currentYear, state.currentMonth + 1, 0).getDate();
  const leading = (first.getDay() + 6) % 7;

  for (let i = 0; i < leading; i++) {
    calendarEl.appendChild(document.createElement('div'));
  }

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(state.currentYear, state.currentMonth, day);
    const dateKey = date.toISOString().slice(0, 10);
    const cell = dayTemplate.content.firstElementChild.cloneNode(true);
    cell.querySelector('.day-num').textContent = day;
    const shiftsBox = cell.querySelector('.day-shifts');

    if (state.employees.length === 0) {
      shiftsBox.innerHTML = '<small>Добавьте сотрудника</small>';
    } else {
      state.employees.forEach((employee) => {
        const row = document.createElement('div');
        row.className = 'shift-row';
        const key = `${dateKey}|${employee.id}`;
        const current = state.assignments[key] || { type: 'off', hours: 0 };

        const select = document.createElement('select');
        shiftOptions.forEach((opt) => {
          const option = document.createElement('option');
          option.value = opt.value;
          option.textContent = opt.label;
          if (opt.value === current.type) option.selected = true;
          select.appendChild(option);
        });

        select.addEventListener('change', () => {
          const selected = shiftOptions.find((x) => x.value === select.value);
          let hours = selected.hours;

          if (selected.value === 'custom') {
            const input = prompt(`Введите часы для ${employee.name} (${dateKey})`, String(current.hours || 8));
            const parsed = Number(input);
            if (Number.isNaN(parsed) || parsed < 0 || parsed > 24) {
              alert('Нужно число от 0 до 24. Изменение отменено.');
              select.value = current.type;
              return;
            }
            hours = parsed;
          }

          state.assignments[key] = {
            type: selected.value,
            hours,
          };
          persistAndRender();
        });

        row.innerHTML = `<label>${employee.name}</label>`;
        row.appendChild(select);
        shiftsBox.appendChild(row);
      });
    }

    calendarEl.appendChild(cell);
  }
}

function renderSummary() {
  payrollSummaryEl.innerHTML = '';

  if (state.employees.length === 0) {
    payrollSummaryEl.textContent = 'Сотрудников пока нет';
    return;
  }

  const totals = calculateMonthTotals();
  state.employees.forEach((employee) => {
    const total = totals[employee.id] || { hours: 0, pay: 0, shifts: 0 };
    const row = document.createElement('div');
    row.className = 'summary-row';
    row.innerHTML = `
      <div><strong>${employee.name}</strong></div>
      <div>Смен: ${total.shifts}</div>
      <div>Часов: ${total.hours}</div>
      <div>К выплате: <b>${Math.round(total.pay).toLocaleString('ru-RU')} ₽</b></div>
    `;
    payrollSummaryEl.appendChild(row);
  });
}

function calculateMonthTotals() {
  const totals = {};
  const prefix = `${state.currentYear}-${String(state.currentMonth + 1).padStart(2, '0')}-`;

  state.employees.forEach((employee) => {
    totals[employee.id] = { hours: 0, pay: 0, shifts: 0 };
  });

  Object.entries(state.assignments).forEach(([key, value]) => {
    const [datePart, employeeId] = key.split('|');
    if (!datePart.startsWith(prefix)) return;

    const employee = state.employees.find((e) => e.id === employeeId);
    if (!employee) return;

    totals[employeeId].hours += Number(value.hours) || 0;
    if ((Number(value.hours) || 0) > 0) totals[employeeId].shifts += 1;
    totals[employeeId].pay = totals[employeeId].hours * employee.rate;
  });

  return totals;
}

function exportCsv() {
  const totals = calculateMonthTotals();
  const rows = [['Сотрудник', 'Ставка', 'Часы', 'Смены', 'К выплате']];

  state.employees.forEach((employee) => {
    const t = totals[employee.id] || { hours: 0, pay: 0, shifts: 0 };
    rows.push([employee.name, employee.rate, t.hours, t.shifts, Math.round(t.pay)]);
  });

  const csv = rows.map((r) => r.join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `payroll-${state.currentYear}-${state.currentMonth + 1}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

render();
