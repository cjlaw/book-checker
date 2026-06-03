// Pure functions — no DOM, no Fuse. Shared between browser (global) and Node (require).

const STOP = new Set(["the", "and", "for", "are", "was", "not", "its", "but", "via"]);

function esc(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

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

if (typeof module !== "undefined") {
  module.exports = { esc, splitCSVLine, parseCSV, parsePaste, filterCatalog };
}
