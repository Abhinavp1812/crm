"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

interface RemarkOption {
  label: string;
  defaultDaysAhead: number | null;
  autoFlagDnc: boolean;
  closesFollowup: boolean;
}

interface Props {
  customerId: string;
  customerName: string | null;
  currentRemark: string | null;
  currentNote: string | null;
  currentFollowupDate: string; // YYYY-MM-DD
  remarkOptions: RemarkOption[];
  onClose?: () => void;
}

export default function FollowupEditor({
  customerId,
  customerName,
  currentRemark,
  currentNote,
  currentFollowupDate,
  remarkOptions,
  onClose,
}: Props) {
  const router = useRouter();
  const [remark, setRemark] = useState(currentRemark || "");
  const [note, setNote] = useState(currentNote || "");
  const [nextDate, setNextDate] = useState(currentFollowupDate);
  const [flagDnc, setFlagDnc] = useState(false);
  const [dncReason, setDncReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const selectedOption = remarkOptions.find((r) => r.label === remark);
  const isAutoDnc = selectedOption?.autoFlagDnc || false;
  const isCloser = selectedOption?.closesFollowup || false;
  const effectiveDnc = flagDnc || isAutoDnc;

  // When remark changes, suggest a default next date
  function handleRemarkChange(label: string) {
    setRemark(label);
    setError("");
    const opt = remarkOptions.find((r) => r.label === label);
    if (opt && opt.defaultDaysAhead !== null) {
      const d = new Date();
      d.setDate(d.getDate() + opt.defaultDaysAhead);
      setNextDate(d.toISOString().slice(0, 10));
    }
  }

  async function handleSave() {
    setError("");
    if (!remark) {
      setError("Pick a remark first.");
      return;
    }
    // Client-side rule check (server will also enforce)
    if (!effectiveDnc && !isCloser && !nextDate) {
      setError(
        "Set a next follow-up date OR mark this customer Do Not Contact. No customer can be left without a next step."
      );
      return;
    }

    setSaving(true);
    try {
      const res = await fetch("/api/followups/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId,
          remark,
          note: note || undefined,
          nextFollowupDate:
            !effectiveDnc && !isCloser && nextDate ? nextDate : undefined,
          flagDnc: effectiveDnc,
          dncReason: effectiveDnc ? dncReason || remark : undefined,
        }),
      });
      const text = await res.text();
      let data: { success?: boolean; error?: string } = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch {
        setSaving(false);
        setError(`Server error (status ${res.status})`);
        return;
      }
      setSaving(false);
      if (!res.ok || !data.success) {
        setError(data.error || `Save failed (status ${res.status})`);
        return;
      }
      // Success — close + refresh
      if (onClose) onClose();
      router.refresh();
    } catch (e) {
      setSaving(false);
      setError(`Network error: ${e instanceof Error ? e.message : "unknown"}`);
    }
  }

  return (
    <div className="bg-white border rounded-lg p-4 shadow-md max-w-2xl">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="font-semibold">
          Update follow-up for{" "}
          <span className="text-blue-700">{customerName || "this customer"}</span>
        </h3>
        {onClose ? (
          <button
            onClick={onClose}
            className="text-sm text-gray-500 hover:text-gray-800"
          >
            Close
          </button>
        ) : null}
      </div>

      {error ? (
        <div className="mb-3 p-2 bg-red-50 text-red-700 rounded text-sm">
          {error}
        </div>
      ) : null}

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Remark <span className="text-red-600">*</span>
          </label>
          <select
            value={remark}
            onChange={(e) => handleRemarkChange(e.target.value)}
            className="w-full border rounded px-2 py-2 text-sm"
            disabled={saving}
          >
            <option value="">— Choose a remark —</option>
            {remarkOptions.map((r) => (
              <option key={r.label} value={r.label}>
                {r.label}
                {r.autoFlagDnc ? " (auto-DNC)" : ""}
                {r.closesFollowup ? " (closes followup)" : ""}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">
            Detailed note (optional)
          </label>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            rows={2}
            placeholder="Anything specific worth remembering for next time"
            className="w-full border rounded px-2 py-2 text-sm"
            disabled={saving}
          />
        </div>

        {!effectiveDnc && !isCloser ? (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">
              Next follow-up date <span className="text-red-600">*</span>
              {selectedOption?.defaultDaysAhead !== null &&
              selectedOption?.defaultDaysAhead !== undefined ? (
                <span className="text-gray-500 font-normal">
                  {" "}
                  (default: +{selectedOption.defaultDaysAhead} days)
                </span>
              ) : null}
            </label>
            <input
              type="date"
              value={nextDate}
              onChange={(e) => setNextDate(e.target.value)}
              className="w-full border rounded px-2 py-2 text-sm"
              disabled={saving}
            />
          </div>
        ) : null}

        {isAutoDnc ? (
          <div className="p-3 bg-red-50 border border-red-200 rounded text-sm text-red-800">
            This remark will automatically flag the customer as <strong>Do Not
            Contact</strong>. They will be removed from all future queues.
          </div>
        ) : null}

        {isCloser && !isAutoDnc ? (
          <div className="p-3 bg-gray-50 border border-gray-200 rounded text-sm text-gray-700">
            This remark closes the follow-up cycle. The customer won&apos;t be in
            anyone&apos;s queue unless a new booking comes in or you re-open them.
          </div>
        ) : null}

        {!isAutoDnc && !isCloser ? (
          <div className="border-t pt-3">
            <label className="flex items-start gap-2 text-sm">
              <input
                type="checkbox"
                checked={flagDnc}
                onChange={(e) => setFlagDnc(e.target.checked)}
                className="mt-1"
                disabled={saving}
              />
              <span>
                <strong>Mark as Do Not Contact</strong>
                <span className="block text-xs text-gray-600">
                  e.g. wrong number, asked not to be contacted
                </span>
              </span>
            </label>
            {flagDnc ? (
              <input
                type="text"
                value={dncReason}
                onChange={(e) => setDncReason(e.target.value)}
                placeholder="Reason (optional)"
                className="mt-2 w-full border rounded px-2 py-2 text-sm"
                disabled={saving}
              />
            ) : null}
          </div>
        ) : null}

        <div className="flex gap-2 pt-2 border-t">
          <button
            onClick={handleSave}
            disabled={saving || !remark}
            className="px-4 py-2 bg-green-600 text-white text-sm rounded hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? "Saving..." : "Save"}
          </button>
          {onClose ? (
            <button
              onClick={onClose}
              disabled={saving}
              className="px-4 py-2 bg-gray-200 text-sm rounded"
            >
              Cancel
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}