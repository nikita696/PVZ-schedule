const STORAGE_KEY = 'pvz-schedule-v3';

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
const employeeForm = document.getElementById('employeeForm');
const employeeNameInput = document.getElementById('employeeName');
const employeeRateInput = document.getElementById('employeeRate');

document.getElementById('prevMonth').addEventListener('click', () => changeMonth(-1));
document.getElementById('nextMonth').addEventListener('click', () => changeMonth(1));
document.getElementById('todayBtn').addEventListener('click', toToday);
document.getElementById('issuePayout').addEventListener('click', issuePayout);
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
  render();
});

function loadState() {
  const today = new Date();
  const fallback = {
    year: today.getFullYear(),
    month: today.getMonth(),
    employees: [
      { id: 'pavel', name: 'Павел', rate: 2500 },
      { id: 'nikita', name: 'Никита', rate: 2500 },
    ],
    assignments: {},
    paidByMonth: {},
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

function getMonthKey() {
  return `${state.year}-${String(state.month + 1).padStart(2, '0')}`;
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
  selectEl.setAttribute('data-status', selectEl.value || 'off');
}

function removeEmployee(employeeId) {
  state.employees = state.employees.filter((employee) => employee.id !== employeeId);
  Object.keys(state.assignments).forEach((key) => {
    if (key.endsWith(`|${employeeId}`)) delete state.assignments[key];
  });
  Object.keys(state.paidByMonth).forEach((key) => {
    if (key.endsWith(`|${employeeId}`)) delete state.paidByMonth[key];
  });
  render();
}

function updateRate(employeeId, rate) {
  state.employees = state.employees.map((employee) => (
    employee.id === employeeId ? { ...employee, rate } : employee
  ));
  saveState();
  renderSalary();
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
    th.innerHTML = `
      <div class="employee-head">
        <span>${employee.name}</span>
        <button class="remove-emp" data-emp-id="${employee.id}" title="Удалить">×</button>
      </div>
    `;
    tableHeadRowEl.appendChild(th);
  });

  tableHeadRowEl.querySelectorAll('.remove-emp').forEach((btn) => {
    btn.addEventListener('click', () => removeEmployee(btn.dataset.empId));
  });
}

function renderTable() {
  scheduleBodyEl.innerHTML = '';
  const daysInMonth = new Date(state.year, state.month + 1, 0).getDate();

  for (let day = 1; day <= daysInMonth; day++) {
    const tr = document.createElement('tr');
    const date = new Date(state.year, state.month, day);

    tr.innerHTML = `<td>${day}</td><td>${weekdayNames[date.getDay()]}</td>`;

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
  const monthPrefix = `${getMonthKey()}-`;

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
  const monthKey = getMonthKey();

  state.employees.forEach((employee) => {
    const total = totals[employee.id] || { shifts: 0, earned: 0 };
    const paid = state.paidByMonth[`${monthKey}|${employee.id}`] || 0;
    const due = Math.max(total.earned - paid, 0);

    const card = document.createElement('article');
    card.className = 'salary-item';
    card.innerHTML = `
      <div class="salary-row">
        <div class="salary-name">${employee.name}</div>
        <div class="salary-shifts">${total.shifts} смен</div>
      </div>
      <div class="small">К выплате сейчас</div>
      <div class="big">${due.toLocaleString('ru-RU')} ₽</div>
      <div class="small">Уже выплачено: <b>${paid.toLocaleString('ru-RU')} ₽</b></div>
      <div class="small">Начислено за месяц (только рабочие): <b>${total.earned.toLocaleString('ru-RU')} ₽</b></div>
      <div class="small">Ставка за смену:</div>
      <input class="rate-input" type="number" min="0" step="100" value="${employee.rate}" data-rate-id="${employee.id}" />
    `;
    salaryCardsEl.appendChild(card);
  });

  salaryCardsEl.querySelectorAll('[data-rate-id]').forEach((input) => {
    input.addEventListener('change', () => {
      const rate = Number(input.value);
      if (!Number.isNaN(rate) && rate >= 0) updateRate(input.dataset.rateId, rate);
    });
  });
}

function issuePayout() {
  const totals = calculateTotals();
  const monthKey = getMonthKey();

  state.employees.forEach((employee) => {
    const key = `${monthKey}|${employee.id}`;
    state.paidByMonth[key] = totals[employee.id]?.earned || 0;
  });

  render();
}

function exportCsv() {
  const totals = calculateTotals();
  const monthKey = getMonthKey();
  const rows = [['Сотрудник', 'Ставка за смену', 'Рабочих смен', 'Начислено', 'Уже выплачено', 'К выплате']];

  state.employees.forEach((employee) => {
    const t = totals[employee.id] || { shifts: 0, earned: 0 };
    const paid = state.paidByMonth[`${monthKey}|${employee.id}`] || 0;
    const due = Math.max(t.earned - paid, 0);
    rows.push([employee.name, employee.rate, t.shifts, t.earned, paid, due]);
  });

  const csv = rows.map((line) => line.join(';')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `payroll-${monthKey}.csv`;
  a.click();

  URL.revokeObjectURL(url);
}

render();
