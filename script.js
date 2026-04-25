const DEV_MODE = false; // set false before deploying

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSO0448VKYXgdlE0PSKLcHrevxkMLd_45erfpkXDBiT1QQiF9LwBPcyWDbwsT25elcMHchIdC_M3-1m/pub?gid=0&single=true&output=csv";

const CACHE_KEY = "bookList_cache";
const CACHE_TS_KEY = "bookList_timestamp";
const CACHE_HOURS = 24;
const FUSE_THRESHOLD = 0.35;
const BULK_SCORE_LIMIT = 0.3; // stricter than FUSE_THRESHOLD — bulk needs higher confidence

const SAMPLE_BOOKS = [
  { title: "Charlotte's Web", author: "E.B. White", approved: true },
  { title: "Stuart Little", author: "E.B. White", approved: false },
  { title: "The Trumpet of the Swan", author: "E.B. White", approved: false },
  {
    title: "The Very Hungry Caterpillar",
    author: "Eric Carle",
    approved: true,
  },
  {
    title: "Where the Wild Things Are",
    author: "Maurice Sendak",
    approved: true,
  },
  { title: "Matilda", author: "Roald Dahl", approved: true },
  { title: "James and the Giant Peach", author: "Roald Dahl", approved: true },
  {
    title: "Charlie and the Chocolate Factory",
    author: "Roald Dahl",
    approved: false,
  },
  { title: "The BFG", author: "Roald Dahl", approved: false },
  { title: "The Giving Tree", author: "Shel Silverstein", approved: true },
  { title: "Goodnight Moon", author: "Margaret Wise Brown", approved: true },
  { title: "Green Eggs and Ham", author: "Dr. Seuss", approved: true },
  { title: "The Cat in the Hat", author: "Dr. Seuss", approved: false },
  {
    title: "The Lion, the Witch and the Wardrobe",
    author: "C.S. Lewis",
    approved: true,
  },
  { title: "A Wrinkle in Time", author: "Madeleine L'Engle", approved: true },
  { title: "Harriet the Spy", author: "Louise Fitzhugh", approved: true },
];

const searchInput = document.getElementById("searchInput");
const searchBtn = document.getElementById("searchBtn");
const resultDiv = document.getElementById("result");
const emptyState = document.getElementById("emptyState");
const statusText = document.getElementById("statusText");
const refreshBtn = document.getElementById("refreshBtn");
const loadingEl = document.getElementById("loadingIndicator");
const configNotice = document.getElementById("configNotice");

let fuse = null;

// ── Utilities ──

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isConfigured() {
  return SHEET_CSV_URL && SHEET_CSV_URL !== "YOUR_GOOGLE_SHEET_CSV_URL_HERE";
}

function cacheAge() {
  const ts = localStorage.getItem(CACHE_TS_KEY);
  if (!ts) return Infinity;
  return (Date.now() - parseInt(ts, 10)) / 36e5;
}

function saveCache(books) {
  localStorage.setItem(CACHE_KEY, JSON.stringify(books));
  localStorage.setItem(CACHE_TS_KEY, Date.now().toString());
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// ── CSV parsing ──

function splitCSVLine(line) {
  const fields = [];
  let cur = "",
    inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuote && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else inQuote = !inQuote;
    } else if (ch === "," && !inQuote) {
      fields.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur.trim());
  return fields;
}

// Returns { error, rows } — error is a string if parsing failed, rows is the array of books.
// When includeApproved is true, parses an "approved" column from the sheet CSV.
// When false (bulk upload), approved is omitted from each row.
function parseCSV(text, { includeApproved = false } = {}) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { error: null, rows: [] };

  const headers = splitCSVLine(lines[0]).map((h) => h.toLowerCase());
  const titleIdx = headers.findIndex((h) => h.includes("title"));
  const authorIdx = headers.findIndex((h) => h.includes("author"));
  const approvedIdx = includeApproved
    ? headers.findIndex((h) => h.includes("approved"))
    : -1;

  if (titleIdx === -1)
    return { error: "No title column found in the CSV.", rows: [] };

  const rows = lines
    .slice(1)
    .map((line) => {
      const cols = splitCSVLine(line);
      const approvedVal =
        approvedIdx >= 0 ? (cols[approvedIdx] || "").toLowerCase() : "yes";
      const row = {
        title: cols[titleIdx] || "",
        author: authorIdx >= 0 ? cols[authorIdx] || "" : "",
      };
      if (includeApproved) {
        row.approved =
          approvedVal === "yes" ||
          approvedVal === "true" ||
          approvedVal === "1";
      }
      return row;
    })
    .filter((b) => b.title);

  return { error: null, rows };
}

