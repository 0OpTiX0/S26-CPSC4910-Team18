// frontend/js/apply-to-sponsor.js
document.addEventListener("DOMContentLoaded", () => {
    const applyButtons = document.querySelectorAll(".apply-btn");
    
    const user = JSON.parse(localStorage.getItem("gd_user") || sessionStorage.getItem("gd_user"));

    applyButtons.forEach(button => {
        button.addEventListener("click", async (e) => {
            if (!user) {
                alert("Please log in first.");
                window.location.href = "login.html";
                return;
            }
            if (user.role !== "driver") {
                alert("Only drivers can apply for sponsorship.");
                return;
            }

            const sponsorId = e.target.getAttribute("data-sponsor-id");
            
            const originalText = button.textContent;
            button.textContent = "Sending...";
            button.disabled = true;

            try {
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
                    alert("Application submitted successfully!");
                    button.textContent = "Applied";
                    button.classList.replace("bg-blue-600", "bg-slate-400");
                } else {
                    const err = await response.json();
                    alert(`Error: ${err.detail || "Failed to submit"}`);
                    button.textContent = originalText;
                    button.disabled = false;
                }
            } catch (error) {
                console.error("Connection error:", error);
                alert("Could not connect to the rewards server.");
                button.textContent = originalText;
                button.disabled = false;
            }
        });
    });
});