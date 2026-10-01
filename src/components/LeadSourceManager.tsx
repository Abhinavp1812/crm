"use client";

import { useEffect, useState } from "react";

interface LeadSourceOption {
  id: string;
  label: string;
  sortOrder: number;
  isActive: boolean;
}

export default function LeadSourceManager() {
  const [sources, setSources] = useState<LeadSourceOption[] | null>(null);
  const [newLabel, setNewLabel] = useState("");
  const [adding, setAdding] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const res = await fetch("/api/admin/lead-sources");
    const data = await res.json();
    if (res.ok) setSources(data.sources);
  }

  useEffect(() => {
    fetch("/api/admin/lead-sources")
      .then((res) => res.json())
      .then((data) => setSources(data.sources));
  }, []);

  async function addSource() {
    const label = newLabel.trim();
    if (!label) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/lead-sources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ label }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to add");
      setNewLabel("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setAdding(false);
    }
  }

  async function toggleActive(id: string, isActive: boolean) {
    setTogglingId(id);
    try {
      await fetch("/api/admin/lead-sources/" + id, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !isActive }),
      });
      await load();
    } finally {
      setTogglingId(null);
    }
  }

  return (
    <div className="bg-white rounded-lg shadow border border-gray-200 p-5 max-w-xl">
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addSource()}
          placeholder="e.g. Pedicure Campaign"
          className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={adding}
        />
        <button
          onClick={addSource}
          disabled={adding || !newLabel.trim()}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-lg hover:bg-blue-700 disabled:opacity-50"
        >
          {adding ? "Adding…" : "Add"}
        </button>
      </div>

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {!sources ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : sources.length === 0 ? (
        <p className="text-sm text-slate-400">No lead sources yet - add one above.</p>
      ) : (
        <ul className="divide-y divide-gray-100">
          {sources.map((s) => (
            <li key={s.id} className="flex items-center justify-between py-2.5">
              <span className={"text-sm " + (s.isActive ? "text-gray-900" : "text-gray-400 line-through")}>{s.label}</span>
              <button
                onClick={() => toggleActive(s.id, s.isActive)}
                disabled={togglingId === s.id}
                className={
                  "text-xs px-2.5 h-7 rounded-lg border font-medium disabled:opacity-50 " +
                  (s.isActive
                    ? "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                    : "bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100")
                }
              >
                {togglingId === s.id ? "…" : s.isActive ? "Deactivate" : "Reactivate"}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