// ── Fuse ──

function buildFuse(books) {
  fuse = new Fuse(books, {
    keys: ["title", "author"],
    threshold: FUSE_THRESHOLD,
    includeScore: true,
  });
}

// ── Single-book search ──

// Caller is responsible for any escaping — name reflects the unsafe contract.
function setStatusHTML(msg) {
  statusText.innerHTML = msg;
}

function bookHTML(book) {
  return `
    <div class="match-item">
      <div class="match-title">${esc(book.title)}</div>
      ${book.author ? `<div class="match-author">${esc(book.author)}</div>` : ""}
    </div>`;
}

function formatListDate(ts) {
  return new Date(
    typeof ts === "string" ? parseInt(ts, 10) : ts,
  ).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

async function loadBooks(forceRefresh = false) {
  if (!isConfigured()) {
    configNotice.style.display = "block";
    buildFuse(SAMPLE_BOOKS);
    setStatusHTML(
      `Demo mode — <span>${SAMPLE_BOOKS.length} sample books</span> loaded`,
    );
    return;
  }

  if (!forceRefresh && cacheAge() < CACHE_HOURS) {
    const cached = loadCache();
    if (cached && cached.length) {
      buildFuse(cached);
      const ts = localStorage.getItem(CACHE_TS_KEY);
      const dateStr = ts ? formatListDate(ts) : "recently";
      setStatusHTML(
        `<span>${cached.length} books</span> · list as of ${dateStr}`,
      );
      return;
    }
  }

  loadingEl.style.display = "block";
  setStatusHTML("Fetching latest list…");
  try {
    const res = await fetch(SHEET_CSV_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    const { rows: books } = parseCSV(text, { includeApproved: true });
    if (!books.length) throw new Error("No books parsed");
    saveCache(books);
    buildFuse(books);
    const dateStr = formatListDate(Date.now());
    setStatusHTML(`<span>${books.length} books</span> · list as of ${dateStr}`);
  } catch (err) {
    console.warn("Sheet load failed:", err);
    const cached = loadCache();
    if (cached && cached.length) {
      buildFuse(cached);
      const ts = localStorage.getItem(CACHE_TS_KEY);
      const dateStr = ts ? formatListDate(ts) : "an earlier date";
      setStatusHTML(`⚠️ Fetch failed — showing list as of ${dateStr}`);
    } else {
      setStatusHTML("⚠️ Could not load book list. Check your sheet URL.");
    }
  } finally {
    loadingEl.style.display = "none";
  }
}

function doSearch() {
  const query = searchInput.value.trim();
  resultDiv.className = "result";
  resultDiv.innerHTML = "";

  if (!query) {
    emptyState.style.display = "";
    return;
  }
  emptyState.style.display = "none";

  if (!fuse) {
    resultDiv.classList.add("visible", "not-found");
    resultDiv.innerHTML = `
      <div class="result-section not-found-section">
        <div class="result-header">
          <span class="result-icon">⏳</span>
          <span class="result-status">Loading</span>
        </div>
        <p class="result-detail">Book list is still loading — try again in a moment.</p>
      </div>`;
    return;
  }

  const rawHits = fuse.search(query);
  const hits = rawHits.map((h) => h.item);
  const topScore = rawHits.length ? (rawHits[0].score ?? 1) : 1;
  const nextScore = rawHits.length > 1 ? (rawHits[1].score ?? 1) : 1;
  const hasStrongMatch = topScore <= 0.15 && nextScore - topScore > 0.1;

  const primaryHits = hasStrongMatch ? [hits[0]] : hits;
  const secondaryHits = hasStrongMatch ? hits.slice(1) : [];

  const approved = primaryHits.filter((b) => b.approved);
  const rejected = primaryHits.filter((b) => !b.approved);

  if (!hits.length) {
    resultDiv.classList.add("not-found", "visible");
    resultDiv.innerHTML = `
      <div class="result-section not-found-section">
        <div class="result-header">
          <span class="result-icon">🔍</span>
          <span class="result-status">Not Found</span>
        </div>
        <p class="result-detail">No match for "<strong>${esc(query)}</strong>" — this title may not have been reviewed yet.</p>
      </div>`;
    return;
  }

  let html = "";

  if (approved.length) {
    html += `
      <div class="result-section approved-section">
        <div class="result-header">
          <span class="result-icon">✅</span>
          <span class="result-status">Approved${!hasStrongMatch && approved.length > 1 ? ` (${approved.length})` : ""}</span>
        </div>
        <div class="result-matches">${approved.map(bookHTML).join("")}</div>
      </div>`;
  }

  if (rejected.length) {
    html += `
      <div class="result-section not-approved-section">
        <div class="result-header">
          <span class="result-icon">❌</span>
          <span class="result-status">Not Approved${!hasStrongMatch && rejected.length > 1 ? ` (${rejected.length})` : ""}</span>
        </div>
        <div class="result-matches">${rejected.map(bookHTML).join("")}</div>
      </div>`;
  }

  if (secondaryHits.length) {
    html += `
      <div class="result-section other-matches-section">
        <div class="result-header">
          <span class="result-status">Other possible matches</span>
        </div>
        <div class="result-matches">${secondaryHits.map(bookHTML).join("")}</div>
      </div>`;
  }

  resultDiv.classList.add("visible");
  if (approved.length && !rejected.length)
    resultDiv.classList.add("approved-only");
  resultDiv.innerHTML = html;
}

searchBtn.addEventListener("click", doSearch);
searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") doSearch();
});
searchInput.addEventListener("input", doSearch);
function clearSearch() {
  searchInput.value = "";
  resultDiv.className = "result";
  resultDiv.innerHTML = "";
  emptyState.style.display = "";
}

