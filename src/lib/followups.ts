import { prisma } from "@/lib/prisma";

// Stale threshold: customers touched longer ago than this are treated as "due today"
// regardless of their stored followup date. TODO Day 3: read from Setting table.
const STALE_THRESHOLD_DAYS = 60;

export interface FollowupRow {
  customerId: string;
  customerName: string | null;
  phone: string;
  city: string | null;
  customerType: "NEW_REGISTRATION" | "CUSTOMER";
  doNotContact: boolean;
  nextFollowupDate: Date;
  effectiveFollowupDate: Date; // For display - same as stored unless stale
  currentRemark: string | null;
  currentNote: string | null;
  lastContactedAt: Date | null;
  lastBookingDate: Date | null;
  lastBookingSalon: string | null;
  status: "OVERDUE" | "DUE_TODAY" | "UPCOMING";
  untouched: boolean;
  isStale: boolean;
}

export interface FollowupCounts {
  total: number;
  untouched: number;
  todaysFollowup: number;   // touched + due today (incl. stale-rolled)
  takenFollowup: number;    // touched + due future
  overdue: number;          // touched (recent) + past
  registered: number;
  booked: number;
}

export type FollowupFilter =
  | "all"
  | "untouched"
  | "todays_followup"
  | "taken_followup"
  | "overdue"
  | "registered"
  | "booked";

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function getDateMarkers() {
  const today = startOfDay(new Date());
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  const staleCutoff = new Date(today);
  staleCutoff.setDate(staleCutoff.getDate() - STALE_THRESHOLD_DAYS);
  return { today, tomorrow, staleCutoff };
}

function buildBaseWhere(userId: string) {
  return {
    customer: {
      ownerId: userId,
      doNotContact: false,
      deletedAt: null,
    },
  };
}

/**
 * Counts for the 4 stat cards. Counts are filtered by user's customers
 * AND filtered to "visible" rows (i.e., effectiveDate <= today, mirrors the All tab default).
 */
export async function getFollowupCounts(userId: string): Promise<FollowupCounts> {
  const { today, tomorrow, staleCutoff } = getDateMarkers();
  const baseWhere = buildBaseWhere(userId);

  // Untouched: no remark AND no lastContactedAt — always visible (date doesn't matter for this group)
  const untouched = await prisma.followup.count({
    where: {
      ...baseWhere,
      currentRemark: null,
      lastContactedAt: null,
    },
  });

  // Today's Followup: touched (recent) + nextFollowupDate = today, OR touched but stale (regardless of date)
  // (Stale touched are pulled forward to "today" effectively)
  const todaysFollowup = await prisma.followup.count({
    where: {
      ...baseWhere,
      OR: [
        // Touched recently AND date is today
        {
          AND: [
            { nextFollowupDate: { gte: today, lt: tomorrow } },
            {
              OR: [
                { lastContactedAt: { gte: staleCutoff } },
                { AND: [{ lastContactedAt: null }, { currentRemark: { not: null } }] },
              ],
            },
          ],
        },
        // Stale touched (last contact > 60 days ago)
        {
          AND: [
            { lastContactedAt: { lt: staleCutoff, not: null } },
            { currentRemark: { not: null } },
          ],
        },
      ],
    },
  });

  // Taken Followup: touched + future date + recent (not stale)
  const takenFollowup = await prisma.followup.count({
    where: {
      ...baseWhere,
      nextFollowupDate: { gte: tomorrow },
      OR: [
        { lastContactedAt: { gte: staleCutoff } },
        { AND: [{ lastContactedAt: null }, { currentRemark: { not: null } }] },
      ],
    },
  });

  // Overdue: touched (recent) + past date
  const overdue = await prisma.followup.count({
    where: {
      ...baseWhere,
      nextFollowupDate: { lt: today },
      OR: [
        { lastContactedAt: { gte: staleCutoff } },
        { AND: [{ lastContactedAt: null }, { currentRemark: { not: null } }] },
      ],
    },
  });

  // Total visible: untouched + todays + taken + overdue
  const total = untouched + todaysFollowup + takenFollowup + overdue;

  // Type filters (cut across all)
  const [registered, booked] = await Promise.all([
    prisma.followup.count({
      where: {
        ...baseWhere,
        customer: { ...baseWhere.customer, customerType: "NEW_REGISTRATION" },
      },
    }),
    prisma.followup.count({
      where: {
        ...baseWhere,
        customer: { ...baseWhere.customer, customerType: "CUSTOMER" },
      },
    }),
  ]);

  return {
    total,
    untouched,
    todaysFollowup,
    takenFollowup,
    overdue,
    registered,
    booked,
  };
}

