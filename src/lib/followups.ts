import { prisma } from "@/lib/prisma";

export interface FollowupRow {
  customerId: string;
  customerName: string | null;
  phone: string;
  city: string | null;
  customerType: "NEW_REGISTRATION" | "CUSTOMER";
  doNotContact: boolean;
  nextFollowupDate: Date;
  currentRemark: string | null;
  currentNote: string | null;
  lastContactedAt: Date | null;
  lastBookingDate: Date | null;
  lastBookingSalon: string | null;
  status: "OVERDUE" | "DUE_TODAY" | "UPCOMING";
  untouched: boolean; // never contacted by anyone, ever
}

export interface FollowupCounts {
  total: number;
  overdue: number;
  dueToday: number;
  registered: number;
  booked: number;
  untouched: number;     // never contacted
  inProgress: number;    // contacted at least once
}

export type FollowupFilter =
  | "all"
  | "untouched"
  | "in_progress"
  | "overdue"
  | "registered"
  | "booked";

function buildBaseWhere(userId: string) {
  return {
    customer: {
      ownerId: userId,
      doNotContact: false,
      deletedAt: null,
    },
  };
}

export async function getFollowupCounts(userId: string): Promise<FollowupCounts> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const baseWhere = buildBaseWhere(userId);
  const dueWhere = { ...baseWhere, nextFollowupDate: { lt: tomorrow } };

  const [total, overdue, registered, booked, untouched, inProgress] = await Promise.all([
    prisma.followup.count({ where: dueWhere }),
    prisma.followup.count({
      where: { ...dueWhere, nextFollowupDate: { lt: today } },
    }),
    prisma.followup.count({
      where: {
        ...dueWhere,
        customer: { ...dueWhere.customer, customerType: "NEW_REGISTRATION" },
      },
    }),
    prisma.followup.count({
      where: {
        ...dueWhere,
        customer: { ...dueWhere.customer, customerType: "CUSTOMER" },
      },
    }),
    prisma.followup.count({
      where: { ...dueWhere, lastContactedAt: null, currentRemark: null },
    }),
    prisma.followup.count({
      where: {
        ...dueWhere,
        OR: [
          { lastContactedAt: { not: null } },
          { currentRemark: { not: null } },
        ],
      },
    }),
  ]);

  return {
    total,
    overdue,
    dueToday: total - overdue,
    registered,
    booked,
    untouched,
    inProgress,
  };
}

export async function getFilteredCount(
  userId: string,
  filter: FollowupFilter
): Promise<number> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const baseWhere = buildBaseWhere(userId);
  const where = applyFilter(baseWhere, filter, today, tomorrow);

  return prisma.followup.count({ where });
}

type WhereInput = ReturnType<typeof buildBaseWhere> & Record<string, unknown>;

function applyFilter(
  baseWhere: ReturnType<typeof buildBaseWhere>,
  filter: FollowupFilter,
  today: Date,
  tomorrow: Date
): WhereInput {
  // Date filter (default: due today or earlier)
  const dateFilter =
    filter === "overdue" ? { lt: today } : { lt: tomorrow };

  // Build customer filter as a flexible object so we can add customerType
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

  const where: WhereInput = {
    customer: customerFilter,
    nextFollowupDate: dateFilter,
  };

  // Touched/untouched filter
  if (filter === "untouched") {
    where.lastContactedAt = null;
    where.currentRemark = null;
  } else if (filter === "in_progress") {
    where.OR = [
      { lastContactedAt: { not: null } },
      { currentRemark: { not: null } },
    ];
  }

  return where;
}

export async function getTodayFollowups(
  userId: string,
  page = 1,
  pageSize = 50,
  filter: FollowupFilter = "all"
): Promise<FollowupRow[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const baseWhere = buildBaseWhere(userId);
  const where = applyFilter(baseWhere, filter, today, tomorrow);

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
            where: { status: "Completed" },
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
    const fd = new Date(f.nextFollowupDate);
    fd.setHours(0, 0, 0, 0);
    const lastBooking = f.customer.bookings[0];
    let status: "OVERDUE" | "DUE_TODAY" | "UPCOMING";
    if (fd.getTime() < today.getTime()) status = "OVERDUE";
    else if (fd.getTime() === today.getTime()) status = "DUE_TODAY";
    else status = "UPCOMING";

    const untouched = !f.lastContactedAt && !f.currentRemark;

    return {
      customerId: f.customer.id,
      customerName: f.customer.name,
      phone: f.customer.phone,
      city: f.customer.city,
      customerType: f.customer.customerType,
      doNotContact: f.customer.doNotContact,
      nextFollowupDate: f.nextFollowupDate,
      currentRemark: f.currentRemark,
      currentNote: f.currentNote,
      lastContactedAt: f.lastContactedAt,
      lastBookingDate: lastBooking?.bookingDate || null,
      lastBookingSalon:
        lastBooking?.salon?.name || lastBooking?.salonNameSnapshot || null,
      status,
      untouched,
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
  // "Closed" means: DNC OR no active followup row exists (cycle closed by Booked/Service Taken/etc.)
  const where: Record<string, unknown> = {
    deletedAt: null,
    OR: [
      { doNotContact: true },
      { AND: [{ doNotContact: false }, { followup: null }] },
    ],
  };

  // Filter by closure reason if provided
  if (filterReason === "dnc") {
    where.OR = undefined;
    where.doNotContact = true;
  } else if (filterReason && filterReason !== "all") {
    // Find customers whose most recent activity matches this reason
    // (we'll do this in JS post-fetch since it's complex to express in Prisma)
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

  // Apply post-fetch reason filter if needed
  if (filterReason && filterReason !== "all" && filterReason !== "dnc") {
    rows = rows.filter(
      (r) => r.closedReason.toLowerCase() === filterReason.toLowerCase()
    );
  }

  return { rows, total };
}

/** Distinct closure reasons for filter dropdown. */
export async function getClosureReasons(): Promise<string[]> {
  // Get distinct remark labels that close followups, plus DNC
  const closingRemarks = await prisma.remarkOption.findMany({
    where: { isActive: true, closesFollowup: true },
    select: { label: true },
    orderBy: { sortOrder: "asc" },
  });
  return ["dnc", ...closingRemarks.map((r) => r.label)];
}