import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseFile, getField } from "@/lib/parseFile";
import { normalizePhone, parseFlexibleDate, cleanString } from "@/lib/normalize";

export const maxDuration = 60;

export async function POST(request: Request) {
  try {
    const session = await auth();
    if (!session?.user?.id || session.user.role !== "ADMIN") {
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

    // Load all agents for name → id lookup
    const agents = await prisma.user.findMany({
      where: { role: "AGENT", isActive: true, deletedAt: null },
      select: { id: true, name: true },
    });
    const agentByName = new Map(
      agents.map((a) => [a.name.trim().toLowerCase(), a.id])
    );

    let updatedCount = 0;
    let createdCount = 0;
    let skippedCount = 0;
    let ownerUpdatedCount = 0;
    const errors: { row: number; reason: string; data: Record<string, unknown> }[] = [];

    for (let i = 0; i < sheet.rows.length; i++) {
      const row = sheet.rows[i];
      const rowNum = i + 2;

      try {
        const phone = normalizePhone(getField(row, "Contact Number", "Phone", "phone", "contact number"));
        if (!phone) {
          errors.push({ row: rowNum, reason: "Missing or invalid phone number", data: row });
          skippedCount++;
          continue;
        }

        const ownerName = cleanString(getField(row, "Owner", "owner", "Agent", "agent"));
        const nextFollowupRaw = getField(row, "Next Follow Up date", "Next Followup Date", "Next Follow Up Date", "followup date", "Next_Follow_Up_date");
        const remark = cleanString(getField(row, "Remarks", "remark", "Last Remark"));
        const note = cleanString(getField(row, "Detailed Remarks", "detailed remarks", "Note", "notes", "detailed_remarks"));

        const nextFollowupDate = parseFlexibleDate(nextFollowupRaw);

        // Find customer by phone
        const customer = await prisma.customer.findUnique({ where: { phone } });
        if (!customer) {
          errors.push({ row: rowNum, reason: `Customer not found for phone ${phone}`, data: row });
          skippedCount++;
          continue;
        }

        // Match owner by name
        const ownerId = ownerName
          ? (agentByName.get(ownerName.trim().toLowerCase()) ?? null)
          : null;

        // Update customer owner if we found a match
        if (ownerId && customer.ownerId !== ownerId) {
          await prisma.customer.update({
            where: { id: customer.id },
            data: { ownerId },
          });
          ownerUpdatedCount++;
        }

        // Upsert followup record
        const followupDate = nextFollowupDate ?? new Date();
        const existingFollowup = await prisma.followup.findUnique({
          where: { customerId: customer.id },
        });

        if (existingFollowup) {
          await prisma.followup.update({
            where: { customerId: customer.id },
            data: {
              nextFollowupDate: followupDate,
              currentRemark: remark || existingFollowup.currentRemark,
              currentNote: note || existingFollowup.currentNote,
              lastContactedAt: remark ? new Date() : existingFollowup.lastContactedAt,
            },
          });
          updatedCount++;
        } else {
          await prisma.followup.create({
            data: {
              customerId: customer.id,
              nextFollowupDate: followupDate,
              currentRemark: remark || null,
              currentNote: note || null,
              lastContactedAt: remark ? new Date() : null,
            },
          });
          createdCount++;
        }
      } catch (err) {
        errors.push({
          row: rowNum,
          reason: err instanceof Error ? err.message : "Unknown error",
          data: row,
        });
        skippedCount++;
      }
    }

    return NextResponse.json({
      success: true,
      totalRows: sheet.rows.length,
      updatedCount,
      createdCount,
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
