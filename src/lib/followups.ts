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

/**
 * Get follow-ups for a specific user (agent's queue),
 * applying the locked-rule filter:
 *   - Skip DNC customers
 *   - Show overdue + due today
 *   - Hide if contacted today AND follow-up date hasn't moved forward
 */
export async function getTodayFollowups(userId: string): Promise<FollowupRow[]> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get all due/overdue followups for this user
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

/**
 * Format a 10-digit Indian phone for display: 98765 43210
 */
export function formatPhone(phone: string): string {
  if (!phone || phone.length !== 10) return phone;
  return `${phone.slice(0, 5)} ${phone.slice(5)}`;
}

/**
 * Build wa.me link with optional pre-filled message
 */
export function whatsappLink(phone: string, message?: string): string {
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/91${phone}${text}`;
}

/**
 * Build tel: link
 */
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