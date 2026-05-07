import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseFile, getField } from "@/lib/parseFile";
import { normalizePhone, cleanString } from "@/lib/normalize";

export const maxDuration = 300;

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

  // Pre-load existing data
  const [existingOrders, existingCustomers, users] = await Promise.all([
    prisma.booking.findMany({
      where: { orderNo: { not: null } },
      select: { orderNo: true },
    }),
    prisma.customer.findMany({ select: { phone: true } }),
    prisma.user.findMany({ where: { deletedAt: null }, select: { name: true } }),
  ]);
  const existingOrderNos = new Set(existingOrders.map((b) => b.orderNo).filter(Boolean) as string[]);
  const existingPhones = new Set(existingCustomers.map((c) => c.phone));
  const userNames = new Set(users.map((u) => u.name.toLowerCase().trim()));

  let newBookingCount = 0;
  let duplicateOrderCount = 0;
  let newCustomerCount = 0;
  let existingCustomerCount = 0;
  let skipCount = 0;
  let completedBookings = 0;
  const errors: { row: number; reason: string; data: Record<string, unknown> }[] = [];
  const customersInFile = new Set<string>();
  const ordersInFile = new Set<string>();

  sheet.rows.forEach((row, idx) => {
    const rowNum = idx + 2;
    const phone = normalizePhone(getField(row, "Contact Number"));
    const orderNo = cleanString(getField(row, "Order No.")) || null;
    const status = cleanString(getField(row, "Status"));
    const ownerRaw = cleanString(getField(row, "Owner"));

    if (!phone) {
      skipCount++;
      errors.push({ row: rowNum, reason: "Missing or invalid phone number", data: row });
      return;
    }
    if (!orderNo) {
      skipCount++;
      errors.push({ row: rowNum, reason: "Missing Order No.", data: row });
      return;
    }
    if (existingOrderNos.has(orderNo)) {
      duplicateOrderCount++;
      return;
    }
    if (ordersInFile.has(orderNo)) {
      skipCount++;
      errors.push({ row: rowNum, reason: `Duplicate Order No. in same file (${orderNo})`, data: row });
      return;
    }
    ordersInFile.add(orderNo);

    if (existingPhones.has(phone)) existingCustomerCount++;
    else if (!customersInFile.has(phone)) {
      newCustomerCount++;
      customersInFile.add(phone);
    }

    if (status.toLowerCase() === "completed") completedBookings++;

    if (ownerRaw && !userNames.has(ownerRaw.toLowerCase().trim())) {
      errors.push({
        row: rowNum,
        reason: `Owner "${ownerRaw}" not recognized — will be parked with admin (only used if customer is new)`,
        data: row,
      });
    }

    newBookingCount++;
  });

  return NextResponse.json({
    filename: file.name,
    sheetName,
    totalRows: sheet.rows.length,
    newBookingCount,
    duplicateOrderCount,
    newCustomerCount,
    existingCustomerCount,
    completedBookings,
    skipCount,
    errorCount: errors.length,
    errors: errors.slice(0, 100),
    fullErrorCount: errors.length,
  });
}