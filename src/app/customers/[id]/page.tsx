import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatPhone, whatsappLink, telLink, getActiveRemarkOptions } from "@/lib/followups";
import { CustomerTypeBadge } from "@/components/StatusBadge";
import TopNav from "@/components/TopNav";
import FollowupEditButton from "@/components/FollowupEditButton";
import LogCallButton from "@/components/LogCallButton";
import UnflagDncButton from "@/components/UnflagDncButton";
import Tabs from "@/components/Tabs";

export const dynamic = "force-dynamic";

export default async function CustomerPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { id } = await params;

  const [customer, remarkOptions] = await Promise.all([
    prisma.customer.findUnique({
      where: { id },
      include: {
        owner: { select: { name: true, email: true } },
        followup: true,
        bookings: { orderBy: { bookingDate: "desc" }, include: { salon: { select: { name: true, city: true } } } },
        registrations: { orderBy: { onboardingDate: "desc" } },
        activities: { orderBy: { createdAt: "desc" }, include: { user: { select: { name: true } } }, take: 200 },
      },
    }),
    getActiveRemarkOptions(),
  ]);

  if (!customer) notFound();

  const isAdmin = session.user.role === "ADMIN";
  const isOwner = customer.ownerId === session.user.id;
  const canEdit = isOwner || isAdmin;

  function toLocalIso(date: Date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  const followupIso = customer.followup
    ? toLocalIso(new Date(customer.followup.nextFollowupDate))
    : toLocalIso(new Date());

  const lastBooking = customer.bookings[0];
  const completedBookings = customer.bookings.filter((b) => b.status === "Completed");
  const totalSpend = completedBookings.reduce((sum, b) => sum + (b.grandTotal ? Number(b.grandTotal) : 0), 0);
  const waMessage = "Hi " + (customer.name ?? "") + ", this is from Style Lounge.";

  return (
    <>
      <TopNav />
      <main className="min-h-screen bg-gray-50 py-6">
        <div className="max-w-5xl mx-auto px-4">
          <Link href="/" className="text-sm text-gray-600 hover:text-gray-900">Back to followups</Link>

          {customer.doNotContact ? (
            <div className="mt-3 p-4 bg-red-50 border border-red-200 rounded">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-semibold text-red-900">Do Not Contact</p>
                  <p className="text-sm text-red-800 mt-1">{customer.doNotContactReason || "(no reason given)"}</p>
                  <p className="text-xs text-red-700 mt-1">
                    Flagged {customer.doNotContactSetAt ? new Date(customer.doNotContactSetAt).toLocaleDateString("en-IN") : ""}
                  </p>
                </div>
                {isAdmin ? <UnflagDncButton customerId={customer.id} /> : null}
              </div>
            </div>
          ) : null}

          <div className="mt-3 bg-white rounded-lg shadow p-5">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold">{customer.name || "(no name)"}</h1>
                  <CustomerTypeBadge type={customer.customerType} doNotContact={customer.doNotContact} />
                </div>
                <p className="text-sm text-gray-600">
                  <span className="font-mono">{formatPhone(customer.phone)}</span>
                  {customer.city ? <span className="ml-2">{". " + customer.city}</span> : null}
                  {customer.gender ? <span className="ml-2">{". " + customer.gender}</span> : null}
                </p>
                {customer.address ? <p className="text-sm text-gray-600 mt-1">{customer.address}</p> : null}
                <p className="text-xs text-gray-500 mt-2">
                  Owner: <strong>{customer.owner?.name || "-"}</strong>
                  {customer.customerIdExt ? <span className="ml-3">External ID: {customer.customerIdExt}</span> : null}
                </p>
              </div>
              {!customer.doNotContact ? (
                <div className="flex flex-wrap gap-2">
                  <a href={telLink(customer.phone)} className="inline-flex items-center px-3 h-9 rounded bg-blue-50 text-blue-700 hover:bg-blue-100 text-sm font-medium">Call</a>
                  <a href={whatsappLink(customer.phone, waMessage)} target="_blank" rel="noopener" className="inline-flex items-center px-3 h-9 rounded bg-green-50 text-green-700 hover:bg-green-100 text-sm font-medium">WhatsApp</a>
                  {canEdit ? <LogCallButton customerId={customer.id} /> : null}
                  {canEdit ? (
                    <FollowupEditButton
                      customerId={customer.id}
                      customerName={customer.name}
                      currentRemark={customer.followup?.currentRemark || null}
                      currentNote={customer.followup?.currentNote || null}
                      currentFollowupDate={followupIso}
                      remarkOptions={remarkOptions}
                    />
                  ) : null}
                </div>
              ) : null}
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
            <Stat label="Next followup" value={customer.followup ? new Date(customer.followup.nextFollowupDate).toLocaleDateString("en-IN") : "-"} />
            <Stat label="Last contact" value={customer.followup?.lastContactedAt ? new Date(customer.followup.lastContactedAt).toLocaleDateString("en-IN") : "Never"} />
            <Stat label="Total bookings" value={customer.bookings.length.toString()} />
            <Stat label="Lifetime spend" value={totalSpend > 0 ? "Rs. " + Math.round(totalSpend).toLocaleString("en-IN") : "-"} />
          </div>

          {customer.followup && (customer.followup.currentRemark || customer.followup.currentNote) ? (
            <div className="mt-4 bg-white rounded-lg shadow p-4">
              <p className="text-xs uppercase text-gray-500 font-medium mb-1">Current state</p>
              {customer.followup.currentRemark ? <p className="text-sm"><strong>Remark:</strong> {customer.followup.currentRemark}</p> : null}
              {customer.followup.currentNote ? <p className="text-sm mt-1"><strong>Note:</strong> {customer.followup.currentNote}</p> : null}
            </div>
          ) : null}

          {lastBooking ? (
            <div className="mt-4 bg-white rounded-lg shadow p-4">
              <p className="text-xs uppercase text-gray-500 font-medium mb-1">Most recent booking</p>
              <p className="text-sm">
                <strong>{lastBooking.salon?.name || lastBooking.salonNameSnapshot || "Unknown salon"}</strong>
                {lastBooking.bookingDate ? <span className="text-gray-600"> on {new Date(lastBooking.bookingDate).toLocaleDateString("en-IN")}</span> : null}
              </p>
              <p className="text-xs text-gray-600 mt-1">
                Order #{lastBooking.orderNo} . {lastBooking.status || "?"} . {lastBooking.paymentStatus || "?"}
                {lastBooking.grandTotal ? <span> . Rs. {Math.round(Number(lastBooking.grandTotal)).toLocaleString("en-IN")}</span> : null}
              </p>
            </div>
          ) : null}

          <div className="mt-6 bg-white rounded-lg shadow p-4">
            <Tabs
              tabs={[
                { id: "timeline", label: "Timeline", count: customer.activities.length, content: <Timeline activities={customer.activities} /> },
                { id: "bookings", label: "Bookings", count: customer.bookings.length, content: <BookingsTable bookings={customer.bookings} /> },
                { id: "registrations", label: "Registrations", count: customer.registrations.length, content: <RegistrationsTable registrations={customer.registrations} /> },
              ]}
            />
          </div>
        </div>
      </main>
    </>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg shadow p-3">
      <p className="text-xs uppercase tracking-wide text-gray-500 font-medium">{label}</p>
      <p className="text-lg font-semibold mt-1">{value}</p>
    </div>
  );
}

