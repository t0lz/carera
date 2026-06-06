const API_BASE = '/api';

const ORDER_STATUS_LABELS = {
  new: 'Новая',
  in_work: 'В работе',
  calculated: 'Расчет выполнен',
  approved: 'Согласована',
  completed: 'Завершена',
  cancelled: 'Отменена',
};

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('currentUser')) || null;
  } catch {
    return null;
  }
}

function authHeaders(extra = {}) {
  if (window.appAuth && typeof window.appAuth.authHeaders === 'function') {
    return window.appAuth.authHeaders(extra);
  }
  const token = localStorage.getItem('authToken');
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}

function canManageOrders(user) {
  return user && ['admin', 'manager'].includes(user.role_name);
}

function money(value) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function formatEngineVolume(order) {
  const liters = Number(order.engine_volume_l || order.engine_volume_cm3 / 1000);
  if (!Number.isFinite(liters) || liters <= 0) return '0 л';
  return `${liters.toFixed(1)} л`;
}

function formatDate(value) {
  if (!value) return '';
  return new Intl.DateTimeFormat('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

async function apiGet(path) {
  const res = await fetch(API_BASE + path, {
    headers: authHeaders(),
  });
  if (!res.ok) throw new Error('API error: ' + res.status);
  return res.json();
}

async function apiPut(path, body) {
  const res = await fetch(API_BASE + path, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('API error: ' + res.status);
  return res.json();
}

function statusSelect(order) {
  const options = Object.entries(ORDER_STATUS_LABELS)
    .map(([value, label]) => `<option value="${value}" ${value === order.status ? 'selected' : ''}>${label}</option>`)
    .join('');

  return `<select class="select status-select" data-order-id="${order.import_order_id}">${options}</select>`;
}

function statusBadge(status) {
  return `<span class="status-badge status-${status}">${ORDER_STATUS_LABELS[status] || status}</span>`;
}

function renderOrders(orders, managerMode) {
  const tbody = document.getElementById('importOrdersBody');

  if (!orders.length) {
    tbody.innerHTML = '<tr><td colspan="6">Заявок пока нет.</td></tr>';
    return;
  }

  tbody.innerHTML = orders.map((order) => {
    const car = [order.car_make, order.car_model].filter(Boolean).join(' ') || 'Автомобиль не указан';
    const client = [order.customer_name, order.customer_phone].filter(Boolean).join('<br>') || `ID ${order.user_id || '-'}`;
    const total = order.calculation ? money(order.calculation.total) : 'Нет расчета';

    return `
      <tr>
        <td>IMP-${order.import_order_id}</td>
        <td>${car}<div class="small">${formatEngineVolume(order)}, ${order.power_hp || 0} л.с.</div></td>
        <td>${client}</td>
        <td>${total}</td>
        <td>${managerMode ? statusSelect(order) : statusBadge(order.status)}</td>
        <td>${formatDate(order.created_at)}</td>
      </tr>
    `;
  }).join('');
}

async function loadOrders() {
  const user = getCurrentUser();
  const tbody = document.getElementById('importOrdersBody');
  const title = document.getElementById('ordersTitle');
  const subtitle = document.getElementById('ordersSubtitle');

  if (!user) {
    tbody.innerHTML = '<tr><td colspan="6">Войдите в систему, чтобы просматривать заявки.</td></tr>';
    return;
  }

  const managerMode = canManageOrders(user);
  if (!managerMode) {
    title.textContent = 'Мои заявки';
    subtitle.textContent = 'Ваши заказы автомобилей из-за границы и текущие статусы обработки.';
  }

  const query = managerMode ? '' : `?user_id=${encodeURIComponent(user.user_id)}`;
  const orders = await apiGet('/import-order' + query);
  renderOrders(orders, managerMode);

  if (managerMode) {
    tbody.addEventListener('change', async (event) => {
      const select = event.target.closest('.status-select');
      if (!select) return;

      const orderId = select.getAttribute('data-order-id');
      const status = select.value;
      select.disabled = true;

      try {
        await apiPut(`/import-order/${orderId}/status`, { status });
      } catch (error) {
        alert('Не удалось обновить статус: ' + error.message);
      } finally {
        select.disabled = false;
      }
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadOrders().catch((error) => {
    console.error(error);
    document.getElementById('importOrdersBody').innerHTML = `<tr><td colspan="6">Ошибка загрузки: ${error.message}</td></tr>`;
  });
});
