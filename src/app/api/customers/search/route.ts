import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { normalizePhone } from "@/lib/normalize";

export async function GET(req: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") || "").trim();
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const digitsOnly = q.replace(/\D/g, "");
  const phoneSearch = digitsOnly.length >= 4 ? normalizePhone(digitsOnly) || digitsOnly.slice(-10) : "";
  const phoneWildcard = phoneSearch ? "%" + phoneSearch + "%" : "%__no_match__%";
  const nameWildcard = "%" + q + "%";

  const results = await prisma.$queryRaw<Array<{
    id: string;
    name: string | null;
    phone: string;
    city: string | null;
    customer_type: "NEW_REGISTRATION" | "CUSTOMER";
    do_not_contact: boolean;
    owner_name: string | null;
  }>>`
    SELECT
      c.id,
      c.name,
      c.phone,
      c.city,
      c."customerType" AS customer_type,
      c."doNotContact" AS do_not_contact,
      u.name AS owner_name
    FROM "Customer" c
    LEFT JOIN "User" u ON u.id = c."ownerId"
    WHERE c."deletedAt" IS NULL
      AND (
        c.name ILIKE ${nameWildcard}
        OR c.phone LIKE ${phoneWildcard}
        OR c."customerIdExt" = ${q}
      )
    ORDER BY
      CASE WHEN c."customerType" = 'CUSTOMER' THEN 0 ELSE 1 END,
      c."updatedAt" DESC
    LIMIT 10
  `;

  return NextResponse.json({
    results: results.map((c: {
      id: string;
      name: string | null;
      phone: string;
      city: string | null;
      customer_type: "NEW_REGISTRATION" | "CUSTOMER";
      do_not_contact: boolean;
      owner_name: string | null;
    }) => ({
      id: c.id,
      name: c.name || "(no name)",
      phone: c.phone,
      city: c.city,
      customerType: c.customer_type,
      doNotContact: c.do_not_contact,
      ownerName: c.owner_name,
    })),
  });
}
