"use client";
import React, { useEffect, useState } from "react";

type UserRow = {
  id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  onLeaveFrom?: string | null;
  onLeaveUntil?: string | null;
  customersOwned: number;
};

export default function TeamManager() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [loading, setLoading] = useState(false);

  // Add agent modal state
  const [showAdd, setShowAdd] = useState(false);
  const [newName, setNewName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");

  // Reassign modal
  const [showReassign, setShowReassign] = useState(false);
  const [reassignFrom, setReassignFrom] = useState<string | null>(null);
  const [reassignDestination, setReassignDestination] = useState<string | "roundrobin" | null>(null);
  // On-leave modal
  const [showLeave, setShowLeave] = useState(false);
  const [leaveFrom, setLeaveFrom] = useState<string | null>(null);
  const [leaveUntil, setLeaveUntil] = useState<string | null>(null);
  const [leaveTarget, setLeaveTarget] = useState<string | null>(null);
  // Remove modal
  const [showRemove, setShowRemove] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<string | null>(null);
  const [removeDestination, setRemoveDestination] = useState<string | "roundrobin" | null>(null);
  // Edit modal
  const [showEdit, setShowEdit] = useState(false);
  const [editTarget, setEditTarget] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editPassword, setEditPassword] = useState("");

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    const res = await fetch("/api/admin/team");
    const data = await res.json();
    if (data?.success) setUsers(data.users);
    setLoading(false);
  }

  async function createAgent() {
    const res = await fetch("/api/admin/team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, email: newEmail, password: newPassword }),
    });
    const data = await res.json();
    if (data?.success) {
      setShowAdd(false);
      setNewName("");
      setNewEmail("");
      setNewPassword("");
      fetchUsers();
    } else {
      alert(data?.error || "Failed to create agent");
    }
  }

  function openMarkOnLeave(id: string) {
    setLeaveTarget(id);
    setLeaveFrom(null);
    setLeaveUntil(null);
    setShowLeave(true);
  }

  async function submitMarkOnLeave() {
    if (!leaveTarget) return;
    const payload: any = { action: "markOnLeave", from: leaveFrom, until: leaveUntil };
    const res = await fetch(`/api/admin/team/${leaveTarget}`, { method: "PATCH", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } });
    const data = await res.json();
    if (data?.success) {
      setShowLeave(false);
      setLeaveTarget(null);
      fetchUsers();
    } else {
      alert(data?.error || "Failed to mark on leave");
    }
  }

  async function bringBack(id: string) {
    await fetch(`/api/admin/team/${id}`, { method: "PATCH", body: JSON.stringify({ action: "bringBack" }), headers: { "Content-Type": "application/json" } });
    fetchUsers();
  }

  function openReassign(id: string) {
    setReassignFrom(id);
    setShowReassign(true);
    setReassignDestination(null);
  }

  async function doReassign() {
    if (!reassignFrom) return;
    const payload: any = { action: "reassignCustomers" };
    if (reassignDestination === "roundrobin") payload.roundRobin = true;
    else if (reassignDestination) payload.destinationId = reassignDestination;

    const res = await fetch(`/api/admin/team/${reassignFrom}`, { method: "PATCH", body: JSON.stringify(payload), headers: { "Content-Type": "application/json" } });
    const data = await res.json();
    if (data?.success) {
      setShowReassign(false);
      setReassignFrom(null);
      fetchUsers();
    } else {
      alert(data?.error || "Failed to reassign");
    }
  }

  async function removeAgent(id: string) {
    // open modal
    setRemoveTarget(id);
    setRemoveDestination(null);
    setShowRemove(true);
  }

  async function submitRemove() {
    if (!removeTarget) return;
    const body: any = {};
    if (removeDestination === "roundrobin") body.roundRobin = true;
    else if (removeDestination) body.destinationId = removeDestination;

    const res = await fetch(`/api/admin/team/${removeTarget}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json();
    if (data?.success) {
      setShowRemove(false);
      setRemoveTarget(null);
      fetchUsers();
    } else {
      alert(data?.error || "Failed to remove agent");
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium">Agents</h2>
        <div>
          <button onClick={() => setShowAdd(true)} className="bg-blue-600 text-white px-3 py-1 rounded mr-2">Add Agent</button>
          <button onClick={async () => {
            if (!confirm("Balance team now? This will redistribute customers across all active agents.")) return;
            const res = await fetch('/api/admin/team/balance', { method: 'POST' });
            const data = await res.json();
            if (data?.success) fetchUsers();
            else alert(data?.error || 'Failed to balance team');
          }} className="bg-gray-200 text-gray-800 px-3 py-1 rounded">Balance team</button>
        </div>
      </div>

      <div className="bg-white rounded border border-gray-200 overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-gray-50">
            <tr>
              <th className="p-3">Name</th>
              <th>Email</th>
              <th>Customers Owned</th>
              <th>Status</th>
              <th className="text-right p-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={5} className="p-4">Loading…</td></tr>
            ) : users.length === 0 ? (
              <tr><td colSpan={5} className="p-4">No agents</td></tr>
            ) : users.map((u) => (
              <tr key={u.id} className="border-t">
                <td className="p-3">{u.name}</td>
                <td>{u.email}</td>
                <td>{u.customersOwned}</td>
                <td>{u.onLeaveFrom ? "On Leave" : u.isActive ? "Active" : "Inactive"}</td>
                <td className="p-3 text-right">
                  {u.role !== "ADMIN" && (
                    u.onLeaveFrom ? (
                      <button onClick={() => bringBack(u.id)} className="text-sm text-green-600 mr-3">Bring Back</button>
                    ) : (
                      <button onClick={() => openMarkOnLeave(u.id)} className="text-sm text-yellow-600 mr-3">Mark On Leave</button>
                    )
                  )}
                  <button onClick={() => openReassign(u.id)} className="text-sm text-blue-600 mr-3">Reassign Customers</button>
                  <button onClick={() => { setEditTarget(u.id); setEditName(u.name); setEditEmail(u.email); setEditPassword(""); setShowEdit(true); }} className="text-sm text-indigo-600 mr-3">Edit</button>
                  {u.role !== "ADMIN" && <button onClick={() => removeAgent(u.id)} className="text-sm text-red-600">Remove</button>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Agent Modal */}
      {showAdd && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded w-96">
            <h3 className="font-semibold mb-3">Add Agent</h3>
            <div className="space-y-2">
              <input className="w-full border p-2" placeholder="Name" value={newName} onChange={(e) => setNewName(e.target.value)} />
              <input className="w-full border p-2" placeholder="Email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
              <input type="password" className="w-full border p-2" placeholder="Initial password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowAdd(false)} className="px-3 py-1">Cancel</button>
              <button onClick={createAgent} className="px-3 py-1 bg-blue-600 text-white rounded">Create</button>
            </div>
          </div>
        </div>
      )}

      {/* Reassign Modal */}
      {showReassign && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded w-96">
            <h3 className="font-semibold mb-3">Reassign Customers</h3>
            <div className="space-y-2">
              <label className="block text-sm">Destination</label>
              <select className="w-full border p-2" value={(reassignDestination as string) || ""} onChange={(e) => setReassignDestination(e.target.value || null)}>
                <option value="">-- pick --</option>
                <option value="roundrobin">Round-robin to remaining</option>
                {users.filter((u) => u.id !== reassignFrom && u.role === "AGENT").map((u) => (
                  <option key={u.id} value={u.id}>{u.name} — {u.email}</option>
                ))}
              </select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowReassign(false)} className="px-3 py-1">Cancel</button>
              <button onClick={doReassign} className="px-3 py-1 bg-blue-600 text-white rounded">Reassign</button>
            </div>
          </div>
        </div>
      )}

      {/* Remove Modal */}
      {showRemove && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded w-96">
            <h3 className="font-semibold mb-3">Remove Agent</h3>
            <p className="text-sm text-gray-600">Choose how to reassign this agent's customers before removal.</p>
            <div className="space-y-2 mt-3">
              <label className="block text-sm">Destination</label>
              <select className="w-full border p-2" value={(removeDestination as string) || ""} onChange={(e) => setRemoveDestination(e.target.value || null)}>
                <option value="">-- pick --</option>
                <option value="roundrobin">Round-robin to remaining</option>
                {users.filter((u) => u.id !== removeTarget && u.role === "AGENT").map((u) => (
                  <option key={u.id} value={u.id}>{u.name} — {u.email}</option>
                ))}
              </select>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowRemove(false)} className="px-3 py-1">Cancel</button>
              <button onClick={submitRemove} className="px-3 py-1 bg-red-600 text-white rounded">Remove</button>
            </div>
          </div>
        </div>
      )}

      {/* Mark On Leave Modal */}
      {showLeave && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded w-96">
            <h3 className="font-semibold mb-3">Mark On Leave</h3>
            <div className="space-y-2">
              <label className="block text-sm">From</label>
              <input type="date" className="w-full border p-2" onChange={(e) => setLeaveFrom(e.target.value ? new Date(e.target.value).toISOString() : null)} />
              <label className="block text-sm">Until</label>
              <input type="date" className="w-full border p-2" onChange={(e) => setLeaveUntil(e.target.value ? new Date(e.target.value).toISOString() : null)} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowLeave(false)} className="px-3 py-1">Cancel</button>
              <button onClick={submitMarkOnLeave} className="px-3 py-1 bg-blue-600 text-white rounded">Save</button>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center">
          <div className="bg-white p-6 rounded w-96">
            <h3 className="font-semibold mb-3">Edit Agent</h3>
            <div className="space-y-2">
              <input className="w-full border p-2" placeholder="Name" value={editName} onChange={(e) => setEditName(e.target.value)} />
              <input className="w-full border p-2" placeholder="Email" value={editEmail} onChange={(e) => setEditEmail(e.target.value)} />
              <input type="password" className="w-full border p-2" placeholder="New password (leave blank to keep)" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} />
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => setShowEdit(false)} className="px-3 py-1">Cancel</button>
              <button onClick={async () => {
                if (!editTarget) return;
                const payload: any = { action: 'updateDetails' };
                if (editName) payload.name = editName;
                if (editEmail) payload.email = editEmail;
                if (editPassword) payload.password = editPassword;
                const res = await fetch(`/api/admin/team/${editTarget}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
                const data = await res.json();
                if (data?.success) { setShowEdit(false); setEditTarget(null); fetchUsers(); } else { alert(data?.error || 'Failed to update'); }
              }} className="px-3 py-1 bg-blue-600 text-white rounded">Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
