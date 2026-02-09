// frontend/js/sponsor-applications.js
(() => {
  const whoEl = document.getElementById("whoami");
  const listEl = document.getElementById("appsList");
  const emptyEl = document.getElementById("emptyState");
  const statusEl = document.getElementById("pageStatus");
  const countEl = document.getElementById("countPill");

  const statusFilter = document.getElementById("statusFilter");
  const emailSearch = document.getElementById("emailSearch");
  const refreshBtn = document.getElementById("refreshBtn");
  const exportBtn = document.getElementById("exportBtn");
  const logoutBtn = document.getElementById("logoutBtn");

  function setStatus(msg, isError=false) {
    if (!statusEl) return;
    statusEl.textContent = msg;
    statusEl.classList.remove("hidden");
    statusEl.classList.toggle("text-red-600", !!isError);
    statusEl.classList.toggle("text-slate-600", !isError);
  }

  function clearStatus() {
    if (!statusEl) return;
    statusEl.classList.add("hidden");
    statusEl.textContent = "";
  }

  function escapeHtml(s) {
    return String(s ?? "").replace(/[&<>"']/g, (c) => ({
      "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"
    }[c]));
  }

  function fmtDate(iso) {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return String(iso);
    return d.toLocaleString();
  }

  function getSession() {
    try { return JSON.parse(localStorage.getItem("gd_user") || "null"); } catch { return null; }
  }

  function requireSponsor(session) {
    const role = (session?.role || "").toLowerCase();
    return role === "sponsor" || role === "sponsor_user";
  }

async function lookupSponsorId(email) {
  const sponsors = await window.API.request(`/sponsors?sponsorEmail=${encodeURIComponent(email)}`);

  if (!Array.isArray(sponsors) || sponsors.length === 0) {
    throw new Error("No sponsor record found for this email.");
  }

  // Support both Sponsor_Email and sponsor_email (and ID variants)
  const getEmail = (s) =>
    (s.Sponsor_Email ?? s.sponsor_email ?? s.sponsorEmail ?? "").toLowerCase();

  const getId = (s) =>
    s.Sponsor_ID ?? s.sponsor_id ?? s.sponsorId;

  const exact = sponsors.find((s) => getEmail(s) === email.toLowerCase());
  const sponsor = exact || sponsors[0];

  const sponsorId = getId(sponsor);
  if (!sponsorId) throw new Error("Sponsor record missing Sponsor_ID.");

  return sponsorId;
}


  async function fetchApps({ sponsorId, status, applicantEmail }) {
    const qs = new URLSearchParams();
    if (sponsorId != null) qs.set("sponsor_id", String(sponsorId));
    if (status) qs.set("status", status);
    if (applicantEmail) qs.set("applicant_email", applicantEmail);
    return await window.API.request(`/application?${qs.toString()}`);
  }

  function renderApps(apps) {
    if (!listEl) return;

    listEl.innerHTML = "";
    const count = Array.isArray(apps) ? apps.length : 0;
    if (countEl) countEl.textContent = String(count);

    if (!apps || apps.length === 0) {
      emptyEl?.classList.remove("hidden");
      return;
    }
    emptyEl?.classList.add("hidden");

    for (const a of apps) {
      const card = document.createElement("div");
      card.className = "bg-white rounded-2xl shadow-sm border border-slate-100 p-5";

      const status = a?.Applicant_Status ?? "—";
      const badgeClass =
        status === "Approved" ? "bg-green-100 text-green-700" :
        status === "Rejected" ? "bg-red-100 text-red-700" :
        "bg-amber-100 text-amber-800";

      card.innerHTML = `
        <div class="flex items-start justify-between gap-3">
          <div>
            <p class="text-xs font-semibold text-slate-500 uppercase tracking-wide">Applicant</p>
            <p class="text-lg font-bold break-all">${escapeHtml(a?.Applicant_Email || "—")}</p>
            <p class="text-sm text-slate-600 mt-1">Phone: ${escapeHtml(a?.Applicant_Phone_Num || "—")}</p>
          </div>
          <span class="text-xs font-bold px-3 py-1 rounded-full ${badgeClass}">
            ${escapeHtml(status)}
          </span>
        </div>

        <div class="mt-4 grid grid-cols-2 gap-3 text-sm">
          <div class="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <p class="text-xs font-semibold text-slate-500">Submitted</p>
            <p class="font-semibold text-slate-800">${escapeHtml(fmtDate(a?.Submitted_At))}</p>
          </div>
          <div class="bg-slate-50 rounded-xl p-3 border border-slate-100">
            <p class="text-xs font-semibold text-slate-500">Application #</p>
            <p class="font-semibold text-slate-800">${escapeHtml(a?.ApplicationID ?? "—")}</p>
          </div>
        </div>

        <div class="mt-4 flex flex-wrap gap-2">
          <button data-act="approve" class="px-4 py-2 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 active:scale-[0.98]">
            Approve
          </button>
          <button data-act="reject" class="px-4 py-2 rounded-xl border border-slate-200 bg-white font-semibold hover:bg-slate-50 active:scale-[0.98]">
            Reject
          </button>
        </div>
      `;

      // Action handlers (uses existing PATCH /application/{id}?decision=...)
      card.querySelector('[data-act="approve"]')?.addEventListener("click", async () => {
        await decide(a?.ApplicationID, "Approved");
      });
      card.querySelector('[data-act="reject"]')?.addEventListener("click", async () => {
        await decide(a?.ApplicationID, "Rejected");
      });

      listEl.appendChild(card);
    }
  }

  async function decide(applicationId, decision) {
    if (!applicationId) return;
    try {
      setStatus(`${decision}…`);
      await window.API.request(`/application/${applicationId}?decision=${encodeURIComponent(decision)}`, {
        method: "PATCH",
      });
      setStatus(`Application ${decision.toLowerCase()} successfully.`);
      await load();
    } catch (err) {
      console.error(err);
      setStatus("Could not update application status.", true);
    }
  }

  function toCsv(apps) {
    const rows = [
      ["ApplicationID", "Applicant_Email", "Applicant_Phone_Num", "Applicant_Status", "Submitted_At", "Sponsor_ID"],
      ...(apps || []).map(a => [
        a?.ApplicationID ?? "",
        a?.Applicant_Email ?? "",
        a?.Applicant_Phone_Num ?? "",
        a?.Applicant_Status ?? "",
        a?.Submitted_At ?? "",
        a?.Sponsor_ID ?? "",
      ]),
    ];
    return rows.map(r => r.map(cell => {
      const s = String(cell ?? "");
      return /[",\n]/.test(s) ? `"${s.replace(/"/g,'""')}"` : s;
    }).join(",")).join("\n");
  }

  function download(filename, text) {
    const blob = new Blob([text], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  let _lastApps = [];

  async function load() {
    clearStatus();
    const session = getSession();
    if (!session || !requireSponsor(session)) {
      setStatus("You must be logged in as a sponsor to view applications.", true);
      // Option A requirement: don't force user to pick a type at login; redirect back to login if not sponsor.
      setTimeout(() => (window.location.href = "login.html"), 900);
      return;
    }

    if (whoEl) {
      whoEl.textContent = `${session.name || "Sponsor User"} • ${session.email || ""}`;
      whoEl.classList.remove("hidden");
    }

    try {
      setStatus("Loading applications…");
      const sponsorId = await lookupSponsorId(session.email);
      const status = statusFilter?.value || "";
      const applicant = (emailSearch?.value || "").trim();

      const apps = await fetchApps({ sponsorId, status, applicantEmail: applicant || "" });
      _lastApps = Array.isArray(apps) ? apps : [];
      renderApps(_lastApps);
      setStatus(`Loaded ${_lastApps.length} application(s).`);
    } catch (err) {
      console.error(err);
      setStatus("Failed to load applications. Check API_BASE and backend logs.", true);
    }
  }

  refreshBtn?.addEventListener("click", load);
  statusFilter?.addEventListener("change", load);
  exportBtn?.addEventListener("click", () => {
    const csv = toCsv(_lastApps);
    const stamp = new Date().toISOString().slice(0,19).replace(/[:T]/g,"-");
    download(`applications-${stamp}.csv`, csv);
  });

  logoutBtn?.addEventListener("click", () => {
    localStorage.removeItem("gd_user");
    window.location.href = "login.html";
  });

  load();
})();
