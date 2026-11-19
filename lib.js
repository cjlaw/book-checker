// Pure functions — no DOM, no Fuse. Shared between browser (global) and Node (require).

const STOP = new Set(["the", "and", "for", "are", "was", "not", "its", "but", "via"]);

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// Tokenizes CSV text into records of trimmed fields. Quoted fields may contain
// commas and newlines; "" is an escaped quote. Handles \n and \r\n line breaks.
function parseCSVRecords(text) {
  const records = [];
  let field = "",
    record = [],
    inQuote = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuote) {
      if (ch === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (ch === '"') inQuote = false;
      else field += ch;
    } else if (ch === '"') {
      inQuote = true;
    } else if (ch === ",") {
      record.push(field.trim());
      field = "";
    } else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && text[i + 1] === "\n") i++;
      record.push(field.trim());
      field = "";
      records.push(record);
      record = [];
    } else {
      field += ch;
    }
  }
  record.push(field.trim());
  records.push(record);
  return records;
}

function splitCSVLine(line) {
  return parseCSVRecords(line)[0];
}

function parseCSV(text) {
  const records = parseCSVRecords(text.trim());
  while (records.length && records[records.length - 1].every((f) => f === "")) {
    records.pop();
  }
  if (records.length < 2) return { error: null, rows: [] };

  const headers = records[0].map((h) => h.toLowerCase());
  const titleIdx = headers.findIndex((h) => h.includes("title"));
  const authorIdx = headers.findIndex((h) => h.includes("author"));

  if (titleIdx === -1)
    return { error: "No title column found in the CSV.", rows: [] };

  const rows = records
    .slice(1)
    .map((cols) => ({
      title: cols[titleIdx] || "",
      author: authorIdx >= 0 ? cols[authorIdx] || "" : "",
    }))
    .filter((b) => b.title);

  return { error: null, rows };
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

// Returns null when query is all stop words / too short — caller should fall back to Fuse.
// Returns an array (possibly empty) when regex ran — empty means not found.
function filterCatalog(catalog, query) {
  const words = query
    .trim()
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP.has(w.toLowerCase()));
  if (!words.length) return null;
  const patterns = words.map(
    (w) =>
      new RegExp(`\\b${w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i"),
  );
  return catalog.filter((e) => patterns.every((p) => p.test(e.title) || p.test(e.author || "")));
}

// Returns a checksum-valid ISBN-13 string (ISBN-10 converted), or null.
function normalizeIsbn(raw) {
  const s = String(raw).replace(/[\s-]/g, "").toUpperCase();
  if (/^97[89]\d{10}$/.test(s)) {
    const sum = [...s.slice(0, 12)].reduce((acc, d, i) => acc + d * (i % 2 ? 3 : 1), 0);
    return (10 - (sum % 10)) % 10 === +s[12] ? s : null;
  }
  if (/^\d{9}[\dX]$/.test(s)) {
    const sum = [...s].reduce((acc, d, i) => acc + (d === "X" ? 10 : +d) * (10 - i), 0);
    if (sum % 11) return null;
    const body = "978" + s.slice(0, 9);
    const sum13 = [...body].reduce((acc, d, i) => acc + d * (i % 2 ? 3 : 1), 0);
    return body + ((10 - (sum13 % 10)) % 10);
  }
  return null;
}

// Destiny lists alternate titles as separate entries; one ISBN is one book, so
// return a single entry, preferring the longest (usually most complete) title.
function findByIsbn(catalog, isbn) {
  return catalog
    .filter((e) => e.isbn === isbn)
    .reduce((best, e) => (!best || e.title.length > best.title.length ? e : best), null);
}

if (typeof module !== "undefined") {
  module.exports = { esc, splitCSVLine, parseCSV, parsePaste, filterCatalog, normalizeIsbn, findByIsbn };
}
