import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseFile, getField } from "@/lib/parseFile";
import { normalizePhone, parseFlexibleDate, cleanString } from "@/lib/normalize";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || (session.user.role !== "ADMIN" && session.user.id !== "super-admin")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const sheetName = formData.get("sheetName") as string | null;
    if (!file || !sheetName) {
      return NextResponse.json({ error: "Missing file or sheetName" }, { status: 400 });
    }

    const buffer = await file.arrayBuffer();
    const workbook = await parseFile(buffer, file.name);
    const sheet = workbook.sheets.find((s) => s.sheetName === sheetName);
    if (!sheet) return NextResponse.json({ error: "Sheet not found" }, { status: 400 });

    // Pre-load all agents and customers in bulk
    const [agents, allCustomers] = await Promise.all([
      prisma.user.findMany({
        where: { role: "AGENT", isActive: true, deletedAt: null },
        select: { id: true, name: true },
      }),
      prisma.customer.findMany({
        select: { id: true, phone: true, ownerId: true },
      }),
    ]);

    const agentByName = new Map(agents.map((a) => [a.name.trim().toLowerCase(), a.id]));
    const customerByPhone = new Map(allCustomers.map((c) => [c.phone, c]));

    // Parse all rows first
    type ParsedRow = {
      customerId: string;
      currentOwnerId: string | null;
      newOwnerId: string | null;
      followupDate: Date;
      remark: string | null;
      note: string | null;
    };

    const parsed: ParsedRow[] = [];
    let skippedCount = 0;
    const errors: { row: number; reason: string; data: Record<string, unknown> }[] = [];

    for (let i = 0; i < sheet.rows.length; i++) {
      const row = sheet.rows[i];
      const rowNum = i + 2;

      const phone = normalizePhone(getField(row, "Contact Number", "Phone", "phone", "contact number"));
      if (!phone) {
        errors.push({ row: rowNum, reason: "Missing or invalid phone number", data: row });
        skippedCount++;
        continue;
      }

      const customer = customerByPhone.get(phone);
      if (!customer) {
        errors.push({ row: rowNum, reason: `Customer not found for phone ${phone}`, data: row });
        skippedCount++;
        continue;
      }

      const ownerName = cleanString(getField(row, "Owner", "owner", "Agent", "agent"));
      const nextFollowupRaw = getField(row, "Next Follow Up date", "Next Followup Date", "Next Follow Up Date", "followup date", "Next_Follow_Up_date");
      const remark = cleanString(getField(row, "Remarks", "remark", "Last Remark"));
      const note = cleanString(getField(row, "Detailed Remarks", "detailed remarks", "Note", "notes", "detailed_remarks"));

      const nextFollowupDate = parseFlexibleDate(nextFollowupRaw) ?? new Date();
      const newOwnerId = ownerName ? (agentByName.get(ownerName.trim().toLowerCase()) ?? null) : null;

      parsed.push({
        customerId: customer.id,
        currentOwnerId: customer.ownerId,
        newOwnerId,
        followupDate: nextFollowupDate,
        remark: remark || null,
        note: note || null,
      });
    }

    // Pre-load all existing followups for matched customers
    const customerIds = parsed.map((p) => p.customerId);
    const existingFollowups = await prisma.followup.findMany({
      where: { customerId: { in: customerIds } },
      select: { customerId: true, currentRemark: true, currentNote: true, lastContactedAt: true },
    });
    const followupByCustomer = new Map(existingFollowups.map((f) => [f.customerId, f]));

    // Batch owner updates (only where owner changed)
    const ownerUpdates = parsed.filter((p) => p.newOwnerId && p.newOwnerId !== p.currentOwnerId);
    let ownerUpdatedCount = 0;
    for (let i = 0; i < ownerUpdates.length; i += 30) {
      await Promise.all(
        ownerUpdates.slice(i, i + 30).map((p) =>
          prisma.customer.update({ where: { id: p.customerId }, data: { ownerId: p.newOwnerId } })
        )
      );
      ownerUpdatedCount += ownerUpdates.slice(i, i + 30).length;
    }

    // Separate creates vs updates
    const toCreate = parsed.filter((p) => !followupByCustomer.has(p.customerId));
    const toUpdate = parsed.filter((p) => followupByCustomer.has(p.customerId));

    // Bulk create new followups
    if (toCreate.length > 0) {
      await prisma.followup.createMany({
        data: toCreate.map((p) => ({
          customerId: p.customerId,
          nextFollowupDate: p.followupDate,
          currentRemark: p.remark,
          currentNote: p.note,
          lastContactedAt: p.remark ? new Date() : null,
        })),
        skipDuplicates: true,
      });
    }

    // Parallel update existing followups in batches of 30
    for (let i = 0; i < toUpdate.length; i += 30) {
      await Promise.all(
        toUpdate.slice(i, i + 30).map((p) => {
          const existing = followupByCustomer.get(p.customerId)!;
          return prisma.followup.update({
            where: { customerId: p.customerId },
            data: {
              nextFollowupDate: p.followupDate,
              currentRemark: p.remark || existing.currentRemark,
              currentNote: p.note || existing.currentNote,
              lastContactedAt: p.remark ? new Date() : existing.lastContactedAt,
            },
          });
        })
      );
    }

    return NextResponse.json({
      success: true,
      totalRows: sheet.rows.length,
      updatedCount: toUpdate.length,
      createdCount: toCreate.length,
      ownerUpdatedCount,
      skippedCount,
      errorCount: errors.length,
      errors,
    });
  } catch (err) {
    console.error("[followups/commit]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Internal server error" },
      { status: 500 }
    );
  }
}