type WhereInput = ReturnType<typeof buildBaseWhere> & Record<string, unknown>;

function applyFilter(
  baseWhere: ReturnType<typeof buildBaseWhere>,
  filter: FollowupFilter,
  today: Date,
  tomorrow: Date,
  staleCutoff: Date
): WhereInput {
  const customerFilter: {
    ownerId: string;
    doNotContact: boolean;
    deletedAt: null;
    customerType?: "NEW_REGISTRATION" | "CUSTOMER";
  } = {
    ownerId: baseWhere.customer.ownerId,
    doNotContact: baseWhere.customer.doNotContact,
    deletedAt: baseWhere.customer.deletedAt,
  };
  if (filter === "registered") customerFilter.customerType = "NEW_REGISTRATION";
  if (filter === "booked") customerFilter.customerType = "CUSTOMER";

  const where: WhereInput = { customer: customerFilter };

  if (filter === "untouched") {
    where.currentRemark = null;
    where.lastContactedAt = null;
  } else if (filter === "todays_followup") {
    where.OR = [
      // Recent touch + due today
      {
        AND: [
          { nextFollowupDate: { gte: today, lt: tomorrow } },
          {
            OR: [
              { lastContactedAt: { gte: staleCutoff } },
              { AND: [{ lastContactedAt: null }, { currentRemark: { not: null } }] },
            ],
          },
        ],
      },
      // Stale touched (any date)
      {
        AND: [
          { lastContactedAt: { lt: staleCutoff, not: null } },
          { currentRemark: { not: null } },
        ],
      },
    ];
  } else if (filter === "taken_followup") {
    where.nextFollowupDate = { gte: tomorrow };
    where.OR = [
      { lastContactedAt: { gte: staleCutoff } },
      { AND: [{ lastContactedAt: null }, { currentRemark: { not: null } }] },
    ];
  } else if (filter === "overdue") {
    where.nextFollowupDate = { lt: today };
    where.OR = [
      { lastContactedAt: { gte: staleCutoff } },
      { AND: [{ lastContactedAt: null }, { currentRemark: { not: null } }] },
    ];
  } else if (filter === "all" || filter === "registered" || filter === "booked") {
    // No additional date/touch filter - show everything
  }

  return where;
}

export async function getFilteredCount(
  userId: string,
  filter: FollowupFilter
): Promise<number> {
  const { today, tomorrow, staleCutoff } = getDateMarkers();
  const baseWhere = buildBaseWhere(userId);
  const where = applyFilter(baseWhere, filter, today, tomorrow, staleCutoff);
  return prisma.followup.count({ where });
}

