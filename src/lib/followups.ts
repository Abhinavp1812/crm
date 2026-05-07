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
}

export interface FollowupCounts {
  total: number;
  overdue: number;
  dueToday: number;
  registered: number;
  booked: number;
}

/**
 * Get count breakdown for a user — fast, doesn't fetch row data.
 */
export async function getFollowupCounts(userId: string): Promise<FollowupCounts> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const baseFilter = {
    nextFollowupDate: { lt: tomorrow },
    customer: {
      ownerId: userId,
      doNotContact: false,
      deletedAt: null,
    },
  } as const;

  const [total, overdue, registered, booked] = await Promise.all([
    prisma.followup.count({ where: baseFilter }),
    prisma.followup.count({
      where: { ...baseFilter, nextFollowupDate: { lt: today } },
    }),
    prisma.followup.count({
      where: { ...baseFilter, customer: { ...baseFilter.customer, customerType: "NEW_REGISTRATION" } },
    }),
    prisma.followup.count({
      where: { ...baseFilter, customer: { ...baseFilter.customer, customerType: "CUSTOMER" } },
    }),
  ]);

  return {
    total,
    overdue,
    dueToday: total - overdue,
    registered,
    booked,
  };
}

/**
 * Get a page of followups for a user.
 * @param page 1-indexed page number
 * @param pageSize number of rows per page
 */
export async function getTodayFollowups(
  userId: string,
  page = 1,
  pageSize = 50
): Promise<FollowupRow[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const followups = await prisma.followup.findMany({
    where: {
      nextFollowupDate: { lt: tomorrow },
      customer: {
        ownerId: userId,
        doNotContact: false,
        deletedAt: null,
      },
    },
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
      lastBookingSalon: lastBooking?.salon?.name || lastBooking?.salonNameSnapshot || null,
      status,
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