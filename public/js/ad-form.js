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
    throw new Error(data.details || data.error || 'API GET ' + path + ' -> ' + res.status);
  }

  return data;
}

async function apiPost(path, body) {
  const res = await fetch(API_BASE + path, {
    method: 'POST',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.details || data.error || 'API POST ' + path + ' -> ' + res.status);
  }

  return data;
}

async function apiPut(path, body) {
  const res = await fetch(API_BASE + path, {
    method: 'PUT',
    headers: authHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.details || data.error || 'API PUT ' + path + ' -> ' + res.status);
  }

  return data;
}

async function apiDelete(path) {
  const res = await fetch(API_BASE + path, {
    method: 'DELETE',
    headers: authHeaders(),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.details || data.error || 'API DELETE ' + path + ' -> ' + res.status);
  }

  return data;
}

async function apiUploadPhotos(adId, files) {
  if (!adId || !files || !files.length) return [];

  const formData = new FormData();
  formData.append('ad_id', adId);

  Array.from(files).forEach((file) => {
    formData.append('photos', file);
  });

  const res = await fetch(API_BASE + '/photo/upload', {
    method: 'POST',
    headers: authHeaders(),
    body: formData,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.details || data.error || 'Ошибка загрузки фото');
  }

  return data;
}

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem('currentUser')) || null;
  } catch {
    return null;
  }
}

function getAdIdFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const id = params.get('id');
  return id ? Number(id) : null;
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

let makesCache = [];
let modelsCache = [];
let bodyTypesCache = [];

async function loadReferenceData() {
  const [makes, models, bodyTypes] = await Promise.all([
    apiGet('/make'),
    apiGet('/model'),
    apiGet('/body-type'),
  ]);

  makesCache = makes;
  modelsCache = models;
  bodyTypesCache = bodyTypes;

  const bodyTypeSelect = document.getElementById('bodyTypeSelect');

  if (bodyTypeSelect) {
    bodyTypeSelect.innerHTML = '<option value="">Выберите тип кузова</option>';

    bodyTypesCache.forEach((bodyType) => {
      const opt = document.createElement('option');
      opt.value = bodyType.body_type_id;
      opt.textContent = bodyType.name;
      bodyTypeSelect.appendChild(opt);
    });
  }
}

function getSelectedPhotoFiles() {
  const input = document.getElementById('adPhotos');
  return input && input.files ? Array.from(input.files) : [];
}

function renderSelectedPhotosPreview() {
  const input = document.getElementById('adPhotos');
  const preview = document.getElementById('selectedPhotosPreview');

  if (!input || !preview) return;

  preview.innerHTML = '';

  const files = Array.from(input.files || []);

  if (!files.length) return;

  files.forEach((file) => {
    const item = document.createElement('div');
    item.className = 'photo-preview-item';

    const img = document.createElement('img');
    img.src = URL.createObjectURL(file);
    img.alt = file.name;

    img.onload = () => {
      URL.revokeObjectURL(img.src);
    };

    const caption = document.createElement('div');
    caption.className = 'small';
    caption.textContent = file.name;

    item.appendChild(img);
    item.appendChild(caption);
    preview.appendChild(item);
  });
}

function renderExistingPhotosPreview(photos) {
  const preview = document.getElementById('existingPhotosPreview');

  if (!preview) return;

  preview.innerHTML = '';

  if (!photos || !photos.length) {
    preview.innerHTML = '<div class="small">Фото пока нет.</div>';
    return;
  }

  photos.forEach((photo) => {
    const item = document.createElement('div');
    item.className = 'photo-preview-item';

    const img = document.createElement('img');
    img.src = normalizePhotoUrl(photo.url);
    img.alt = 'Фото объявления';

    const caption = document.createElement('div');
    caption.className = 'small';
    caption.textContent = 'Загружено';

    item.appendChild(img);
    item.appendChild(caption);
    preview.appendChild(item);
  });
}