refreshBtn.addEventListener("click", () => {
  clearSearch();
  loadBooks(true);
});

const clearCacheBtn = document.getElementById("clearCacheBtn");
clearCacheBtn.addEventListener("click", () => {
  localStorage.removeItem(CACHE_KEY);
  localStorage.removeItem(CACHE_TS_KEY);
  clearSearch();
  loadBooks(true);
});

if (!DEV_MODE) {
  refreshBtn.style.display = "none";
  clearCacheBtn.style.display = "none";
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
  if (!fuse) return "unknown";
  const hits = fuse.search(book.title);
  if (!hits.length || hits[0].score > BULK_SCORE_LIMIT) return "unknown";

  let pick = hits[0];
  if (book.author) {
    const wantAuthor = book.author.toLowerCase();
    const authorMatch = hits.find((h) =>
      (h.item.author || "").toLowerCase().includes(wantAuthor),
    );
    if (authorMatch) pick = authorMatch;
  }
  return pick.item.approved ? "approved" : "rejected";
}

function renderBulkResults(books) {
  if (!books.length) {
    bulkResults.className = "bulk-results visible";
    bulkResults.innerHTML = `<p class="bulk-message empty">No books found in the input.</p>`;
    return;
  }

  const rows = books.map((b) => ({ ...b, status: lookupBook(b) }));
  rows.sort((a, b) => {
    const byAuthor = (a.author || "").localeCompare(b.author || "", undefined, {
      sensitivity: "base",
    });
    if (byAuthor !== 0) return byAuthor;
    return a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  });

  const approvedCount = rows.filter((r) => r.status === "approved").length;
  const rejectedCount = rows.filter((r) => r.status === "rejected").length;
  const unknownCount = rows.filter((r) => r.status === "unknown").length;

  const badgeHTML = (status) => {
    if (status === "approved")
      return `<span class="status-badge approved">✔ Approved</span>`;
    if (status === "rejected")
      return `<span class="status-badge rejected">✘ Not Approved</span>`;
    return `<span class="status-badge unknown">? Not Found</span>`;
  };

  const tableRows = rows
    .map(
      (r) => `
    <tr class="row-${r.status}">
      <td>${esc(r.title)}</td>
      <td>${r.author ? esc(r.author) : "—"}</td>
      <td>${badgeHTML(r.status)}</td>
    </tr>`,
    )
    .join("");

  bulkResults.className = "bulk-results visible";
  bulkResults.innerHTML = `
    <div class="bulk-summary">
      <span class="approved-count">✔ ${approvedCount} Approved</span>
      <span class="rejected-count">✘ ${rejectedCount} Not Approved</span>
      ${unknownCount ? `<span class="total-count">? ${unknownCount} Not Found</span>` : ""}
      <button class="print-btn" id="printBtn">Print</button>
    </div>
    <div class="bulk-table-wrap">
      <table class="bulk-table">
        <thead><tr><th>Title</th><th>Author</th><th>Status</th></tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>`;
  document
    .getElementById("printBtn")
    .addEventListener("click", () => window.print());
}

function parsePaste(text) {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .filter((l) => l.trim());
  return lines
    .map((line) => {
      let title, author;
      if (line.includes("\t")) {
        const idx = line.indexOf("\t");
        title = line.slice(0, idx).trim();
        author = line.slice(idx + 1).trim();
      } else {
        const idx = line.indexOf(">");
        title = idx === -1 ? line.trim() : line.slice(0, idx).trim();
        author = idx === -1 ? "" : line.slice(idx + 1).trim();
      }
      return { title, author };
    })
    .filter((b) => b.title);
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
