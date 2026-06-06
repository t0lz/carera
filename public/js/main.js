const API_BASE = '/api';

let allAds = [];
let makesCache = [];
let modelsCache = [];
let bodyTypesCache = [];

async function apiGet(path) {
  const res = await fetch(API_BASE + path);

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.details || data.error || 'API error: ' + res.status);
  }

  return data;
}

function formatPrice(num) {
  if (num == null) return 'Цена не указана';

  const n = Number(num);

  if (Number.isNaN(n)) return `${num} ₽`;

  return new Intl.NumberFormat('ru-RU').format(n) + ' ₽';
}

function normalizePhotoUrl(url) {
  if (!url) return '';

  if (url.startsWith('http://') || url.startsWith('https://')) {
    return url;
  }

  if (url.startsWith('/')) {
    return url;
  }

  return '/' + url;
}

function renderAdCard(ad) {
  const div = document.createElement('div');
  div.className = 'card';

  const title = ad.title || `Объявление #${ad.ad_id}`;
  const priceText = formatPrice(ad.price);

  const carInfoParts = [];

  if (ad.car_make) carInfoParts.push(ad.car_make);
  if (ad.car_model) carInfoParts.push(ad.car_model);
  if (ad.year) carInfoParts.push(ad.year + ' г.');

  const carLine = carInfoParts.join(' · ');
  const mileagePart = ad.mileage_km ? `${ad.mileage_km} км` : '';
  const desc = ad.description || '';
  const photoUrl = normalizePhotoUrl(ad.photo_url);

  div.innerHTML = `
    <div class="card-image-wrap">
      ${
        photoUrl
          ? `<img 
              class="card-image" 
              src="${photoUrl}" 
              alt="${title}" 
              loading="lazy" 
              onerror="this.closest('.card-image-wrap').innerHTML = '<div class=&quot;card-image-placeholder&quot;>Фото отсутствует</div>'"
            >`
          : `<div class="card-image-placeholder">Фото отсутствует</div>`
      }
    </div>

    <h3>${title}</h3>

    <div class="card-price">${priceText}</div>

    <div class="card-subtitle">
      ${carLine}${mileagePart ? ' · ' + mileagePart : ''}
    </div>

    <div class="card-desc">${desc}</div>

    <button class="btn btn-primary btn-sm" onclick="location.href='/ad.html?id=${ad.ad_id}'">
      Открыть
    </button>
  `;

  return div;
}

function renderAdsList(ads) {
  const adsList = document.getElementById('adsList');
  const adsCounter = document.getElementById('adsCounter');

  if (!adsList || !adsCounter) return;

  if (!ads || !ads.length) {
    adsList.innerHTML = '';
    adsCounter.textContent = 'Объявлений не найдено';
    return;
  }

  adsList.innerHTML = '';
  adsCounter.textContent = `Найдено объявлений: ${ads.length}`;

  ads.forEach((ad) => {
    adsList.appendChild(renderAdCard(ad));
  });
}

function getAdSearchText(ad) {
  return [
    ad.ad_id,
    ad.title,
    ad.description,
    ad.car_make,
    ad.car_model,
    ad.year,
    ad.body_type,
    ad.fuel_type,
    ad.transmission,
    ad.drive_type,
    ad.color,
    ad.price,
    ad.mileage_km,
  ].filter(Boolean).join(' ').toLowerCase();
}

async function loadFilters() {
  const makeSelect = document.getElementById('makeSelect');
  const modelSelect = document.getElementById('modelSelect');
  const bodyTypeSelect = document.getElementById('bodyTypeSelect');

  if (!makeSelect || !modelSelect || !bodyTypeSelect) return;

  [makesCache, modelsCache, bodyTypesCache] = await Promise.all([
    apiGet('/make'),
    apiGet('/model'),
    apiGet('/body-type'),
  ]);

  makeSelect.innerHTML = '<option value="">Любая</option>';

  makesCache.forEach((make) => {
    const opt = document.createElement('option');
    opt.value = make.car_make_id;
    opt.textContent = make.name;
    makeSelect.appendChild(opt);
  });

  modelSelect.innerHTML = '<option value="">Любая</option>';

  modelsCache.forEach((model) => {
    const opt = document.createElement('option');
    opt.value = model.car_model_id;
    opt.textContent = model.name;
    modelSelect.appendChild(opt);
  });

  bodyTypeSelect.innerHTML = '<option value="">Любой</option>';

  bodyTypesCache.forEach((bodyType) => {
    const opt = document.createElement('option');
    opt.value = bodyType.body_type_id;
    opt.textContent = bodyType.name;
    bodyTypeSelect.appendChild(opt);
  });
}

