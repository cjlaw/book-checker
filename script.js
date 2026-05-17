const FUSE_THRESHOLD = 0.35;
const BULK_SCORE_LIMIT = 0.3; // stricter than FUSE_THRESHOLD — bulk needs higher confidence

const searchInput = document.getElementById("searchInput");
const resultDiv = document.getElementById("result");
const emptyState = document.getElementById("emptyState");
const statusText = document.getElementById("statusText");
const loadingEl = document.getElementById("loadingIndicator");
let fuse = null;
let catalog = [];

// ── Fuse ──

function buildFuse(books) {
  catalog = books;
  fuse = new Fuse(books, {
    threshold: FUSE_THRESHOLD,
    includeScore: true,
  });
}

// ── Single-book search ──

// Caller is responsible for any escaping — name reflects the unsafe contract.
function setStatusHTML(msg) {
  statusText.innerHTML = msg;
}

function bookHTML(title) {
  return `
    <div class="match-item">
      <div class="match-title">${esc(title)}</div>
    </div>`;
}

async function loadBooks() {
  loadingEl.style.display = "block";
  setStatusHTML("Loading book list…");
  try {
    const res = await fetch("catalog.json");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const { generated, books } = await res.json();
    if (!books.length) throw new Error("Catalog is empty");
    buildFuse(books);
    const dateStr = generated
      ? new Date(...generated.split("-").map((v, i) => i === 1 ? v - 1 : +v)).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : null;
    setStatusHTML(`<span>${books.length} books</span>${dateStr ? ` · as of ${dateStr}` : ""}`);
  } catch (err) {
    console.warn("Catalog load failed:", err);
    setStatusHTML("⚠️ Could not load book list.");
  } finally {
    loadingEl.style.display = "none";
  }
}

function doSearch() {
  const query = searchInput.value.trim();
  resultDiv.className = "result";
  resultDiv.innerHTML = "";

  if (query.length < 2) {
    emptyState.style.display = query.length === 0 ? "" : "none";
    return;
  }
  emptyState.style.display = "none";

  if (!fuse) {
    resultDiv.classList.add("visible", "not-found");
    resultDiv.innerHTML = `
      <div class="result-section not-found-section">
        <div class="result-header">
          <span class="result-icon" aria-hidden="true">⏳</span>
          <span class="result-status">Loading</span>
        </div>
        <p class="result-detail">Book list is still loading — try again in a moment.</p>
      </div>`;
    return;
  }

  const hits = filterCatalog(catalog, query) ?? fuse.search(query).map((h) => h.item);
  if (!hits.length) {
    resultDiv.classList.add("not-found", "visible");
    resultDiv.innerHTML = `
      <div class="result-section not-found-section">
        <div class="result-header">
          <span class="result-icon" aria-hidden="true">🔍</span>
          <span class="result-status">Not Found</span>
        </div>
        <p class="result-detail">"<strong>${esc(query)}</strong>" is not in the library catalog.</p>
        <p class="result-detail result-guidance">Contact your school librarian for assistance.</p>
      </div>`;
    return;
  }

  resultDiv.classList.add("visible", "found-only");
  resultDiv.innerHTML = `
    <div class="result-section found-section">
      <div class="result-header">
        <span class="result-icon" aria-hidden="true">✓</span>
        <span class="result-status">Books matching your search</span>
      </div>
      <div class="result-matches">${hits.map(bookHTML).join("")}</div>
    </div>`;
}

let searchDebounceTimer = null;
function doSearchDebounced() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(doSearch, 150);
}

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doSearch();
});
searchInput.addEventListener("input", doSearchDebounced);
function clearSearch() {
  searchInput.value = "";
  resultDiv.className = "result";
  resultDiv.innerHTML = "";
  emptyState.style.display = "";
}

// ── Tabs ──

const tabSingle = document.getElementById("tabSingle");
const tabBulk = document.getElementById("tabBulk");
const paneSingle = document.getElementById("paneSingle");
const paneBulk = document.getElementById("paneBulk");

function switchTab(activeBtn, activePane, inactiveBtn, inactivePane) {
  activeBtn.classList.add("active");
  activeBtn.setAttribute("aria-selected", "true");
  inactiveBtn.classList.remove("active");
  inactiveBtn.setAttribute("aria-selected", "false");
  activePane.style.display = "";
  inactivePane.style.display = "none";
}

// ── Bulk check ──

