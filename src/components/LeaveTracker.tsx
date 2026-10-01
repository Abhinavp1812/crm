"use client";

import { useEffect, useState } from "react";
import { formatDateIN } from "@/lib/formatDate";

interface LeaveLogEntry {
  id: string;
  agentName: string;
  startDate: string;
  endDate: string | null;
  setByName: string;
  createdAt: string;
}

function daySpan(start: string, end: string | null): string {
  if (!end) return "Open-ended";
  const days = Math.round((new Date(end).getTime() - new Date(start).getTime()) / 86400000) + 1;
  return days + " day" + (days !== 1 ? "s" : "");
}

export default function LeaveTracker() {
  const [log, setLog] = useState<LeaveLogEntry[] | null>(null);

  useEffect(() => {
    fetch("/api/admin/team/leave-log")
      .then((res) => res.json())
      .then((data) => setLog(data.log ?? []));
  }, []);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm mb-6">
      <h3 className="font-semibold text-gray-900 mb-1">Leave Tracker</h3>
      <p className="text-sm text-slate-500 mb-3">Every leave period any agent has taken, most recent first.</p>

      {!log ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : log.length === 0 ? (
        <p className="text-sm text-slate-400">No leave has been recorded yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-xs uppercase text-gray-600">
              <tr>
                <th className="px-3 py-2 text-left">Agent</th>
                <th className="px-3 py-2 text-left">From</th>
                <th className="px-3 py-2 text-left">Until</th>
                <th className="px-3 py-2 text-left">Duration</th>
                <th className="px-3 py-2 text-left">Set By</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {log.map((l) => (
                <tr key={l.id}>
                  <td className="px-3 py-2 font-medium text-gray-900">{l.agentName}</td>
                  <td className="px-3 py-2 text-gray-700">{formatDateIN(l.startDate)}</td>
                  <td className="px-3 py-2 text-gray-700">{l.endDate ? formatDateIN(l.endDate) : "—"}</td>
                  <td className="px-3 py-2 text-gray-700">{daySpan(l.startDate, l.endDate)}</td>
                  <td className="px-3 py-2 text-gray-500">{l.setByName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
