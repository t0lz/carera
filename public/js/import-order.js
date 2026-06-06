const API_BASE = '/api';

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('currentUser')) || null;
  } catch {
    return null;
  }
}

function isAuthorized() {
  return Boolean(getCurrentUser() && localStorage.getItem('authToken'));
}

function authHeaders(extra = {}) {
  if (window.appAuth && typeof window.appAuth.authHeaders === 'function') {
    return window.appAuth.authHeaders(extra);
  }
  const token = localStorage.getItem('authToken');
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}

function money(value) {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    maximumFractionDigits: 0,
  }).format(Number(value) || 0);
}

function getPayload() {
  const user = getCurrentUser();

  return {
    user_id: user ? user.user_id : null,
    customer_name: document.getElementById('customerName').value.trim(),
    customer_phone: document.getElementById('customerPhone').value.trim(),
    make: document.getElementById('makeInput').value.trim(),
    model: document.getElementById('modelInput').value.trim(),
    price_rub: document.getElementById('priceRub').value,
    delivery_rub: document.getElementById('deliveryRub').value,
    engine_volume_l: document.getElementById('engineVolume').value,
    power_hp: document.getElementById('powerHp').value,
    age_years: document.getElementById('ageYears').value,
    eur_rate: document.getElementById('eurRate').value,
    customer_type: document.getElementById('customerType').value,
  };
}

function renderCalculation(data, orderId) {
  const result = document.getElementById('importResult');
  const orderBlock = orderId
    ? `<div class="order-created">Заявка ${orderId} создана. Статус: новая</div>`
    : '';

  result.innerHTML = `
    ${orderBlock}
    <div class="result-title">Предварительный расчет</div>
    <div class="result-total">${money(data.total)}</div>
    <div class="result-list">
      <div><span>Стоимость автомобиля</span><b>${money(data.price_rub)}</b></div>
      <div><span>Доставка</span><b>${money(data.delivery_rub)}</b></div>
      <div><span>Таможенный сбор</span><b>${money(data.customs_fee)}</b></div>
      <div><span>Таможенная пошлина</span><b>${money(data.duty)}</b></div>
      <div><span>Акциз</span><b>${money(data.excise)}</b></div>
      <div><span>НДС</span><b>${money(data.vat)}</b></div>
      <div><span>Утилизационный сбор</span><b>${money(data.utilization_fee)}</b></div>
    </div>
    <div class="result-note">${data.note}</div>
  `;
}

async function sendImportRequest(path) {
  if (path === '/import-order' && !isAuthorized()) {
    throw new Error('Войдите в систему, чтобы создать заявку');
  }
  const response = await fetch(API_BASE + path, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(getPayload()),
  });

  if (!response.ok) {
    throw new Error('Ошибка расчета: ' + response.status);
  }

  return response.json();
}

function updateImportOrderAccess() {
  const createBtn = document.getElementById('createOrderBtn');
  const notice = document.getElementById('importAuthNotice');
  const loginBtn = document.getElementById('importLoginBtn');
  const allowed = isAuthorized();

  if (createBtn) {
    createBtn.disabled = !allowed;
    createBtn.classList.toggle('btn-disabled', !allowed);
    createBtn.title = allowed ? '' : 'Войдите в аккаунт, чтобы сформировать заявку';
  }
  if (notice) notice.style.display = allowed ? 'none' : 'block';
  if (loginBtn) {
    loginBtn.addEventListener('click', () => {
      location.href = '/login.html';
    }, { once: true });
  }
}

async function loadEuroRate() {
  const input = document.getElementById('eurRate');
  const hint = document.getElementById('rateHint');
  if (!input) return;

  try {
    const today = new Date().toISOString().slice(0, 10);
    const response = await fetch(`${API_BASE}/import-order/rates?date=${today}`);
    if (!response.ok) throw new Error('rate unavailable');

    const data = await response.json();
    const eur = Number(data.eur).toFixed(2);
    const date = today.split('-').reverse().join('.');
    input.value = eur;
    if (hint) hint.textContent = `Курс евро для расчёта на ${date}: ${eur} ₽.`;
  } catch (error) {
    if (hint) hint.textContent = 'Не удалось загрузить курс автоматически. Можно указать курс вручную.';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  loadEuroRate();
  updateImportOrderAccess();

  const form = document.getElementById('importOrderForm');
  const createBtn = document.getElementById('createOrderBtn');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      const data = await sendImportRequest('/import-order/calculate');
      renderCalculation(data);
    } catch (error) {
      document.getElementById('importResult').innerHTML = `<div class="result-error">${error.message}</div>`;
    }
  });

  createBtn.addEventListener('click', async () => {
    if (!isAuthorized()) {
      document.getElementById('importResult').innerHTML =
        '<div class="result-error">Войдите в систему, чтобы создать заявку.</div>';
      updateImportOrderAccess();
      return;
    }
    try {
      const data = await sendImportRequest('/import-order');
      renderCalculation(data.calculation, data.order_id);
    } catch (error) {
      document.getElementById('importResult').innerHTML = `<div class="result-error">${error.message}</div>`;
    }
  });
});
