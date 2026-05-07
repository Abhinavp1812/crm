"use client";
import { useState } from "react";
import Link from "next/link";

type Sheet = { name: string; headers: string[]; rowCount: number };
type Preview = {
  filename: string;
  sheetName: string;
  totalRows: number;
  newBookingCount: number;
  duplicateOrderCount: number;
  newCustomerCount: number;
  existingCustomerCount: number;
  completedBookings: number;
  skipCount: number;
  errorCount: number;
  errors: { row: number; reason: string; data: Record<string, unknown> }[];
  fullErrorCount: number;
};
type CommitResult = {
  success: boolean;
  totalRows: number;
  newBookingCount: number;
  duplicateOrderCount: number;
  upgradedCustomerCount: number;
  skipCount: number;
  errorCount: number;
  followupsCreated: number;
  followupsUpdated: number;
  followupsSkipped: number;
  errors: { row: number; reason: string; data: Record<string, unknown> }[];
  error?: string;
};

export default function ImportBookingsPage() {
  const [file, setFile] = useState<File | null>(null);
  const [sheets, setSheets] = useState<Sheet[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<CommitResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function reset() {
    setFile(null); setSheets([]); setSelectedSheet("");
    setPreview(null); setResult(null); setError("");
  }

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f); setSheets([]); setSelectedSheet("");
    setPreview(null); setResult(null); setError(""); setLoading(true);

    const fd = new FormData();
    fd.append("file", f);
    const res = await fetch("/api/admin/import/parse", { method: "POST", body: fd });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || "Parse failed"); return; }
    setSheets(data.sheets);
    if (data.sheets.length === 1) setSelectedSheet(data.sheets[0].name);
  }

  async function handlePreview() {
    if (!file || !selectedSheet) return;
    setLoading(true); setError("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("sheetName", selectedSheet);
    const res = await fetch("/api/admin/import/bookings/preview", { method: "POST", body: fd });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) { setError(data.error || "Preview failed"); return; }
    setPreview(data);
  }

  async function handleCommit() {
    if (!file || !selectedSheet || !preview) return;
    if (!confirm(`Import ${preview.newBookingCount} new bookings? (${preview.completedBookings} completed will trigger follow-up scheduling)`)) return;
    setLoading(true); setError("");
    const fd = new FormData();
    fd.append("file", file);
    fd.append("sheetName", selectedSheet);

    let data: CommitResult = {} as CommitResult;
    try {
      const res = await fetch("/api/admin/import/bookings/commit", { method: "POST", body: fd });
      const text = await res.text();
      try { data = text ? JSON.parse(text) : {} as CommitResult; }
      catch {
        setLoading(false);
        setError(`Server returned non-JSON response (status ${res.status}). Check server logs.`);
        return;
      }
      setLoading(false);
      if (!res.ok) { setError(data.error || `Commit failed with status ${res.status}`); return; }
      setResult(data);
    } catch (e) {
      setLoading(false);
      setError(`Network error: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  function downloadErrors(errors: { row: number; reason: string; data: Record<string, unknown> }[]) {
    if (!errors || errors.length === 0) return;
    const headers = ["row", "reason", "raw_data"];
    const rows = errors.map((e) => [
      e.row,
      e.reason.replace(/"/g, '""'),
      JSON.stringify(e.data).replace(/"/g, '""'),
    ]);
    const csv = [headers.join(","), ...rows.map((r) => r.map((v) => `"${v}"`).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `booking-import-errors-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main className="min-h-screen p-8 bg-gray-50">
      <div className="max-w-3xl mx-auto">
        <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900">← Admin</Link>
        <h1 className="text-2xl font-bold mt-2 mb-6">Import Bookings</h1>

        {error && <div className="mb-4 p-3 bg-red-50 text-red-700 rounded">{error}</div>}

        {!result && (
          <div className="bg-white p-6 rounded-lg shadow mb-4">
            <label className="block text-sm font-medium mb-2">1. Choose CSV or XLSX file</label>
            <input type="file" accept=".csv,.xlsx,.xls,.tsv" onChange={handleFileSelect} disabled={loading}
              className="block w-full text-sm border rounded p-2" />
            {file && <p className="mt-2 text-xs text-gray-600">Selected: {file.name}</p>}
          </div>
        )}

        {sheets.length > 0 && !preview && !result && (
          <div className="bg-white p-6 rounded-lg shadow mb-4">
            <label className="block text-sm font-medium mb-2">2. Pick the sheet to import</label>
            <select value={selectedSheet} onChange={(e) => setSelectedSheet(e.target.value)}
              className="block w-full border rounded p-2">
              <option value="">— Choose —</option>
              {sheets.map((s) => (
                <option key={s.name} value={s.name}>{s.name} ({s.rowCount} rows, {s.headers.length} columns)</option>
              ))}
            </select>
            <button onClick={handlePreview} disabled={!selectedSheet || loading}
              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-50">
              {loading ? "Analyzing..." : "Preview Import"}
            </button>
          </div>
        )}

        {preview && !result && (
          <div className="bg-white p-6 rounded-lg shadow mb-4">
            <h2 className="font-semibold text-lg mb-3">3. Preview</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Stat label="Total rows" value={preview.totalRows} color="gray" />
              <Stat label="New bookings" value={preview.newBookingCount} color="green" />
              <Stat label="Duplicate orders (skip)" value={preview.duplicateOrderCount} color="amber" />
              <Stat label="Completed bookings" value={preview.completedBookings} color="blue" />
              <Stat label="New customers" value={preview.newCustomerCount} color="green" />
              <Stat label="Existing customers" value={preview.existingCustomerCount} color="blue" />
              <Stat label="Skipped (bad data)" value={preview.skipCount} color="amber" />
              <Stat label="Warnings" value={preview.errorCount} color="red" />
            </div>
            <p className="text-xs text-gray-600 mb-3">
              💡 Only <strong>Completed</strong> bookings trigger the +20-day follow-up rule.
              Existing customers keep their current owner (sticky).
            </p>
            {preview.errorCount > 0 && (
              <div className="mb-4 p-3 bg-amber-50 border border-amber-200 rounded">
                <p className="text-sm font-medium text-amber-900">⚠️ {preview.errorCount} warning(s) found.</p>
                <button onClick={() => downloadErrors(preview.errors)}
                  className="mt-2 text-sm text-blue-700 hover:underline">
                  Download warning report (CSV)
                </button>
              </div>
            )}
            <div className="flex gap-2">
              <button onClick={handleCommit} disabled={loading || preview.newBookingCount === 0}
                className="px-4 py-2 bg-green-600 text-white rounded disabled:opacity-50">
                {loading ? "Importing..." : "Confirm & Import"}
              </button>
              <button onClick={reset} className="px-4 py-2 bg-gray-200 rounded">Cancel</button>
            </div>
          </div>
        )}

        {result && (
          <div className="bg-white p-6 rounded-lg shadow mb-4">
            <h2 className="font-semibold text-lg mb-3 text-green-700">✅ Import complete</h2>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <Stat label="New bookings" value={result.newBookingCount} color="green" />
              <Stat label="Duplicate orders" value={result.duplicateOrderCount} color="amber" />
              <Stat label="Customers upgraded" value={result.upgradedCustomerCount} color="blue" />
              <Stat label="Skipped" value={result.skipCount} color="amber" />
              <Stat label="Followups created" value={result.followupsCreated} color="green" />
              <Stat label="Followups updated" value={result.followupsUpdated} color="blue" />
              <Stat label="Followups kept (older)" value={result.followupsSkipped} color="gray" />
              <Stat label="Errors" value={result.errorCount} color="red" />
            </div>
            {result.errors && result.errors.length > 0 && (
              <button onClick={() => downloadErrors(result.errors)}
                className="text-sm text-blue-700 hover:underline mb-3">
                Download full report (CSV)
              </button>
            )}
            <button onClick={reset} className="px-4 py-2 bg-blue-600 text-white rounded">
              Import another file
            </button>
          </div>
        )}
      </div>
    </main>
  );
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  const colors: Record<string, string> = {
    gray: "bg-gray-50 text-gray-700",
    green: "bg-green-50 text-green-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
    red: "bg-red-50 text-red-700",
  };
  return (
    <div className={`p-3 rounded ${colors[color]}`}>
      <p className="text-xs uppercase tracking-wide font-medium">{label}</p>
      <p className="text-2xl font-bold mt-1">{value.toLocaleString()}</p>
    </div>
  );
}