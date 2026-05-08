import { auth } from "@/auth";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  getClosedCustomers,
  getClosureReasons,
  formatPhone,
} from "@/lib/followups";
import { CustomerTypeBadge } from "@/components/StatusBadge";
import TopNav from "@/components/TopNav";
import ReopenFollowupButton from "@/components/ReopenFollowupButton";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function ClosedFollowupsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; reason?: string }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const reason = params.reason || "all";

  const [{ rows, total }, reasons] = await Promise.all([
    getClosedCustomers(reason === "all" ? null : reason, page, PAGE_SIZE),
    getClosureReasons(),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  function buildUrl(overrides: Record<string, string | undefined>) {
    const merged: Record<string, string | undefined> = {
      reason: reason !== "all" ? reason : undefined,
      ...overrides,
    };
    const qs = Object.entries(merged)
      .filter(([, v]) => v !== undefined && v !== "")
      .map(([k, v]) => k + "=" + encodeURIComponent(String(v)))
      .join("&");
    return "/admin/closed-followups" + (qs ? "?" + qs : "");
  }

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-gray-50 py-6">
        <div className="max-w-7xl mx-auto px-4">
          <Link href="/admin" className="text-sm text-gray-600 hover:text-gray-900">
            Back to Admin
          </Link>
          <div className="flex items-baseline justify-between mt-2 mb-4">
            <h1 className="text-2xl font-bold text-gray-900">Closed Followups</h1>
            <p className="text-sm text-gray-600">{total.toLocaleString()} customers</p>
          </div>

          <p className="text-sm text-gray-600 mb-4">
            Customers whose followup cycle has ended. Re-open to put them back into their owner&apos;s queue with today&apos;s date.
          </p>

          <div className="flex gap-1 mb-4 border-b border-gray-200 bg-white rounded-t-lg px-2 pt-2 overflow-x-auto">
            <FilterTab href={buildUrl({ reason: undefined })} active={reason === "all"} label="All" />
            <FilterTab href={buildUrl({ reason: "dnc" })} active={reason === "dnc"} label="Do Not Contact" />
            {reasons
              .filter((r) => r !== "dnc")
              .map((r) => (
                <FilterTab
                  key={r}
                  href={buildUrl({ reason: r })}
                  active={reason === r}
                  label={r}
                />
              ))}
          </div>

          {total === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">
              No closed followups in this view.
            </div>
          ) : (
            <>
              <div className="bg-white rounded-lg shadow overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr className="text-left text-xs font-medium text-gray-700 uppercase">
                      <th className="px-3 py-3">Customer</th>
                      <th className="px-3 py-3">Type</th>
                      <th className="px-3 py-3">Phone</th>
                      <th className="px-3 py-3">City</th>
                      <th className="px-3 py-3">Owner</th>
                      <th className="px-3 py-3">Closed Reason</th>
                      <th className="px-3 py-3">Closed On</th>
                      <th className="px-3 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {rows.map((c) => {
                      const closedAtText = c.closedAt
                        ? new Date(c.closedAt).toLocaleDateString("en-IN")
                        : "-";

                      return (
                        <tr key={c.id} className="hover:bg-gray-50">
                          <td className="px-3 py-3">
                            <Link
                              href={"/customers/" + c.id}
                              className="font-medium text-gray-900 hover:text-blue-700"
                            >
                              {c.name ?? "(no name)"}
                            </Link>
                          </td>
                          <td className="px-3 py-3">
                            <CustomerTypeBadge
                              type={c.customerType}
                              doNotContact={c.doNotContact}
                            />
                          </td>
                          <td className="px-3 py-3 font-mono text-gray-700 whitespace-nowrap">
                            {formatPhone(c.phone)}
                          </td>
                          <td className="px-3 py-3 text-gray-600">{c.city ?? "-"}</td>
                          <td className="px-3 py-3 text-gray-600">{c.ownerName ?? "-"}</td>
                          <td className="px-3 py-3 text-gray-700">
                            <span className={c.doNotContact ? "text-red-700 font-medium" : ""}>
                              {c.closedReason}
                            </span>
                          </td>
                          <td className="px-3 py-3 text-gray-600 whitespace-nowrap">{closedAtText}</td>
                          <td className="px-3 py-3">
                            <div className="flex gap-1 flex-wrap">
                              <ReopenFollowupButton
                                customerId={c.id}
                                customerName={c.name}
                                isDnc={c.doNotContact}
                              />
                              <Link
                                href={"/customers/" + c.id}
                                className="inline-flex items-center px-2 h-7 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs"
                              >
                                Open
                              </Link>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 ? (
                <div className="flex items-center justify-between mt-4 px-1">
                  <p className="text-sm text-gray-600">Page {page} of {totalPages}</p>
                  <div className="flex gap-2">
                    <Link
                      href={buildUrl({ page: String(Math.max(1, page - 1)) })}
                      aria-disabled={page === 1}
                      className={
                        "px-3 h-9 inline-flex items-center rounded text-sm " +
                        (page === 1
                          ? "bg-gray-100 text-gray-400 pointer-events-none"
                          : "bg-white border hover:bg-gray-50 text-gray-700")
                      }
                    >
                      Previous
                    </Link>
                    <Link
                      href={buildUrl({ page: String(Math.min(totalPages, page + 1)) })}
                      aria-disabled={page === totalPages}
                      className={
                        "px-3 h-9 inline-flex items-center rounded text-sm " +
                        (page === totalPages
                          ? "bg-gray-100 text-gray-400 pointer-events-none"
                          : "bg-white border hover:bg-gray-50 text-gray-700")
                      }
                    >
                      Next
                    </Link>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </main>
    </>
  );
}

function FilterTab({
  href,
  active,
  label,
}: {
  href: string;
  active: boolean;
  label: string;
}) {
  return (
    <Link
      href={href}
      className={
        "px-4 py-2 text-sm font-medium border-b-2 transition rounded-t whitespace-nowrap " +
        (active
          ? "border-blue-600 text-blue-700 bg-blue-50"
          : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50")
      }
    >
      {label}
    </Link>
  );
}
