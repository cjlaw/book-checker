const FUSE_THRESHOLD = 0.35;
const BULK_SCORE_LIMIT = 0.3; // stricter than FUSE_THRESHOLD — bulk needs higher confidence

const searchInput = document.getElementById("searchInput");
const resultDiv = document.getElementById("result");
const emptyState = document.getElementById("emptyState");
const statusText = document.getElementById("statusText");
const loadingEl = document.getElementById("loadingIndicator");
let fuseSingle = null;
let fuseBulk = null;
let catalog = [];

// ── Fuse ──

function buildFuse(entries) {
  catalog = entries;
  fuseSingle = new Fuse(entries, {
    keys: ["title", "author"],
    threshold: FUSE_THRESHOLD,
    includeScore: true,
  });
  fuseBulk = new Fuse(entries, {
    keys: ["title"],
    threshold: FUSE_THRESHOLD,
    includeScore: true,
  });
}

// ── Single-book search ──

// Caller is responsible for any escaping — name reflects the unsafe contract.
function setStatusHTML(msg) {
  statusText.innerHTML = msg;
}

function bookHTML(entry) {
  return `
    <div class="match-item">
      <div class="match-title">${esc(entry.title)}</div>
      ${entry.author ? `<div class="match-author">${esc(entry.author)}</div>` : ""}
      ${entry.il ? `<span class="grade-badge">${esc(entry.il)}</span>` : ""}
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
    const entries = books.map((b) =>
      typeof b === "string" ? { title: b, author: null, rl: null, il: null } : b
    );
    buildFuse(entries);
    const dateStr = generated
      ? new Date(...generated.split("-").map((v, i) => i === 1 ? v - 1 : +v)).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
      : null;
    setStatusHTML(`<span>${entries.length} books</span>${dateStr ? ` · as of ${dateStr}` : ""}`);
  } catch (err) {
    console.warn("Catalog load failed:", err);
    setStatusHTML("⚠️ Could not load book list.");
  } finally {
    loadingEl.style.display = "none";
  }
}

function renderNotFound(detailHTML, status = "No — it's not in the catalog", icon = "✕") {
  resultDiv.className = "result visible not-found";
  resultDiv.innerHTML = `
    <div class="result-section not-found-section">
      <div class="result-header">
        <span class="result-icon" aria-hidden="true">${icon}</span>
        <span class="result-status">${status}</span>
      </div>
      <p class="result-detail">${detailHTML}</p>
    </div>`;
}

function renderFound(hits, status, detailHTML = "") {
  resultDiv.className = "result visible found-only";
  resultDiv.innerHTML = `
    <div class="result-section found-section">
      <div class="result-header">
        <span class="result-icon" aria-hidden="true">✓</span>
        <span class="result-status">${status}</span>
      </div>
      ${detailHTML ? `<p class="result-detail">${detailHTML}</p>` : ""}
      <div class="result-matches">${hits.map(bookHTML).join("")}</div>
    </div>`;
}

function foundStatus(hits) {
  return hits.length === 1 ? "Yes — it's in the catalog!" : `${hits.length} matches in the catalog`;
}

const isbnTitles = new Map();

async function fetchIsbnTitle(isbn) {
  if (!isbnTitles.has(isbn)) {
    isbnTitles.set(isbn, fetch(`https://openlibrary.org/isbn/${isbn}.json`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data?.title || null)
      .catch(() => {
        isbnTitles.delete(isbn);
        return null;
      }));
  }
  return isbnTitles.get(isbn);
}

let searchSeq = 0;

async function isbnSearch(isbn, seq) {
  const exact = findByIsbn(catalog, isbn);
  if (exact) {
    renderFound([exact], foundStatus([exact]));
    return;
  }

  renderNotFound("Looking up this ISBN…", "Checking", "⏳");
  const title = await fetchIsbnTitle(isbn);
  if (seq !== searchSeq) return;

  if (!title) {
    renderNotFound(`We couldn't identify ISBN <strong>${esc(isbn)}</strong>. Try typing the book's title instead.`, "Couldn't identify this book", "?");
    return;
  }

  let hits = filterCatalog(catalog, title) || [];
  if (!hits.length) {
    hits = fuseBulk.search(title).filter((h) => h.score <= BULK_SCORE_LIMIT).map((h) => h.item);
  }
  if (!hits.length) {
    renderNotFound(`"<strong>${esc(title)}</strong>" is not in the library catalog.`);
    return;
  }
  renderFound(
    hits,
    hits.length === 1 ? "Possible match in the catalog" : `${hits.length} possible matches in the catalog`,
    `This ISBN is "<strong>${esc(title)}</strong>". We found it by title, not by ISBN — check that the title and author match your book.`,
  );
}

