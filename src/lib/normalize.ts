/**
 * Normalize phone number to 10-digit Indian format.
 * Strips +91, spaces, dashes, parens, leading zeros, .0 suffix from Excel.
 * Returns "" if not a valid 10-digit number.
 */
export function normalizePhone(input: unknown): string {
  if (input === null || input === undefined) return "";
  const raw = String(input).trim();
  if (!raw) return "";
  // Remove .0 that Excel adds when phones are stored as numbers
  const noFloat = raw.replace(/\.0+$/, "");
  // Strip everything non-digit
  const digits = noFloat.replace(/\D/g, "");
  // Take last 10 digits (handles +91 prefix)
  if (digits.length < 10) return "";
  return digits.slice(-10);
}

/**
 * Parse a date from various formats found in your data:
 *  - JS Date object (already parsed by xlsx library)
 *  - "31-12-2025" (dd-mm-yyyy)
 *  - "31/12/2025" (dd/mm/yyyy)
 *  - "01-11-2025, 7:55:59 PM" (with time)
 *  - Excel serial number (43891 = Jan 31 2020)
 *
 * Returns null if unparseable.
 */
export function parseFlexibleDate(input: unknown): Date | null {
  if (input === null || input === undefined || input === "") return null;

  if (input instanceof Date && !isNaN(input.getTime())) {
    return input;
  }

  // Excel serial number (rare with our setup but possible)
  if (typeof input === "number" && input > 1 && input < 100000) {
    // Excel epoch: Dec 30 1899
    const ms = (input - 25569) * 86400 * 1000;
    const d = new Date(ms);
    if (!isNaN(d.getTime())) return d;
  }

  const s = String(input).trim();
  if (!s) return null;

  // Strip trailing time if comma-separated: "01-11-2025, 7:55 PM" -> "01-11-2025"
  const datePart = s.split(",")[0].trim();

  // dd-mm-yyyy or dd/mm/yyyy
  const m = datePart.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
  if (m) {
    const day = parseInt(m[1], 10);
    const mon = parseInt(m[2], 10);
    const year = parseInt(m[3], 10);
    if (day >= 1 && day <= 31 && mon >= 1 && mon <= 12) {
      return new Date(year, mon - 1, day);
    }
  }

  return null;
}

/**
 * Strip "#N/A", "N/A", "null", whitespace.
 * Returns "" for empty-ish values.
 */
export function cleanString(input: unknown): string {
  if (input === null || input === undefined) return "";
  const s = String(input).trim();
  if (!s) return "";
  if (/^(#?n\/?a|null|undefined|-)$/i.test(s)) return "";
  return s;
}

/** Convert a string to number, or null. */
export function parseNumber(input: unknown): number | null {
  if (input === null || input === undefined || input === "") return null;
  const s = String(input).trim();
  if (!s || /^(#?n\/?a|null|-)$/i.test(s)) return null;
  const n = parseFloat(s.replace(/,/g, ""));
  return isNaN(n) ? null : n;
}