const AUTH_KEY = 'currentUser';

function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem(AUTH_KEY)) || null;
  } catch {
    return null;
  }
}

function logout() {
  localStorage.removeItem(AUTH_KEY);
  localStorage.removeItem('authToken');
  window.location.href = '/index.html';
}

function authHeaders(extra = {}) {
  const token = localStorage.getItem('authToken');
  return token
    ? { ...extra, Authorization: `Bearer ${token}` }
    : { ...extra };
}

function updateHeaderAuthState() {
  const user = getCurrentUser();

  const loginBtn = document.getElementById('headerLoginBtn');
  const profileBtn = document.getElementById('headerProfileBtn');
  const logoutBtn = document.getElementById('headerLogoutBtn');

  if (!loginBtn && !profileBtn && !logoutBtn) return;

  if (user) {
    if (loginBtn) loginBtn.style.display = 'none';

    if (profileBtn) {
      profileBtn.style.display = 'inline-flex';
      profileBtn.textContent =
        (user.firstname && user.firstname.trim()) ||
        (user.email || 'Личный кабинет');
      profileBtn.onclick = () => {
        window.location.href = '/profile.html';
      };
    }

    if (logoutBtn) {
      logoutBtn.style.display = 'inline-flex';
      logoutBtn.onclick = logout;
    }
  } else {
    if (loginBtn) {
      loginBtn.style.display = 'inline-flex';
      loginBtn.textContent = 'Вход';
      loginBtn.onclick = () => {
        window.location.href = '/login.html';
      };
    }

    if (profileBtn) {
      profileBtn.style.display = 'none';
      profileBtn.onclick = null;
    }

    if (logoutBtn) {
      logoutBtn.style.display = 'none';
      logoutBtn.onclick = null;
    }
  }
}

document.addEventListener('DOMContentLoaded', updateHeaderAuthState);

window.appAuth = {
  getCurrentUser,
  logout,
  updateHeaderAuthState,
  authHeaders,
};
