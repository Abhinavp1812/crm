import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Find active agents
  const agents = await prisma.user.findMany({ where: { role: "AGENT", deletedAt: null, onLeaveFrom: null }, select: { id: true } });
  const agentIds = agents.map((a) => a.id);
  if (agentIds.length === 0) return NextResponse.json({ error: "No active agents" }, { status: 400 });

  // Count total customers to distribute
  const total = await prisma.customer.count({ where: { deletedAt: null } });
  const per = Math.floor(total / agentIds.length);
  let remainder = total - per * agentIds.length;

  // Get current counts
  const counts = await prisma.customer.groupBy({ by: ["ownerId"], where: { ownerId: { in: agentIds }, deletedAt: null }, _count: { _all: true } });
  const countBy: Record<string, number> = {};
  for (const r of counts) if (r.ownerId) countBy[r.ownerId] = r._count._all;

  // Build target map
  const targets: Record<string, number> = {};
  for (const id of agentIds) {
    targets[id] = per + (remainder > 0 ? 1 : 0);
    if (remainder > 0) remainder--;
  }

  // Determine surpluses and deficits
  const surplusOwners: string[] = [];
  const deficitOwners: string[] = [];
  for (const id of agentIds) {
    const cur = countBy[id] || 0;
    if (cur > targets[id]) surplusOwners.push(id);
    else if (cur < targets[id]) deficitOwners.push(id);
  }

  // Early exit if already balanced
  if (surplusOwners.length === 0 && deficitOwners.length === 0) {
    return NextResponse.json({ success: true, message: "Already balanced" });
  }

  // Rebalance: for each deficit, pull customers from surplus owners until target met
  await prisma.$transaction(async (tx) => {
    // Convert to mutable arrays
    const surplus = surplusOwners.slice();
    const deficit = deficitOwners.slice();

    let sIdx = 0;
    for (let dIdx = 0; dIdx < deficit.length; dIdx++) {
      const dest = deficit[dIdx];
      let need = targets[dest] - (countBy[dest] || 0);
      while (need > 0 && sIdx < surplus.length) {
        const src = surplus[sIdx];
        const srcCur = countBy[src] || 0;
        const avail = srcCur - targets[src];
        if (avail <= 0) {
          sIdx++;
          continue;
        }

        const take = Math.min(avail, need);
        // select 'take' customers from src and move to dest
        const customers = await tx.customer.findMany({ where: { ownerId: src, deletedAt: null }, select: { id: true }, take });
        const ids = customers.map((c) => c.id);
        if (ids.length > 0) {
          await tx.customer.updateMany({ where: { id: { in: ids } }, data: { ownerId: dest } });
          countBy[src] = (countBy[src] || 0) - ids.length;
          countBy[dest] = (countBy[dest] || 0) + ids.length;
          need -= ids.length;
        } else {
          sIdx++;
        }

        if (countBy[src] <= targets[src]) sIdx++;
      }
    }
  });

  return NextResponse.json({ success: true });
}
