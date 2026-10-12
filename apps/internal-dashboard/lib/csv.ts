// Minimal RFC 4180 CSV parser (quoted fields, escaped "" quotes, commas and
// newlines inside quotes), good enough for BOM exports from spreadsheet
// tools without pulling in a dependency for one small parser.
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
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
      row.push(field);
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f !== "")) rows.push(row);
      row = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    if (row.some((f) => f !== "")) rows.push(row);
  }
  return rows;
}

// One quoted CSV output cell, neutralized against formula injection. A cell
// that starts with =, +, -, @, a tab or a carriage return is treated as a live
// formula by Excel/Sheets/LibreOffice (tab and CR are stripped and the rest
// evaluated), so it gets a leading ' to render as inert text instead.
// Exported values include player-typed text (names, descriptions, notes).
export function csvCell(value: unknown): string {
  const str = String(value ?? "");
  const safe = /^[=+\-@\t\r]/.test(str) ? `'${str}` : str;
  return `"${safe.replaceAll('"', '""')}"`;
}
