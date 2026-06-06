const API_BASE = '/api';

async function request(path, options = {}) {
  const response = await fetch(API_BASE + path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `API error: ${response.status}`);
  return data;
}

function saveSession(data) {
  localStorage.setItem('authToken', data.token);
  localStorage.setItem('currentUser', JSON.stringify(data.user));
  window.appAuth?.updateHeaderAuthState();
}

function initRegisterPage() {
  const form = document.getElementById('registerForm');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const body = {
      email: document.getElementById('regEmail').value.trim(),
      password: document.getElementById('regPassword').value,
      firstname: document.getElementById('regFirstname').value.trim(),
      lastname: document.getElementById('regLastname').value.trim(),
      phone: document.getElementById('regPhone').value.trim(),
    };

    if (!body.email || body.password.length < 8) {
      alert('Введите корректный email и пароль длиной не менее 8 символов');
      return;
    }

    try {
      saveSession(await request('/auth/register', {
        method: 'POST',
        body: JSON.stringify(body),
      }));
      window.location.href = '/profile.html';
    } catch (error) {
      alert('Ошибка регистрации: ' + error.message);
    }
  });
}

function initLoginPage() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    try {
      saveSession(await request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: document.getElementById('loginEmail').value.trim(),
          password: document.getElementById('loginPassword').value,
        }),
      }));
      window.location.href = '/profile.html';
    } catch (error) {
      alert(error.message === 'invalid_credentials'
        ? 'Неверный email или пароль'
        : 'Ошибка входа: ' + error.message);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  initRegisterPage();
  initLoginPage();
});
