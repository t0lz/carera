function getCurrentUser() {
  try {
    return JSON.parse(localStorage.getItem("currentUser")) || null;
  } catch {
    return null;
  }
}

function updateHeader() {
  const user = getCurrentUser();

  const btnLogin = document.getElementById("headerLoginBtn");
  const btnProfile = document.getElementById("headerProfileBtn");
  const btnLogout = document.getElementById("headerLogoutBtn");
  const adminLink = document.querySelector('[data-nav="admin"]');

  if (!btnLogin) return;

  if (user) {
    btnLogin.style.display = "none";
    btnProfile.style.display = "block";
    btnProfile.textContent = user.firstname || "Профиль";
    btnLogout.style.display = "block";

    if (adminLink && ["admin", "manager"].includes(user.role_name)) {
      adminLink.style.display = "block";
      adminLink.textContent = user.role_name === "manager" ? "Панель" : "Админка";
    }
  } else {
    btnLogin.style.display = "block";
    btnProfile.style.display = "none";
    btnLogout.style.display = "none";
    adminLink.style.display = "none";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  updateHeader();

  const btnLogin = document.getElementById("headerLoginBtn");
  const btnProfile = document.getElementById("headerProfileBtn");
  const btnLogout = document.getElementById("headerLogoutBtn");

  if (btnLogin) btnLogin.onclick = () => (location.href = "/login.html");
  if (btnProfile) btnProfile.onclick = () => (location.href = "/profile.html");
  if (btnLogout) btnLogout.onclick = () => {
    localStorage.removeItem("currentUser");
    localStorage.removeItem("authToken");
    location.href = "/index.html";
  };
});



