import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  getTodayFollowups,
  getFollowupCounts,
  getFilteredCount,
  getActiveRemarkOptions,
  formatPhone,
  whatsappLink,
  telLink,
  type FollowupFilter,
  type BookingFlavor,
} from "@/lib/followups";
import { CustomerTypeBadge, FollowupStatusBadge } from "@/components/StatusBadge";
import TopNav from "@/components/TopNav";
import FollowupEditButton from "@/components/FollowupEditButton";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; filter?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);
  const validFilters: FollowupFilter[] = [
    "all",
    "cold",
    "booked",
    "todays_followup",
    "pipeline",
    "action_required",
    "registered",
    "booked_type",
  ];
  const filter: FollowupFilter = validFilters.includes(params.filter as FollowupFilter)
    ? (params.filter as FollowupFilter)
    : "all";

  const [followups, counts, filteredCount, remarkOptions] = await Promise.all([
    getTodayFollowups(session.user.id, page, PAGE_SIZE, filter),
    getFollowupCounts(session.user.id),
    getFilteredCount(session.user.id, filter),
    getActiveRemarkOptions(),
  ]);

  const isAdmin = session.user.role === "ADMIN";
  const totalPages = Math.max(1, Math.ceil(filteredCount / PAGE_SIZE));

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-gray-50 py-6">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-baseline justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">
              {isAdmin ? "Parking Lot" : session.user.name + "'s Followups"}
            </h1>
            <p className="text-sm text-gray-600">
              {filteredCount.toLocaleString()} of {counts.total.toLocaleString()}
            </p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            <StatCard label="Cold" value={counts.cold} color="purple" />
            <StatCard label="Booked" value={counts.booked} color="green" />
            <StatCard label="Today's Followup" value={counts.todaysFollowup} color="blue" />
            <StatCard label="Pipeline" value={counts.pipeline} color="amber" />
            <StatCard label="Action Required" value={counts.actionRequired} color="red" />
          </div>

          <FilterTabs currentFilter={filter} counts={counts} />

          {isAdmin && counts.total > 0 ? (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900">
              You are seeing customers in the admin parking lot. Use the Admin page to distribute them.
            </div>
          ) : null}

          {filteredCount === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">
              No followups in this view.
            </div>
          ) : (
            <>
              <div className="bg-white rounded-lg shadow overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 border-b">
                    <tr className="text-left text-xs font-medium text-gray-700 uppercase">
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">City</th>
                      <th className="px-4 py-3">Last Booking</th>
                      <th className="px-4 py-3">Last Contact</th>
                      <th className="px-4 py-3">Followup Date</th>
                      <th className="px-4 py-3">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {followups.map((f) => (
                      <FollowupRow key={f.customerId} f={f} remarkOptions={remarkOptions} />
                    ))}
                  </tbody>
                </table>
              </div>

              <Pagination page={page} totalPages={totalPages} filter={filter} />
            </>
          )}
        </div>
      </main>
    </>
  );
}

function FilterTabs({
  currentFilter,
  counts,
}: {
  currentFilter: FollowupFilter;
  counts: {
    total: number;
    cold: number;
    booked: number;
    todaysFollowup: number;
    pipeline: number;
    actionRequired: number;
    registered: number;
    bookedType: number;
  };
}) {
  const tabs: { id: FollowupFilter; label: string; count: number }[] = [
    { id: "all", label: "All", count: counts.total },
    { id: "cold", label: "Cold", count: counts.cold },
    { id: "booked", label: "Booked", count: counts.booked },
    { id: "todays_followup", label: "Today's Followup", count: counts.todaysFollowup },
    { id: "pipeline", label: "Pipeline", count: counts.pipeline },
    { id: "action_required", label: "Action Required", count: counts.actionRequired },
    { id: "registered", label: "Registered", count: counts.registered },
    { id: "booked_type", label: "Booked (type)", count: counts.bookedType },
  ];

  return (
    <div className="flex gap-1 mb-4 border-b border-gray-200 bg-white rounded-t-lg px-2 pt-2 overflow-x-auto">
      {tabs.map((t) => {
        const active = currentFilter === t.id;
        const href = t.id === "all" ? "/" : "/?filter=" + t.id;
        return (
          <Link
            key={t.id}
            href={href}
            className={
              "px-4 py-2 text-sm font-medium border-b-2 transition rounded-t whitespace-nowrap " +
              (active
                ? "border-blue-600 text-blue-700 bg-blue-50"
                : "border-transparent text-gray-600 hover:text-gray-900 hover:bg-gray-50")
            }
          >
            {t.label}{" "}
            <span className={"ml-1.5 text-xs " + (active ? "text-blue-700" : "text-gray-500")}>
              ({t.count.toLocaleString()})
            </span>
          </Link>
        );
      })}
    </div>
  );
}

function Pagination({
  page,
  totalPages,
  filter,
}: {
  page: number;
  totalPages: number;
  filter: FollowupFilter;
}) {
  if (totalPages <= 1) return null;
  const prevPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);
  const filterParam = filter !== "all" ? "&filter=" + filter : "";
  return (
    <div className="flex items-center justify-between mt-4 px-1">
      <p className="text-sm text-gray-600">Page {page} of {totalPages}</p>
      <div className="flex gap-2">
        <Link
          href={"/?page=" + prevPage + filterParam}
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
          href={"/?page=" + nextPage + filterParam}
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
  );
}

