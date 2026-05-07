import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseFile, getField } from "@/lib/parseFile";
import { normalizePhone, parseFlexibleDate, cleanString, parseNumber } from "@/lib/normalize";

export const maxDuration = 600;

const FOLLOWUP_DAYS_DEFAULT = 20;

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  x.setHours(0, 0, 0, 0);
  return x;
}

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

  // ---------- Reference data ----------
  const [users, settings] = await Promise.all([
    prisma.user.findMany({
      where: { deletedAt: null },
      select: { id: true, name: true, role: true },
    }),
    prisma.setting.findMany(),
  ]);
  const userByName = new Map<string, { id: string; role: string }>();
  for (const u of users) userByName.set(u.name.toLowerCase().trim(), { id: u.id, role: u.role });
  const adminUser = users.find((u) => u.role === "ADMIN");
  if (!adminUser) {
    return NextResponse.json({ error: "No admin user for parking lot" }, { status: 500 });
  }
  const followupDays = parseInt(
    settings.find((s) => s.key === "bookingFollowupDays")?.value || `${FOLLOWUP_DAYS_DEFAULT}`,
    10
  );
  const followupStatuses = (settings.find((s) => s.key === "bookingFollowupStatuses")?.value || "Completed")
    .split(",")
    .map((s) => s.trim().toLowerCase());

  const [existingCustomers, existingOrders, existingSalons] = await Promise.all([
    prisma.customer.findMany({
      select: {
        id: true, phone: true, ownerId: true, customerType: true,
        doNotContact: true,
      },
    }),
    prisma.booking.findMany({
      where: { orderNo: { not: null } },
      select: { orderNo: true },
    }),
    prisma.salon.findMany({
      where: { externalId: { not: null } },
      select: { id: true, externalId: true },
    }),
  ]);
  const customerByPhone = new Map(existingCustomers.map((c) => [c.phone, c]));
  const existingOrderNos = new Set(existingOrders.map((b) => b.orderNo!));
  const salonByExtId = new Map(existingSalons.map((s) => [s.externalId!, s.id]));

  // ---------- First pass: parse + classify ----------
  type ParsedRow = {
    rowNum: number;
    phone: string;
    orderNo: string;
    raw: Record<string, unknown>;
    status: string;
    ownerRaw: string;
    customerName: string | null;
    bookingDate: Date | null;
    orderDate: Date | null;
    bookingTime: string | null;
    paymentStatus: string | null;
    aiCallingStatus: string | null;
    salonExtId: string | null;
    salonName: string | null;
    salonPhone: string | null;
    salonAddress: string | null;
    salonCity: string | null;
    salonState: string | null;
    gst: number | null;
    grossAmount: number | null;
    stylistDiscount: number | null;
    slotsDiscount: number | null;
    couponsDiscount: number | null;
    offersDiscount: number | null;
    hygieneFee: number | null;
    platformFee: number | null;
    grandTotal: number | null;
    tokenAmount: number | null;
    remainingAmount: number | null;
    gatewayOrderId: string | null;
    styleLoungeCoupon: string | null;
    salonCoupon: string | null;
    styleLoungeUser: string | null;
  };

  const toProcess: ParsedRow[] = [];
  let skipCount = 0;
  let duplicateOrderCount = 0;
  const errors: { row: number; reason: string; data: Record<string, unknown> }[] = [];
  const ordersInFile = new Set<string>();

  for (let idx = 0; idx < sheet.rows.length; idx++) {
    const row = sheet.rows[idx];
    const rowNum = idx + 2;
    const phone = normalizePhone(getField(row, "Contact Number"));
    const orderNo = cleanString(getField(row, "Order No.")) || null;

    if (!phone) {
      skipCount++;
      errors.push({ row: rowNum, reason: "Missing or invalid phone number", data: row });
      continue;
    }
    if (!orderNo) {
      skipCount++;
      errors.push({ row: rowNum, reason: "Missing Order No.", data: row });
      continue;
    }
    if (existingOrderNos.has(orderNo)) {
      duplicateOrderCount++;
      continue;
    }
    if (ordersInFile.has(orderNo)) {
      skipCount++;
      errors.push({ row: rowNum, reason: `Duplicate Order No. in same file (${orderNo})`, data: row });
      continue;
    }
    ordersInFile.add(orderNo);

    toProcess.push({
      rowNum,
      phone,
      orderNo,
      raw: row,
      status: cleanString(getField(row, "Status")),
      ownerRaw: cleanString(getField(row, "Owner")),
      customerName: cleanString(getField(row, "Customer Name")) || null,
      bookingDate: parseFlexibleDate(getField(row, "Booking Date")),
      orderDate: parseFlexibleDate(getField(row, "Order Date")),
      bookingTime: cleanString(getField(row, "Booking Time")) || null,
      paymentStatus: cleanString(getField(row, "Payment Status")) || null,
      aiCallingStatus: cleanString(getField(row, "AI Calling Status")) || null,
      salonExtId: cleanString(getField(row, "Salon Id")) || null,
      salonName: cleanString(getField(row, "Salon Name")) || null,
      salonPhone: cleanString(getField(row, "Salon Contact Number")) || null,
      salonAddress: cleanString(getField(row, "Address")) || null,
      salonCity: cleanString(getField(row, "City")) || null,
      salonState: cleanString(getField(row, "State")) || null,
      gst: parseNumber(getField(row, "GST")),
      grossAmount: parseNumber(getField(row, "Gross Amount")),
      stylistDiscount: parseNumber(getField(row, "Stylist Discount")),
      slotsDiscount: parseNumber(getField(row, "Slots Discount")),
      couponsDiscount: parseNumber(getField(row, "Coupons Discount")),
      offersDiscount: parseNumber(getField(row, "Offers Discount")),
      hygieneFee: parseNumber(getField(row, "Hygiene Fee")),
      platformFee: parseNumber(getField(row, "Plateform Fee", "Platform Fee")),
      grandTotal: parseNumber(getField(row, "Grand Total Amount")),
      tokenAmount: parseNumber(getField(row, "Token Amount")),
      remainingAmount: parseNumber(getField(row, "Remaining Amount")),
      gatewayOrderId: cleanString(getField(row, "Gateway Order ID")) || null,
      styleLoungeCoupon: cleanString(getField(row, "Style Lounge Coupon")) || null,
      salonCoupon: cleanString(getField(row, "Salon Coupon")) || null,
      styleLoungeUser: cleanString(getField(row, "Style Lounge User")) || null,
    });
  }

  // ---------- Second pass: salon ensure (bulk) ----------
  // Collect all unique salon extIds we need to create
  const newSalonExtIds = new Map<string, ParsedRow>();
  for (const p of toProcess) {
    if (p.salonExtId && !salonByExtId.has(p.salonExtId) && !newSalonExtIds.has(p.salonExtId)) {
      newSalonExtIds.set(p.salonExtId, p);
    }
  }
  if (newSalonExtIds.size > 0) {
    await prisma.salon.createMany({
      data: Array.from(newSalonExtIds.values()).map((p) => ({
        externalId: p.salonExtId!,
        name: p.salonName || `Salon ${p.salonExtId}`,
        phone: p.salonPhone,
        address: p.salonAddress,
        city: p.salonCity,
        state: p.salonState,
      })),
      skipDuplicates: true,
    });
    // Refresh map
    const newSalons = await prisma.salon.findMany({
      where: { externalId: { in: Array.from(newSalonExtIds.keys()) } },
      select: { id: true, externalId: true },
    });
    for (const s of newSalons) salonByExtId.set(s.externalId!, s.id);
  }

  // ---------- Third pass: customer ensure (bulk) ----------
  const newCustomers = new Map<string, ParsedRow>();
  for (const p of toProcess) {
    if (!customerByPhone.has(p.phone) && !newCustomers.has(p.phone)) {
      newCustomers.set(p.phone, p);
    }
  }
  if (newCustomers.size > 0) {
    await prisma.customer.createMany({
      data: Array.from(newCustomers.values()).map((p) => {
        // Owner resolution for new customer
        let ownerId = adminUser.id;
        if (p.ownerRaw) {
          const matched = userByName.get(p.ownerRaw.toLowerCase().trim());
          if (matched) ownerId = matched.id;
          else {
            errors.push({
              row: p.rowNum,
              reason: `Owner "${p.ownerRaw}" not recognized — parked with admin`,
              data: p.raw,
            });
          }
        }
        return {
          phone: p.phone,
          name: p.customerName,
          city: p.salonCity,
          customerType: "CUSTOMER" as const,
          ownerId,
        };
      }),
      skipDuplicates: true,
    });
    // Refresh map
    const justCreated = await prisma.customer.findMany({
      where: { phone: { in: Array.from(newCustomers.keys()) } },
      select: {
        id: true, phone: true, ownerId: true, customerType: true, doNotContact: true,
      },
    });
    for (const c of justCreated) customerByPhone.set(c.phone, c);
  }

  // ---------- Upgrade customers from NEW_REGISTRATION → CUSTOMER ----------
  const phonesToUpgrade: string[] = [];
  for (const p of toProcess) {
    const c = customerByPhone.get(p.phone);
    if (c && c.customerType === "NEW_REGISTRATION") {
      phonesToUpgrade.push(p.phone);
    }
  }
  if (phonesToUpgrade.length > 0) {
    await prisma.customer.updateMany({
      where: { phone: { in: phonesToUpgrade } },
      data: { customerType: "CUSTOMER" },
    });
    // Activity log entries
    const upgradeIds = Array.from(new Set(phonesToUpgrade)).map((ph) => customerByPhone.get(ph)?.id).filter(Boolean) as string[];
    await prisma.activityLog.createMany({
      data: upgradeIds.map((id) => ({
        customerId: id,
        userId,
        activityType: "CUSTOMER_TYPE_CHANGED" as const,
        oldValue: "NEW_REGISTRATION",
        newValue: "CUSTOMER",
        note: "Promoted via booking import",
      })),
    });
  }

  // ---------- Fourth pass: bulk-create bookings ----------
  await prisma.booking.createMany({
    data: toProcess.map((p) => ({
      customerId: customerByPhone.get(p.phone)!.id,
      orderNo: p.orderNo,
      aiCallingStatus: p.aiCallingStatus,
      orderDate: p.orderDate,
      bookingDate: p.bookingDate,
      bookingTime: p.bookingTime,
      status: p.status || null,
      paymentStatus: p.paymentStatus,
      salonId: p.salonExtId ? salonByExtId.get(p.salonExtId) || null : null,
      salonNameSnapshot: p.salonName,
      city: p.salonCity,
      state: p.salonState,
      address: p.salonAddress,
      gst: p.gst,
      grossAmount: p.grossAmount,
      stylistDiscount: p.stylistDiscount,
      slotsDiscount: p.slotsDiscount,
      couponsDiscount: p.couponsDiscount,
      offersDiscount: p.offersDiscount,
      hygieneFee: p.hygieneFee,
      platformFee: p.platformFee,
      grandTotal: p.grandTotal,
      tokenAmount: p.tokenAmount,
      remainingAmount: p.remainingAmount,
      gatewayOrderId: p.gatewayOrderId,
      styleLoungeCoupon: p.styleLoungeCoupon,
      salonCoupon: p.salonCoupon,
      styleLoungeUser: p.styleLoungeUser,
      rawData: p.raw as never,
    })),
    skipDuplicates: true,
  });

  // ---------- Activity log: booking imported (bulk) ----------
  await prisma.activityLog.createMany({
    data: toProcess.map((p) => ({
      customerId: customerByPhone.get(p.phone)!.id,
      userId,
      activityType: "BOOKING_IMPORTED" as const,
      note: `Order ${p.orderNo} (${p.status || "unknown status"})`,
    })),
  });

  // ---------- Fifth pass: follow-up scheduling ----------
  // Per locked rule 6: only Completed bookings trigger +N day follow-up.
  // Per rule 7: latest qualifying booking date wins; older ones don't override.
  const completedRows = toProcess.filter(
    (p) => p.status && followupStatuses.includes(p.status.toLowerCase()) && p.bookingDate
  );

  // Group by customer; pick latest booking date per customer
  const latestByCustomer = new Map<string, ParsedRow>();
  for (const p of completedRows) {
    const c = customerByPhone.get(p.phone)!;
    if (c.doNotContact) continue; // DNC: never schedule
    const existing = latestByCustomer.get(c.id);
    if (!existing || p.bookingDate!.getTime() > existing.bookingDate!.getTime()) {
      latestByCustomer.set(c.id, p);
    }
  }

  // Read existing followups for these customers
  const customerIds = Array.from(latestByCustomer.keys());
  const existingFollowups = customerIds.length > 0
    ? await prisma.followup.findMany({
        where: { customerId: { in: customerIds } },
        select: { customerId: true, nextFollowupDate: true },
      })
    : [];
  const followupByCustomer = new Map(existingFollowups.map((f) => [f.customerId, f.nextFollowupDate]));

  let followupsCreated = 0;
  let followupsUpdated = 0;
  let followupsSkipped = 0;

  for (const [cid, p] of latestByCustomer) {
    const newDate = addDays(p.bookingDate!, followupDays);
    const existing = followupByCustomer.get(cid);
    if (!existing) {
      await prisma.followup.create({
        data: { customerId: cid, nextFollowupDate: newDate },
      });
      followupsCreated++;
    } else if (newDate.getTime() > existing.getTime()) {
      // Newer trigger date → update
      await prisma.followup.update({
        where: { customerId: cid },
        data: { nextFollowupDate: newDate, currentRemark: null, currentNote: null },
      });
      followupsUpdated++;
    } else {
      // Imported booking is older than what's scheduled — leave it alone (rule 7)
      followupsSkipped++;
    }
  }

  // ---------- Log import ----------
  await prisma.importHistory.create({
    data: {
      importType: "BOOKINGS",
      filename: file.name,
      uploadedById: userId,
      totalRows: sheet.rows.length,
      newCount: toProcess.length,
      updatedCount: phonesToUpgrade.length,
      skippedCount: skipCount + duplicateOrderCount,
      errorCount: errors.length,
      notes: `Sheet: ${sheetName}; ${followupsCreated} new followups, ${followupsUpdated} updated, ${followupsSkipped} kept`,
    },
  });

  return NextResponse.json({
    success: true,
    totalRows: sheet.rows.length,
    newBookingCount: toProcess.length,
    duplicateOrderCount,
    upgradedCustomerCount: phonesToUpgrade.length,
    skipCount,
    errorCount: errors.length,
    followupsCreated,
    followupsUpdated,
    followupsSkipped,
    errors,
  });
}