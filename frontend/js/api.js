// frontend/js/api.js
// Lightweight API helper for the static frontend pages. Uses jQuery AJAX when available
// and falls back to fetch() everywhere else.
(() => {
  function getApiBase() {
    let configBase = "http://127.0.0.1:8000";
    if (window.CONFIG && window.CONFIG.API_BASE_URL) {
      configBase = window.CONFIG.API_BASE_URL;
    }
    return String(configBase).replace(/\/+$/, "");
  }

  function normalizePath(path) {
    return path.startsWith("/") ? path : `/${path}`;
  }

  function parseTextPayload(text) {
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch (_) {
      return text;
    }
  }

  async function requestWithFetch(url, options = {}) {
    const { method = "GET", body, headers = {} } = options;
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

    const res = await fetch(url, opts);
    const text = await res.text();
    const data = parseTextPayload(text);

    if (!res.ok) {
      const err = new Error("API request failed");
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  function requestWithJQuery(url, options = {}) {
    const { method = "GET", body, headers = {} } = options;
    return new Promise((resolve, reject) => {
      $.ajax({
        url,
        method,
        headers,
        contentType: "application/json",
        dataType: "text",
        data: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
        processData: false,
        success: (responseText) => {
          resolve(parseTextPayload(responseText));
        },
        error: (xhr, _statusText, errorThrown) => {
          const err = new Error(errorThrown || "API request failed");
          err.status = xhr?.status;
          err.data = parseTextPayload(xhr?.responseText || "");
          reject(err);
        },
      });
    });
  }

  async function request(path, options = {}) {
    const url = `${getApiBase()}${normalizePath(path)}`;

    try {
      if (window.jQuery) {
        return await requestWithJQuery(url, options);
      }
      return await requestWithFetch(url, options);
    } catch (error) {
      console.error(`API Error on ${path}:`, error);
      throw error;
    }
  }

  window.API = { request };
})();
