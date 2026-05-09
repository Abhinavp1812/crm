import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Layout from "@/components/Layout";

export const dynamic = "force-dynamic";

export default async function AdminStatsPage() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/");

  // Get all active agents
  const agents = await prisma.user.findMany({
    where: { role: "AGENT", deletedAt: null },
    select: { id: true, name: true, onLeaveFrom: true },
    orderBy: { name: "asc" },
  });

  // Get totals across all customers
  const [
    totalCustomers,
    dncCustomers,
    closedCustomers,
    activeFollowups,
    totalBookings,
    paidBookings,
  ] = await Promise.all([
    prisma.customer.count({ where: { deletedAt: null } }),
    prisma.customer.count({ where: { deletedAt: null, doNotContact: true } }),
    prisma.customer.count({ where: { deletedAt: null, doNotContact: false, followup: null } }),
    prisma.followup.count({ where: { customer: { deletedAt: null, doNotContact: false } } }),
    prisma.booking.count(),
    prisma.booking.count({ where: { paymentStatus: { in: ["Success", "Partially Paid"] }, NOT: { status: "Cancelled" } } }),
  ]);

  // Per-agent stats
  const agentStats = await Promise.all(
    agents.map(async (a) => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const weekAgo = new Date(today);
      weekAgo.setDate(weekAgo.getDate() - 7);

      const [
        ownedCount,
        ownedActive,
        ownedDnc,
        callsThisWeek,
        remarksThisWeek,
        dueToday,
      ] = await Promise.all([
        prisma.customer.count({ where: { ownerId: a.id, deletedAt: null } }),
        prisma.customer.count({ where: { ownerId: a.id, deletedAt: null, doNotContact: false, followup: { isNot: null } } }),
        prisma.customer.count({ where: { ownerId: a.id, deletedAt: null, doNotContact: true } }),
        prisma.activityLog.count({ where: { userId: a.id, activityType: "CALL_LOGGED", createdAt: { gte: weekAgo } } }),
        prisma.activityLog.count({ where: { userId: a.id, activityType: "REMARK_ADDED", createdAt: { gte: weekAgo } } }),
        prisma.followup.count({
          where: {
            customer: { ownerId: a.id, deletedAt: null, doNotContact: false },
            nextFollowupDate: { gte: today, lt: tomorrow },
            currentRemark: { not: null },
          },
        }),
      ]);

      return {
        id: a.id,
        name: a.name,
        onLeave: !!a.onLeaveFrom,
        ownedCount,
        ownedActive,
        ownedDnc,
        callsThisWeek,
        remarksThisWeek,
        dueToday,
      };
    })
  );

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Team Stats</h1>
        <p className="text-sm text-gray-500 mt-0.5">Performance overview across all agents</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 mb-6">
        <Stat label="Total Customers" value={totalCustomers} />
        <Stat label="Active Followups" value={activeFollowups} />
        <Stat label="Closed" value={closedCustomers} />
        <Stat label="DNC" value={dncCustomers} />
        <Stat label="Total Bookings" value={totalBookings} />
        <Stat label="Paid Bookings" value={paidBookings} />
      </div>

      <h2 className="text-lg font-semibold text-gray-900 mb-3">Per-Agent Stats</h2>
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr className="text-left text-xs font-medium text-gray-700 uppercase">
                <th className="px-4 py-3">Agent</th>
                <th className="px-4 py-3">Owned</th>
                <th className="px-4 py-3">Active</th>
                <th className="px-4 py-3">DNC</th>
                <th className="px-4 py-3">Due Today</th>
                <th className="px-4 py-3">Calls (7d)</th>
                <th className="px-4 py-3">Remarks (7d)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {agentStats.map((a) => (
                <tr key={a.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {a.name}
                    {a.onLeave && <span className="ml-2 inline-block px-1.5 py-0.5 text-xs bg-amber-100 text-amber-800 rounded">On Leave</span>}
                  </td>
                  <td className="px-4 py-3 text-gray-700">{a.ownedCount.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-700">{a.ownedActive.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-700">{a.ownedDnc.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-700">{a.dueToday.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-700">{a.callsThisWeek.toLocaleString()}</td>
                  <td className="px-4 py-3 text-gray-700">{a.remarksThisWeek.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </Layout>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-white rounded-lg p-3 border border-gray-200">
      <p className="text-xs uppercase tracking-wide font-medium text-gray-500">{label}</p>
      <p className="text-xl font-bold mt-1 text-gray-900">{value.toLocaleString()}</p>
    </div>
  );
}