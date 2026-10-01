import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  let body: { isActive?: boolean; label?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const data: { isActive?: boolean; label?: string } = {};
  if (typeof body.isActive === "boolean") data.isActive = body.isActive;
  if (typeof body.label === "string" && body.label.trim()) data.label = body.label.trim();
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Nothing to update" }, { status: 400 });

  const updated = await prisma.leadSourceOption.update({ where: { id }, data });
  return NextResponse.json({ success: true, source: updated });
}