type Activity = {
  id: string;
  activityType: string;
  remark: string | null;
  note: string | null;
  oldValue: string | null;
  newValue: string | null;
  createdAt: Date;
  user: { name: string } | null;
};

function activityLabel(a: Activity): string {
  switch (a.activityType) {
    case "REMARK_ADDED": return "Remark: " + (a.remark || "");
    case "NOTE_ADDED": return "Note added";
    case "FOLLOWUP_DATE_CHANGED": {
      const oldD = a.oldValue ? new Date(a.oldValue).toLocaleDateString("en-IN") : "-";
      const newD = a.newValue ? new Date(a.newValue).toLocaleDateString("en-IN") : "-";
      return "Follow-up moved: " + oldD + " to " + newD;
    }
    case "OWNER_CHANGED": return "Owner changed: " + (a.oldValue || "-") + " to " + (a.newValue || "-");
    case "CUSTOMER_IMPORTED": return "Customer imported (registration CSV)";
    case "BOOKING_IMPORTED": return "Booking imported";
    case "REGISTRATION_IMPORTED": return "Registration imported";
    case "CUSTOMER_TYPE_CHANGED": return "Type changed: " + a.oldValue + " to " + a.newValue;
    case "DNC_FLAGGED": return "Flagged Do Not Contact";
    case "DNC_UNFLAGGED": return "DNC flag removed";
    case "CALL_LOGGED": return "Call logged";
    default: return a.activityType;
  }
}

