import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function POST(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

  let body: { customerId?: string; note?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const { customerId, note } = body;
  if (!customerId) {
    return NextResponse.json({ error: "Missing customerId" }, { status: 400 });
  }

  const customer = await prisma.customer.findUnique({ where: { id: customerId } });
  if (!customer) {
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });
  }

  const isOwner = customer.ownerId === userId;
  const isAdmin = session.user.role === "ADMIN";
  if (!isOwner && !isAdmin) {
    return NextResponse.json({ error: "You don't own this customer" }, { status: 403 });
  }

  await prisma.activityLog.create({
    data: {
      customerId,
      userId,
      activityType: "CALL_LOGGED",
      note: note || null,
    },
  });

  // Also bump lastContactedAt on the followup if one exists
  await prisma.followup.updateMany({
    where: { customerId },
    data: { lastContactedAt: new Date(), lastContactedById: userId },
  });

  return NextResponse.json({ success: true });
}