const csvInput = document.getElementById("csvInput");
const bulkBtn = document.getElementById("bulkBtn");
const pasteInput = document.getElementById("pasteInput");
const pasteBtn = document.getElementById("pasteBtn");
const bulkResults = document.getElementById("bulkResults");
const csvSection = document.getElementById("csvSection");
const csvToggleBtn = document.getElementById("csvToggleBtn");

csvToggleBtn.addEventListener("click", () => {
  const expanded = csvSection.style.display !== "none";
  csvSection.style.display = expanded ? "none" : "block";
  csvToggleBtn.textContent = expanded
    ? "or upload a CSV file instead"
    : "hide CSV upload";
});

tabSingle.addEventListener("click", () => {
  switchTab(tabSingle, paneSingle, tabBulk, paneBulk);
  pasteInput.value = "";
  csvInput.value = "";
  bulkResults.className = "bulk-results";
  bulkResults.innerHTML = "";
  csvSection.style.display = "none";
  csvToggleBtn.textContent = "or upload a CSV file instead";
});

tabBulk.addEventListener("click", () => {
  switchTab(tabBulk, paneBulk, tabSingle, paneSingle);
  clearSearch();
});

function lookupBook(book) {
  if (!fuse) return { status: "unknown", match: null };
  const hits = fuse.search(book.title);
  if (!hits.length || hits[0].score > BULK_SCORE_LIMIT)
    return { status: "unknown", match: null };
  return { status: "found", match: hits[0].item };
}

function renderBulkResults(books) {
  if (!books.length) {
    bulkResults.className = "bulk-results visible";
    bulkResults.innerHTML = `<p class="bulk-message empty">No books found in the input.</p>`;
    return;
  }

  const rows = books.map((b) => {
    const { status, match } = lookupBook(b);
    return { title: match || b.title, status };
  });

  const unknownCount = rows.filter((r) => r.status === "unknown").length;
  const foundCount = rows.length - unknownCount;

  const tableRows = rows
    .map(
      (r) => `
    <tr${r.status === "unknown" ? ` class="row-unknown"` : ""}>
      <td>${esc(r.title)}</td>
      <td>${r.status === "unknown" ? `<span class="status-badge unknown"><span aria-hidden="true">?</span> Not Found</span>` : `<span class="status-badge found"><span aria-hidden="true">✔</span> Found</span>`}</td>
    </tr>`,
    )
    .join("");

  bulkResults.className = "bulk-results visible";
  bulkResults.innerHTML = `
    <div class="bulk-summary">
      <span class="found-count"><span aria-hidden="true">✔</span> ${foundCount} Found</span>
      ${unknownCount ? `<span class="total-count"><span aria-hidden="true">?</span> ${unknownCount} Not Found</span>` : ""}
      <button class="print-btn" id="printBtn">Print</button>
    </div>
    ${unknownCount ? `<p class="bulk-guidance">Books marked Not Found are not in the library catalog — contact your school librarian for assistance.</p>` : ""}
    <div class="bulk-table-wrap">
      <table class="bulk-table">
        <thead><tr><th>Title</th><th>Status</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>`;
  document
    .getElementById("printBtn")
    .addEventListener("click", () => window.print());
}

function runPasteCheck() {
  const text = pasteInput.value.trim();
  if (!text) return;

  if (!fuse) {
    bulkResults.className = "bulk-results visible";
    bulkResults.innerHTML = `<p class="bulk-message empty">⚠️ Book list not loaded yet — wait a moment and try again.</p>`;
    return;
  }

  renderBulkResults(parsePaste(text));
}

function runBulkCheck() {
  const file = csvInput.files[0];
  if (!file) return;

  if (!fuse) {
    bulkResults.className = "bulk-results visible";
    bulkResults.innerHTML = `<p class="bulk-message empty">⚠️ Book list not loaded yet — wait a moment and try again.</p>`;
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    const { error, rows: books } = parseCSV(e.target.result);
    if (error) {
      bulkResults.className = "bulk-results visible";
      bulkResults.innerHTML = `<p class="bulk-message error">⚠️ ${esc(error)}</p>`;
      return;
    }
    renderBulkResults(books);
  };
  reader.readAsText(file);
}

pasteBtn.addEventListener("click", runPasteCheck);
pasteInput.addEventListener("paste", () => setTimeout(runPasteCheck, 0));
bulkBtn.addEventListener("click", runBulkCheck);
csvInput.addEventListener("change", runBulkCheck);

loadBooks();
