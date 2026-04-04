const STORAGE_KEY = 'pvz-schedule-v2';

const statuses = {
  work: { label: 'Рабочий', paid: true },
  off: { label: 'Выходной', paid: false },
  vacation: { label: 'Отпуск', paid: false },
  sick: { label: 'Больничный', paid: false },
  absent: { label: 'Невыход', paid: false },
};

const weekdayNames = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

const state = loadState();

const monthLabelEl = document.getElementById('monthLabel');
const tableHeadRowEl = document.getElementById('tableHeadRow');
const scheduleBodyEl = document.getElementById('scheduleBody');
const salaryCardsEl = document.getElementById('salaryCards');

document.getElementById('prevMonth').addEventListener('click', () => changeMonth(-1));
document.getElementById('nextMonth').addEventListener('click', () => changeMonth(1));
document.getElementById('todayBtn').addEventListener('click', toToday);
document.getElementById('issuePayout').addEventListener('click', issuePayout);
document.getElementById('exportCsv').addEventListener('click', exportCsv);

function loadState() {
  const today = new Date();
  const fallback = {
    year: today.getFullYear(),
    month: today.getMonth(),
    employees: [
      { id: 'pavel', name: 'Павел', rate: 2500, paid: 30000, rateFrom: '2026-04-15' },
      { id: 'nikita', name: 'Никита', rate: 2500, paid: 32500, rateFrom: '2026-01-01' },
    ],
    assignments: {},
  };

  try {
    const raw = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return raw ? { ...fallback, ...raw } : fallback;
  } catch {
    return fallback;
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function changeMonth(step) {
  state.month += step;
  if (state.month < 0) {
    state.month = 11;
    state.year -= 1;
  }
  if (state.month > 11) {
    state.month = 0;
    state.year += 1;
  }
  render();
}

function toToday() {
  const now = new Date();
  state.month = now.getMonth();
  state.year = now.getFullYear();
  render();
}

function getDateKey(day) {
  const dt = new Date(state.year, state.month, day);
  return dt.toISOString().slice(0, 10);
}

function getAssignment(day, employeeId) {
  const key = `${getDateKey(day)}|${employeeId}`;
  return state.assignments[key] || 'off';
}

function setAssignment(day, employeeId, status) {
  const key = `${getDateKey(day)}|${employeeId}`;
  state.assignments[key] = status;
  saveState();
  renderSalary();
}

function applyStatusColor(selectEl) {
  const value = selectEl.value || 'off';
  selectEl.setAttribute('data-status', value);
}

function render() {
  renderHeader();
  renderTable();
  renderSalary();
  saveState();
}

function renderHeader() {
  const dt = new Date(state.year, state.month, 1);
  monthLabelEl.textContent = dt.toLocaleDateString('ru-RU', { month: 'long', year: 'numeric' });

  tableHeadRowEl.innerHTML = '<th class="day-col">День</th><th class="week-col">День недели</th>';
  state.employees.forEach((employee) => {
    const th = document.createElement('th');
    th.textContent = employee.name;
    tableHeadRowEl.appendChild(th);
  });
}

function renderTable() {
  scheduleBodyEl.innerHTML = '';
  const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const tr = document.createElement('tr');
    const date = new Date(state.year, state.month, day);

    const tdDay = document.createElement('td');
    tdDay.textContent = String(day);
    tr.appendChild(tdDay);

    const tdWeek = document.createElement('td');
    tdWeek.textContent = weekdayNames[date.getDay()];
    tr.appendChild(tdWeek);

    state.employees.forEach((employee) => {
      const td = document.createElement('td');
      const select = document.createElement('select');
      select.className = 'status-select';

      Object.entries(statuses).forEach(([value, item]) => {
        const option = document.createElement('option');
        option.value = value;
        option.textContent = item.label;
        select.appendChild(option);
      });

      select.value = getAssignment(day, employee.id);
      applyStatusColor(select);
      select.addEventListener('change', () => {
        applyStatusColor(select);
        setAssignment(day, employee.id, select.value);
      });

      td.appendChild(select);
      tr.appendChild(td);
    });

    scheduleBodyEl.appendChild(tr);
  }
}

function calculateTotals() {
  const totals = {};
  const monthPrefix = `${state.year}-${String(state.month + 1).padStart(2, '0')}-`;

  state.employees.forEach((employee) => {
    totals[employee.id] = { shifts: 0, earned: 0 };
  });

  Object.entries(state.assignments).forEach(([key, status]) => {
    const [datePart, employeeId] = key.split('|');
    if (!datePart.startsWith(monthPrefix)) return;
    if (!totals[employeeId]) return;
    if (statuses[status]?.paid) {
      totals[employeeId].shifts += 1;
      const employee = state.employees.find((x) => x.id === employeeId);
      totals[employeeId].earned += employee.rate;
    }
  });

  return totals;
}

function renderSalary() {
  salaryCardsEl.innerHTML = '';
  const totals = calculateTotals();

  state.employees.forEach((employee) => {
    const total = totals[employee.id] || { shifts: 0, earned: 0 };
    const due = Math.max(total.earned - (employee.paid || 0), 0);

    const card = document.createElement('article');
    card.className = 'salary-item';
    card.innerHTML = `
      <div class="salary-row">
        <div class="salary-name">${employee.name}</div>
        <div class="salary-shifts">${total.shifts} смен</div>
      </div>
      <div class="small">К выплате сейчас</div>
      <div class="big">${Math.round(due).toLocaleString('ru-RU')} ₽</div>
      <div class="small">Уже выплачено: <b>${(employee.paid || 0).toLocaleString('ru-RU')} ₽</b></div>
      <div class="small">Ставка: ${employee.rate.toLocaleString('ru-RU')} ₽/смена (с ${formatDate(employee.rateFrom)})</div>
    `;
    salaryCardsEl.appendChild(card);
  });
}

function formatDate(str) {
  if (!str) return '—';
  const dt = new Date(str);
  return dt.toLocaleDateString('ru-RU');
}

function issuePayout() {
  const totals = calculateTotals();
  state.employees = state.employees.map((employee) => {
    const due = Math.max((totals[employee.id]?.earned || 0) - (employee.paid || 0), 0);
    return { ...employee, paid: (employee.paid || 0) + due };
  });
  render();
}

function exportCsv() {
  const totals = calculateTotals();
  const rows = [['Сотрудник', 'Ставка за смену', 'Рабочих смен', 'Начислено', 'Уже выплачено', 'К выплате']];

  state.employees.forEach((employee) => {
    const t = totals[employee.id] || { shifts: 0, earned: 0 };
    const due = Math.max(t.earned - (employee.paid || 0), 0);
    rows.push([employee.name, employee.rate, t.shifts, t.earned, employee.paid || 0, due]);
  });

  const csv = rows.map((line) => line.join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `payroll-${state.year}-${state.month + 1}.csv`;
  a.click();

  URL.revokeObjectURL(url);
}

render();
