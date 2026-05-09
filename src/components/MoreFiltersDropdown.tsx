"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { ChevronDownIcon } from "@heroicons/react/24/outline";
import type { FollowupFilter } from "@/lib/followups";

interface Tab {
  id: FollowupFilter;
  label: string;
  count: number;
}

export default function MoreFiltersDropdown({
  tabs,
  currentFilter,
}: {
  tabs: Tab[];
  currentFilter: FollowupFilter;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const activeTab = tabs.find((t) => t.id === currentFilter);
  const isActiveInDropdown = !!activeTab;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={
          "px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap inline-flex items-center gap-1 " +
          (isActiveInDropdown
            ? "border-blue-600 text-blue-700"
            : "border-transparent text-gray-600 hover:text-gray-900 hover:border-gray-300")
        }
      >
        {isActiveInDropdown ? activeTab.label : "More"}
        <ChevronDownIcon className="h-4 w-4" />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-30">
          {tabs.map((t) => {
            const active = currentFilter === t.id;
            const href = "/?filter=" + t.id;
            return (
              <Link
                key={t.id}
                href={href}
                onClick={() => setOpen(false)}
                className={
                  "flex items-center justify-between px-3 py-2 text-sm transition " +
                  (active ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-50")
                }
              >
                <span>{t.label}</span>
                <span className={"text-xs " + (active ? "text-blue-700" : "text-gray-400")}>
                  {t.count.toLocaleString()}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}