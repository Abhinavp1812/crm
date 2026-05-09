"use client";
import { useEffect } from "react";

export default function MidnightRefresh() {
  useEffect(() => {
    function schedule() {
      const now = new Date();
      const next = new Date(now);
      next.setDate(now.getDate() + 1);
      // small buffer 5s after midnight
      next.setHours(0, 0, 5, 0);
      const ms = next.getTime() - now.getTime();
      const id = setTimeout(() => {
        // reload to get fresh server-side data for 'today'
        try {
          window.location.reload();
        } catch {
          // ignore
        }
      }, ms);
      return () => clearTimeout(id);
    }

    const clear = schedule();
    return clear;
  }, []);

  return null;
}
