// config.js (at project web root)
(function () {
  const isLocal =
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1";

  // IMPORTANT: must be accessible globally
  window.__API_BASE__ = isLocal
    ? "http://127.0.0.1:8000"
    : "http://team18-env.eba-wdekfmiy.us-east-1.elasticbeanstalk.com";

  console.log("Running with API URL:", window.__API_BASE__);
})();