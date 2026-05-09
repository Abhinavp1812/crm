import { prisma } from "@/lib/prisma";

const STALE_THRESHOLD_DAYS = 60;
const NEW_BOOKING_DAYS = 20;

export type BookingFlavor =
  | "AWAITING_SERVICE"
  | "PAID_NOT_DONE"
  | "COMPLETED"
  | "IN_PROGRESS"
  | null;

export interface FollowupRow {
  customerId: string;
  customerName: string | null;
  phone: string;
  city: string | null;
  customerType: "NEW_REGISTRATION" | "CUSTOMER";
  doNotContact: boolean;
  nextFollowupDate: Date;
  effectiveFollowupDate: Date;
  currentRemark: string | null;
  currentNote: string | null;
  lastContactedAt: Date | null;
  lastBookingDate: Date | null;
  lastBookingSalon: string | null;
  status: "OVERDUE" | "DUE_TODAY" | "UPCOMING";
  untouched: boolean;
  isStale: boolean;
  isBooked: boolean;
  isCancelledRecovery: boolean;
  bookingFlavor: BookingFlavor;
}

export interface FollowupCounts {
  total: number;
  cold: number;
  booked: number;
  todaysFollowup: number;
  pipeline: number;
  actionRequired: number;
  registered: number;
  bookedType: number;
}

export type FollowupFilter =
  | "all"
  | "cold"
  | "booked"
  | "todays_followup"
  | "pipeline"
  | "action_required"
  | "registered"
  | "booked_type";

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
  const newBookingCutoff = new Date(today);
  newBookingCutoff.setDate(newBookingCutoff.getDate() - NEW_BOOKING_DAYS);
  return { today, tomorrow, staleCutoff, newBookingCutoff };
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

async function getBookedCustomerIds(userId: string, newBookingCutoff: Date): Promise<Set<string>> {
  const rows = await prisma.booking.findMany({
    where: {
      bookingDate: { gte: newBookingCutoff },
      paymentStatus: { in: ["Success", "Partially Paid"] },
      NOT: { status: "Cancelled" },
      customer: {
        ownerId: userId,
        doNotContact: false,
        deletedAt: null,
      },
    },
    select: { customerId: true },
    distinct: ["customerId"],
  });
  return new Set(rows.map((r) => r.customerId));
}

async function getCancelledRecoveryIds(userId: string, newBookingCutoff: Date): Promise<Set<string>> {
  const rows = await prisma.booking.findMany({
    where: {
      bookingDate: { gte: newBookingCutoff },
      status: "Cancelled",
      customer: {
        ownerId: userId,
        doNotContact: false,
        deletedAt: null,
      },
    },
    select: { customerId: true },
    distinct: ["customerId"],
  });
  return new Set(rows.map((r) => r.customerId));
}

async function getLatestPaidBookingByCustomer(
  customerIds: string[]
): Promise<Map<string, { date: Date; status: string | null; paymentStatus: string | null }>> {
  if (customerIds.length === 0) return new Map();
  const rows = await prisma.booking.findMany({
    where: {
      customerId: { in: customerIds },
      paymentStatus: { in: ["Success", "Partially Paid"] },
      NOT: { status: "Cancelled" },
    },
    orderBy: { bookingDate: "desc" },
    select: {
      customerId: true,
      bookingDate: true,
      status: true,
      paymentStatus: true,
    },
  });
  const map = new Map<string, { date: Date; status: string | null; paymentStatus: string | null }>();
  for (const r of rows) {
    if (!r.bookingDate) continue;
    if (!map.has(r.customerId)) {
      map.set(r.customerId, {
        date: r.bookingDate,
        status: r.status,
        paymentStatus: r.paymentStatus,
      });
    }
  }
  return map;
}

function classifyBooking(
  bookingDate: Date,
  status: string | null,
  today: Date
): BookingFlavor {
  const bd = startOfDay(bookingDate);
  const isFuture = bd.getTime() >= today.getTime();
  const s = (status || "").toLowerCase();

  if (s === "completed") return "COMPLETED";
  if (s === "in progress") return "IN_PROGRESS";
  if (s === "pending") {
    return isFuture ? "AWAITING_SERVICE" : "PAID_NOT_DONE";
  }
  return null;
}

