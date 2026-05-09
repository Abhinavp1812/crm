"use client";
import { useState } from "react";

export default function SelfLeaveButton({ name, role }: { name?: string; role?: string }) {
  const [show, setShow] = useState(false);
  const [from, setFrom] = useState("");
  const [until, setUntil] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit() {
    setLoading(true);
    try {
      const res = await fetch("/api/agents/me/leave", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ from: from || null, until: until || null }) });
      const data = await res.json();
      if (!data?.success) {
        alert(data?.error || "Failed to set leave");
      } else {
        setShow(false);
      }
    } catch (err) {
      alert("Failed to set leave");
    } finally {
      setLoading(false);
    }
  }

  if (role !== "AGENT") return null;

  return (
    <>
      <button onClick={() => setShow(true)} className="text-sm text-yellow-600 hover:text-yellow-800">Mark On Leave</button>
      {show && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded w-80">
            <h3 className="font-semibold mb-3">Mark On Leave</h3>
            <label className="block text-sm">From</label>
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="w-full border p-2 mb-2" />
            <label className="block text-sm">Until</label>
            <input type="date" value={until} onChange={(e) => setUntil(e.target.value)} className="w-full border p-2 mb-4" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setShow(false)} className="px-3 py-1">Cancel</button>
              <button onClick={submit} disabled={loading} className="px-3 py-1 bg-yellow-600 text-white rounded">{loading ? "Saving..." : "Save"}</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
