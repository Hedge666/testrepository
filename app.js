// --- STATE ---
let expenses = JSON.parse(localStorage.getItem('expenses') || '[]');
let categories = JSON.parse(localStorage.getItem('categories') || 'null');

if (!categories) {
  categories = [
    { id: 'food', name: 'Еда', color: '#f59e0b' },
    { id: 'transport', name: 'Транспорт', color: '#3b82f6' },
    { id: 'entertainment', name: 'Развлечения', color: '#8b5cf6' },
    { id: 'health', name: 'Здоровье', color: '#10b981' },
    { id: 'shopping', name: 'Покупки', color: '#ef4444' },
  ];
  saveCategories();
}

let currentMonth = new Date().getMonth();
let currentYear = new Date().getFullYear();

let pieChart = null;
let barChart = null;

// --- PERSISTENCE ---
function saveExpenses() { localStorage.setItem('expenses', JSON.stringify(expenses)); }
function saveCategories() { localStorage.setItem('categories', JSON.stringify(categories)); }

// --- NAVIGATION ---
document.querySelectorAll('.nav-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('page-' + btn.dataset.page).classList.add('active');
    if (btn.dataset.page === 'dashboard') renderDashboard();
    if (btn.dataset.page === 'expenses') renderExpenses();
    if (btn.dataset.page === 'categories') renderCategories();
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
  updateMonthLabel();
  renderDashboard();
});

document.getElementById('next-month').addEventListener('click', () => {
  currentMonth++;
  if (currentMonth > 11) { currentMonth = 0; currentYear++; }
  updateMonthLabel();
  renderDashboard();
});

// --- HELPERS ---
function getCat(id) { return categories.find(c => c.id === id); }

function formatAmount(n) {
  return Number(n).toLocaleString('ru-RU') + ' ₸';
}

function formatDate(str) {
  const d = new Date(str + 'T00:00:00');
  return d.toLocaleDateString('ru-RU', { day: '2-digit', month: 'short', year: 'numeric' });
}

function getMonthExpenses(month, year) {
  return expenses.filter(e => {
    const d = new Date(e.date + 'T00:00:00');
    return d.getMonth() === month && d.getFullYear() === year;
  });
}

// --- DASHBOARD ---
function renderDashboard() {
  updateMonthLabel();
  const list = getMonthExpenses(currentMonth, currentYear);
  const total = list.reduce((s, e) => s + Number(e.amount), 0);

  document.getElementById('stat-total').textContent = formatAmount(total);
  document.getElementById('stat-count').textContent = list.length;

  const usedCats = new Set(list.map(e => e.category));
  document.getElementById('stat-cats').textContent = usedCats.size;

  renderPieChart(list);
  renderBarChart(list);
  renderBreakdown(list, total);
}

function renderBreakdown(list, total) {
  const byCategory = {};
  list.forEach(e => {
    if (!byCategory[e.category]) byCategory[e.category] = 0;
    byCategory[e.category] += Number(e.amount);
  });

  const sorted = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  const container = document.getElementById('category-breakdown');

  if (sorted.length === 0) {
    container.innerHTML = '<div class="empty-state">Нет данных за этот месяц</div>';
    return;
  }

  container.innerHTML = sorted.map(([catId, amount]) => {
    const cat = getCat(catId);
    if (!cat) return '';
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

function renderPieChart(list) {
  const byCategory = {};
  list.forEach(e => {
    if (!byCategory[e.category]) byCategory[e.category] = 0;
    byCategory[e.category] += Number(e.amount);
  });

  const cats = Object.keys(byCategory).map(id => getCat(id)).filter(Boolean);
  const data = cats.map(c => byCategory[c.id]);
  const colors = cats.map(c => c.color);
  const labels = cats.map(c => c.name);

  const ctx = document.getElementById('chart-pie').getContext('2d');
  if (pieChart) pieChart.destroy();

  if (data.length === 0) {
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    pieChart = null;
    return;
  }

  pieChart = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderWidth: 2, borderColor: '#fff' }] },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { padding: 12, font: { size: 12 } } },
        tooltip: {
          callbacks: {
            label: ctx => ` ${ctx.label}: ${Number(ctx.raw).toLocaleString('ru-RU')} ₸`
          }
        }
      }
    }
  });
}

function renderBarChart(list) {
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const byDay = Array(daysInMonth).fill(0);
  list.forEach(e => {
    const day = new Date(e.date + 'T00:00:00').getDate();
    byDay[day - 1] += Number(e.amount);
  });

  const ctx = document.getElementById('chart-bar').getContext('2d');
  if (barChart) barChart.destroy();

  barChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: Array.from({ length: daysInMonth }, (_, i) => i + 1),
      datasets: [{
        data: byDay,
        backgroundColor: '#6c63ff',
        borderRadius: 4,
        borderSkipped: false,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: { label: ctx => ` ${Number(ctx.raw).toLocaleString('ru-RU')} ₸` }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { font: { size: 11 } } },
        y: {
          grid: { color: '#f0f2f5' },
          ticks: { font: { size: 11 }, callback: v => v ? (v / 1000) + 'k' : 0 }
        }
      }
    }
  });
}

