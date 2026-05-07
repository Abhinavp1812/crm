import { CustomerType } from "@prisma/client";

export function CustomerTypeBadge({
  type,
  doNotContact,
}: {
  type: CustomerType;
  doNotContact?: boolean;
}) {
  if (doNotContact) {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
        🚫 DNC
      </span>
    );
  }
  if (type === "CUSTOMER") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
        ✅ Booked
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
      🆕 Registered
    </span>
  );
}

export function FollowupStatusBadge({
  status,
}: {
  status: "OVERDUE" | "DUE_TODAY" | "UPCOMING";
}) {
  if (status === "OVERDUE") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
        ⚠️ Overdue
      </span>
    );
  }
  if (status === "DUE_TODAY") {
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-800">
        Today
      </span>
    );
  }
  return (
    <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-700">
      Upcoming
    </span>
  );
}