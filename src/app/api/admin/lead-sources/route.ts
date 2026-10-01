import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sources = await prisma.leadSourceOption.findMany({ orderBy: [{ isActive: "desc" }, { sortOrder: "asc" }] });
  return NextResponse.json({ sources });
}

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { label?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const label = (body.label || "").trim();
  if (!label) return NextResponse.json({ error: "Label is required" }, { status: 400 });

  const existing = await prisma.leadSourceOption.findUnique({ where: { label } });
  if (existing) {
    if (existing.isActive) return NextResponse.json({ error: `"${label}" already exists` }, { status: 400 });
    // Re-adding a previously deactivated label just reactivates it.
    const revived = await prisma.leadSourceOption.update({ where: { id: existing.id }, data: { isActive: true } });
    return NextResponse.json({ success: true, source: revived });
  }

  const maxOrder = await prisma.leadSourceOption.aggregate({ _max: { sortOrder: true } });
  const created = await prisma.leadSourceOption.create({
    data: { label, sortOrder: (maxOrder._max.sortOrder ?? -1) + 1 },
  });
  return NextResponse.json({ success: true, source: created });
}
