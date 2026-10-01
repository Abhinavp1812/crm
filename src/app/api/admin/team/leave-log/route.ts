import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const [records, users] = await Promise.all([
    prisma.leaveRecord.findMany({ orderBy: { startDate: "desc" }, take: 200 }),
    prisma.user.findMany({ select: { id: true, name: true } }),
  ]);
  const nameById = new Map(users.map((u) => [u.id, u.name]));

  const log = records.map((r) => ({
    id: r.id,
    agentName: nameById.get(r.userId) ?? "Unknown",
    startDate: r.startDate,
    endDate: r.endDate,
    setByName: r.createdById ? nameById.get(r.createdById) ?? "Admin" : "Admin",
    createdAt: r.createdAt,
  }));

  return NextResponse.json({ log });
}
