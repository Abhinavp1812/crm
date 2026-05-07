import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  getTodayFollowups,
  getFollowupCounts,
  getActiveRemarkOptions,
  formatPhone,
  whatsappLink,
  telLink,
} from "@/lib/followups";
import { CustomerTypeBadge, FollowupStatusBadge } from "@/components/StatusBadge";
import TopNav from "@/components/TopNav";
import FollowupEditButton from "@/components/FollowupEditButton";
import Link from "next/link";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

export default async function HomePage({ searchParams }: { searchParams: Promise<{ page?: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const params = await searchParams;
  const page = Math.max(1, parseInt(params.page || "1", 10) || 1);

  const [followups, counts, remarkOptions] = await Promise.all([
    getTodayFollowups(session.user.id, page, PAGE_SIZE),
    getFollowupCounts(session.user.id),
    getActiveRemarkOptions(),
  ]);

  const isAdmin = session.user.role === "ADMIN";
  const totalPages = Math.max(1, Math.ceil(counts.total / PAGE_SIZE));

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-gray-50 py-6">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-baseline justify-between mb-4">
            <h1 className="text-2xl font-bold text-gray-900">
              {isAdmin ? "Parking Lot" : session.user.name + "'s Followups"}
            </h1>
            <p className="text-sm text-gray-600">{counts.total.toLocaleString()} total</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard label="Overdue" value={counts.overdue} color="red" />
            <StatCard label="Due today" value={counts.dueToday} color="amber" />
            <StatCard label="Registered" value={counts.registered} color="blue" />
            <StatCard label="Booked" value={counts.booked} color="green" />
          </div>

          {isAdmin && counts.total > 0 ? (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900">
              You are seeing customers in the admin parking lot. Use the Admin page to distribute them.
            </div>
          ) : null}

          {counts.total === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">
              No followups due today.
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
                    {followups.map((f) => (<FollowupRow key={f.customerId} f={f} remarkOptions={remarkOptions} />))}
                  </tbody>
                </table>
              </div>

              <Pagination page={page} totalPages={totalPages} />
            </>
          )}
        </div>
      </main>
    </>
  );
}

function Pagination({ page, totalPages }: { page: number; totalPages: number }) {
  if (totalPages <= 1) return null;
  const prevPage = Math.max(1, page - 1);
  const nextPage = Math.min(totalPages, page + 1);
  return (
    <div className="flex items-center justify-between mt-4 px-1">
      <p className="text-sm text-gray-600">Page {page} of {totalPages}</p>
      <div className="flex gap-2">
        <Link
          href={"/?page=" + prevPage}
          aria-disabled={page === 1}
          className={"px-3 h-9 inline-flex items-center rounded text-sm " + (page === 1 ? "bg-gray-100 text-gray-400 pointer-events-none" : "bg-white border hover:bg-gray-50 text-gray-700")}
        >
          Previous
        </Link>
        <Link
          href={"/?page=" + nextPage}
          aria-disabled={page === totalPages}
          className={"px-3 h-9 inline-flex items-center rounded text-sm " + (page === totalPages ? "bg-gray-100 text-gray-400 pointer-events-none" : "bg-white border hover:bg-gray-50 text-gray-700")}
        >
          Next
        </Link>
      </div>
    </div>
  );
}

type RemarkOption = Awaited<ReturnType<typeof getActiveRemarkOptions>>[number];

function FollowupRow({ f, remarkOptions }: { f: Awaited<ReturnType<typeof getTodayFollowups>>[number]; remarkOptions: RemarkOption[] }) {
  const lastBookingText = f.lastBookingDate ? new Date(f.lastBookingDate).toLocaleDateString("en-IN") : "-";
  const lastContactText = f.lastContactedAt ? new Date(f.lastContactedAt).toLocaleDateString("en-IN") : "Never";
  const followupText = new Date(f.nextFollowupDate).toLocaleDateString("en-IN");
  const followupIso = new Date(f.nextFollowupDate).toISOString().slice(0, 10);
  const waMessage = "Hi " + (f.customerName ?? "") + ", this is from Style Lounge.";

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3"><FollowupStatusBadge status={f.status} /></td>
      <td className="px-4 py-3">
        <Link href={"/customers/" + f.customerId} className="font-medium text-gray-900 hover:text-blue-700">
          {f.customerName ?? "(no name)"}
        </Link>
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

function StatCard({ label, value, color }: { label: string; value: number; color: "red" | "amber" | "blue" | "green" }) {
  const colors = { red: "bg-red-50 text-red-700", amber: "bg-amber-50 text-amber-700", blue: "bg-blue-50 text-blue-700", green: "bg-green-50 text-green-700" };
  return (
    <div className={"rounded-lg p-3 " + colors[color]}>
      <p className="text-xs uppercase tracking-wide font-medium">{label}</p>
      <p className="text-2xl font-bold mt-1">{value.toLocaleString()}</p>
    </div>
  );
}
