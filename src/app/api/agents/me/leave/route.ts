import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // only agents may set leave for themselves
  if (session.user.role !== "AGENT") return NextResponse.json({ error: "Only agents can set leave" }, { status: 403 });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { from, until } = body;

  function parseDateOnly(input: string) {
    if (!input) return null;
    const m = String(input).match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      return new Date(Date.UTC(y, mo - 1, d));
    }
    const dt = new Date(input);
    return new Date(Date.UTC(dt.getUTCFullYear(), dt.getUTCMonth(), dt.getUTCDate()));
  }

  const fromDate = from ? parseDateOnly(from) : null;
  const untilDate = until ? parseDateOnly(until) : null;

  // apply update and shift followups if necessary
  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id: session.user.id }, data: { onLeaveFrom: fromDate, onLeaveUntil: untilDate } });

    if (fromDate && untilDate) {
      const start = new Date(fromDate);
      start.setUTCHours(0, 0, 0, 0);
      const end = new Date(untilDate);
      end.setUTCHours(23, 59, 59, 999);

      const returnDate = new Date(untilDate);
      returnDate.setUTCDate(returnDate.getUTCDate() + 1);
      returnDate.setUTCHours(0, 0, 0, 0);

      const owned = await tx.customer.findMany({ where: { ownerId: session.user.id, deletedAt: null }, select: { id: true } });
      const ownedIds = owned.map((c) => c.id);
      if (ownedIds.length > 0) {
        await tx.followup.updateMany({ where: { customerId: { in: ownedIds }, nextFollowupDate: { gte: start, lte: end } }, data: { nextFollowupDate: returnDate } });
      }
    }
  });

  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, email: true, role: true, onLeaveFrom: true, onLeaveUntil: true } });
  return NextResponse.json({ success: true, user });
}