export async function getTodayFollowups(
  userId: string,
  page = 1,
  pageSize = 50,
  filter: FollowupFilter = "all"
): Promise<FollowupRow[]> {
  const { today, tomorrow, staleCutoff } = getDateMarkers();
  const baseWhere = buildBaseWhere(userId);
  const where = applyFilter(baseWhere, filter, today, tomorrow, staleCutoff);

  const followups = await prisma.followup.findMany({
    where,
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          phone: true,
          city: true,
          customerType: true,
          doNotContact: true,
          bookings: {
            orderBy: { bookingDate: "desc" },
            take: 1,
            select: {
              bookingDate: true,
              salonNameSnapshot: true,
              salon: { select: { name: true } },
            },
          },
        },
      },
    },
    orderBy: { nextFollowupDate: "asc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return followups.map((f) => {
    const fd = startOfDay(f.nextFollowupDate);
    const lastBooking = f.customer.bookings[0];
    const untouched = !f.currentRemark && !f.lastContactedAt;

    // Stale: touched but last contact > 60 days ago
    const isStale = !!f.lastContactedAt && f.lastContactedAt < staleCutoff;

    // Effective date: untouched and stale customers shown as Today
    let effectiveFollowupDate = fd;
    if (untouched || isStale) {
      effectiveFollowupDate = today;
    }

    let status: "OVERDUE" | "DUE_TODAY" | "UPCOMING";
    if (effectiveFollowupDate.getTime() < today.getTime()) status = "OVERDUE";
    else if (effectiveFollowupDate.getTime() === today.getTime()) status = "DUE_TODAY";
    else status = "UPCOMING";

    return {
      customerId: f.customer.id,
      customerName: f.customer.name,
      phone: f.customer.phone,
      city: f.customer.city,
      customerType: f.customer.customerType,
      doNotContact: f.customer.doNotContact,
      nextFollowupDate: f.nextFollowupDate,
      effectiveFollowupDate,
      currentRemark: f.currentRemark,
      currentNote: f.currentNote,
      lastContactedAt: f.lastContactedAt,
      lastBookingDate: lastBooking?.bookingDate || null,
      lastBookingSalon:
        lastBooking?.salon?.name || lastBooking?.salonNameSnapshot || null,
      status,
      untouched,
      isStale,
    };
  });
}

export function formatPhone(phone: string): string {
  if (!phone || phone.length !== 10) return phone;
  return phone;
}

