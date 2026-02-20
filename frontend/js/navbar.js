// frontend/js/navbar.js
document.addEventListener("DOMContentLoaded", () => {
  const profileBtn = document.getElementById("profile-btn");
  const dropdown = document.getElementById("profile-dropdown");

  // Support both localStorage and sessionStorage
  const safeParse = (s) => {
    try { return s ? JSON.parse(s) : null; } catch { return null; }
  };

  const storedUser =
    safeParse(localStorage.getItem("gd_user")) ||
    safeParse(sessionStorage.getItem("gd_user"));

  const navGuest = document.getElementById("nav-guest");
  const navUser = document.getElementById("nav-user");

  if (!storedUser) {
    navGuest?.classList.remove("hidden");
    navUser?.classList.add("hidden");
    return;
  }

  // Logged in state
  navGuest?.classList.add("hidden");
  navUser?.classList.remove("hidden");
  navUser?.classList.add("flex");

  // Initials
  const name = storedUser.name || "";
  const initials =
    name.trim()
      ? name.trim().split(/\s+/).slice(0, 2).map(w => w[0]?.toUpperCase() || "").join("")
      : "U";

  if (profileBtn) profileBtn.textContent = initials;

  const userNameEl = document.getElementById("user-name");
  const userEmailEl = document.getElementById("user-email");
  if (userNameEl) userNameEl.textContent = storedUser.name || "User";
  if (userEmailEl) userEmailEl.textContent = storedUser.email || "";

  const role = (storedUser.role || "").toLowerCase();
  applyRolePermissions(role);

  // Driver points UI (only if present)
  if (role === "driver") {
    const points = storedUser.points || 0;
    const pointsElement = document.getElementById("user-points");
    const progressElement = document.getElementById("points-progress");
    if (pointsElement) pointsElement.textContent = Number(points).toLocaleString();
    if (progressElement) {
      const percentage = Math.min((Number(points) / 1000) * 100, 100);
      setTimeout(() => (progressElement.style.width = `${percentage}%`), 200);
    }
  }

  // ✅ Sponsor dropdown link changes
  // This finds the existing "Application Status" link (view-status.html) and rewrites it for sponsors.
  const statusLink = document.querySelector('a[href="view-status.html"]');
  if (role === "sponsor" || role === "sponsor_user") {
    if (statusLink) {
      statusLink.textContent = "Application View";
      statusLink.href = "sponsor_applications.html";
    }
  } else if (role === "driver") {
    if (statusLink) {
      statusLink.textContent = "Application Status";
      statusLink.href = "view-status.html";
    }
  } else if (role === "admin") {
    // optional: hide status link for admins
    statusLink?.classList.add("hidden");
  }

  // Dropdown toggle
  profileBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown?.classList.toggle("hidden");
  });

  // Click outside closes dropdown
  window.addEventListener("click", () => {
    if (dropdown && !dropdown.classList.contains("hidden")) dropdown.classList.add("hidden");
  });

  // Logout clears both storages
  document.getElementById("logout-btn")?.addEventListener("click", () => {
    localStorage.removeItem("gd_user");
    sessionStorage.removeItem("gd_user");
    window.location.href = "index.html";
  });

  // frontend/js/navbar.js

  async function updatePointsDisplay(userId) {
    try {
      const response = await fetch(`${CONFIG.API_BASE_URL}/points/${userId}`);
      if (!response.ok) return;

      const data = await response.json();
      const points = data.total_points || 0;

      const dropdownPointsEl = document.getElementById("dropdown-points");
      if (dropdownPointsEl) {
          dropdownPointsEl.textContent = points;
      }

      const storeBalanceEl = document.getElementById("display-points");
      if (storeBalanceEl) {
          storeBalanceEl.textContent = points;
      }
    } catch (err) {
      console.error("Failed to fetch points:", err);
    }
  }

  if (storedUser && storedUser.role === "driver") {
      // Note: ensure your storedUser object has the numeric 'id' field
      updatePointsDisplay(storedUser.id); 
  }

});

function applyRolePermissions(role) {
  document.querySelectorAll(".role-specific").forEach((el) => el.classList.add("hidden"));
  if (role) document.querySelectorAll(`.role-${role}`).forEach((el) => el.classList.remove("hidden"));
}
