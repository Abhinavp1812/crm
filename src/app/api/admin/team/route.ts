import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      isActive: true,
      onLeaveFrom: true,
      onLeaveUntil: true,
      createdAt: true,
      updatedAt: true,
      _count: undefined,
    },
  });

  // Attach counts of owned customers
  const counts = await prisma.customer.groupBy({
    by: ["ownerId"],
    where: { deletedAt: null, ownerId: { in: users.map((u) => u.id) } },
    _count: { _all: true },
  });
  const countBy: Record<string, number> = {};
  for (const c of counts) if (c.ownerId) countBy[c.ownerId] = c._count._all;

  const payload = users.map((u) => ({
    ...u,
    customersOwned: countBy[u.id] || 0,
  }));

  return NextResponse.json({ success: true, users: payload });
}

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { name?: string; email?: string; password?: string; role?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, email, password, role } = body;
  if (!name || !email || !password) {
    return NextResponse.json({ error: "Missing fields" }, { status: 400 });
  }

  const emailNorm = email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: emailNorm } });
  if (existing) return NextResponse.json({ error: "Email already in use" }, { status: 409 });

  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      name,
      email: emailNorm,
      passwordHash,
      role: role === "ADMIN" ? "ADMIN" : "AGENT",
      isActive: true,
    },
    select: { id: true, name: true, email: true, role: true, isActive: true },
  });

  return NextResponse.json({ success: true, user });
}