function initPhotosUi() {
  const input = document.getElementById('adPhotos');

  if (input) {
    input.addEventListener('change', () => {
      const files = Array.from(input.files || []);

      if (files.length > 10) {
        alert('Можно выбрать не больше 10 фото');
        input.value = '';
        renderSelectedPhotosPreview();
        return;
      }

      const tooLarge = files.find((file) => file.size > 5 * 1024 * 1024);

      if (tooLarge) {
        alert(`Файл "${tooLarge.name}" больше 5 МБ`);
        input.value = '';
        renderSelectedPhotosPreview();
        return;
      }

      renderSelectedPhotosPreview();
    });
  }
}

function collectFormData() {
  const getVal = (id) => {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
  };

  const makeName = getVal('makeInput');
  const modelName = getVal('modelInput');

  const body_type_id = Number(getVal('bodyTypeSelect')) || null;
  const year = getVal('year') || null;
  const mileage_km = getVal('mileage') || null;
  const color = getVal('color') || null;
  const transmission = getVal('transmission') || null;
  const fuel_type = getVal('fuelType') || null;
  const drive_type = getVal('driveType') || null;
  const engine_volume_l = getVal('engineVolume') || null;
  const power_hp = getVal('powerHp') || null;
  const torque_nm = getVal('torqueNm') || null;

  const title = getVal('title');
  const description = getVal('description');
  const price = getVal('price') ? Number(getVal('price')) : null;

  return {
    makeName,
    modelName,
    body_type_id,
    year,
    mileage_km,
    color,
    transmission,
    fuel_type,
    drive_type,
    engine_volume_l,
    power_hp,
    torque_nm,
    title,
    description,
    price,
  };
}

function fillForm(ad, vehicle, photos) {
  const setVal = (id, value) => {
    const el = document.getElementById(id);

    if (el && value != null) {
      el.value = value;
    }
  };

  if (vehicle) {
    setVal('year', vehicle.year);
    setVal('mileage', vehicle.mileage_km);
    setVal('color', vehicle.color);
    setVal('transmission', vehicle.transmission);
    setVal('fuelType', vehicle.fuel_type);
    setVal('driveType', vehicle.drive_type);
    setVal('engineVolume', vehicle.engine_volume_l);
    setVal('powerHp', vehicle.power_hp);
    setVal('torqueNm', vehicle.torque_nm);

    let makeName = '';
    let modelName = '';

    if (vehicle.car_model_id) {
      const model = modelsCache.find(
        (item) => Number(item.car_model_id) === Number(vehicle.car_model_id)
      );

      if (model) {
        modelName = model.name;

        const make = makesCache.find(
          (item) => Number(item.car_make_id) === Number(model.car_make_id)
        );

        if (make) makeName = make.name;
      }
    }

    setVal('makeInput', makeName);
    setVal('modelInput', modelName);

    if (vehicle.body_type_id) {
      setVal('bodyTypeSelect', vehicle.body_type_id);
    }
  }

  if (ad) {
    setVal('title', ad.title);
    setVal('description', ad.description);
    setVal('price', ad.price);
  }

  renderExistingPhotosPreview(photos || []);
}

