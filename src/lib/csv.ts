// Minimal RFC 4180 CSV: quoted fields, escaped quotes, commas/newlines inside quotes.

export function toCSV(rows: (string | number | null | undefined)[][]): string {
  const cell = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return rows.map((row) => row.map(cell).join(",")).join("\r\n");
}

export function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  const input = text.replace(/^﻿/, ""); // Excel's BOM

  for (let i = 0; i < input.length; i++) {
    const char = input[i];
    if (quoted) {
      if (char === '"' && input[i + 1] === '"') {
        field += '"';
        i++;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && input[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else field += char;
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter((r) => r.some((cell) => cell.trim()));
}

export type DateFormat = "YYYY-MM-DD" | "DD/MM/YYYY" | "MM/DD/YYYY";

/** Parses a date cell in the chosen format ("/", "-" or "." separators). Returns YYYY-MM-DD or null. */
export function parseDateCell(value: string, format: DateFormat): string | null {
  const parts = value
    .trim()
    .split(/[/.\-\s]+/)
    .map(Number);
  if (parts.length < 3 || parts.some(Number.isNaN)) return null;
  let [y, m, d] = [0, 0, 0];
  if (format === "YYYY-MM-DD") [y, m, d] = parts;
  else if (format === "DD/MM/YYYY") [d, m, y] = parts;
  else [m, d, y] = parts;
  if (y < 100) y += 2000;
  const date = new Date(Date.UTC(y, m - 1, d));
  if (date.getUTCFullYear() !== y || date.getUTCMonth() !== m - 1 || date.getUTCDate() !== d) return null;
  return date.toISOString().slice(0, 10);
}

/** Guesses the date format from sample cells (a first part > 12 means day-first, etc.). */
export function guessDateFormat(samples: string[]): DateFormat {
  const split = samples.map((s) =>
    s
      .trim()
      .split(/[/.\-\s]+/)
      .map(Number),
  );
  if (split.some((p) => p[0] > 31)) return "YYYY-MM-DD";
  if (split.some((p) => p[1] > 12)) return "MM/DD/YYYY";
  return "DD/MM/YYYY";
}

/** "₹1,234.50", "-1234.5", "(1,234)" → 1234.5 (sign dropped: imports are spending). */
export function parseAmountCell(value: string): number | null {
  const number = Number(value.replace(/[^\d.]/g, ""));
  return Number.isFinite(number) && number > 0 ? number : null;
}