function doSearch() {
  const query = searchInput.value.trim();
  const seq = ++searchSeq;
  resultDiv.className = "result";
  resultDiv.innerHTML = "";

  if (query.length < 2) {
    emptyState.style.display = query.length === 0 ? "" : "none";
    return;
  }
  emptyState.style.display = "none";

  if (!fuseSingle) {
    renderNotFound("Book list is still loading — try again in a moment.", "Loading", "⏳");
    return;
  }

  const isbn = normalizeIsbn(query);
  if (isbn) {
    isbnSearch(isbn, seq);
    return;
  }
  if (/^\d{9}[\dX]$|^\d{13}$/i.test(query.replace(/[\s-]/g, ""))) {
    renderNotFound(`<strong>${esc(query)}</strong> isn't a valid ISBN. Check the number and try again.`, "That number doesn't look right", "?");
    return;
  }

  const hits = filterCatalog(catalog, query) ?? fuseSingle.search(query).map((h) => h.item);
  if (!hits.length) {
    renderNotFound(`"<strong>${esc(query)}</strong>" is not in the library catalog.`);
    return;
  }
  renderFound(hits, foundStatus(hits));
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
// Text copied from a cover (Live Text) can span lines; browsers drop the break
// without a space when pasting into an <input>, gluing words together.
searchInput.addEventListener("paste", (e) => {
  const text = e.clipboardData?.getData("text/plain");
  if (!text || !/[\r\n]/.test(text)) return;
  e.preventDefault();
  searchInput.setRangeText(text.replace(/\s+/g, " ").trim(), searchInput.selectionStart, searchInput.selectionEnd, "end");
  doSearch();
});
function clearSearch() {
  searchSeq++;
  searchInput.value = "";
  resultDiv.className = "result";
  resultDiv.innerHTML = "";
  emptyState.style.display = "";
}

// ── Barcode scan ──

const scanBtn = document.getElementById("scanBtn");
const scanInput = document.getElementById("scanInput");
const SCAN_FORMATS = ["ean_13", "upc_a", "code_128", "code_39", "codabar"];
const BARCODE_PONYFILL = {
  src: "https://cdn.jsdelivr.net/npm/barcode-detector@3.2.3/dist/iife/ponyfill.js",
  integrity: "sha384-ZQvvHKgw7Ktqkui5vapXokyfDpQcnXLZhR9hfFMh8rUQztTRNywKQdQ994308nhY",
};

function loadScript({ src, integrity }) {
  return new Promise((resolve, reject) => {
    const el = document.createElement("script");
    el.src = src;
    el.integrity = integrity;
    el.crossOrigin = "anonymous";
    el.onload = resolve;
    el.onerror = () => reject(new Error(`Failed to load ${src}`));
    document.head.append(el);
  });
}

// Native BarcodeDetector can exist yet support no formats (Android without Play
// services), so fall back to the zxing ponyfill unless it can read EAN-13.
async function makeDetector() {
  if ("BarcodeDetector" in window) {
    const supported = await BarcodeDetector.getSupportedFormats();
    if (supported.includes("ean_13")) {
      return new BarcodeDetector({ formats: SCAN_FORMATS.filter((f) => supported.includes(f)) });
    }
  }
  await loadScript(BARCODE_PONYFILL);
  return new BarcodeDetectionAPI.BarcodeDetector({ formats: SCAN_FORMATS });
}

let detectorPromise = null;
function getDetector() {
  if (!detectorPromise) {
    detectorPromise = makeDetector().catch((err) => {
      detectorPromise = null;
      throw err;
    });
  }
  return detectorPromise;
}

// Non-ISBN codes are still detected so we can say "wrong barcode" instead of "no barcode".
async function readBarcodes(file) {
  const detector = await getDetector();
  const bitmap = await createImageBitmap(file);
  try {
    return await detector.detect(bitmap);
  } finally {
    bitmap.close();
  }
}

scanBtn.addEventListener("click", () => {
  getDetector().catch(() => {});
  scanInput.click();
});

scanInput.addEventListener("change", async () => {
  const file = scanInput.files[0];
  scanInput.value = "";
  if (!file) return;

  const seq = ++searchSeq;
  searchInput.value = "";
  emptyState.style.display = "none";
  renderNotFound("Reading the barcode…", "Scanning", "⏳");

  let codes;
  try {
    codes = await readBarcodes(file);
  } catch (err) {
    console.warn("Scan failed:", err);
    if (seq !== searchSeq) return;
    renderNotFound("Something went wrong reading the photo. Try again, or type the title instead.", "Couldn't scan", "?");
    return;
  }
  if (seq !== searchSeq) return;

  const isbn = codes.map((c) => normalizeIsbn(c.rawValue)).find(Boolean);
  if (isbn) {
    searchInput.value = isbn;
    doSearch();
  } else if (codes.length) {
    renderNotFound("That barcode isn't the book's ISBN — it may be a library sticker or a store code. Scan the barcode on the back cover; its number starts with 978 or 979.", "Wrong barcode", "?");
  } else {
    renderNotFound("We couldn't find a barcode in that photo. Get closer so the barcode fills most of the picture, and make sure it's in focus.", "No barcode found", "?");
  }
});

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
  if (!fuseBulk) return { status: "unknown", match: null };
  const hits = fuseBulk.search(book.title);
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
    return { title: match ? match.title : b.title, author: match ? match.author : null, il: match ? match.il : null, status };
  });

  const unknownCount = rows.filter((r) => r.status === "unknown").length;
  const foundCount = rows.length - unknownCount;

  const tableRows = rows
    .map(
      (r) => `
    <tr${r.status === "unknown" ? ` class="row-unknown"` : ""}>
      <td>${esc(r.title)}${r.author ? `<br><span class="match-author">${esc(r.author)}</span>` : ""}${r.il ? ` <span class="grade-badge">${esc(r.il)}</span>` : ""}</td>
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
    ${unknownCount ? `<p class="bulk-guidance">Books marked Not Found are not in the library catalog.</p>` : ""}
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

  if (!fuseBulk) {
    bulkResults.className = "bulk-results visible";
    bulkResults.innerHTML = `<p class="bulk-message empty">⚠️ Book list not loaded yet — wait a moment and try again.</p>`;
    return;
  }

  renderBulkResults(parsePaste(text));
}

function runBulkCheck() {
  const file = csvInput.files[0];
  if (!file) return;

  if (!fuseBulk) {
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

loadBooks();
