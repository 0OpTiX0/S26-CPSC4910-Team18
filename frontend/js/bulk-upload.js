(function () {
  function safeParse(s) {
    try { return s ? JSON.parse(s) : null; } catch { return null; }
  }

  function getStoredUser() {
    return safeParse(sessionStorage.getItem("gd_user")) || safeParse(localStorage.getItem("gd_user"));
  }

  function normalizeRole(role) {
    const r = String(role || "").trim().toLowerCase();
    if (r.includes("admin")) return "admin";
    if (r.includes("sponsor")) return "sponsor";
    if (r.includes("driver")) return "driver";
    return r;
  }

  function getMode(user) {
    const role = normalizeRole(user?.role);
    if (role === "admin") return "admin";
    if (role === "sponsor" || role === "sponsor_user") return "sponsor";
    return null;
  }

  function getApiBase() {
    return ((window.CONFIG && window.CONFIG.API_BASE_URL) || "http://127.0.0.1:8000").replace(/\/+$/, "");
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function showStatus(el, message, kind) {
    if (!el) return;
    el.textContent = message;
    el.classList.remove("hidden", "border-emerald-200", "bg-emerald-50", "text-emerald-800", "border-rose-200", "bg-rose-50", "text-rose-800", "border-slate-200", "bg-slate-50", "text-slate-700");
    if (kind === "success") {
      el.classList.add("border", "border-emerald-200", "bg-emerald-50", "text-emerald-800");
    } else if (kind === "error") {
      el.classList.add("border", "border-rose-200", "bg-rose-50", "text-rose-800");
    } else {
      el.classList.add("border", "border-slate-200", "bg-slate-50", "text-slate-700");
    }
  }

  function makeSample(mode) {
    if (mode === "admin") {
      return [
        "name,role,email,phone,pssw,sponsor_join",
        "Joe Driver,driver,joe.driver@email.com,8645551010,TempPass123!,James Company",
        "Jill Sponsor,sponsor,jill.sponsor@email.com,8645552020,TempPass123!,James Company",
        "Amy Admin,admin,amy.admin@email.com,8645553030,TempPass123!,"
      ].join("\n");
    }
    return [
      "name,role,email,phone,pssw",
      "Joe Driver,driver,joe.driver@email.com,8645551010,TempPass123!",
      "Jill Sponsor,sponsor,jill.sponsor@email.com,8645552020,TempPass123!"
    ].join("\n");
  }

  function downloadTemplate(filename, text) {
    const blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function uploadCsv(endpoint, file) {
    const formData = new FormData();
    formData.append("file", file);

    const response = await fetch(`${getApiBase()}${endpoint.startsWith("/") ? endpoint : `/${endpoint}`}`, {
      method: "POST",
      body: formData
    });

    const text = await response.text();
    let data;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = text;
    }

    if (!response.ok) {
      const err = new Error("Bulk upload failed");
      err.status = response.status;
      err.data = data;
      throw err;
    }

    return data;
  }

  function fillCreatedRows(rows) {
    const tbody = document.getElementById("created-body");
    if (!tbody) return;
    if (!Array.isArray(rows) || !rows.length) {
      tbody.innerHTML = '<tr><td colspan="4" class="px-4 py-5 text-slate-500">No users were created.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((row) => `
      <tr>
        <td class="px-4 py-3 font-semibold text-slate-700">${escapeHtml(row.line)}</td>
        <td class="px-4 py-3 text-slate-700">${escapeHtml(row.email)}</td>
        <td class="px-4 py-3"><span class="px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 text-xs font-bold">${escapeHtml(row.role)}</span></td>
        <td class="px-4 py-3 text-right font-semibold text-slate-900">${escapeHtml(row.userId)}</td>
      </tr>
    `).join("");
  }

  function fillErrorRows(rows) {
    const tbody = document.getElementById("error-body");
    if (!tbody) return;
    if (!Array.isArray(rows) || !rows.length) {
      tbody.innerHTML = '<tr><td colspan="3" class="px-4 py-5 text-slate-500">No row errors were returned.</td></tr>';
      return;
    }
    tbody.innerHTML = rows.map((row) => `
      <tr>
        <td class="px-4 py-3 font-semibold text-slate-700">${escapeHtml(row.line)}</td>
        <td class="px-4 py-3 text-slate-700">${escapeHtml(row.email || "—")}</td>
        <td class="px-4 py-3 text-rose-700">${escapeHtml(typeof row.error === "string" ? row.error : JSON.stringify(row.error))}</td>
      </tr>
    `).join("");
  }

  document.addEventListener("DOMContentLoaded", function () {
    const user = getStoredUser();
    const mode = getMode(user);

    if (!user || !mode) {
      window.location.href = "login.html";
      return;
    }

    const rolePill = document.getElementById("upload-role-pill");
    const allowedRoles = document.getElementById("allowed-roles");
    const endpointText = document.getElementById("endpoint-text");
    const sponsorJoinPill = document.getElementById("sponsor-join-pill");
    const fileInput = document.getElementById("csv-file");
    const fileName = document.getElementById("file-name");
    const uploadBtn = document.getElementById("upload-btn");
    const downloadBtn = document.getElementById("download-template");
    const previewBtn = document.getElementById("preview-template");
    const sampleWrap = document.getElementById("sample-wrap");
    const sampleLabel = document.getElementById("sample-label");
    const sampleText = document.getElementById("sample-text");
    const statusBox = document.getElementById("status-box");
    const resultsSection = document.getElementById("results-section");
    const createdCount = document.getElementById("created-count");
    const errorCount = document.getElementById("error-count");

    const endpoint = mode === "admin"
      ? "/admin/users/upload_csv"
      : `/sponsors/${encodeURIComponent(user.email || "")}/users/upload_csv`;

    if (rolePill) {
      rolePill.classList.remove("hidden");
      rolePill.textContent = mode === "admin" ? "Admin Upload" : "Sponsor Upload";
    }
    if (allowedRoles) {
      allowedRoles.textContent = mode === "admin"
        ? "Admins can upload driver, sponsor, and admin users."
        : "Sponsors can upload only driver and sponsor users for their own sponsor.";
    }
    if (endpointText) endpointText.textContent = endpoint;
    if (mode === "admin") sponsorJoinPill?.classList.remove("hidden");

    const sample = makeSample(mode);
    if (sampleText) sampleText.textContent = sample;
    if (sampleLabel) sampleLabel.textContent = mode === "admin" ? "Admin template" : "Sponsor template";

    fileInput?.addEventListener("change", function () {
      const file = fileInput.files && fileInput.files[0];
      if (fileName) fileName.textContent = file ? `${file.name} • ${Math.max(1, Math.round(file.size / 1024))} KB` : "No file selected";
      statusBox?.classList.add("hidden");
    });

    previewBtn?.addEventListener("click", function () {
      sampleWrap?.classList.toggle("hidden");
    });

    downloadBtn?.addEventListener("click", function () {
      downloadTemplate(mode === "admin" ? "admin_bulk_upload_template.csv" : "sponsor_bulk_upload_template.csv", sample);
    });

    uploadBtn?.addEventListener("click", async function () {
      const file = fileInput?.files?.[0];
      if (!file) {
        showStatus(statusBox, "Choose a CSV file first.", "error");
        return;
      }

      uploadBtn.disabled = true;
      uploadBtn.textContent = "Uploading…";
      showStatus(statusBox, "Uploading and processing file…", "info");

      try {
        const result = await uploadCsv(endpoint, file);
        resultsSection?.classList.remove("hidden");
        if (createdCount) createdCount.textContent = String(result?.created_count ?? 0);
        if (errorCount) errorCount.textContent = String(result?.error_count ?? 0);
        fillCreatedRows(result?.created || []);
        fillErrorRows(result?.errors || []);

        const summary = `Upload complete. Created ${result?.created_count ?? 0} user(s) and skipped ${result?.error_count ?? 0} row(s).`;
        showStatus(statusBox, summary, (result?.error_count ?? 0) > 0 ? "info" : "success");
      } catch (err) {
        console.error(err);
        const detail = err?.data?.detail;
        const message = typeof detail === "string"
          ? detail
          : detail?.message || err?.data?.message || err?.message || "Upload failed.";
        showStatus(statusBox, `Upload failed: ${message}`, "error");
      } finally {
        uploadBtn.disabled = false;
        uploadBtn.textContent = "Upload CSV";
      }
    });
  });
})();
