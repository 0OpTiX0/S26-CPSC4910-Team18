// frontend/js/api.js
// Lightweight API helper for the static frontend pages.
(() => {
  const fromStorage = () => {
    try { return localStorage.getItem("API_BASE") || ""; } catch { return ""; }
  };

  const guessSameOrigin = () => {
    // If the API is reverse-proxied behind the same origin, set API_BASE to window.location.origin.
    // Otherwise keep localhost as a safe dev default.
    return window.location.origin || "http://localhost:8000";
  };

  const API_BASE = (
    window.__API_BASE__ ||
    fromStorage() ||
    (guessSameOrigin() + "/api")
  ).replace(/\/+$/, "");

  async function request(path, { method = "GET", body, headers = {} } = {}) {
    const url = `${API_BASE}${path.startsWith("/") ? "" : "/"}${path}`;

    const opts = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };

    if (body !== undefined) opts.body = JSON.stringify(body);

    const res = await fetch(url, opts);
    const text = await res.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }

    if (!res.ok) {
      const err = new Error("API request failed");
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  }

  window.API = { API_BASE, request, guessSameOrigin };
})();
