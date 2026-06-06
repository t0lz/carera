const API_BASE = '/api';

let roles = [];
let makes = [];
let moderationAds = [];
let adminUsers = [];
let adminModels = [];
let adminBodyTypes = [];

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('currentUser')) || null;
  } catch {
    return null;
  }
}

function canManageUsers(user) {
  return user && user.role_name === 'admin';
}

function canModerateAds(user) {
  return user && ['manager', 'admin'].includes(user.role_name);
}

function showMessage(text, type = 'info') {
  const message = document.getElementById('adminMessage');
  if (!message) return;

  message.className = `admin-message admin-message-${type}`;
  message.innerHTML = text;
  message.style.display = 'block';
}

function hideMessage() {
  const message = document.getElementById('adminMessage');
  if (message) message.style.display = 'none';
}

function authHeaders(extra = {}) {
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
    if (response.status === 401) {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('authToken');
      throw new Error('Нужно войти заново');
    }

    throw new Error(data.details || data.error || `API error ${response.status}`);
  }

  return data;
}

function bindTabs() {
  document.querySelectorAll('[data-admin-tab]').forEach((button) => {
    button.addEventListener('click', () => activateTab(button.dataset.adminTab));
  });
}

function activateTab(key) {
  document.querySelectorAll('[data-admin-tab]').forEach((item) => {
    item.classList.toggle('active', item.dataset.adminTab === key);
  });

  document.querySelectorAll('[data-admin-panel]').forEach((panel) => {
    panel.classList.toggle('active', panel.dataset.adminPanel === key);
  });
}

function bindReferenceTabs() {
  document.querySelectorAll('[data-ref-tab]').forEach((button) => {
    button.addEventListener('click', () => {
      const key = button.dataset.refTab;

      document.querySelectorAll('[data-ref-tab]').forEach((tab) => {
        tab.classList.toggle('active', tab.dataset.refTab === key);
      });

      document.querySelectorAll('[data-ref-panel]').forEach((panel) => {
        panel.classList.toggle('active', panel.dataset.refPanel === key);
      });
    });
  });
}

function getAdStatus(ad) {
  return ad.status || 'pending';
}

function statusBadge(ad) {
  const status = getAdStatus(ad);

  const labels = {
    pending: 'На модерации',
    approved: 'Опубликовано',
    rejected: 'Отклонено',
  };

  return `<span class="status-badge status-${status}">${ad.status_label || labels[status] || 'На модерации'}</span>`;
}

function moderationButtons(ad) {
  const status = getAdStatus(ad);
  const buttons = [];

  if (status === 'pending' || status === 'rejected') {
    buttons.push(`<button class="btn btn-primary btn-sm" data-publish-ad="${ad.ad_id}">Опубликовать</button>`);
  }

  if (status === 'pending') {
    buttons.push(`<button class="btn btn-light btn-sm" data-reject-ad="${ad.ad_id}">Отклонить</button>`);
  }

  buttons.push(`<button class="btn btn-light btn-sm" onclick="location.href='/ad.html?id=${ad.ad_id}'">Открыть</button>`);
  buttons.push(`<button class="btn btn-light btn-sm" data-delete-ad="${ad.ad_id}">Удалить</button>`);

  return buttons.join('');
}

function referenceRows(items, idField, type) {
  if (!items.length) {
    return '<div class="refs-empty">Записей пока нет.</div>';
  }

  return items.map((item) => `
    <div class="reference-row">
      <span>${item.name}</span>
      <button class="btn btn-light btn-sm" data-ref-type="${type}" data-ref-id="${item[idField]}">
        Удалить
      </button>
    </div>
  `).join('');
}

async function loadUsers() {
  adminUsers = await api('/user');
  renderUsers();
}

function getUserSearchText(user) {
  const role = roles.find((item) => Number(item.role_id) === Number(user.role_id));

  return [
    user.user_id,
    user.email,
    user.firstname,
    user.lastname,
    user.phone,
    role?.name,
  ].filter(Boolean).join(' ').toLowerCase();
}

function renderUsers() {
  const body = document.getElementById('adminUsersBody');
  if (!body) return;

  const query = (document.getElementById('adminUsersSearch')?.value || '').trim().toLowerCase();

  const users = query
    ? adminUsers.filter((user) => getUserSearchText(user).includes(query))
    : adminUsers;

  body.innerHTML = users.map((user) => `
    <tr>
      <td>${user.user_id}</td>
      <td>${user.email}</td>
      <td>${[user.firstname, user.lastname].filter(Boolean).join(' ') || '-'}</td>
      <td>
        <select class="select admin-role-select" data-user-id="${user.user_id}">
          ${roles.map((role) => `<option value="${role.role_id}" ${Number(role.role_id) === Number(user.role_id) ? 'selected' : ''}>${role.name}</option>`).join('')}
        </select>
      </td>
      <td>
        <button class="btn btn-light btn-sm" data-delete-user="${user.user_id}">
          Удалить
        </button>
      </td>
    </tr>
  `).join('') || `<tr><td colspan="5">${query ? 'По вашему запросу пользователи не найдены.' : 'Пользователей пока нет.'}</td></tr>`;
}

