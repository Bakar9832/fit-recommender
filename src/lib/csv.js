// Minimal, dependency-free RFC-4180 CSV parser. Handles quoted fields, escaped
// quotes ("" inside a quoted field), embedded commas, and embedded newlines, plus
// CRLF / lone-CR / LF line endings. Pure and unit-tested — this is why we don't
// pull in a CSV library for Phase 1.

/**
 * Parse CSV text into an array of records, each an array of string cells.
 * Cells are returned verbatim (not trimmed); callers decide on trimming.
 * @param {string} text
 * @returns {string[][]}
 */
export function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  let started = false; // any char seen for the current record (to detect real rows)

  const endField = () => {
    row.push(field);
    field = "";
  };
  const endRow = () => {
    endField();
    rows.push(row);
    row = [];
    started = false;
  };

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    started = true;

    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++; // consume the escaped quote
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
      continue;
    }

    if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      endField();
    } else if (c === "\r") {
      if (text[i + 1] === "\n") i++; // CRLF → single line end
      endRow();
    } else if (c === "\n") {
      endRow();
    } else {
      field += c;
    }
  }

  // Flush the final field/record if the file didn't end with a newline.
  if (started || field !== "" || row.length > 0) {
    endRow();
  }

  return rows;
}

/**
 * Parse CSV into a header plus record objects keyed by (trimmed) header names.
 * Fully blank lines are dropped. Cell values are trimmed.
 * @param {string} text
 * @returns {{ header: string[], records: Record<string,string>[] }}
 */
export function csvToObjects(text) {
  const rows = parseCsv(text).filter(
    (r) => !(r.length === 1 && r[0].trim() === "") // skip blank lines
  );
  if (rows.length === 0) return { header: [], records: [] };

  const header = rows[0].map((h) => h.trim());
  const records = rows.slice(1).map((cells) => {
    const obj = {};
    header.forEach((h, idx) => {
      obj[h] = (cells[idx] ?? "").trim();
    });
    return obj;
  });

  return { header, records };
}
