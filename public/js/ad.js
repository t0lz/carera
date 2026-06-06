const API_BASE = '/api';

function authHeaders(extra = {}) {
  if (window.appAuth && typeof window.appAuth.authHeaders === 'function') {
    return window.appAuth.authHeaders(extra);
  }

  const token = localStorage.getItem('authToken');
  return token ? { ...extra, Authorization: `Bearer ${token}` } : { ...extra };
}

async function apiGet(path) {
  const res = await fetch(API_BASE + path, {
    headers: authHeaders(),
  });

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

function getAdIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');

  return id ? Number(id) : null;
}

function statusBlock(ad) {
  const labels = {
    pending: 'На модерации',
    approved: 'Опубликовано',
    rejected: 'Отклонено',
  };

  const status = ad.status || 'pending';

  if (status === 'approved') return '';

  return `
    <div class="moderation-notice moderation-${status}">
      <strong>${labels[status] || status}</strong>
      ${status === 'pending' ? '<span>Объявление увидят покупатели после проверки менеджером.</span>' : ''}
      ${status === 'rejected' && ad.rejection_reason ? `<span>Причина отказа: ${ad.rejection_reason}</span>` : ''}
    </div>
  `;
}

function renderPhotos(photos) {
  if (!photos || !photos.length) {
    return '<div class="empty-state">Фото отсутствуют</div>';
  }

  const slidesHtml = photos.map((photo, index) => {
    const photoUrl = normalizePhotoUrl(photo.url);

    return `
      <div class="ad-slide ${index === 0 ? 'active' : ''}" data-index="${index}">
        ${
          photoUrl
            ? `<img src="${photoUrl}" alt="Фото ${index + 1}" loading="lazy" onerror="console.error('Фото не загрузилось:', this.src)">`
            : '<div class="empty-state">Фото недоступно</div>'
        }
      </div>
    `;
  }).join('');

  const arrowsHtml = photos.length > 1 ? `
    <button class="ad-slider-arrow ad-slider-arrow-left" id="adSliderPrev">&#10094;</button>
    <button class="ad-slider-arrow ad-slider-arrow-right" id="adSliderNext">&#10095;</button>
  ` : '';

  const dotsHtml = photos.length > 1 ? `
    <div class="ad-slider-dots" id="adSliderDots">
      ${photos.map((_photo, index) => `<button class="ad-slider-dot ${index === 0 ? 'active' : ''}" data-index="${index}"></button>`).join('')}
    </div>
  ` : '';

  return `<div class="ad-slider" id="adSlider">${slidesHtml}${arrowsHtml}${dotsHtml}</div>`;
}

function initSlider(photosCount) {
  if (photosCount <= 1) return;

  const sliderEl = document.getElementById('adSlider');

  if (!sliderEl) return;

  const slides = sliderEl.querySelectorAll('.ad-slide');
  const prevBtn = document.getElementById('adSliderPrev');
  const nextBtn = document.getElementById('adSliderNext');
  const dots = document.querySelectorAll('.ad-slider-dot');

  let currentIndex = 0;

  function showSlide(index) {
    if (index < 0) index = slides.length - 1;
    if (index >= slides.length) index = 0;

    slides.forEach((slide) => slide.classList.remove('active'));
    dots.forEach((dot) => dot.classList.remove('active'));

    slides[index].classList.add('active');

    if (dots[index]) {
      dots[index].classList.add('active');
    }

    currentIndex = index;
  }

  prevBtn?.addEventListener('click', () => showSlide(currentIndex - 1));
  nextBtn?.addEventListener('click', () => showSlide(currentIndex + 1));

  dots.forEach((dot) => {
    dot.addEventListener('click', () => showSlide(Number(dot.dataset.index)));
  });
}

async function loadAdPage() {
  const container = document.getElementById('adContainer');
  const adId = getAdIdFromUrl();

  if (!container) return;

  if (!adId) {
    container.textContent = 'Объявление не найдено';
    return;
  }

  try {
    const ad = await apiGet('/ad/' + adId);

    let photos = [];

    try {
      photos = await apiGet('/photo?ad_id=' + adId);
    } catch (error) {
      console.warn('Не удалось загрузить фото:', error);
    }

    const specs = [
      ['Марка', ad.car_make],
      ['Модель', ad.car_model],
      ['Тип кузова', ad.body_type],
      ['Год выпуска', ad.year],
      ['Пробег', ad.mileage_km ? `${ad.mileage_km} км` : null],
      ['Цвет', ad.color],
      ['Коробка передач', ad.transmission],
      ['Тип топлива', ad.fuel_type],
      ['Привод', ad.drive_type],
      ['Объём двигателя', ad.engine_volume_l ? `${ad.engine_volume_l} л` : null],
      ['Мощность', ad.power_hp ? `${ad.power_hp} л.с.` : null],
      ['Крутящий момент', ad.torque_nm ? `${ad.torque_nm} Н·м` : null],
    ].filter(([, value]) => value != null && String(value).trim() !== '');

    const specsHtml = specs.map(([name, value]) => `
      <div class="ad-specs-row">
        <div class="ad-spec-name">${name}</div>
        <div class="ad-spec-value">${value}</div>
      </div>
    `).join('');

    const sellerName =
      [ad.seller_firstname, ad.seller_lastname].filter(Boolean).join(' ') ||
      ad.seller_email ||
      'Продавец';

    const sellerPhone = ad.seller_phone || 'не указан';

    container.innerHTML = `
      ${statusBlock(ad)}
      <div class="ad-layout">
        <div class="ad-main">
          <div class="ad-photos-main">${renderPhotos(photos)}</div>
          <div>
            <h2>${ad.title || `Объявление #${ad.ad_id}`}</h2>
            <div class="card-price">${formatPrice(ad.price)}</div>
            <div class="card-subtitle">${[ad.car_make, ad.car_model, ad.year ? ad.year + ' г.' : ''].filter(Boolean).join(' · ')}</div>
            <hr>
            <h3>Описание</h3>
            <div class="card-desc">${ad.description || 'Описание не указано'}</div>
          </div>
        </div>

        <div class="ad-side">
          <div class="ad-specs">
            <div class="ad-specs-title">Характеристики</div>
            ${specsHtml || '<div class="small">Нет данных</div>'}
          </div>

          <div class="ad-specs">
            <div class="ad-specs-title">Продавец</div>
            <div class="small">Имя: <strong>${sellerName}</strong></div>
            <div class="small">Телефон: <strong>${sellerPhone}</strong></div>
          </div>
        </div>
      </div>
    `;

    initSlider(photos.length);
  } catch (err) {
    console.error(err);
    container.textContent = 'Ошибка загрузки объявления: ' + err.message;
  }
}

document.addEventListener('DOMContentLoaded', loadAdPage);