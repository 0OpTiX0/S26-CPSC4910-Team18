// frontend/js/notifications.js
(() => {
  const DISMISSED_KEY = "gd_dismissed_notifications_v1"; // session-scoped

  function getUser() {
    try {
      return JSON.parse(sessionStorage.getItem("gd_user") || "null");
    } catch {
      return null;
    }
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }[c]));
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    return Number.isNaN(d.getTime()) ? String(iso) : d.toLocaleString();
  }

  function getDismissedSet(userId) {
    try {
      const raw = sessionStorage.getItem(DISMISSED_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      const arr = Array.isArray(obj?.[userId]) ? obj[userId] : [];
      return new Set(arr.map(String));
    } catch {
      return new Set();
    }
  }

  function saveDismissedSet(userId, set) {
    try {
      const raw = sessionStorage.getItem(DISMISSED_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      obj[userId] = Array.from(set);
      sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(obj));
    } catch {
      // ignore
    }
  }

  function clearDismissed(userId) {
    try {
      const raw = sessionStorage.getItem(DISMISSED_KEY);
      const obj = raw ? JSON.parse(raw) : {};
      delete obj[userId];
      sessionStorage.setItem(DISMISSED_KEY, JSON.stringify(obj));
    } catch {
      // ignore
    }
  }

  async function fetchNotifications(userId) {
    // GET /notifications/{user_id}
    return await window.API.request(`/notifications/${userId}`);
  }

  async function markRead(notificationId) {
    // PATCH /notifications/{id}/read
    return await window.API.request(`/notifications/${notificationId}/read`, { method: "PATCH" });
  }

  async function renderBell() {
    const host = document.getElementById("notifHost");
    if (!host) return;

    const user = getUser();
    if (!user?.userId) {
      host.innerHTML = "";
      return;
    }

    // persisted UI preference (unread-only toggle)
    const PREF_KEY = `gd_notif_unread_only_${user.userId}`;
    const unreadOnlyPref = sessionStorage.getItem(PREF_KEY);
    let unreadOnly = unreadOnlyPref == null ? true : unreadOnlyPref === "true";

    let notifs = [];
    try {
      notifs = await fetchNotifications(user.userId);
      if (!Array.isArray(notifs)) notifs = [];
    } catch (e) {
      console.error("Failed to load notifications", e);
      notifs = [];
    }

    const dismissed = getDismissedSet(String(user.userId));

    // Filter dismissed (frontend-only)
    const notifsNotDismissed = notifs.filter((n) => !dismissed.has(String(n?.NotificationID)));

    // Unread count should ignore dismissed items (so the badge matches what user sees)
    const unreadCount = notifsNotDismissed.filter((n) => !n?.Is_Read).length;

    // Visible list depends on unread-only toggle
    const visibleNotifs = unreadOnly
      ? notifsNotDismissed.filter((n) => !n?.Is_Read)
      : notifsNotDismissed;

    host.innerHTML = `
      <button id="notifBtn" class="relative w-10 h-10 rounded-xl hover:bg-slate-100 flex items-center justify-center">
        🔔
        ${unreadCount ? `<span class="absolute -top-1 -right-1 text-xs bg-red-600 text-white rounded-full px-2 py-0.5">${unreadCount}</span>` : ""}
      </button>

      <div id="notifMenu" class="hidden absolute right-0 mt-2 w-[28rem] bg-white border border-slate-200 rounded-2xl shadow-lg overflow-hidden z-50">
        <div class="px-4 py-3 border-b border-slate-100">
          <div class="flex items-center justify-between">
            <div class="font-semibold">Notifications</div>
            <button id="notifMarkAll" class="text-sm text-blue-600 hover:underline">Mark all read</button>
          </div>

          <div class="mt-3 flex items-center justify-between gap-3">
            <label class="flex items-center gap-2 text-sm text-slate-700 select-none">
              <input id="notifUnreadOnly" type="checkbox" class="accent-blue-600" ${unreadOnly ? "checked" : ""}/>
              Unread only
            </label>

            <button id="notifClearDismissed" class="text-sm text-slate-600 hover:underline">
              Clear dismissed
            </button>
          </div>
        </div>

        <div class="max-h-96 overflow-auto">
          ${
            visibleNotifs.length
              ? visibleNotifs.map((n) => {
                  const id = n.NotificationID;
                  const isRead = !!n.Is_Read;
                  const type = n.Type || "Info";
                  const msg = n.Message || "";
                  const created = n.Created_At;

                  return `
                    <div class="px-4 py-3 border-b border-slate-50 hover:bg-slate-50 ${isRead ? "opacity-60" : ""}">
                      <div class="flex items-start justify-between gap-3">
                        <button data-id="${id}" class="notifItem text-left flex-1">
                          <div class="text-xs text-slate-500">${escapeHtml(fmtDate(created))} • ${escapeHtml(type)}</div>
                          <div class="text-sm text-slate-900">${escapeHtml(msg)}</div>
                          ${!isRead ? `<div class="mt-1 text-xs text-blue-600">Click to mark read</div>` : ""}
                        </button>

                        <button
                          data-dismiss-id="${id}"
                          class="dismissBtn text-xs px-2 py-1 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 text-slate-700"
                          title="Dismiss (frontend only)"
                        >
                          Dismiss
                        </button>
                      </div>
                    </div>
                  `;
                }).join("")
              : `<div class="px-4 py-8 text-sm text-slate-500 text-center">No notifications${unreadOnly ? " (unread)" : ""}.</div>`
          }
        </div>
      </div>
    `;

    const btn = document.getElementById("notifBtn");
    const menu = document.getElementById("notifMenu");
    const markAllBtn = document.getElementById("notifMarkAll");
    const unreadOnlyEl = document.getElementById("notifUnreadOnly");
    const clearDismissedBtn = document.getElementById("notifClearDismissed");

    btn?.addEventListener("click", (e) => {
      e.stopPropagation();
      menu?.classList.toggle("hidden");
    });

    // Toggle unread-only preference
    unreadOnlyEl?.addEventListener("change", async () => {
      unreadOnly = !!unreadOnlyEl.checked;
      sessionStorage.setItem(PREF_KEY, String(unreadOnly));
      await renderBell();
    });

    // Click notification -> mark read -> re-render
    host.querySelectorAll(".notifItem").forEach((el) => {
      el.addEventListener("click", async () => {
        const id = el.getAttribute("data-id");
        if (!id) return;
        try {
          await markRead(id);
          await renderBell();
        } catch (e) {
          console.error("Failed to mark read", e);
        }
      });
    });

    // Dismiss (frontend-only)
    host.querySelectorAll(".dismissBtn").forEach((el) => {
      el.addEventListener("click", async (e) => {
        e.stopPropagation();
        const id = el.getAttribute("data-dismiss-id");
        if (!id) return;
        const set = getDismissedSet(String(user.userId));
        set.add(String(id));
        saveDismissedSet(String(user.userId), set);
        await renderBell();
      });
    });

    // Mark all read (backend)
    markAllBtn?.addEventListener("click", async (e) => {
      e.stopPropagation();
      const unreadItems = notifsNotDismissed.filter((n) => !n?.Is_Read && n?.NotificationID != null);
      try {
        await Promise.all(unreadItems.map((n) => markRead(n.NotificationID)));
        await renderBell();
      } catch (e2) {
        console.error("Failed to mark all read", e2);
      }
    });

    // Clear dismissed (frontend-only)
    clearDismissedBtn?.addEventListener("click", async (e) => {
      e.stopPropagation();
      clearDismissed(String(user.userId));
      await renderBell();
    });

    // Click outside closes menu (attach once per render; OK for your scale)
    document.addEventListener("click", () => menu?.classList.add("hidden"), { once: true });
  }

  window.GDNotifications = { renderBell };

  document.addEventListener("DOMContentLoaded", () => {
    const tryInit = () => {
      if (window.API?.request) renderBell();
      else setTimeout(tryInit, 100);
    };
    tryInit();
  });
})();