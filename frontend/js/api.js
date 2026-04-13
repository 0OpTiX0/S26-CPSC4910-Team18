// frontend/js/api.js
(() => {
  function getApiBase() {
    const fromWindowConfig =
      window.CONFIG && window.CONFIG.API_BASE_URL
        ? window.CONFIG.API_BASE_URL
        : "";

    const fromGlobal =
      typeof window.__API_BASE__ === "string"
        ? window.__API_BASE__
        : "";

    const base =
      fromWindowConfig ||
      fromGlobal ||
      "http://127.0.0.1:8000";

    return base.replace(/\/+$/, "");
  }

  async function request(path, options = {}) {
    const { method = "GET", body, headers = {} } = options;

    const API_BASE = getApiBase();
    const cleanPath = path.startsWith("/") ? path : "/" + path;
    const url = `${API_BASE}${cleanPath}`;

    const opts = {
      method,
      headers: {
        "Content-Type": "application/json",
        ...headers,
      },
    };

    if (body !== undefined && body !== null) {
      opts.body = JSON.stringify(body);
    }

    try {
      const res = await fetch(url, opts);

      const text = await res.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }

      if (!res.ok) {
        const err = new Error("API request failed");
        err.status = res.status;
        err.data = data;
        throw err;
      }

      return data;
    } catch (error) {
      console.error(`API Error on ${path}:`, error);
      throw error;
    }
  }

  window.API = {
    request,
    get API_BASE() {
      return getApiBase();
    }
  };
})();