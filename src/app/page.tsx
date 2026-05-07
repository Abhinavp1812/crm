import { auth } from "@/auth";
import { redirect } from "next/navigation";
import {
  getTodayFollowups,
  formatPhone,
  whatsappLink,
  telLink,
} from "@/lib/followups";
import {
  CustomerTypeBadge,
  FollowupStatusBadge,
} from "@/components/StatusBadge";
import TopNav from "@/components/TopNav";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const followups = await getTodayFollowups(session.user.id);
  const overdueCount = followups.filter((f) => f.status === "OVERDUE").length;
  const todayCount = followups.filter((f) => f.status === "DUE_TODAY").length;
  const registeredCount = followups.filter((f) => f.customerType === "NEW_REGISTRATION").length;
  const bookedCount = followups.filter((f) => f.customerType === "CUSTOMER").length;
  const isAdmin = session.user.role === "ADMIN";

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-gray-50 py-6">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex items-baseline justify-between mb-4">
            <h1 className="text-2xl font-bold">
              {isAdmin ? "Parking Lot" : session.user.name + "'s Followups"}
            </h1>
            <p className="text-sm text-gray-600">{followups.length.toLocaleString()} total</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
            <StatCard label="Overdue" value={overdueCount} color="red" />
            <StatCard label="Due today" value={todayCount} color="amber" />
            <StatCard label="Registered" value={registeredCount} color="blue" />
            <StatCard label="Booked" value={bookedCount} color="green" />
          </div>

          {isAdmin && followups.length > 0 ? (
            <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded text-sm text-blue-900">
              You are seeing customers in the admin parking lot. Use the Admin page to distribute them.
            </div>
          ) : null}

          {followups.length === 0 ? (
            <div className="bg-white rounded-lg shadow p-8 text-center text-gray-600">
              No followups due today.
            </div>
          ) : (
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
                  {followups.slice(0, 200).map((f) => (<FollowupRow key={f.customerId} f={f} />))}
                </tbody>
              </table>
              {followups.length > 200 ? (
                <div className="p-4 text-center text-sm text-gray-600 bg-gray-50 border-t">
                  Showing first 200 of {followups.length.toLocaleString()}.
                </div>
              ) : null}
            </div>
          )}
        </div>
      </main>
    </>
  );
}

function FollowupRow({ f }: { f: Awaited<ReturnType<typeof getTodayFollowups>>[number] }) {
  const lastBookingText = f.lastBookingDate ? new Date(f.lastBookingDate).toLocaleDateString("en-IN") : "-";
  const lastContactText = f.lastContactedAt ? new Date(f.lastContactedAt).toLocaleDateString("en-IN") : "Never";
  const followupText = new Date(f.nextFollowupDate).toLocaleDateString("en-IN");
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
      <td className="px-4 py-3 font-mono text-gray-700">{formatPhone(f.phone)}</td>
      <td className="px-4 py-3 text-gray-600">{f.city ?? "-"}</td>
      <td className="px-4 py-3 text-gray-600">
        {lastBookingText}
        {f.lastBookingSalon ? <div className="text-xs text-gray-500">{f.lastBookingSalon}</div> : null}
      </td>
      <td className="px-4 py-3 text-gray-600">{lastContactText}</td>
      <td className="px-4 py-3 text-gray-700">{followupText}</td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <a href={telLink(f.phone)} title="Call" className="inline-flex items-center justify-center px-2 h-8 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs">Call</a>
          <a href={whatsappLink(f.phone, waMessage)} target="_blank" rel="noopener" title="WhatsApp" className="inline-flex items-center justify-center px-2 h-8 rounded bg-green-50 text-green-700 hover:bg-green-100 text-xs">WA</a>
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