function BookingFlavorBadge({ flavor }: { flavor: BookingFlavor }) {
  if (!flavor) return null;
  const styles: Record<string, { label: string; color: string }> = {
    AWAITING_SERVICE: { label: "Awaiting service", color: "bg-blue-100 text-blue-800" },
    PAID_NOT_DONE: { label: "Paid, not done", color: "bg-orange-100 text-orange-800" },
    COMPLETED: { label: "Completed", color: "bg-green-100 text-green-800" },
    IN_PROGRESS: { label: "In progress", color: "bg-yellow-100 text-yellow-800" },
  };
  const s = styles[flavor];
  if (!s) return null;
  return (
    <span className={"ml-2 inline-block px-1.5 py-0.5 text-xs rounded " + s.color}>{s.label}</span>
  );
}

type RemarkOption = Awaited<ReturnType<typeof getActiveRemarkOptions>>[number];

function FollowupRow({
  f,
  remarkOptions,
}: {
  f: Awaited<ReturnType<typeof getTodayFollowups>>[number];
  remarkOptions: RemarkOption[];
}) {
  const lastBookingText = f.lastBookingDate ? new Date(f.lastBookingDate).toLocaleDateString("en-IN") : "-";
  const lastContactText = f.lastContactedAt ? new Date(f.lastContactedAt).toLocaleDateString("en-IN") : "Never";
  const followupText = new Date(f.effectiveFollowupDate).toLocaleDateString("en-IN");
  const followupIso = new Date(f.nextFollowupDate).toISOString().slice(0, 10);
  const waMessage = "Hi " + (f.customerName ?? "") + ", this is from Style Lounge.";

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3"><FollowupStatusBadge status={f.status} /></td>
      <td className="px-4 py-3">
        <Link href={"/customers/" + f.customerId} className="font-medium text-gray-900 hover:text-blue-700">
          {f.customerName ?? "(no name)"}
        </Link>
        {f.untouched && !f.isBooked && !f.isCancelledRecovery ? (
          <span className="ml-2 inline-block px-1.5 py-0.5 text-xs bg-purple-100 text-purple-800 rounded">Cold</span>
        ) : null}
        {f.isCancelledRecovery ? (
          <span className="ml-2 inline-block px-1.5 py-0.5 text-xs bg-red-100 text-red-800 rounded">Recover</span>
        ) : null}
        <BookingFlavorBadge flavor={f.bookingFlavor} />
        {f.isStale ? (
          <span className="ml-2 inline-block px-1.5 py-0.5 text-xs bg-amber-100 text-amber-800 rounded">Stale</span>
        ) : null}
        {f.currentRemark ? <div className="text-xs text-gray-500 mt-0.5">Last: {f.currentRemark}</div> : null}
      </td>
      <td className="px-4 py-3"><CustomerTypeBadge type={f.customerType} doNotContact={f.doNotContact} /></td>
      <td className="px-4 py-3 font-mono text-gray-700 whitespace-nowrap">{formatPhone(f.phone)}</td>
      <td className="px-4 py-3 text-gray-600">{f.city ?? "-"}</td>
      <td className="px-4 py-3 text-gray-600">
        {lastBookingText}
        {f.lastBookingSalon ? <div className="text-xs text-gray-500">{f.lastBookingSalon}</div> : null}
      </td>
      <td className="px-4 py-3 text-gray-600">{lastContactText}</td>
      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{followupText}</td>
      <td className="px-4 py-3">
        <div className="flex gap-2 flex-wrap">
          <a href={telLink(f.phone)} title="Call" className="inline-flex items-center justify-center px-2 h-8 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs">Call</a>
          <a href={whatsappLink(f.phone, waMessage)} target="_blank" rel="noopener" title="WhatsApp" className="inline-flex items-center justify-center px-2 h-8 rounded bg-green-50 text-green-700 hover:bg-green-100 text-xs">WA</a>
          <FollowupEditButton
            customerId={f.customerId}
            customerName={f.customerName}
            currentRemark={f.currentRemark}
            currentNote={f.currentNote}
            currentFollowupDate={followupIso}
            remarkOptions={remarkOptions}
          />
          <Link href={"/customers/" + f.customerId} title="Open" className="inline-flex items-center justify-center px-2 h-8 rounded bg-gray-100 text-gray-700 hover:bg-gray-200 text-xs">Open</Link>
        </div>
      </td>
    </tr>
  );
}

function StatCard({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: "red" | "amber" | "blue" | "green" | "purple";
}) {
  const colors = {
    red: "bg-red-50 text-red-700",
    amber: "bg-amber-50 text-amber-700",
    blue: "bg-blue-50 text-blue-700",
    green: "bg-green-50 text-green-700",
    purple: "bg-purple-50 text-purple-700",
  };
  return (
    <div className={"rounded-lg p-3 " + colors[color]}>
      <p className="text-xs uppercase tracking-wide font-medium">{label}</p>
      <p className="text-2xl font-bold mt-1">{value.toLocaleString()}</p>
    </div>
  );
}
