// frontend/config.js
const CONFIG = {
    API_BASE_URL: window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1"
        ? "http://127.0.0.1:8000" // Your local FastAPI
        : "http://team18-env.eba-wdekfmiy.us-east-1.elasticbeanstalk.com" // Your EB Backend
};

console.log("Running with API URL:", CONFIG.API_BASE_URL);