document.addEventListener("DOMContentLoaded", () => {
    loadSponsors();

    const user = JSON.parse(sessionStorage.getItem("gd_user"));

    document.addEventListener("click", async (e) => {
        if (e.target && e.target.classList.contains("apply-btn")) {
            const button = e.target;

            if (!user) {
                alert("Please log in first.");
                window.location.href = "login.html";
                return;
            }

            const effectiveRole = window.GDUserView?.getEffectiveRole(user) || user.role;
            const driverViewActive = !!window.GDUserView?.isDriverViewActive?.(user);

            if (effectiveRole !== "driver") {
                alert("Only drivers can apply for sponsorship.");
                return;
            }

            if (driverViewActive) {
                alert("Driver View is for preview only. Sponsor users cannot submit driver applications.");
                return;
            }

            const sponsorEmail = button.getAttribute("data-sponsor-email");
            const originalText = button.textContent;

            button.textContent = "Sending...";
            button.disabled = true;

            try {
                const phone =
                    user.phone ||
                    user.User_Phone_Num ||
                    user.user_phone_num ||
                    user.User_Phone ||
                    "";

                await window.API.request("/application", {
                    method: "POST",
                    body: {
                        appEmail: user.email,
                        sponsEmail: sponsorEmail,
                        appPhoneNum: phone
                    }
                });

                alert("Application submitted successfully!");
                button.textContent = "Applied";
                button.classList.replace("bg-blue-600", "bg-slate-400");
            } catch (error) {
                console.error("Connection error:", error);
                const msg =
                    error?.data?.detail ||
                    error?.message ||
                    "Could not connect to the rewards server.";
                alert(`Error: ${msg}`);
                button.textContent = originalText;
                button.disabled = false;
            }
        }
    });
});

async function loadSponsors() {
    const container = document.getElementById("sponsor-container");
    if (!container) return;

    try {
        const sponsors = await window.API.request("/sponsors");

        container.innerHTML = "";

        if (!Array.isArray(sponsors) || sponsors.length === 0) {
            container.innerHTML = `<p class="col-span-2 text-center text-slate-500 py-10">No active sponsor programs found.</p>`;
            return;
        }

        sponsors.forEach((sponsor) => {
            const cardHTML = `
                <div class="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all group">
                    <div class="h-32 bg-slate-900 p-6 flex items-end relative">
                        <div class="w-16 h-16 bg-white rounded-2xl shadow-lg flex items-center justify-center translate-y-8 border border-slate-100">
                            <span class="text-2xl font-black text-slate-900">${sponsor.Sponsor_Name.charAt(0)}</span>
                        </div>
                    </div>
                    <div class="p-6 pt-12">
                        <h3 class="text-xl font-bold text-slate-900">${sponsor.Sponsor_Name}</h3>
                        <p class="text-sm text-slate-500 mt-1">${sponsor.Sponsor_Description || "Join our program to earn exclusive rewards."}</p>

                        <div class="mt-6 space-y-3">
                            <div class="flex items-center gap-2 text-sm text-emerald-600 font-semibold">
                                <span class="bg-emerald-100 p-1 rounded-md">✓</span>
                                Official Sponsor
                            </div>
                        </div>

                        <button
                            data-sponsor-id="${sponsor.Sponsor_ID}"
                            data-sponsor-email="${sponsor.Sponsor_Email || ""}"
                            class="apply-btn w-full mt-6 bg-blue-600 text-white font-bold py-4 rounded-2xl hover:bg-blue-700 transition-all active:scale-95">
                            Apply to Sponsor
                        </button>
                    </div>
                </div>
            `;
            container.insertAdjacentHTML("beforeend", cardHTML);
        });
    } catch (error) {
        console.error("Fetch error:", error);
        container.innerHTML = `<p class="col-span-2 text-center text-red-500 py-10">Unable to load sponsors. Please try again later.</p>`;
    }
}