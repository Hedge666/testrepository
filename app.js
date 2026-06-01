// --- API ---
const API = '';

async function api(method, path, body) {
  const token = localStorage.getItem('token');
  const res = await fetch(API + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {})
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Ошибка сервера');
  return data;
}

// --- STATE ---
let categories = [];
let expenses = [];
let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();
let pieChart = null;
let barChart = null;

// --- AUTH ---
const authScreen = document.getElementById('auth-screen');
const mainApp = document.getElementById('main-app');

function showAuth() {
  authScreen.style.display = 'flex';
  mainApp.style.display = 'none';
}

function showApp(user) {
  authScreen.style.display = 'none';
  mainApp.style.display = 'flex';
  document.getElementById('user-name').textContent = user.name;
}

async function init() {
  const token = localStorage.getItem('token');
  if (!token) { showAuth(); return; }
  try {
    await loadCategories();
    const stored = JSON.parse(localStorage.getItem('user') || 'null');
    showApp(stored || { name: '' });
    renderDashboard();
  } catch {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    showAuth();
  }
}

// AUTH TABS
document.querySelectorAll('.auth-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('login-form').style.display = tab.dataset.tab === 'login' ? 'block' : 'none';
    document.getElementById('register-form').style.display = tab.dataset.tab === 'register' ? 'block' : 'none';
  });
});

// LOGIN
document.getElementById('login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const errEl = document.getElementById('login-error');
  errEl.style.display = 'none';
  try {
    const data = await api('POST', '/api/auth/login', {
      email: document.getElementById('login-email').value,
      password: document.getElementById('login-password').value
    });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    await loadCategories();
    showApp(data.user);
    renderDashboard();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
});

// REGISTER
document.getElementById('register-form').addEventListener('submit', async e => {
  e.preventDefault();
  const errEl = document.getElementById('reg-error');
  errEl.style.display = 'none';
  try {
    const data = await api('POST', '/api/auth/register', {
      name: document.getElementById('reg-name').value,
      email: document.getElementById('reg-email').value,
      password: document.getElementById('reg-password').value
    });
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
    await loadCategories();
    showApp(data.user);
    renderDashboard();
  } catch (err) {
    errEl.textContent = err.message;
    errEl.style.display = 'block';
  }
});

// LOGOUT
document.getElementById('logout-btn').addEventListener('click', () => {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  showAuth();
});

// --- NAVIGATION ---
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('page-' + btn.dataset.page).classList.add('active');
    if (btn.dataset.page === 'dashboard') renderDashboard();
    if (btn.dataset.page === 'expenses') renderExpenses();
    if (btn.dataset.page === 'categories') renderCategoriesPage();
  });
});

// --- MONTH NAVIGATION ---
const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь',
                 'Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];

function updateMonthLabel() {
  document.getElementById('current-month-label').textContent = `${MONTHS[currentMonth]} ${currentYear}`;
}

document.getElementById('prev-month').addEventListener('click', () => {
  currentMonth--;
  if (currentMonth < 0) { currentMonth = 11; currentYear--; }
  renderDashboard();
});

document.getElementById('next-month').addEventListener('click', () => {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  renderDashboard();
});

// --- HELPERS ---
function getCat(id) { return categories.find(c => c.id === id); }
function formatAmount(n) { return Number(n).toLocaleString('ru-RU') + ' ₸'; }
function formatDate(str) {
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
}
function monthKey(month, year) {
  return `${year}-${String(month + 1).padStart(2, '0')}`;
}

// --- DATA LOADING ---
async function loadCategories() {
  categories = await api('GET', '/api/categories');
}

async function loadExpenses(month) {
  const query = month ? `?month=${month}` : '';
  expenses = await api('GET', '/api/expenses' + query);
}

// --- DASHBOARD ---
async function renderDashboard() {
  updateMonthLabel();
  const key = monthKey(currentMonth, currentYear);
  await loadExpenses(key);

  const total = expenses.reduce((s, e) => s + Number(e.amount), 0);
  document.getElementById('stat-total').textContent = formatAmount(total);
  document.getElementById('stat-count').textContent = expenses.length;
  const usedCats = new Set(expenses.map(e => e.category.id));
  document.getElementById('stat-cats').textContent = usedCats.size;

  renderPieChart();
  renderBarChart();
  renderBreakdown(total);
}