// --- EXPENSES PAGE ---
function renderExpenses() {
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
    sel.innerHTML += `<option value="${c.id}" ${c.id === current ? 'selected' : ''}>${c.name}</option>`;
  });
}

function applyExpenseFilters() {
  const monthFilter = document.getElementById('filter-month').value;
  const catFilter = document.getElementById('filter-category').value;

  let filtered = expenses.filter(e => {
    if (monthFilter && !e.date.startsWith(monthFilter)) return false;
    if (catFilter && e.category !== catFilter) return false;
    return true;
  });

  filtered = filtered.slice().sort((a, b) => b.date.localeCompare(a.date));

  const tbody = document.getElementById('expenses-list');
  const empty = document.getElementById('expenses-empty');

  if (filtered.length === 0) {
    tbody.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  tbody.innerHTML = filtered.map(e => {
    const cat = getCat(e.category);
    const catHtml = cat
      ? `<span class="cat-badge" style="background:${cat.color}22;color:${cat.color}">
           <span class="cat-dot" style="background:${cat.color}"></span>${cat.name}
         </span>`
      : '—';
    return `
      <tr>
        <td>${formatDate(e.date)}</td>
        <td>${catHtml}</td>
        <td style="color:#6b7280">${e.desc || '—'}</td>
        <td class="amount-cell">−${formatAmount(e.amount)}</td>
        <td>
          <button class="btn-danger" onclick="deleteExpense('${e.id}')" title="Удалить">×</button>
        </td>
      </tr>`;
  }).join('');
}

document.getElementById('filter-month').addEventListener('change', applyExpenseFilters);
document.getElementById('filter-category').addEventListener('change', applyExpenseFilters);

function deleteExpense(id) {
  if (!confirm('Удалить этот расход?')) return;
  expenses = expenses.filter(e => e.id !== id);
  saveExpenses();
  renderExpenses();
  renderDashboard();
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

document.getElementById('expense-form').addEventListener('submit', e => {
  e.preventDefault();
  const amount = document.getElementById('exp-amount').value;
  const category = document.getElementById('exp-category').value;
  const date = document.getElementById('exp-date').value;
  const desc = document.getElementById('exp-desc').value.trim();

  if (!amount || !category || !date) return;

  expenses.push({
    id: Date.now().toString(),
    amount: Number(amount),
    category,
    date,
    desc
  });

  saveExpenses();
  closeModal();
  renderDashboard();
  renderExpenses();
});

// --- CATEGORIES PAGE ---
function renderCategories() {
  const list = document.getElementById('categories-list');
  const empty = document.getElementById('categories-empty');

  if (categories.length === 0) {
    list.innerHTML = '';
    empty.style.display = 'block';
    return;
  }

  empty.style.display = 'none';
  list.innerHTML = categories.map(c => {
    const count = expenses.filter(e => e.category === c.id).length;
    return `
      <div class="category-item">
        <div class="category-color" style="background:${c.color}"></div>
        <div class="category-name">${c.name}</div>
        <div class="category-count">${count} расход${plural(count)}</div>
        <button class="btn-danger" onclick="deleteCategory('${c.id}')" title="Удалить">×</button>
      </div>`;
  }).join('');
}

function plural(n) {
  if (n % 10 === 1 && n % 100 !== 11) return '';
  if ([2,3,4].includes(n % 10) && ![12,13,14].includes(n % 100)) return 'а';
  return 'ов';
}

document.getElementById('add-category-btn').addEventListener('click', () => {
  const name = document.getElementById('new-category-name').value.trim();
  const color = document.getElementById('new-category-color').value;
  if (!name) { document.getElementById('new-category-name').focus(); return; }

  categories.push({
    id: Date.now().toString(),
    name,
    color
  });

  saveCategories();
  document.getElementById('new-category-name').value = '';
  renderCategories();
  populateFilterCategories();
});

document.getElementById('new-category-name').addEventListener('keydown', e => {
  if (e.key === 'Enter') document.getElementById('add-category-btn').click();
});

function deleteCategory(id) {
  const count = expenses.filter(e => e.category === id).length;
  const msg = count > 0
    ? `В этой категории ${count} расход${plural(count)}. Всё равно удалить?`
    : 'Удалить категорию?';
  if (!confirm(msg)) return;
  categories = categories.filter(c => c.id !== id);
  saveCategories();
  renderCategories();
  renderDashboard();
}

// --- INIT ---
renderDashboard();