function Timeline({ activities }: { activities: Activity[] }) {
  if (activities.length === 0) return <p className="text-sm text-gray-500">No activity yet.</p>;
  return (
    <div className="space-y-2">
      {activities.map((a) => (
        <div key={a.id} className="border-l-2 border-gray-200 pl-3 py-1">
          <p className="text-sm">
            <strong>{activityLabel(a)}</strong>
            {a.note ? <span className="text-gray-700">{" - " + a.note}</span> : null}
          </p>
          <p className="text-xs text-gray-500 mt-0.5">
            {new Date(a.createdAt).toLocaleString("en-IN")}
            {a.user?.name ? <span>{" . by " + a.user.name}</span> : null}
          </p>
        </div>
      ))}
    </div>
  );
}

type Booking = {
  id: string;
  orderNo: string | null;
  bookingDate: Date | null;
  status: string | null;
  paymentStatus: string | null;
  grandTotal: unknown;
  salonNameSnapshot: string | null;
  salon: { name: string; city: string | null } | null;
};

function BookingsTable({ bookings }: { bookings: Booking[] }) {
  if (bookings.length === 0) return <p className="text-sm text-gray-500">No bookings yet.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-700">
          <tr>
            <th className="px-3 py-2 text-left">Date</th>
            <th className="px-3 py-2 text-left">Salon</th>
            <th className="px-3 py-2 text-left">Order</th>
            <th className="px-3 py-2 text-left">Status</th>
            <th className="px-3 py-2 text-left">Payment</th>
            <th className="px-3 py-2 text-right">Amount</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {bookings.map((b) => (
            <tr key={b.id}>
              <td className="px-3 py-2">{b.bookingDate ? new Date(b.bookingDate).toLocaleDateString("en-IN") : "-"}</td>
              <td className="px-3 py-2">
                {b.salon?.name || b.salonNameSnapshot || "-"}
                {b.salon?.city ? <span className="text-gray-500 text-xs">{" . " + b.salon.city}</span> : null}
              </td>
              <td className="px-3 py-2 font-mono text-xs">{b.orderNo}</td>
              <td className="px-3 py-2">{b.status || "-"}</td>
              <td className="px-3 py-2">{b.paymentStatus || "-"}</td>
              <td className="px-3 py-2 text-right">{b.grandTotal ? "Rs. " + Math.round(Number(b.grandTotal)).toLocaleString("en-IN") : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

type Registration = {
  id: string;
  customerIdExt: string | null;
  onboardingDate: Date | null;
  createdAt: Date;
};

function RegistrationsTable({ registrations }: { registrations: Registration[] }) {
  if (registrations.length === 0) return <p className="text-sm text-gray-500">No registration records.</p>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-xs uppercase text-gray-700">
          <tr>
            <th className="px-3 py-2 text-left">Onboarding date</th>
            <th className="px-3 py-2 text-left">External ID</th>
            <th className="px-3 py-2 text-left">Imported</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {registrations.map((r) => (
            <tr key={r.id}>
              <td className="px-3 py-2">{r.onboardingDate ? new Date(r.onboardingDate).toLocaleDateString("en-IN") : "-"}</td>
              <td className="px-3 py-2 font-mono text-xs">{r.customerIdExt || "-"}</td>
              <td className="px-3 py-2 text-gray-600">{new Date(r.createdAt).toLocaleDateString("en-IN")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
