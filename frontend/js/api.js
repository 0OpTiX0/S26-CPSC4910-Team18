// frontend/js/api.js
// Lightweight API helper for the static frontend pages.
(() => {
  /**
   * Helper to perform API requests using the global CONFIG object.
   */
  async function request(path, options = {}) {
    const { method = "GET", body, headers = {} } = options;

    let configBase = "http://127.0.0.1:8000";
    if (window.CONFIG && window.CONFIG.API_BASE_URL) {
      configBase = window.CONFIG.API_BASE_URL;
    }

    const API_BASE = configBase.replace(/\/+$/, "");
    
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
      } catch (parseError) { 
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
    request: request
  };
})();