async function initAdFormPage() {
  const form = document.getElementById('adForm');

  if (!form) return;

  initPhotosUi();

  const adId = getAdIdFromUrl();
  const isEdit = !!adId;

  const titleEl = document.querySelector('.form-title');
  const subtitleEl = document.querySelector('.form-subtitle');

  if (!isEdit) {
    if (titleEl) titleEl.textContent = 'Новое объявление';

    if (subtitleEl) {
      subtitleEl.textContent = 'Заполни данные автомобиля, добавь фото и укажи цену';
    }
  } else {
    if (titleEl) titleEl.textContent = 'Редактирование объявления';

    if (subtitleEl) {
      subtitleEl.textContent = 'Измени данные и сохрани обновлённое объявление';
    }
  }

  try {
    await loadReferenceData();
  } catch (err) {
    console.error(err);
    alert('Ошибка загрузки справочников: ' + err.message);
    return;
  }

  let existingAd = null;
  let existingVehicle = null;
  let existingPhotos = [];

  if (isEdit) {
    try {
      existingAd = await apiGet('/ad/' + adId);

      if (!existingAd) {
        alert('Объявление не найдено');
        window.location.href = '/profile.html';
        return;
      }

      if (existingAd.vehicle_id) {
        existingVehicle = await apiGet('/vehicle/' + existingAd.vehicle_id);
      }

      try {
        existingPhotos = await apiGet('/photo?ad_id=' + adId);
      } catch (error) {
        console.warn('Не удалось загрузить фото объявления:', error);
      }

      const current = getCurrentUser();

      if (!current) {
        alert('Сначала войдите в аккаунт');
        window.location.href = '/login.html';
        return;
      }

      if (
        Number(existingAd.seller_id) !== Number(current.user_id) &&
        current.role_name !== 'admin'
      ) {
        alert('Вы не можете редактировать чужое объявление');
        window.location.href = '/profile.html';
        return;
      }

      fillForm(existingAd, existingVehicle, existingPhotos);
    } catch (err) {
      console.error(err);
      alert('Ошибка загрузки объявления: ' + err.message);
      return;
    }
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const current = getCurrentUser();

    if (!current) {
      alert('Сначала войдите в аккаунт');
      window.location.href = '/login.html';
      return;
    }

    const data = collectFormData();
    const selectedFiles = getSelectedPhotoFiles();

    if (!data.makeName || !data.modelName) {
      alert('Введите марку и модель');
      return;
    }

    if (!data.body_type_id) {
      alert('Выберите тип кузова');
      return;
    }

    if (!data.title || !data.price) {
      alert('Введите заголовок и цену');
      return;
    }

    try {
      let make = makesCache.find(
        (item) => item.name.toLowerCase() === data.makeName.toLowerCase()
      );

      if (!make) {
        make = await apiPost('/make', {
          name: data.makeName,
        });

        makesCache.push(make);
      }

      const car_make_id = make.car_make_id;

      let model = modelsCache.find(
        (item) =>
          item.name.toLowerCase() === data.modelName.toLowerCase() &&
          Number(item.car_make_id) === Number(car_make_id)
      );

      if (!model) {
        model = await apiPost('/model', {
          name: data.modelName,
          car_make_id,
        });

        modelsCache.push(model);
      }

      const car_model_id = model.car_model_id;

      if (isEdit) {
        if (!existingAd || !existingAd.vehicle_id) {
          throw new Error('У объявления нет связанного автомобиля');
        }

        await apiPut('/vehicle/' + existingAd.vehicle_id, {
          car_make_id,
          car_model_id,
          body_type_id: data.body_type_id,
          year: data.year,
          mileage_km: data.mileage_km,
          color: data.color,
          transmission: data.transmission,
          fuel_type: data.fuel_type,
          drive_type: data.drive_type,
          engine_volume_l: data.engine_volume_l,
          power_hp: data.power_hp,
          torque_nm: data.torque_nm,
        });

        await apiPut('/ad/' + adId, {
          title: data.title,
          description: data.description,
          price: data.price,
        });

        if (selectedFiles.length) {
          await apiDelete('/photo/by-ad/' + adId);
          await apiUploadPhotos(adId, selectedFiles);
        }

        alert('Объявление обновлено и отправлено на модерацию');
      } else {
        const newVehicle = await apiPost('/vehicle', {
          car_make_id,
          car_model_id,
          body_type_id: data.body_type_id,
          year: data.year,
          mileage_km: data.mileage_km,
          color: data.color,
          transmission: data.transmission,
          fuel_type: data.fuel_type,
          drive_type: data.drive_type,
          engine_volume_l: data.engine_volume_l,
          power_hp: data.power_hp,
          torque_nm: data.torque_nm,
        });

        const newAd = await apiPost('/ad', {
          seller_id: current.user_id,
          vehicle_id: newVehicle.vehicle_id,
          title: data.title,
          description: data.description,
          price: data.price,
        });

        if (newAd && newAd.ad_id && selectedFiles.length) {
          await apiUploadPhotos(newAd.ad_id, selectedFiles);
        }

        alert('Объявление создано и отправлено на модерацию');
      }

      window.location.href = '/profile.html';
    } catch (err) {
      console.error(err);
      alert('Ошибка сохранения объявления: ' + err.message);
    }
  });
}

document.addEventListener('DOMContentLoaded', initAdFormPage);