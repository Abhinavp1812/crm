import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseFile, getField } from "@/lib/parseFile";
import { normalizePhone, parseFlexibleDate, cleanString } from "@/lib/normalize";

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await req.formData();
  const file = formData.get("file") as File | null;
  const sheetName = formData.get("sheetName") as string | null;
  if (!file || !sheetName) {
    return NextResponse.json({ error: "Missing file or sheetName" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const wb = await parseFile(buffer, file.name);
  const sheet = wb.sheets.find((s) => s.sheetName === sheetName);
  if (!sheet) {
    return NextResponse.json({ error: "Sheet not found" }, { status: 400 });
  }

  // Pre-load existing customer phones + customerIdExt for dedup
  const existingCustomers = await prisma.customer.findMany({
    select: { phone: true, customerIdExt: true },
  });
  const existingPhones = new Set(existingCustomers.map((c) => c.phone));
  const existingExtIds = new Set(
    existingCustomers.map((c) => c.customerIdExt).filter(Boolean) as string[]
  );

  // Pre-load active users for owner matching (case-insensitive)
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, role: true },
  });
  const userByName = new Map<string, { id: string; role: string }>();
  for (const u of users) userByName.set(u.name.toLowerCase().trim(), { id: u.id, role: u.role });

  let newCount = 0;
  let updateCount = 0;
  let skipCount = 0;
  const errors: { row: number; reason: string; data: Record<string, unknown> }[] = [];
  const seenInFile = new Set<string>();

  sheet.rows.forEach((row, idx) => {
    const rowNum = idx + 2; // +1 for header, +1 for 1-indexing
    const phone = normalizePhone(getField(row, "Contact Number"));

    if (!phone) {
      skipCount++;
      errors.push({ row: rowNum, reason: "Missing or invalid phone number", data: row });
      return;
    }

    if (seenInFile.has(phone)) {
      skipCount++;
      errors.push({ row: rowNum, reason: `Duplicate phone in same file (${phone})`, data: row });
      return;
    }
    seenInFile.add(phone);

    const customerIdExt = cleanString(getField(row, "Customer ID"));
    if (customerIdExt && existingExtIds.has(customerIdExt)) {
      // Already imported as a registration
      updateCount++;
      return;
    }

    if (existingPhones.has(phone)) {
      updateCount++;
      return;
    }

    // Validate owner if specified
    const ownerRaw = cleanString(getField(row, "Owner"));
    if (ownerRaw) {
      const matched = userByName.get(ownerRaw.toLowerCase().trim());
      if (!matched) {
        // Not an error — will fall back to admin parking lot, but flag in report
        errors.push({
          row: rowNum,
          reason: `Owner "${ownerRaw}" not found — will be parked with admin`,
          data: row,
        });
      }
    }

    newCount++;
  });

  return NextResponse.json({
    filename: file.name,
    sheetName,
    totalRows: sheet.rows.length,
    newCount,
    updateCount,
    skipCount,
    errorCount: errors.length,
    errors: errors.slice(0, 100), // cap displayed errors
    fullErrorCount: errors.length,
  });
}