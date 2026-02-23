// config.js (at project web root)
(function () {
  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  // We attach it to window.CONFIG so other scripts can find it
  window.CONFIG = {
    API_BASE_URL: isLocal
      ? "http://127.0.0.1:8000"
      : "http://team18-env.eba-wdekfmiy.us-east-1.elasticbeanstalk.com"
  };

  console.log("CONFIG initialized. API URL:", window.CONFIG.API_BASE_URL);
})();