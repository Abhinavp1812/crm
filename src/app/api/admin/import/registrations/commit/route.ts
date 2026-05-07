import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseFile, getField } from "@/lib/parseFile";
import { normalizePhone, parseFlexibleDate, cleanString } from "@/lib/normalize";

export const maxDuration = 300; // 5 min for big imports

export async function POST(req: Request) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const userId = session.user.id;

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

  // ---------- Pre-load reference data once ----------
  const users = await prisma.user.findMany({
    where: { deletedAt: null },
    select: { id: true, name: true, role: true },
  });
  const userByName = new Map<string, { id: string; role: string }>();
  for (const u of users) userByName.set(u.name.toLowerCase().trim(), { id: u.id, role: u.role });
  const adminUser = users.find((u) => u.role === "ADMIN");
  if (!adminUser) {
    return NextResponse.json({ error: "No admin user for parking lot" }, { status: 500 });
  }

  const existingCustomers = await prisma.customer.findMany({
    select: {
      id: true, phone: true, customerIdExt: true, ownerId: true,
      name: true, gender: true, address: true, city: true, sector: true,
    },
  });
  const customerByPhone = new Map<string, typeof existingCustomers[0]>();
  for (const c of existingCustomers) customerByPhone.set(c.phone, c);

  // ---------- First pass: validate + classify rows in memory ----------
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  type ParsedRow = {
    rowNum: number;
    phone: string;
    customerIdExt: string | null;
    name: string | null;
    gender: string | null;
    onboardingDate: Date | null;
    address: string | null;
    city: string | null;
    sector: string | null;
    ownerId: string;
    ownerWarning: string | null;
    isExisting: boolean;
    existingId: string | null;
    raw: Record<string, unknown>;
  };

  const toCreate: ParsedRow[] = [];
  const toUpdate: ParsedRow[] = [];
  let skipCount = 0;
  const errors: { row: number; reason: string; data: Record<string, unknown> }[] = [];
  const seenInFile = new Set<string>();

  for (let idx = 0; idx < sheet.rows.length; idx++) {
    const row = sheet.rows[idx];
    const rowNum = idx + 2;
    const phone = normalizePhone(getField(row, "Contact Number"));
    if (!phone) {
      skipCount++;
      errors.push({ row: rowNum, reason: "Missing or invalid phone number", data: row });
      continue;
    }
    if (seenInFile.has(phone)) {
      skipCount++;
      errors.push({ row: rowNum, reason: `Duplicate phone in same file (${phone})`, data: row });
      continue;
    }
    seenInFile.add(phone);

    const customerIdExt = cleanString(getField(row, "Customer ID")) || null;
    const name = cleanString(getField(row, "Name")) || null;
    const gender = cleanString(getField(row, "Gender")) || null;
    const onboardingDate = parseFlexibleDate(getField(row, "Onboarding Date"));
    const address = cleanString(getField(row, "Address")) || null;
    const city = cleanString(getField(row, "City")) || null;
    const sector = cleanString(getField(row, "Sector")) || null;
    const ownerRaw = cleanString(getField(row, "Owner"));

    let ownerId: string;
    let ownerWarning: string | null = null;
    const existing = customerByPhone.get(phone);

    if (existing) {
      ownerId = existing.ownerId || adminUser.id;
    } else if (ownerRaw) {
      const matched = userByName.get(ownerRaw.toLowerCase().trim());
      if (matched) {
        ownerId = matched.id;
      } else {
        ownerId = adminUser.id;
        ownerWarning = `Owner "${ownerRaw}" not recognized — parked with admin`;
        errors.push({ row: rowNum, reason: ownerWarning, data: row });
      }
    } else {
      ownerId = adminUser.id;
    }

    const parsed: ParsedRow = {
      rowNum, phone, customerIdExt, name, gender, onboardingDate,
      address, city, sector, ownerId, ownerWarning,
      isExisting: !!existing,
      existingId: existing?.id || null,
      raw: row,
    };

    if (existing) toUpdate.push(parsed);
    else toCreate.push(parsed);
  }

  // ---------- Second pass: bulk DB writes ----------
  // 1. Bulk-create new customers (createMany — single SQL statement)
  if (toCreate.length > 0) {
    await prisma.customer.createMany({
      data: toCreate.map((p) => ({
        phone: p.phone,
        name: p.name,
        gender: p.gender,
        address: p.address,
        city: p.city,
        sector: p.sector,
        customerIdExt: p.customerIdExt,
        customerType: "NEW_REGISTRATION",
        ownerId: p.ownerId,
      })),
      skipDuplicates: true,
    });

    // Re-fetch IDs for the just-created customers
    const newCustomers = await prisma.customer.findMany({
      where: { phone: { in: toCreate.map((p) => p.phone) } },
      select: { id: true, phone: true },
    });
    const idByPhone = new Map(newCustomers.map((c) => [c.phone, c.id]));

    // Bulk-create followups (today's date)
    await prisma.followup.createMany({
      data: toCreate
        .map((p) => ({
          customerId: idByPhone.get(p.phone)!,
          nextFollowupDate: today,
        }))
        .filter((f) => f.customerId),
      skipDuplicates: true,
    });

    // Bulk-create activity log entries
    await prisma.activityLog.createMany({
      data: toCreate
        .filter((p) => idByPhone.get(p.phone))
        .map((p) => ({
          customerId: idByPhone.get(p.phone)!,
          userId,
          activityType: "CUSTOMER_IMPORTED" as const,
          note: p.ownerWarning || "Registration imported",
        })),
    });

    // Bulk-create registration history
    // Use a unique key fallback for rows without customerIdExt
    await prisma.registration.createMany({
      data: toCreate
        .filter((p) => idByPhone.get(p.phone))
        .map((p) => ({
          customerId: idByPhone.get(p.phone)!,
          customerIdExt: p.customerIdExt,
          onboardingDate: p.onboardingDate,
          rawData: p.raw as never,
        })),
      skipDuplicates: true,
    });
  }

  // 2. Update existing customers — only fill empty fields
  // Group updates to minimize queries
  for (const p of toUpdate) {
    const existing = customerByPhone.get(p.phone)!;
    const data: Record<string, unknown> = {};
    if (!existing.name && p.name) data.name = p.name;
    if (!existing.gender && p.gender) data.gender = p.gender;
    if (!existing.address && p.address) data.address = p.address;
    if (!existing.city && p.city) data.city = p.city;
    if (!existing.sector && p.sector) data.sector = p.sector;
    if (!existing.customerIdExt && p.customerIdExt) data.customerIdExt = p.customerIdExt;
    if (Object.keys(data).length > 0) {
      await prisma.customer.update({ where: { id: existing.id }, data });
    }
  }

  // ---------- Log the import ----------
  await prisma.importHistory.create({
    data: {
      importType: "REGISTRATIONS",
      filename: file.name,
      uploadedById: userId,
      totalRows: sheet.rows.length,
      newCount: toCreate.length,
      updatedCount: toUpdate.length,
      skippedCount: skipCount,
      errorCount: errors.length,
      notes: `Sheet: ${sheetName}`,
    },
  });

  return NextResponse.json({
    success: true,
    totalRows: sheet.rows.length,
    newCount: toCreate.length,
    updateCount: toUpdate.length,
    skipCount,
    errorCount: errors.length,
    errors,
  });
}