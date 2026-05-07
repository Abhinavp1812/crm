"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function UnflagDncButton({ customerId }: { customerId: string }) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);

  async function go() {
    if (!confirm("Remove the Do-Not-Contact flag from this customer?")) return;
    setSaving(true);
    try {
      const res = await fetch("/api/customers/unflag-dnc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerId }),
      });
      const data = await res.json();
      setSaving(false);
      if (!res.ok || !data.success) {
        alert(data.error || "Failed");
        return;
      }
      router.refresh();
    } catch {
      setSaving(false);
      alert("Network error");
    }
  }

  return (
    <button
      onClick={go}
      disabled={saving}
      className="text-xs text-red-700 hover:text-red-900 underline disabled:opacity-50"
    >
      {saving ? "Working..." : "Un-flag DNC"}
    </button>
  );
}