export function whatsappLink(phone: string, message?: string): string {
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/91${phone}${text}`;
}

export function telLink(phone: string): string {
  return `tel:+91${phone}`;
}

export async function getActiveRemarkOptions() {
  return prisma.remarkOption.findMany({
    where: { isActive: true },
    orderBy: { sortOrder: "asc" },
    select: {
      label: true,
      defaultDaysAhead: true,
      autoFlagDnc: true,
      closesFollowup: true,
    },
  });
}

// === Admin helpers (unchanged from before) ===

export interface AdminCustomerRow {
  id: string;
  name: string | null;
  phone: string;
  city: string | null;
  customerType: "NEW_REGISTRATION" | "CUSTOMER";
  doNotContact: boolean;
  ownerName: string | null;
  ownerId: string | null;
  followupDate: Date | null;
  currentRemark: string | null;
  currentNote: string | null;
  lastContactedAt: Date | null;
  totalActivities: number;
  lastActivityDate: Date | null;
  hasFollowup: boolean;
}

export interface AdminCustomerFilter {
  search?: string;
  ownerId?: string;
  customerType?: "NEW_REGISTRATION" | "CUSTOMER" | "all";
  followupState?: "active" | "closed" | "dnc" | "all";
  remark?: string;
}

export async function getAdminCustomers(
  filter: AdminCustomerFilter,
  page = 1,
  pageSize = 50
) {
  const where: Record<string, unknown> = { deletedAt: null };

  if (filter.search && filter.search.trim().length >= 2) {
    const q = filter.search.trim();
    const digitsOnly = q.replace(/\D/g, "");
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      ...(digitsOnly.length >= 4 ? [{ phone: { contains: digitsOnly } }] : []),
      { customerIdExt: q },
    ];
  }

  if (filter.ownerId) where.ownerId = filter.ownerId;

  if (filter.customerType && filter.customerType !== "all") {
    where.customerType = filter.customerType;
  }

  if (filter.followupState === "dnc") {
    where.doNotContact = true;
  } else if (filter.followupState === "closed") {
    where.doNotContact = false;
    where.followup = null;
  } else if (filter.followupState === "active") {
    where.doNotContact = false;
    where.followup = { isNot: null };
  }

  if (filter.remark) {
    where.followup = { ...(where.followup as object || {}), currentRemark: filter.remark };
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: {
        owner: { select: { name: true } },
        followup: {
          select: {
            nextFollowupDate: true,
            currentRemark: true,
            currentNote: true,
            lastContactedAt: true,
          },
        },
        _count: { select: { activities: true } },
        activities: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { createdAt: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.customer.count({ where }),
  ]);

  const rows: AdminCustomerRow[] = customers.map((c) => ({
    id: c.id,
    name: c.name,
    phone: c.phone,
    city: c.city,
    customerType: c.customerType,
    doNotContact: c.doNotContact,
    ownerName: c.owner?.name || null,
    ownerId: c.ownerId,
    followupDate: c.followup?.nextFollowupDate || null,
    currentRemark: c.followup?.currentRemark || null,
    currentNote: c.followup?.currentNote || null,
    lastContactedAt: c.followup?.lastContactedAt || null,
    totalActivities: c._count.activities,
    lastActivityDate: c.activities[0]?.createdAt || null,
    hasFollowup: !!c.followup,
  }));

  return { rows, total };
}

export async function getAllUsersForFilter() {
  return prisma.user.findMany({
    where: { deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true, role: true },
  });
}

// === Closed Followups helpers (unchanged) ===

export interface ClosedCustomerRow {
  id: string;
  name: string | null;
  phone: string;
  city: string | null;
  customerType: "NEW_REGISTRATION" | "CUSTOMER";
  doNotContact: boolean;
  doNotContactReason: string | null;
  doNotContactSetAt: Date | null;
  ownerName: string | null;
  closedReason: string;
  closedAt: Date | null;
}

export async function getClosedCustomers(
  filterReason: string | null,
  page = 1,
  pageSize = 50
) {
  const where: Record<string, unknown> = {
    deletedAt: null,
    OR: [
      { doNotContact: true },
      { AND: [{ doNotContact: false }, { followup: null }] },
    ],
  };

  if (filterReason === "dnc") {
    where.OR = undefined;
    where.doNotContact = true;
  }

  const [customers, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      include: {
        owner: { select: { name: true } },
        activities: {
          where: { activityType: "REMARK_ADDED" },
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { remark: true, createdAt: true },
        },
      },
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.customer.count({ where }),
  ]);

  let rows: ClosedCustomerRow[] = customers.map((c) => {
    const lastRemark = c.activities[0];
    let closedReason = "";
    let closedAt: Date | null = null;

    if (c.doNotContact) {
      closedReason = c.doNotContactReason || "Do Not Contact";
      closedAt = c.doNotContactSetAt;
    } else if (lastRemark) {
      closedReason = lastRemark.remark || "Closed";
      closedAt = lastRemark.createdAt;
    } else {
      closedReason = "No active followup";
      closedAt = c.updatedAt;
    }

    return {
      id: c.id,
      name: c.name,
      phone: c.phone,
      city: c.city,
      customerType: c.customerType,
      doNotContact: c.doNotContact,
      doNotContactReason: c.doNotContactReason,
      doNotContactSetAt: c.doNotContactSetAt,
      ownerName: c.owner?.name || null,
      closedReason,
      closedAt,
    };
  });

  if (filterReason && filterReason !== "all" && filterReason !== "dnc") {
    rows = rows.filter(
      (r) => r.closedReason.toLowerCase() === filterReason.toLowerCase()
    );
  }

  return { rows, total };
}

export async function getClosureReasons(): Promise<string[]> {
  const closingRemarks = await prisma.remarkOption.findMany({
    where: { isActive: true, closesFollowup: true },
    select: { label: true },
    orderBy: { sortOrder: "asc" },
  });
  return ["dnc", ...closingRemarks.map((r) => r.label)];
}
