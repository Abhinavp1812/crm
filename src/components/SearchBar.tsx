"use client";
import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

interface Result {
  id: string;
  name: string;
  phone: string;
  city: string | null;
  customerType: "NEW_REGISTRATION" | "CUSTOMER";
  doNotContact: boolean;
  ownerName: string | null;
}

export default function SearchBar() {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Result[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  // Debounced fetch
  useEffect(() => {
    if (q.trim().length < 2) {
      setResults([]);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch("/api/customers/search?q=" + encodeURIComponent(q));
        const data = await res.json();
        setResults(data.results || []);
        setActiveIdx(0);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [q]);

  // Close on outside click
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function handleKey(e: React.KeyboardEvent) {
    if (!open || results.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const r = results[activeIdx];
      if (r) {
        setOpen(false);
        setQ("");
        router.push("/customers/" + r.id);
      }
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  return (
    <div ref={containerRef} className="relative w-72">
      <input
        type="text"
        value={q}
        onChange={(e) => {
          setQ(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKey}
        placeholder="Search name or phone..."
        className="w-full text-sm border border-gray-300 rounded px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
      {open && q.trim().length >= 2 ? (
        <div className="absolute z-30 mt-1 w-96 right-0 bg-white rounded-lg shadow-lg border max-h-96 overflow-y-auto">
          {loading ? (
            <p className="p-3 text-sm text-gray-500">Searching...</p>
          ) : results.length === 0 ? (
            <p className="p-3 text-sm text-gray-500">No matches.</p>
          ) : (
            <ul>
              {results.map((r, idx) => (
                <li key={r.id}>
                  <Link
                    href={"/customers/" + r.id}
                    onClick={() => {
                      setOpen(false);
                      setQ("");
                    }}
                    className={
                      "block px-3 py-2 border-b last:border-b-0 hover:bg-gray-50 " +
                      (idx === activeIdx ? "bg-blue-50" : "")
                    }
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium text-gray-900 truncate">{r.name}</span>
                      <span className="text-xs font-mono text-gray-600">{r.phone}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5 text-xs text-gray-500">
                      {r.doNotContact ? (
                        <span className="text-red-700 font-medium">DNC</span>
                      ) : r.customerType === "CUSTOMER" ? (
                        <span className="text-green-700">Booked</span>
                      ) : (
                        <span className="text-blue-700">Registered</span>
                      )}
                      {r.city ? <span>. {r.city}</span> : null}
                      {r.ownerName ? <span>. Owner: {r.ownerName}</span> : null}
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}