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

  document.getElementById("reject-cancel")?.addEventListener("click", closeRejectModal);

  document.getElementById("reject-confirm")?.addEventListener("click", async () => {
    const reason = getRejectReason();
    if (!reason) return;
    if (!pendingRejectApp?.ApplicationID) return;

    try {
      await decide(pendingRejectApp, "Rejected", reason);
      closeRejectModal();
      await load(); // refresh list
    } catch (e) {
      alert("Failed to reject application.");
    }
  });

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
    try { return JSON.parse(sessionStorage.getItem("gd_user") || "null"); } catch { return null; }
  }

  function requireSponsor(session) {
    const role = window.GDUserView?.getEffectiveRole(session) || (session?.role || '').toLowerCase();
    return role === 'sponsor' || role === 'sponsor_user';
  }

  let pendingRejectApp = null;

  function openRejectModal(app) {
    pendingRejectApp = app;

    const modal = document.getElementById("reject-modal");
    const reasonEl = document.getElementById("reject-reason");
    const errEl = document.getElementById("reject-error");

    if (!modal || !reasonEl || !errEl) return;

    reasonEl.value = "";
    errEl.classList.add("hidden");
    modal.classList.remove("hidden");
    reasonEl.focus();
  }

  function closeRejectModal() {
    pendingRejectApp = null;
    const modal = document.getElementById("reject-modal");
    if (modal) modal.classList.add("hidden");
  }

  function getRejectReason() {
    const reasonEl = document.getElementById("reject-reason");
    const errEl = document.getElementById("reject-error");
    const reason = (reasonEl?.value || "").trim();

    if (reason.length < 3) {
      if (errEl) errEl.classList.remove("hidden");
      return null;
    }
    if (errEl) errEl.classList.add("hidden");
    return reason;
  }

  async function lookupSponsorId(user) {
    const sponsor = await window.GDUserView.resolveSponsorContext(user);

    const sponsorId = sponsor?.Sponsor_ID ?? sponsor?.sponsor_id;
    const sponsorEmail = sponsor?.Sponsor_Email ?? sponsor?.sponsor_email ?? user?.email;

    if (!sponsorId) {
      console.error('lookupSponsorId sponsor object:', sponsor);
      throw new Error('Sponsor record missing Sponsor_ID');
    }

    return { sponsorId, sponsorEmail, sponsor };
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
        await decide(a, "Approved");
      });
      card.querySelector('[data-act="reject"]')?.addEventListener("click", async () => {
        openRejectModal(a);
      });

      listEl.appendChild(card);
    }
  }

  async function decide(app, decision, rejectionReason = "") {
    const applicationId = app?.ApplicationID;
    if (!applicationId || !decision) return;

    const session = getSession();

    try {
      setStatus(`${decision}…`);

      // Resolve the real sponsor from sponsor_user
      const sponsor = await window.GDUserView?.resolveSponsorContext?.(session);

      // 👇 Use Sponsor_Name ONLY
      const adminName =
        (sponsor?.Sponsor_Name || sponsor?.sponsor_name || "").trim() ||
        "Sponsor";

      const qs = new URLSearchParams();
      qs.set("decision", decision);
      qs.set("admin_name", adminName);

      if (decision === "Rejected") {
        qs.set("rejection_reason", rejectionReason || "");
      }

      await window.API.request(`/application/${applicationId}?${qs.toString()}`, {
        method: "PATCH",
      });

      // If approved, enroll the driver with this sponsor using PATCH /driver
      if (decision === "Approved") {
        const driverId = app?.UserID;
        const sponsorId = app?.Sponsor_ID;
        if (driverId && sponsorId) {
          await window.API.request("/driver", {
            method: "PATCH",
            body: {
              driver_id: driverId,
              sponsor_id: sponsorId,
            },
          });
        }
      }


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
      const { sponsorId } = await lookupSponsorId(session);
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
    sessionStorage.removeItem("gd_user");
    window.location.href = "login.html";
  });

  load();
})();