async function loadReferences() {
  [makes, adminModels, adminBodyTypes] = await Promise.all([
    api('/make'),
    api('/model'),
    api('/body-type'),
  ]);

  renderReferences();
}

function filterByReferenceSearch(items, getText) {
  const query = (document.getElementById('adminRefsSearch')?.value || '').trim().toLowerCase();

  if (!query) return items;

  return items.filter((item) => getText(item).toLowerCase().includes(query));
}

function renderReferences() {
  const filteredMakes = filterByReferenceSearch(makes, (make) => make.name);

  const filteredModels = filterByReferenceSearch(adminModels, (model) => {
    const make = makes.find((item) => Number(item.car_make_id) === Number(model.car_make_id));
    return `${model.name} ${make?.name || ''}`;
  });

  const filteredBodyTypes = filterByReferenceSearch(adminBodyTypes, (bodyType) => bodyType.name);

  const makesList = document.getElementById('makesAdminList');
  const modelsList = document.getElementById('modelsAdminList');
  const bodyTypesList = document.getElementById('bodyTypesAdminList');
  const modelMake = document.getElementById('modelMake');

  if (makesList) {
    makesList.innerHTML = referenceRows(filteredMakes, 'car_make_id', 'make');
  }

  if (modelsList) {
    modelsList.innerHTML = referenceRows(filteredModels, 'car_model_id', 'model');
  }

  if (bodyTypesList) {
    bodyTypesList.innerHTML = referenceRows(filteredBodyTypes, 'body_type_id', 'body-type');
  }

  if (modelMake) {
    modelMake.innerHTML = makes
      .map((make) => `<option value="${make.car_make_id}">${make.name}</option>`)
      .join('');
  }
}

async function loadAds() {
  moderationAds = await api('/ad?moderation=1');
  renderAds();
}

function getAdsSearchText(ad) {
  return [
    ad.ad_id,
    ad.title,
    ad.car_make,
    ad.car_model,
    ad.year,
    ad.price,
    ad.seller_email,
    ad.seller_id ? `ID ${ad.seller_id}` : '',
    ad.status_label,
    getAdStatus(ad),
    ad.rejection_reason,
  ].filter(Boolean).join(' ').toLowerCase();
}

function renderAds() {
  const body = document.getElementById('adminAdsBody');
  if (!body) return;

  const query = (document.getElementById('adminAdsSearch')?.value || '').trim().toLowerCase();

  const ads = query
    ? moderationAds.filter((ad) => getAdsSearchText(ad).includes(query))
    : moderationAds;

  body.innerHTML = ads.map((ad) => `
    <tr>
      <td>${ad.ad_id}</td>
      <td>
        <strong>${ad.title || ''}</strong>
        <div class="small">${[ad.car_make, ad.car_model, ad.year].filter(Boolean).join(' ')}</div>
      </td>
      <td>${new Intl.NumberFormat('ru-RU').format(Number(ad.price) || 0)} ₽</td>
      <td>${ad.seller_email || `ID ${ad.seller_id}`}</td>
      <td>${statusBadge(ad)}</td>
      <td>${ad.rejection_reason || '-'}</td>
      <td class="table-actions moderation-actions">${moderationButtons(ad)}</td>
    </tr>
  `).join('') || `<tr><td colspan="7">${query ? 'По вашему запросу ничего не найдено.' : 'Объявлений пока нет.'}</td></tr>`;
}

function bindForms() {
  document.getElementById('makeForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = document.getElementById('makeName').value.trim();

    if (!name) return;

    await api('/make', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });

    event.target.reset();
    await loadReferences();
    showMessage('Марка добавлена', 'success');
  });

  document.getElementById('modelForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const car_make_id = Number(document.getElementById('modelMake').value);
    const name = document.getElementById('modelName').value.trim();

    if (!car_make_id || !name) return;

    await api('/model', {
      method: 'POST',
      body: JSON.stringify({
        car_make_id,
        name,
      }),
    });

    event.target.reset();
    await loadReferences();
    showMessage('Модель добавлена', 'success');
  });

  document.getElementById('bodyTypeForm')?.addEventListener('submit', async (event) => {
    event.preventDefault();

    const name = document.getElementById('bodyTypeName').value.trim();

    if (!name) return;

    await api('/body-type', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });

    event.target.reset();
    await loadReferences();
    showMessage('Тип кузова добавлен', 'success');
  });
}

