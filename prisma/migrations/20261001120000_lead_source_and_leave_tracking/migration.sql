-- AlterTable: Customer gets a freeform Lead Source label (matches an active
-- LeadSourceOption by label, same pattern as Followup.currentRemark/RemarkOption).
ALTER TABLE "Customer" ADD COLUMN "leadSource" TEXT;
CREATE INDEX "Customer_leadSource_idx" ON "Customer"("leadSource");

-- CreateTable: LeadSourceOption — the admin-managed dropdown list.
CREATE TABLE "LeadSourceOption" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadSourceOption_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "LeadSourceOption_label_key" ON "LeadSourceOption"("label");

-- CreateTable: LeaveRecord — durable history behind User.onLeaveFrom/onLeaveUntil,
-- which only ever holds the current window and gets cleared on next login.
CREATE TABLE "LeaveRecord" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" TEXT,

    CONSTRAINT "LeaveRecord_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "LeaveRecord_userId_startDate_idx" ON "LeaveRecord"("userId", "startDate");
ALTER TABLE "LeaveRecord" ADD CONSTRAINT "LeaveRecord_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed a starter set of lead sources so the dropdown isn't empty on first use.
INSERT INTO "LeadSourceOption" ("id", "label", "sortOrder", "isActive") VALUES
  ('leadsrc_organic', 'Organic / Walk-in', 0, true),
  ('leadsrc_referral', 'Referral', 1, true),
  ('leadsrc_instagram', 'Instagram', 2, true),
  ('leadsrc_facebook', 'Facebook', 3, true),
  ('leadsrc_google', 'Google Ads', 4, true);
