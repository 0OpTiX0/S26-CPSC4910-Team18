document.addEventListener("DOMContentLoaded", () => {
  const applyButtons = document.querySelectorAll(".apply-btn");
  const user = JSON.parse(sessionStorage.getItem("gd_user"));

  applyButtons.forEach(button => {
    button.addEventListener("click", async (e) => {
      if (!user || user.role !== "driver") {
        alert("Only drivers can apply for sponsorship.");
        return;
      }

      const sponsorEmail = e.target.getAttribute("data-sponsor-email");
      const phone =
        user.phone ||
        user.User_Phone_Num ||
        user.user_phone_num ||
        user.User_Phone ||
        "";

      button.disabled = true;
      button.textContent = "Submitting...";

      try {
        await window.API.request("/application", {
          method: "POST",
          body: {
            appEmail: user.email,
            sponsEmail: sponsorEmail,
            appPhoneNum: phone
          }
        });

        alert("Application submitted! The sponsor has been notified.");
        button.textContent = "Applied";
        button.classList.add("bg-slate-400");
      } catch (error) {
        console.error("Connection error:", error);
        alert(error?.data?.detail || error?.message || "Server connection failed.");
        button.disabled = false;
        button.textContent = "Apply to Sponsor";
      }
    });
  });
});