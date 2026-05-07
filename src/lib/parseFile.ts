import * as XLSX from "xlsx";

export interface ParsedSheet {
  sheetName: string;
  headers: string[];
  rows: Record<string, unknown>[];
}

export interface ParsedWorkbook {
  sheets: ParsedSheet[];
}

/**
 * Parse an uploaded file (CSV / XLSX / XLS / TSV) into structured rows.
 * Uses sheet name as key. For CSV, returns one sheet named "Sheet1".
 */
export async function parseFile(
  buffer: ArrayBuffer,
  filename: string
): Promise<ParsedWorkbook> {
  const wb = XLSX.read(buffer, {
    type: "array",
    cellDates: true,        // turn date cells into JS Date objects
    raw: false,             // let xlsx format numbers/dates
    dateNF: "dd-mm-yyyy",
  });

  const sheets: ParsedSheet[] = wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    // defval: "" so missing cells become empty strings, not undefined
    const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
      defval: "",
      raw: false,
    });
    const headers = rows.length > 0 ? Object.keys(rows[0]) : [];
    return { sheetName: name, headers, rows };
  });

  return { sheets };
}

/** Trim and lowercase header names for case-insensitive matching. */
export function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Find a value in a row by trying several possible header names
 * (case-insensitive, whitespace-tolerant).
 */
export function getField(
  row: Record<string, unknown>,
  ...candidates: string[]
): unknown {
  const map: Record<string, unknown> = {};
  for (const k of Object.keys(row)) {
    map[normalizeHeader(k)] = row[k];
  }
  for (const c of candidates) {
    const key = normalizeHeader(c);
    if (key in map) return map[key];
  }
  return "";
}