const API_BASE = '/api';

const AD_STATUS_LABELS = {
  pending: 'На модерации',
  approved: 'Опубликовано',
  rejected: 'Отклонено',
};

function currentUser() {
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

async function api(path, options = {}) {
  const response = await fetch(API_BASE + path, {
    ...options,
    headers: authHeaders({
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401) window.appAuth?.logout();
    throw new Error(data.error || `API error: ${response.status}`);
  }
  return data;
}

function formatPrice(value) {
  return value == null
    ? 'Цена не указана'
    : new Intl.NumberFormat('ru-RU').format(Number(value)) + ' ₽';
}

function getInitials(user) {
  const first = (user.firstname || user.email || 'U').trim()[0] || 'U';
  const second = (user.lastname || '').trim()[0] || '';
  return (first + second).toUpperCase();
}

function statusBadge(ad) {
  const status = ad.status || 'pending';
  return `<span class="status-badge status-${status}">${AD_STATUS_LABELS[status] || status}</span>`;
}

function fillProfile(user) {
  const fullName = [user.firstname, user.lastname].filter(Boolean).join(' ') || 'Пользователь';
  document.getElementById('profileInfo').innerHTML = `
    <div class="profile-avatar">${getInitials(user)}</div>
    <div>
      <h2>${fullName}</h2>
      <div class="profile-meta">${user.email}</div>
      <div class="profile-meta">Телефон: ${user.phone || 'не указан'}</div>
      <span class="role-pill">${user.role_name || 'user'}</span>
    </div>
  `;
  document.getElementById('profileEmail').value = user.email || '';
  document.getElementById('profileFirstname').value = user.firstname || '';
  document.getElementById('profileLastname').value = user.lastname || '';
  document.getElementById('profilePhone').value = user.phone || '';
}

async function loadAds(user) {
  const target = document.getElementById('myAdsList');
  const ads = await api(`/ad?seller_id=${encodeURIComponent(user.user_id)}`);
  if (!ads.length) {
    target.innerHTML = '<div class="empty-state">У вас пока нет объявлений.</div>';
    return;
  }

  target.innerHTML = ads.map((ad) => `
    <div class="profile-ad-row">
      <div>
        <h3>${ad.title || `Объявление #${ad.ad_id}`}</h3>
        <div class="profile-meta">${formatPrice(ad.price)}</div>
        <div class="profile-status-line">
          ${statusBadge(ad)}
          ${ad.status === 'rejected' && ad.rejection_reason
            ? `<span class="rejection-text">Причина: ${ad.rejection_reason}</span>`
            : ''}
        </div>
      </div>
      <div class="table-actions">
        <button class="btn btn-primary btn-sm" onclick="location.href='/ad.html?id=${ad.ad_id}'">Открыть</button>
        <button class="btn btn-light btn-sm" onclick="location.href='/edit-ad.html?id=${ad.ad_id}'">Изменить</button>
        <button class="btn btn-light btn-sm" data-delete-ad="${ad.ad_id}">Удалить</button>
      </div>
    </div>
  `).join('');
}

function showSaved(button) {
  const oldText = button.textContent;
  button.textContent = 'Сохранено';
  button.disabled = true;
  setTimeout(() => {
    button.textContent = oldText;
    button.disabled = false;
  }, 1200);
}

async function initProfile() {
  const saved = currentUser();
  if (!saved) return window.appAuth?.logout();

  let user = await api('/auth/profile');
  localStorage.setItem('currentUser', JSON.stringify(user));
  fillProfile(user);
  await loadAds(user);

  document.getElementById('profileForm').addEventListener('submit', async (event) => {
    event.preventDefault();
    const button = event.submitter;
    const updated = await api(`/user/${user.user_id}`, {
      method: 'PUT',
      body: JSON.stringify({
        email: document.getElementById('profileEmail').value.trim(),
        firstname: document.getElementById('profileFirstname').value.trim(),
        lastname: document.getElementById('profileLastname').value.trim(),
        phone: document.getElementById('profilePhone').value.trim(),
      }),
    });
    user = { ...user, ...updated };
    localStorage.setItem('currentUser', JSON.stringify(user));
    fillProfile(user);
    window.appAuth?.updateHeaderAuthState();
    if (button) showSaved(button);
  });

  document.getElementById('myAdsList').addEventListener('click', async (event) => {
    const id = event.target.dataset.deleteAd;
    if (!id || !confirm(`Удалить объявление #${id}?`)) return;
    try {
      await api(`/ad/${id}`, { method: 'DELETE' });
      await loadAds(user);
    } catch (error) {
      alert(`Не удалось удалить объявление: ${error.message}`);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initProfile().catch((error) => {
    console.error(error);
    document.querySelector('.profile-layout').innerHTML =
      `<div class="profile-card result-error">Ошибка загрузки профиля: ${error.message}</div>`;
  });
});
