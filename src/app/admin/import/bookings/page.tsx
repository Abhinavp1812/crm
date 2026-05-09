"use client";

import { useState } from "react";
import Layout from "@/components/Layout";
import Link from "next/link";

interface CommitResponse {
  success: boolean;
  totalRows: number;
  newBookingCount?: number;
  duplicateOrderCount?: number;
  upgradedCustomerCount?: number;
  autoAssignedCount?: number;
  agentBreakdown?: { agentId: string; agentName: string; count: number }[];
  skipCount: number;
  errorCount: number;
  followupsCreated?: number;
  followupsUpdated?: number;
  followupsSkipped?: number;
  errors: { row: number; reason: string }[];
}

export default function BookingsImportPage() {
  const [file, setFile] = useState<File | null>(null);
  const [sheetName, setSheetName] = useState<string | null>(null);
  const [sheetOptions, setSheetOptions] = useState<string[]>([]);
  const [parsing, setParsing] = useState(false);
  const [committing, setCommitting] = useState(false);
  const [result, setResult] = useState<CommitResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(f: File | null) {
    setFile(f);
    setSheetName(null);
    setSheetOptions([]);
    setResult(null);
    setError(null);
    if (!f) return;
    setParsing(true);
    try {
      const fd = new FormData();
      fd.append("file", f);
      const res = await fetch("/api/admin/import/parse", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Parse failed");
      setSheetOptions(data.sheets.map((s: { sheetName: string }) => s.sheetName));
      if (data.sheets.length === 1) setSheetName(data.sheets[0].sheetName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Parse failed");
    } finally {
      setParsing(false);
    }
  }

  async function handleCommit() {
    if (!file || !sheetName) return;
    setCommitting(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("sheetName", sheetName);
      const res = await fetch("/api/admin/import/bookings/commit", { method: "POST", body: fd });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Import failed");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setCommitting(false);
    }
  }

  return (
    <Layout>
      <div className="mb-6">
        <Link href="/admin/imports" className="text-sm text-blue-600 hover:underline">← Back to Imports</Link>
        <h1 className="text-2xl font-bold text-gray-900 mt-2">Import Bookings</h1>
      </div>

      {!result && (
        <div className="bg-white rounded-lg border border-gray-200 p-6 mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">1. Choose CSV or XLSX file</label>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => handleFileChange(e.target.files?.[0] || null)}
            className="block w-full text-sm border border-gray-200 rounded-md p-2"
            disabled={parsing || committing}
          />
          {file && <p className="text-xs text-gray-600 mt-1">Selected: {file.name}</p>}
          {parsing && <p className="text-sm text-blue-600 mt-2">Parsing...</p>}

          {sheetOptions.length > 1 && (
            <div className="mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">2. Choose sheet</label>
              <select
                value={sheetName || ""}
                onChange={(e) => setSheetName(e.target.value)}
                className="block w-full text-sm border border-gray-200 rounded-md p-2"
              >
                <option value="">-- Select --</option>
                {sheetOptions.map((s) => (<option key={s} value={s}>{s}</option>))}
              </select>
            </div>
          )}

          {sheetName && (
            <button
              onClick={handleCommit}
              disabled={committing}
              className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
            >
              {committing ? "Importing..." : "Import"}
            </button>
          )}
        </div>
      )}

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {result && (
        <div className="bg-white rounded-lg border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-green-700 mb-4">Import complete</h2>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <ResultStat label="New Bookings" value={result.newBookingCount || 0} color="green" />
            <ResultStat label="Duplicate Orders" value={result.duplicateOrderCount || 0} color="amber" />
            <ResultStat label="Customers Upgraded" value={result.upgradedCustomerCount || 0} color="blue" />
            <ResultStat label="Skipped" value={result.skipCount} color="amber" />
            <ResultStat label="Followups Created" value={result.followupsCreated || 0} color="green" />
            <ResultStat label="Followups Updated" value={result.followupsUpdated || 0} color="blue" />
            <ResultStat label="Followups Kept (Older)" value={result.followupsSkipped || 0} color="gray" />
            <ResultStat label="Errors" value={result.errorCount} color="red" />
          </div>

          {result.autoAssignedCount && result.autoAssignedCount > 0 && result.agentBreakdown && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <h3 className="font-semibold text-blue-900 mb-2">
                Auto-assigned via round-robin: {result.autoAssignedCount} new customers
              </h3>
              <div className="space-y-1">
                {result.agentBreakdown.map((a) => (
                  <div key={a.agentId} className="flex justify-between text-sm">
                    <span className="text-blue-900">• {a.agentName}</span>
                    <span className="font-mono text-blue-700">{a.count} customer{a.count !== 1 ? "s" : ""}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => { setResult(null); setFile(null); setSheetName(null); setSheetOptions([]); }}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Import another file
            </button>
          </div>
        </div>
      )}
    </Layout>
  );
}

function ResultStat({ label, value, color }: { label: string; value: number; color: "red" | "amber" | "blue" | "green" | "gray" }) {
  const colors = {
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    gray: "bg-gray-50 text-gray-700",
  };
  return (
    <div className={"rounded-lg p-3 " + colors[color]}>
      <p className="text-xs uppercase tracking-wide font-medium">{label}</p>
      <p className="text-2xl font-bold mt-1">{value.toLocaleString()}</p>
    </div>
  );
}