export async function getFollowupCounts(userId: string): Promise<FollowupCounts> {
  const { today, tomorrow, staleCutoff, newBookingCutoff } = getDateMarkers();
  const baseWhere = buildBaseWhere(userId);

  const bookedIds = await getBookedCustomerIds(userId, newBookingCutoff);
  const bookedArr = Array.from(bookedIds);

  const cold = await prisma.followup.count({
    where: {
      ...baseWhere,
      currentRemark: null,
      lastContactedAt: null,
      ...(bookedArr.length > 0 ? { customerId: { notIn: bookedArr } } : {}),
    },
  });

  const booked = bookedArr.length > 0
    ? await prisma.followup.count({
        where: {
          ...baseWhere,
          currentRemark: null,
          lastContactedAt: null,
          customerId: { in: bookedArr },
        },
      })
    : 0;

  const todaysFollowup = await prisma.followup.count({
    where: {
      ...baseWhere,
      OR: [
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
        {
          AND: [
            { lastContactedAt: { lt: staleCutoff, not: null } },
            { currentRemark: { not: null } },
          ],
        },
      ],
    },
  });

  const pipeline = await prisma.followup.count({
    where: {
      ...baseWhere,
      nextFollowupDate: { gte: tomorrow },
      OR: [
        { lastContactedAt: { gte: staleCutoff } },
        { AND: [{ lastContactedAt: null }, { currentRemark: { not: null } }] },
      ],
    },
  });

  const actionRequired = await prisma.followup.count({
    where: {
      ...baseWhere,
      nextFollowupDate: { lt: today },
      OR: [
        { lastContactedAt: { gte: staleCutoff } },
        { AND: [{ lastContactedAt: null }, { currentRemark: { not: null } }] },
      ],
    },
  });

  const total = cold + booked + todaysFollowup + pipeline + actionRequired;

  const [registered, bookedType] = await Promise.all([
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
    cold,
    booked,
    todaysFollowup,
    pipeline,
    actionRequired,
    registered,
    bookedType,
  };
}

type WhereInput = ReturnType<typeof buildBaseWhere> & Record<string, unknown>;

async function applyFilter(
  baseWhere: ReturnType<typeof buildBaseWhere>,
  filter: FollowupFilter,
  today: Date,
  tomorrow: Date,
  staleCutoff: Date,
  newBookingCutoff: Date,
  userId: string
): Promise<WhereInput> {
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
  if (filter === "booked_type") customerFilter.customerType = "CUSTOMER";

  const where: WhereInput = { customer: customerFilter };

  if (filter === "cold") {
    const bookedIds = await getBookedCustomerIds(userId, newBookingCutoff);
    const arr = Array.from(bookedIds);
    where.currentRemark = null;
    where.lastContactedAt = null;
    if (arr.length > 0) where.customerId = { notIn: arr };
  } else if (filter === "booked") {
    const bookedIds = await getBookedCustomerIds(userId, newBookingCutoff);
    const arr = Array.from(bookedIds);
    where.currentRemark = null;
    where.lastContactedAt = null;
    where.customerId = arr.length > 0 ? { in: arr } : { in: ["__no_match__"] };
  } else if (filter === "todays_followup") {
    where.OR = [
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
      {
        AND: [
          { lastContactedAt: { lt: staleCutoff, not: null } },
          { currentRemark: { not: null } },
        ],
      },
    ];
  } else if (filter === "pipeline") {
    where.nextFollowupDate = { gte: tomorrow };
    where.OR = [
      { lastContactedAt: { gte: staleCutoff } },
      { AND: [{ lastContactedAt: null }, { currentRemark: { not: null } }] },
    ];
  } else if (filter === "action_required") {
    where.nextFollowupDate = { lt: today };
    where.OR = [
      { lastContactedAt: { gte: staleCutoff } },
      { AND: [{ lastContactedAt: null }, { currentRemark: { not: null } }] },
    ];
  }

  return where;
}

export async function getFilteredCount(
  userId: string,
  filter: FollowupFilter
): Promise<number> {
  const { today, tomorrow, staleCutoff, newBookingCutoff } = getDateMarkers();
  const baseWhere = buildBaseWhere(userId);
  const where = await applyFilter(baseWhere, filter, today, tomorrow, staleCutoff, newBookingCutoff, userId);
  return prisma.followup.count({ where });
}

export async function getTodayFollowups(
  userId: string,
  page = 1,
  pageSize = 50,
  filter: FollowupFilter = "all"
): Promise<FollowupRow[]> {
  const { today, tomorrow, staleCutoff, newBookingCutoff } = getDateMarkers();
  const baseWhere = buildBaseWhere(userId);
  const where = await applyFilter(baseWhere, filter, today, tomorrow, staleCutoff, newBookingCutoff, userId);

  const [bookedIds, cancelledIds] = await Promise.all([
    getBookedCustomerIds(userId, newBookingCutoff),
    getCancelledRecoveryIds(userId, newBookingCutoff),
  ]);

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

  const customerIds = followups.map((f) => f.customer.id);
  const latestPaidByCustomer = await getLatestPaidBookingByCustomer(customerIds);

  return followups.map((f) => {
    const fd = startOfDay(f.nextFollowupDate);
    const lastBooking = f.customer.bookings[0];
    const untouched = !f.currentRemark && !f.lastContactedAt;
    const isStale = !!f.lastContactedAt && f.lastContactedAt < staleCutoff;
    const isBooked = bookedIds.has(f.customer.id) && untouched;
    const isCancelledRecovery = cancelledIds.has(f.customer.id) && untouched && !isBooked;

    let bookingFlavor: BookingFlavor = null;
    if (isBooked) {
      const lp = latestPaidByCustomer.get(f.customer.id);
      if (lp) bookingFlavor = classifyBooking(lp.date, lp.status, today);
    }

    let effectiveFollowupDate = fd;
    if (untouched && !isBooked) {
      effectiveFollowupDate = today;
    } else if (isStale) {
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
      isBooked,
      isCancelledRecovery,
      bookingFlavor,
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