function configureAccess(user) {
  const adminOnlyTabs = ['users', 'refs'];

  if (!canManageUsers(user)) {
    adminOnlyTabs.forEach((key) => {
      document.querySelector(`[data-admin-tab="${key}"]`)?.remove();
      document.querySelector(`[data-admin-panel="${key}"]`)?.remove();
    });

    document.getElementById('adminPageTitle').textContent = 'Панель менеджера';
    document.getElementById('adminPageSubtitle').textContent = 'Модерация пользовательских объявлений';

    activateTab('ads');
  }
}

async function moderateAd(adId, action) {
  let rejection_reason = null;

  if (action === 'reject') {
    rejection_reason = prompt('Укажите причину отказа');

    if (!rejection_reason || !rejection_reason.trim()) return;
  }

  await api(`/ad/${adId}/moderation`, {
    method: 'PUT',
    body: JSON.stringify({
      action,
      rejection_reason,
    }),
  });

  await loadAds();
}

async function initAdmin() {
  bindTabs();
  bindReferenceTabs();

  const user = getCurrentUser();
  const token = localStorage.getItem('authToken');

  if (!canModerateAds(user) || !token) {
    document.querySelectorAll('.admin-panel').forEach((panel) => {
      panel.style.display = 'none';
    });

    showMessage(
      'Для доступа к панели нужно войти заново под менеджером или администратором. ' +
      '<button class="btn btn-primary btn-sm" id="adminReloginBtn" type="button">Войти</button>',
      'error'
    );

    document.getElementById('adminReloginBtn')?.addEventListener('click', () => {
      localStorage.removeItem('currentUser');
      localStorage.removeItem('authToken');
      location.href = '/login.html';
    });

    return;
  }

  configureAccess(user);

  roles = canManageUsers(user) ? await api('/role') : [];

  await Promise.all([
    canManageUsers(user) ? loadUsers() : Promise.resolve(),
    canManageUsers(user) ? loadReferences() : Promise.resolve(),
    loadAds(),
  ]);

  hideMessage();

  if (canManageUsers(user)) bindForms();

  document.getElementById('adminUsersSearch')?.addEventListener('input', renderUsers);
  document.getElementById('adminRefsSearch')?.addEventListener('input', renderReferences);
  document.getElementById('adminAdsSearch')?.addEventListener('input', renderAds);

  document.addEventListener('change', async (event) => {
    const select = event.target.closest('.admin-role-select');
    if (!select) return;

    try {
      await api(`/user/${select.dataset.userId}`, {
        method: 'PUT',
        body: JSON.stringify({
          role_id: Number(select.value),
        }),
      });

      showMessage('Роль пользователя обновлена', 'success');
    } catch (error) {
      console.error(error);
      showMessage('Ошибка изменения роли: ' + error.message, 'error');
    }
  });

  document.addEventListener('click', async (event) => {
    const button = event.target.closest('button');
    if (!button) return;

    const userId = button.dataset.deleteUser;
    const adId = button.dataset.deleteAd;
    const publishAd = button.dataset.publishAd;
    const rejectAd = button.dataset.rejectAd;
    const refType = button.dataset.refType;
    const refId = button.dataset.refId;

    try {
      if (publishAd) {
        button.disabled = true;
        await moderateAd(publishAd, 'publish');
        showMessage(`Объявление #${publishAd} опубликовано`, 'success');
        return;
      }

      if (rejectAd) {
        button.disabled = true;
        await moderateAd(rejectAd, 'reject');
        showMessage(`Объявление #${rejectAd} отклонено`, 'success');
        return;
      }

      if (userId && confirm(`Удалить пользователя #${userId}?`)) {
        button.disabled = true;
        await api(`/user/${userId}`, { method: 'DELETE' });
        await loadUsers();
        showMessage(`Пользователь #${userId} удалён`, 'success');
        return;
      }

      if (adId && confirm(`Удалить объявление #${adId}?`)) {
        button.disabled = true;
        await api(`/ad/${adId}`, { method: 'DELETE' });
        await loadAds();
        showMessage(`Объявление #${adId} удалено`, 'success');
        return;
      }

      if (refType && refId && confirm('Удалить запись справочника?')) {
        button.disabled = true;
        await api(`/${refType}/${refId}`, { method: 'DELETE' });
        await loadReferences();
        showMessage('Запись справочника удалена', 'success');
      }
    } catch (error) {
      console.error(error);
      showMessage('Ошибка: ' + error.message, 'error');
      button.disabled = false;
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initAdmin().catch((error) => {
    console.error(error);

    document.querySelectorAll('.admin-panel').forEach((panel) => {
      panel.style.display = 'none';
    });

    showMessage(
      `${error.message}. <button class="btn btn-primary btn-sm" onclick="location.href='/login.html'">Войти заново</button>`,
      'error'
    );
  });
});