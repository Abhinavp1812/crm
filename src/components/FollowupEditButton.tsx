"use client";
import { useState } from "react";
import FollowupEditor from "./FollowupEditor";

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
  currentFollowupDate: string;
  remarkOptions: RemarkOption[];
}

export default function FollowupEditButton(props: Props) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center justify-center px-2 h-8 rounded bg-amber-50 text-amber-800 hover:bg-amber-100 text-xs font-medium"
      >
        Update
      </button>
      {open ? (
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-20 px-4"
          onClick={() => setOpen(false)}
        >
          <div onClick={(e) => e.stopPropagation()}>
            <FollowupEditor {...props} onClose={() => setOpen(false)} />
          </div>
        </div>
      ) : null}
    </>
  );
}