async function loadAllAds() {
  const adsCounter = document.getElementById('adsCounter');
  const adsList = document.getElementById('adsList');

  if (!adsCounter || !adsList) return;

  adsCounter.textContent = 'Загрузка объявлений...';
  adsList.innerHTML = '';

  try {
    allAds = await apiGet('/ad');
    renderAdsList(allAds);
  } catch (err) {
    console.error(err);
    adsCounter.textContent = 'Ошибка загрузки объявлений';
  }
}

function applyFilters() {
  const makeSelect = document.getElementById('makeSelect');
  const modelSelect = document.getElementById('modelSelect');
  const bodyTypeSelect = document.getElementById('bodyTypeSelect');
  const yearFrom = document.getElementById('yearFrom');
  const yearTo = document.getElementById('yearTo');
  const priceFrom = document.getElementById('priceFrom');
  const priceTo = document.getElementById('priceTo');
  const searchInput = document.getElementById('adsSearchInput');

  const searchQuery = (searchInput?.value || '').trim().toLowerCase();

  const selectedMakeId = makeSelect?.value || '';
  const selectedModelId = modelSelect?.value || '';
  const selectedBodyTypeId = bodyTypeSelect?.value || '';

  const yearFromVal = yearFrom?.value ? Number(yearFrom.value) : null;
  const yearToVal = yearTo?.value ? Number(yearTo.value) : null;

  const priceFromVal = priceFrom?.value ? Number(priceFrom.value) : null;
  const priceToVal = priceTo?.value ? Number(priceTo.value) : null;

  const filtered = allAds.filter((ad) => {
    if (searchQuery && !getAdSearchText(ad).includes(searchQuery)) return false;

    if (selectedMakeId && String(ad.car_make_id) !== selectedMakeId) return false;
    if (selectedModelId && String(ad.car_model_id) !== selectedModelId) return false;
    if (selectedBodyTypeId && String(ad.body_type_id) !== selectedBodyTypeId) return false;

    if (yearFromVal != null && ad.year && Number(ad.year) < yearFromVal) return false;
    if (yearToVal != null && ad.year && Number(ad.year) > yearToVal) return false;

    if (priceFromVal != null && ad.price != null && Number(ad.price) < priceFromVal) return false;
    if (priceToVal != null && ad.price != null && Number(ad.price) > priceToVal) return false;

    return true;
  });

  renderAdsList(filtered);
}

function resetFilters() {
  [
    'adsSearchInput',
    'makeSelect',
    'modelSelect',
    'bodyTypeSelect',
    'yearFrom',
    'yearTo',
    'priceFrom',
    'priceTo',
  ].forEach((id) => {
    const el = document.getElementById(id);

    if (el) el.value = '';
  });

  renderAdsList(allAds);
}

function initCatalogPage() {
  const applyBtn = document.getElementById('applyFilters');
  const resetBtn = document.getElementById('resetFilters');
  const searchInput = document.getElementById('adsSearchInput');

  if (searchInput) {
    searchInput.addEventListener('input', applyFilters);
  }

  if (applyBtn) {
    applyBtn.addEventListener('click', (event) => {
      event.preventDefault();
      applyFilters();
    });
  }

  if (resetBtn) {
    resetBtn.addEventListener('click', (event) => {
      event.preventDefault();
      resetFilters();
    });
  }
}

function initFiltersToggle() {
  const toggleBtn = document.getElementById('filtersToggle');
  const filtersPanel = document.getElementById('filtersPanel');
  const adsLayout = document.querySelector('.ads-layout');

  if (!toggleBtn || !filtersPanel || !adsLayout) return;

  toggleBtn.addEventListener('click', () => {
    const isOpen = filtersPanel.classList.toggle('is-open');

    adsLayout.classList.toggle('filters-open', isOpen);
    toggleBtn.textContent = isOpen ? 'Скрыть фильтры' : 'Показать фильтры';
  });
}

document.addEventListener('DOMContentLoaded', () => {
  if (document.getElementById('adsList')) {
    loadFilters().catch(console.error);
    loadAllAds().catch(console.error);
    initCatalogPage();
  }

  initFiltersToggle();
});