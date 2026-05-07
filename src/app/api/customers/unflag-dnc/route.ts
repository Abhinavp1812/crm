import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Admin only" }, { status: 403 });
  }
  const userId = session.user.id;

  let body: { customerId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  if (!body.customerId) {
    return NextResponse.json({ error: "Missing customerId" }, { status: 400 });
  }

  await prisma.$transaction([
    prisma.customer.update({
      where: { id: body.customerId },
      data: {
        doNotContact: false,
        doNotContactReason: null,
        doNotContactSetAt: null,
        doNotContactSetBy: null,
      },
    }),
    prisma.activityLog.create({
      data: {
        customerId: body.customerId,
        userId,
        activityType: "DNC_UNFLAGGED",
        note: "Manually un-flagged by admin",
      },
    }),
  ]);

  return NextResponse.json({ success: true });
}