import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// Each remark with its smart-default rules baked in.
// Day 2C agent UI uses these to enforce the "no customer falls through cracks" rule.
const REMARK_OPTIONS = [
  { label: "No follow-up",                 defaultDaysAhead: null, autoFlagDnc: false, closesFollowup: true  },
  { label: "Not Interested",               defaultDaysAhead: null, autoFlagDnc: false, closesFollowup: true  },
  { label: "No answer",                    defaultDaysAhead: 2,    autoFlagDnc: false, closesFollowup: false },
  { label: "Call back",                    defaultDaysAhead: 1,    autoFlagDnc: false, closesFollowup: false },
  { label: "Invalid Number",               defaultDaysAhead: null, autoFlagDnc: true,  closesFollowup: true  },
  { label: "Booked",                       defaultDaysAhead: 20,   autoFlagDnc: false, closesFollowup: false },
  { label: "Service taken",                defaultDaysAhead: 20,   autoFlagDnc: false, closesFollowup: false },
  { label: "Did not take service",         defaultDaysAhead: 14,   autoFlagDnc: false, closesFollowup: false },
  { label: "Will take service later",      defaultDaysAhead: 14,   autoFlagDnc: false, closesFollowup: false },
  { label: "Whatsapp link shared",         defaultDaysAhead: 3,    autoFlagDnc: false, closesFollowup: false },
  { label: "Number missing",               defaultDaysAhead: null, autoFlagDnc: true,  closesFollowup: true  },
  { label: "Location issue",               defaultDaysAhead: 7,    autoFlagDnc: false, closesFollowup: false },
  { label: "Need assistance with booking", defaultDaysAhead: 1,    autoFlagDnc: false, closesFollowup: false },
  { label: "Pricing Issue",                defaultDaysAhead: 7,    autoFlagDnc: false, closesFollowup: false },
  { label: "Timing issue",                 defaultDaysAhead: 7,    autoFlagDnc: false, closesFollowup: false },
  { label: "Salon not listed",             defaultDaysAhead: 14,   autoFlagDnc: false, closesFollowup: false },
  { label: "Coupon Code not working",      defaultDaysAhead: 1,    autoFlagDnc: false, closesFollowup: false },
  { label: "Service not listed",           defaultDaysAhead: 14,   autoFlagDnc: false, closesFollowup: false },
  { label: "Just checking out the app",    defaultDaysAhead: 14,   autoFlagDnc: false, closesFollowup: false },
  { label: "Will book later",              defaultDaysAhead: 7,    autoFlagDnc: false, closesFollowup: false },
  { label: "Will Connect Later",           defaultDaysAhead: 3,    autoFlagDnc: false, closesFollowup: false },
  { label: "Salon misbehave",              defaultDaysAhead: 7,    autoFlagDnc: false, closesFollowup: false },
];

const DEFAULT_SETTINGS: Record<string, string> = {
  // The +N day rule for completed bookings. Agents can override per-customer.
  bookingFollowupDays: "20",
  // Which booking statuses trigger an automatic follow-up schedule.
  // Comma-separated, case-insensitive. Per your decision: only "Completed".
  bookingFollowupStatuses: "Completed",
};

async function main() {
  // Admin user - read from environment with sensible defaults
  const adminEmail = process.env.SEED_ADMIN_EMAIL || "admin@crm.local";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || "admin123";
  const adminHash = await bcrypt.hash(adminPassword, 10);
  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      name: "Admin",
      passwordHash: adminHash,
      role: "ADMIN",
    },
  });
  console.log(`✅ Admin seeded: ${adminEmail} (password: from env)`);

  // Default agents - names and password can be supplied via env
  const agentsEnv = process.env.SEED_AGENT_NAMES || "Lakshita,Sonia,Shivani,Soumya";
  const agents = agentsEnv.split(",").map((s) => s.trim()).filter(Boolean);
  const agentPassword = process.env.SEED_AGENT_PASSWORD || "agent123";
  const agentHash = await bcrypt.hash(agentPassword, 10);
  for (const name of agents) {
    const email = `${name.toLowerCase()}@crm.local`;
    await prisma.user.upsert({
      where: { email },
      update: {},
      create: {
        email,
        name,
        passwordHash: agentHash,
        role: "AGENT",
      },
    });
  }
  console.log(`✅ ${agents.length} agents seeded (password: from env)`);

  // Remark options with smart-default rules
  for (let i = 0; i < REMARK_OPTIONS.length; i++) {
    const r = REMARK_OPTIONS[i];
    await prisma.remarkOption.upsert({
      where: { label: r.label },
      update: {
        sortOrder: i,
        defaultDaysAhead: r.defaultDaysAhead,
        autoFlagDnc: r.autoFlagDnc,
        closesFollowup: r.closesFollowup,
      },
      create: {
        label: r.label,
        sortOrder: i,
        defaultDaysAhead: r.defaultDaysAhead,
        autoFlagDnc: r.autoFlagDnc,
        closesFollowup: r.closesFollowup,
      },
    });
  }
  console.log(`✅ ${REMARK_OPTIONS.length} remark options seeded`);

  // Settings
  for (const [key, value] of Object.entries(DEFAULT_SETTINGS)) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }
  console.log(`✅ ${Object.keys(DEFAULT_SETTINGS).length} settings seeded`);

  console.log("\n🎉 Seed complete.\n");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());