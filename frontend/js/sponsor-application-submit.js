// js/sponsor-application-submit.js
document.addEventListener("DOMContentLoaded", () => {
  const applyButtons = document.querySelectorAll(".apply-btn");
  const user = JSON.parse(localStorage.getItem("gd_user"));

  applyButtons.forEach(button => {
    button.addEventListener("click", async (e) => {
      // 1. Verify Driver Role
      if (!user || user.role !== "driver") {
        alert("Only drivers can apply for sponsorship.");
        return;
      }

      const sponsorId = e.target.getAttribute("data-sponsor-id");
      button.disabled = true;
      button.textContent = "Submitting...";

      try {
        // 2. POST to your Elastic Beanstalk backend
        const response = await fetch(`${CONFIG.API_BASE_URL}/application`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            Sponsor_ID: parseInt(sponsorId),
            Applicant_Email: user.email,
            Applicant_Status: "Pending"
          })
        });

        if (response.ok) {
          alert("Application submitted! The sponsor has been notified.");
          button.textContent = "Applied";
          button.classList.add("bg-slate-400");
        } else {
          const err = await response.json();
          alert(`Error: ${err.detail || "Failed to submit"}`);
          button.disabled = false;
          button.textContent = "Apply to Sponsor";
        }
      } catch (error) {
        console.error("Connection error:", error);
        alert("Server connection failed.");
        button.disabled = false;
      }
    });
  });
});