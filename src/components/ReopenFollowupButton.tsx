"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  customerId: string;
  customerName: string | null;
  isDnc: boolean;
}

export default function ReopenFollowupButton({
  customerId,
  customerName,
  isDnc,
}: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearDnc, setClearDnc] = useState(true);
  const [error, setError] = useState("");

  async function go() {
    setSaving(true);
    setError("");
    try {
      const res = await fetch("/api/customers/reopen-followup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId, clearDnc: isDnc ? clearDnc : false }),
      });
      const data = await res.json();
      setSaving(false);
      if (!res.ok || !data.success) {
        setError(data.error || "Failed");
        return;
      }
      setOpen(false);
      router.refresh();
    } catch {
      setSaving(false);
      setError("Network error");
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center px-2 h-7 rounded bg-purple-50 text-purple-800 hover:bg-purple-100 text-xs font-medium"
      >
        Re-open
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
            <h3 className="font-semibold mb-2">
              Re-open follow-up for {customerName || "this customer"}?
            </h3>
            <p className="text-sm text-gray-600 mb-3">
              Sets next follow-up date to today. Customer goes back into their
              owner&apos;s queue.
            </p>
            {error ? (
              <div className="mb-3 p-2 bg-red-50 text-red-700 rounded text-sm">
                {error}
              </div>
            ) : null}
            {isDnc ? (
              <label className="flex items-start gap-2 text-sm mb-3">
                <input
                  type="checkbox"
                  checked={clearDnc}
                  onChange={(e) => setClearDnc(e.target.checked)}
                  className="mt-1"
                  disabled={saving}
                />
                <span>
                  <strong>Also remove Do Not Contact flag</strong>
                  <span className="block text-xs text-gray-600">
                    Required to actually contact them. Uncheck only if you want
                    to re-open without removing DNC.
                  </span>
                </span>
              </label>
            ) : null}
            <div className="flex gap-2">
              <button
                onClick={go}
                disabled={saving}
                className="px-4 py-2 bg-purple-600 text-white text-sm rounded hover:bg-purple-700 disabled:opacity-50"
              >
                {saving ? "Working..." : "Re-open"}
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