function renderBreakdown(total) {
  const byCategory = {};
  expenses.forEach(e => {
    const id = e.category.id;
    if (!byCategory[id]) byCategory[id] = { cat: e.category, amount: 0 };
    byCategory[id].amount += Number(e.amount);
  });

  const sorted = Object.values(byCategory).sort((a, b) => b.amount - a.amount);
  const container = document.getElementById('category-breakdown');

  if (sorted.length === 0) {
    container.innerHTML = '<div class="empty-state">Нет данных за этот месяц</div>';
    return;
  }

  container.innerHTML = sorted.map(({ cat, amount }) => {
    const pct = total > 0 ? Math.round((amount / total) * 100) : 0;
    return `
      <div class="breakdown-item">
        <div class="breakdown-dot" style="background:${cat.color}"></div>
        <div class="breakdown-name">${cat.name}</div>
        <div class="breakdown-bar-wrap">
          <div class="breakdown-bar" style="width:${pct}%;background:${cat.color}"></div>
        </div>
        <div class="breakdown-amount">${formatAmount(amount)}</div>
        <div class="breakdown-pct">${pct}%</div>
      </div>`;
  }).join('');
}

function renderPieChart() {
  const byCategory = {};
  expenses.forEach(e => {
    const id = e.category.id;
    if (!byCategory[id]) byCategory[id] = { cat: e.category, amount: 0 };
    byCategory[id].amount += Number(e.amount);
  });

  const items = Object.values(byCategory);
  const ctx = document.getElementById('chart-pie').getContext('2d');
  if (pieChart) pieChart.destroy();
  if (!items.length) { ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height); return; }

  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: items.map(i => i.cat.name),
      datasets: [{ data: items.map(i => i.amount), backgroundColor: items.map(i => i.cat.color), borderWidth: 2, borderColor: '#fff' }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { padding: 12, font: { size: 12 } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${Number(ctx.raw).toLocaleString('ru-RU')} ₸` } }
      }
    }
  });
}

function renderBarChart() {
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const byDay = Array(daysInMonth).fill(0);
  expenses.forEach(e => {
    const day = new Date(e.date + 'T00:00:00').getDate();
    byDay[day - 1] += Number(e.amount);
  });

  const ctx = document.getElementById('chart-bar').getContext('2d');
  if (barChart) barChart.destroy();

  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Array.from({ length: daysInMonth }, (_, i) => i + 1),
      datasets: [{ data: byDay, backgroundColor: '#6c63ff', borderRadius: 4, borderSkipped: false }]
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: false }, tooltip: { callbacks: { label: ctx => ` ${Number(ctx.raw).toLocaleString('ru-RU')} ₸` } } },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: { grid: { color: '#f0f2f5' }, ticks: { font: { size: 11 }, callback: v => v ? (v / 1000) + 'k' : 0 } }
      }
    }
  });
}

// --- EXPENSES PAGE ---
async function renderExpenses() {
  await loadExpenses();
  populateFilterMonths();
  populateFilterCategories();
  applyExpenseFilters();
}

function populateFilterMonths() {
  const sel = document.getElementById('filter-month');
  const current = sel.value;
  const months = new Set(expenses.map(e => e.date.slice(0, 7)));
  sel.innerHTML = '<option value="">Все месяцы</option>';
  [...months].sort().reverse().forEach(m => {
    const [y, mo] = m.split('-');
    sel.innerHTML += `<option value="${m}" ${m === current ? 'selected' : ''}>${MONTHS[+mo - 1]} ${y}</option>`;
  });
}

function populateFilterCategories() {
  const sel = document.getElementById('filter-category');
  const current = sel.value;
  sel.innerHTML = '<option value="">Все категории</option>';
  categories.forEach(c => {
    sel.innerHTML += `<option value="${c.id}" ${c.id == current ? 'selected' : ''}>${c.name}</option>`;
  });
}

function applyExpenseFilters() {
  const monthFilter = document.getElementById('filter-month').value;
  const catFilter = document.getElementById('filter-category').value;

  let filtered = expenses.filter(e => {
    if (monthFilter && !e.date.startsWith(monthFilter)) return false;
    if (catFilter && e.category.id != catFilter) return false;
    return true;
  }).slice().sort((a, b) => b.date.localeCompare(a.date));

  const tbody = document.getElementById('expenses-list');
  const empty = document.getElementById('expenses-empty');

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  tbody.innerHTML = filtered.map(e => {
    const cat = e.category;
    return `
      <tr>
        <td>${formatDate(e.date)}</td>
        <td><span class="cat-badge" style="background:${cat.color}22;color:${cat.color}">
          <span class="cat-dot" style="background:${cat.color}"></span>${cat.name}
        </span></td>
        <td style="color:#6b7280">${e.description || '—'}</td>
        <td class="amount-cell">−${formatAmount(e.amount)}</td>
        <td><button class="btn-danger" onclick="deleteExpense(${e.id})" title="Удалить">×</button></td>
      </tr>`;
  }).join('');
}

document.getElementById('filter-month').addEventListener('change', applyExpenseFilters);
document.getElementById('filter-category').addEventListener('change', applyExpenseFilters);

async function deleteExpense(id) {
  if (!confirm('Удалить этот расход?')) return;
  await api('DELETE', `/api/expenses/${id}`);
  await renderExpenses();
  await renderDashboard();
}

// --- ADD EXPENSE MODAL ---
document.getElementById('open-add-modal').addEventListener('click', openModal);
document.getElementById('close-modal').addEventListener('click', closeModal);
document.getElementById('cancel-modal').addEventListener('click', closeModal);
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

function openModal() {
  populateCategorySelect();
  document.getElementById('exp-date').value = new Date().toISOString().slice(0, 10);
  document.getElementById('exp-amount').value = '';
  document.getElementById('exp-desc').value = '';
  document.getElementById('modal-overlay').style.display = 'flex';
  setTimeout(() => document.getElementById('exp-amount').focus(), 50);
}

function closeModal() {
  document.getElementById('modal-overlay').style.display = 'none';
}

function populateCategorySelect() {
  const sel = document.getElementById('exp-category');
  sel.innerHTML = '<option value="">Выберите категорию</option>';
  categories.forEach(c => {
    sel.innerHTML += `<option value="${c.id}">${c.name}</option>`;
  });
}

document.getElementById('expense-form').addEventListener('submit', async e => {
  e.preventDefault();
  const amount = document.getElementById('exp-amount').value;
  const category_id = document.getElementById('exp-category').value;
  const date = document.getElementById('exp-date').value;
  const description = document.getElementById('exp-desc').value.trim();
  if (!amount || !category_id || !date) return;

  await api('POST', '/api/expenses', { amount: Number(amount), category_id: Number(category_id), date, description });
  closeModal();
  await renderDashboard();
  await renderExpenses();
});

// --- CATEGORIES PAGE ---
async function renderCategoriesPage() {
  await loadCategories();
  const list = document.getElementById('categories-list');
  const empty = document.getElementById('categories-empty');

  if (categories.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  await loadExpenses();
  list.innerHTML = categories.map(c => {
    const count = expenses.filter(e => e.category.id === c.id).length;
    return `
      <div class="category-item">
        <div class="category-color" style="background:${c.color}"></div>
        <div class="category-name">${c.name}</div>
        <div class="category-count">${count} расход${plural(count)}</div>
        <button class="btn-danger" onclick="deleteCategory(${c.id})" title="Удалить">×</button>
      </div>`;
  }).join('');
}

function plural(n) {
  if (n % 10 === 1 && n % 100 !== 11) return '';
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'а';
  return 'ов';
}

document.getElementById('add-category-btn').addEventListener('click', async () => {
  const name = document.getElementById('new-category-name').value.trim();
  const color = document.getElementById('new-category-color').value;
  if (!name) { document.getElementById('new-category-name').focus(); return; }

  await api('POST', '/api/categories', { name, color });
  document.getElementById('new-category-name').value = '';
  await renderCategoriesPage();
  populateFilterCategories();
});

document.getElementById('new-category-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('add-category-btn').click();
});

async function deleteCategory(id) {
  if (!confirm('Удалить категорию? Все расходы этой категории тоже удалятся.')) return;
  await api('DELETE', `/api/categories/${id}`);
  await renderCategoriesPage();
  await renderDashboard();
}

// --- INIT ---
init();
