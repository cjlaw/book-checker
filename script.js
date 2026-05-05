const DEV_MODE = false; // set false before deploying

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSO0448VKYXgdlE0PSKLcHrevxkMLd_45erfpkXDBiT1QQiF9LwBPcyWDbwsT25elcMHchIdC_M3-1m/pub?gid=0&single=true&output=csv";

const CACHE_KEY = "bookList_cache";
const CACHE_TS_KEY = "bookList_timestamp";
const CACHE_HOURS = 24;
const FUSE_THRESHOLD = 0.35;
const BULK_SCORE_LIMIT = 0.3; // stricter than FUSE_THRESHOLD — bulk needs higher confidence

const SAMPLE_BOOKS = [
  {
    title: "Also",
    author: "E. B. Goodale",
    gradeLevel: "Grades Pre-K-Kinder",
  },
  {
    title: "Bathe the Cat",
    author: "Alice B. McGinty",
    gradeLevel: "Grades Pre-K/K-1",
  },
  {
    title: "Berry Song",
    author: "Michaela Goade",
    gradeLevel: "Grades Pre-K/K-5",
  },
  {
    title: "The Coquíes Still Sing",
    author: "Karina Nicole González",
    gradeLevel: "Grades K-3, Grades 3-5",
  },
  {
    title: "Every Dog in the Neighborhood",
    author: "Philip C. Stead",
    gradeLevel: "Grades Pre-K-Kinder",
  },
  {
    title: "Farmhouse",
    author: "Sophie Blackall",
    gradeLevel: "Grades K-3, Grades 3-5",
  },
  {
    title: "The Flamingo",
    author: "Guojing",
    gradeLevel: "Grades Pre-K/K-1",
  },
  {
    title: "H Is for Harlem",
    author: "Dinah Johnson",
    gradeLevel: "Grades 3-5",
  },
  {
    title: "A Land of Books",
    author: "Duncan Tonatiuh",
    gradeLevel: "Grades 3-5",
  },
  {
    title: "Luli and the Language of Tea",
    author: "Andrea Wang",
    gradeLevel: "Grades Pre-K/K-5",
  },
  {
    title: "Powwow Day",
    author: "Traci Sorell",
    gradeLevel: "Grades Pre-K/K-1",
  },
  {
    title: "The World Belonged to Us",
    author: "Jacqueline Woodson",
    gradeLevel: "Grades 3-5",
  },
  {
    title: "Aviva vs. the Dybbuk",
    author: "Mari Lowe",
    gradeLevel: "Grades 3-5, Grades 6-8",
  },
  {
    title: "Black Bird, Blue Road",
    author: "Sofiya Pasternack",
    gradeLevel: "Grades 3-5, Grades 6-8",
  },
  {
    title: "Freewater",
    author: "Amina Luqman-Dawson",
    gradeLevel: "Grades 6-8",
  },
  {
    title: "Frizzy",
    author: "Claribel A. Ortega",
    gradeLevel: "Grades 3-5",
  },
  {
    title: "Jennifer Chan Is Not Alone",
    author: "Tae Keller",
    gradeLevel: "Grades 6-8",
  },
  {
    title: "The Last Mapmaker",
    author: "Christina Soontornvat",
    gradeLevel: "Grades 3-5, Grades 6-8",
  },
  {
    title: "The Ogress and the Orphans",
    author: "Kelly Barnhill",
    gradeLevel: "Grades 6-8",
  },
  {
    title: "A Rover's Story",
    author: "Jasmine Warga",
    gradeLevel: "Grades 3-5, Grades 6-8",
  },
  {
    title: "Those Kids from Fawn Creek",
    author: "Erin Entrada Kelly",
    gradeLevel: "Grades 6-8",
  },
  {
    title: "Tumble",
    author: "Celia C. Pérez",
    gradeLevel: "Grades 3-5, Grades 6-8",
  },
  {
    title: "Ain't Burned All the Bright",
    author: "Jason Reynolds",
    gradeLevel: "Grades 7-12",
  },
  {
    title: "American Murderer",
    author: "Gail Jarrow",
    gradeLevel: "Grades 6-8",
  },
  {
    title: "The Bluest Sky",
    author: "Christina Diaz Gonzalez",
    gradeLevel: "Grades 7-12",
  },
  {
    title: "The Door of No Return",
    author: "Kwame Alexander",
    gradeLevel: "Grades 6-8",
  },
  {
    title: "I Must Betray You",
    author: "Ruta Sepetys",
    gradeLevel: "Grades 8 up",
  },
  {
    title: "Iveliz Explains It All",
    author: "Andrea Beatriz Arango",
    gradeLevel: "Grades 6-8",
  },
  {
    title: "All the Fighting Parts",
    author: "Hannah V. Sawyerr",
    gradeLevel: "Grades 9-12",
  },
  {
    title: "Bright Red Fruit",
    author: "Safia Elhillo",
    gradeLevel: "Grades 9-12",
  },
  {
    title: "Dragonfruit",
    author: "Makiia Lucier",
    gradeLevel: "Grades 7-12",
  },
  {
    title: "Libertad",
    author: "Bessie Flores Zaldivar",
    gradeLevel: "Grades 7-12",
  },
  {
    title: "Looking for Smoke",
    author: "K.A. Cobell",
    gradeLevel: "Grades 9-12",
  },
  {
    title: "The Merciless King of Moore High",
    author: "Lily Sparks",
    gradeLevel: "Grades 9-12",
  },
  {
    title: "Rez Ball",
    author: "Byron Graves",
    gradeLevel: "Grades 8 up",
  },
  {
    title: "Thirsty",
    author: "Jas Hammonds",
    gradeLevel: "Grades 9-12",
  },
  {
    title: "Twenty-Four Seconds from Now…",
    author: "Jason Reynolds",
    gradeLevel: "Grades 9-12",
  },
  {
    title: "Under This Red Rock",
    author: "Mindy McGinnis",
    gradeLevel: "Grades 9-12",
  },
  {
    title: "Another First Chance",
    author: "Robbie Couch",
    gradeLevel: "Grades 9-12",
  },
  {
    title: "Bad Graces",
    author: "Kyrie McCauley",
    gradeLevel: "Grades 9-12",
  },
  {
    title: "The Breakup Lists",
    author: "Adib Khorram",
    gradeLevel: "Grades 8 up",
  },
  {
    title: "Breathing Underwater",
    author: "Abbey Lee Nash",
    gradeLevel: "Grades 9-12",
  },
  {
    title: "Dead Things Are Closer Than They Appear",
    author: "Robin Wasley",
    gradeLevel: "Grades 9-12",
  },
  {
    title: "Gwen and Art are Not in Love",
    author: "Lex Croucher",
    gradeLevel: "Grades 8 up",
  },
  {
    title: "I Loved You In Another Life",
    author: "David Arnold",
    gradeLevel: "Grades 9-12",
  },
  {
    title: "Just Say Yes",
    author: "Goldy Moldavsky",
    gradeLevel: "Grades 8 up",
  },
  {
    title: "Not About a Boy",
    author: "Myah Hollis",
    gradeLevel: "Grades 9-12",
  },
  {
    title: "The Reappearance of Rachel Price",
    author: "Holly Jackson",
    gradeLevel: "Grades 9-12",
  },
  {
    title: "Remember Us",
    author: "Jacqueline Woodson",
    gradeLevel: "Grades 7-12",
  },
  {
    title: "Unbecoming",
    author: "Seema Yasmin",
    gradeLevel: "Grades 9-12",
  },
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
function parseCSV(text) {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return { error: null, rows: [] };

  const headers = splitCSVLine(lines[0]).map((h) => h.toLowerCase());
  const titleIdx = headers.findIndex((h) => h.includes("title"));
  const authorIdx = headers.findIndex((h) => h.includes("author"));
  const gradeLevelIdx = headers.findIndex((h) =>
    h.includes("intended grade level"),
  );

  if (titleIdx === -1)
    return { error: "No title column found in the CSV.", rows: [] };

  const rows = lines
    .slice(1)
    .map((line) => {
      const cols = splitCSVLine(line);
      return {
        title: cols[titleIdx] || "",
        author: authorIdx >= 0 ? cols[authorIdx] || "" : "",
        gradeLevel: gradeLevelIdx >= 0 ? cols[gradeLevelIdx] || "" : "",
      };
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
      ${book.gradeLevel ? `<div class="match-grade-level">${esc(book.gradeLevel)}</div>` : ""}
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
    const { rows: books } = parseCSV(text);
    if (!books.length) throw new Error("No books parsed");
    if (!books.some((b) => b.author) || !books.some((b) => b.gradeLevel))
      throw new Error("Required columns missing from the list");
    saveCache(books);
    buildFuse(books);
    const dateStr = formatListDate(Date.now());
    setStatusHTML(`<span>${books.length} books</span> · list as of ${dateStr}`);
  } catch (err) {
    console.warn("Sheet load failed:", err);
    const isSchemaErr = err.message === "Required columns missing from the list";
    const cached = loadCache();
    if (cached && cached.length) {
      buildFuse(cached);
      const ts = localStorage.getItem(CACHE_TS_KEY);
      const dateStr = ts ? formatListDate(ts) : "an earlier date";
      setStatusHTML(
        isSchemaErr
          ? `⚠️ List is missing required columns — contact the list administrator. Showing saved list as of ${dateStr}.`
          : `⚠️ Fetch failed — showing list as of ${dateStr}`,
      );
    } else {
      setStatusHTML(
        isSchemaErr
          ? "⚠️ List is missing required columns — contact the list administrator."
          : "⚠️ Could not load book list. Check your sheet URL.",
      );
    }
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
          <span class="result-icon">⏳</span>
          <span class="result-status">Loading</span>
        </div>
        <p class="result-detail">Book list is still loading — try again in a moment.</p>
      </div>`;
    return;
  }

  const rawHits = fuse.search(query);
  const hits = rawHits.map((h) => h.item);
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

  resultDiv.classList.add("visible", "approved-only");
  resultDiv.innerHTML = `
    <div class="result-section approved-section">
      <div class="result-header">
        <span class="result-status">Approved books matching your search</span>
      </div>
      <div class="result-matches">${hits.map(bookHTML).join("")}</div>
    </div>`;
}

let searchDebounceTimer = null;
function doSearchDebounced() {
  clearTimeout(searchDebounceTimer);
  searchDebounceTimer = setTimeout(doSearch, 150);
}

searchBtn.addEventListener("click", doSearch);
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
  if (!fuse) return { status: "unknown", match: null };

  let hits = book.author
    ? fuse.search({ $and: [{ title: book.title }, { author: book.author }] })
    : fuse.search(book.title);

  if ((!hits.length || hits[0].score > BULK_SCORE_LIMIT) && book.author)
    hits = fuse.search(book.title);

  if (!hits.length || hits[0].score > BULK_SCORE_LIMIT)
    return { status: "unknown", match: null };

  return { status: "approved", match: hits[0].item };
}

function renderBulkResults(books) {
  if (!books.length) {
    bulkResults.className = "bulk-results visible";
    bulkResults.innerHTML = `<p class="bulk-message empty">No books found in the input.</p>`;
    return;
  }

  const rows = books.map((b) => {
    const { status, match } = lookupBook(b);
    return {
      title: match ? match.title : b.title,
      author: match ? match.author : b.author,
      gradeLevel: match ? match.gradeLevel || "" : "",
      status,
    };
  });

  const unknownCount = rows.filter((r) => r.status === "unknown").length;
  const approvedCount = rows.length - unknownCount;

  const tableRows = rows
    .map(
      (r) => `
    <tr${r.status === "unknown" ? ` class="row-unknown"` : ""}>
      <td>${esc(r.title)}</td>
      <td>${r.author ? esc(r.author) : "—"}</td>
      <td>${r.gradeLevel ? esc(r.gradeLevel) : "—"}</td>
      <td>${r.status === "unknown" ? `<span class="status-badge unknown">? Not Found</span>` : `<span class="status-badge approved">✔ Approved</span>`}</td>
    </tr>`,
    )
    .join("");

  bulkResults.className = "bulk-results visible";
  bulkResults.innerHTML = `
    <div class="bulk-summary">
      <span class="approved-count">✔ ${approvedCount} Approved</span>
      ${unknownCount ? `<span class="total-count">? ${unknownCount} Not Found</span>` : ""}
      <button class="print-btn" id="printBtn">Print</button>
    </div>
    <div class="bulk-table-wrap">
      <table class="bulk-table">
        <thead><tr><th>Title</th><th>Author</th><th>Grade Level</th><th>Status</th></tr></thead>
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
