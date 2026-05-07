"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LogCallButton({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function save() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/customers/log-call", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, note: note || undefined }),
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      setSaving(false);
      if (!res.ok || !data.success) {
        setError(data.error || `Save failed (status ${res.status})`);
        return;
      }
      setOpen(false);
      setNote("");
      router.refresh();
    } catch (e) {
      setSaving(false);
      setError(`Network error: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center px-3 h-9 rounded bg-purple-50 text-purple-800 hover:bg-purple-100 text-sm font-medium"
      >
        Log a call
      </button>
      {open ? (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-20 px-4"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white border rounded-lg p-4 shadow-md w-full max-w-md"
          >
            <h3 className="font-semibold mb-3">Log an off-schedule call</h3>
            <p className="text-xs text-gray-600 mb-3">
              Use this when the customer contacted you outside their scheduled
              follow-up. Adds an entry to the timeline without changing their
              follow-up date.
            </p>
            {error ? (
              <div className="mb-3 p-2 bg-red-50 text-red-700 rounded text-sm">
                {error}
              </div>
            ) : null}
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={3}
              placeholder="What was discussed?"
              className="w-full border rounded px-2 py-2 text-sm mb-3"
              disabled={saving}
            />
            <div className="flex gap-2">
              <button
                onClick={save}
                disabled={saving}
                className="px-4 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50"
              >
                {saving ? "Saving..." : "Log call"}
              </button>
              <button
                onClick={() => setOpen(false)}
                disabled={saving}
                className="px-4 py-2 bg-gray-200 text-sm rounded"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}