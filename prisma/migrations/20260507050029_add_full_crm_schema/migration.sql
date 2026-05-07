-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('NEW_REGISTRATION', 'CUSTOMER');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('REMARK_ADDED', 'NOTE_ADDED', 'FOLLOWUP_DATE_CHANGED', 'OWNER_CHANGED', 'CUSTOMER_IMPORTED', 'REGISTRATION_IMPORTED', 'BOOKING_IMPORTED', 'CUSTOMER_TYPE_CHANGED', 'DNC_FLAGGED', 'DNC_UNFLAGGED', 'CALL_LOGGED');

-- CreateEnum
CREATE TYPE "ImportType" AS ENUM ('REGISTRATIONS', 'BOOKINGS');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "deletedAt" TIMESTAMP(3),
ADD COLUMN     "onLeaveFrom" TIMESTAMP(3),
ADD COLUMN     "onLeaveUntil" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT,
    "gender" TEXT,
    "address" TEXT,
    "city" TEXT,
    "sector" TEXT,
    "customerIdExt" TEXT,
    "customerType" "CustomerType" NOT NULL DEFAULT 'NEW_REGISTRATION',
    "ownerId" TEXT,
    "doNotContact" BOOLEAN NOT NULL DEFAULT false,
    "doNotContactReason" TEXT,
    "doNotContactSetAt" TIMESTAMP(3),
    "doNotContactSetBy" TEXT,
    "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Registration" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "customerIdExt" TEXT,
    "onboardingDate" TIMESTAMP(3),
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Registration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "orderNo" TEXT,
    "aiCallingStatus" TEXT,
    "orderDate" TIMESTAMP(3),
    "bookingDate" TIMESTAMP(3),
    "bookingTime" TEXT,
    "status" TEXT,
    "paymentStatus" TEXT,
    "salonId" TEXT,
    "salonNameSnapshot" TEXT,
    "city" TEXT,
    "state" TEXT,
    "address" TEXT,
    "gst" DECIMAL(65,30),
    "grossAmount" DECIMAL(65,30),
    "stylistDiscount" DECIMAL(65,30),
    "slotsDiscount" DECIMAL(65,30),
    "couponsDiscount" DECIMAL(65,30),
    "offersDiscount" DECIMAL(65,30),
    "hygieneFee" DECIMAL(65,30),
    "platformFee" DECIMAL(65,30),
    "grandTotal" DECIMAL(65,30),
    "tokenAmount" DECIMAL(65,30),
    "remainingAmount" DECIMAL(65,30),
    "gatewayOrderId" TEXT,
    "styleLoungeCoupon" TEXT,
    "salonCoupon" TEXT,
    "styleLoungeUser" TEXT,
    "rawData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Salon" (
    "id" TEXT NOT NULL,
    "externalId" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Salon_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Followup" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "nextFollowupDate" TIMESTAMP(3) NOT NULL,
    "currentRemark" TEXT,
    "currentNote" TEXT,
    "lastContactedAt" TIMESTAMP(3),
    "lastContactedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" TEXT,

    CONSTRAINT "Followup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ActivityLog" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "userId" TEXT,
    "activityType" "ActivityType" NOT NULL,
    "remark" TEXT,
    "note" TEXT,
    "oldValue" TEXT,
    "newValue" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ActivityLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RemarkOption" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "color" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "defaultDaysAhead" INTEGER,
    "autoFlagDnc" BOOLEAN NOT NULL DEFAULT false,
    "closesFollowup" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RemarkOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImportHistory" (
    "id" TEXT NOT NULL,
    "importType" "ImportType" NOT NULL,
    "filename" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "totalRows" INTEGER NOT NULL,
    "newCount" INTEGER NOT NULL,
    "updatedCount" INTEGER NOT NULL,
    "skippedCount" INTEGER NOT NULL,
    "errorCount" INTEGER NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Setting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Setting_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_ownerId_idx" ON "Customer"("ownerId");

-- CreateIndex
CREATE INDEX "Customer_customerType_idx" ON "Customer"("customerType");

-- CreateIndex
CREATE INDEX "Customer_doNotContact_idx" ON "Customer"("doNotContact");

-- CreateIndex
CREATE UNIQUE INDEX "Registration_customerIdExt_key" ON "Registration"("customerIdExt");

-- CreateIndex
CREATE INDEX "Registration_customerId_idx" ON "Registration"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "Booking_orderNo_key" ON "Booking"("orderNo");

-- CreateIndex
CREATE INDEX "Booking_customerId_idx" ON "Booking"("customerId");

-- CreateIndex
CREATE INDEX "Booking_bookingDate_idx" ON "Booking"("bookingDate");

-- CreateIndex
CREATE INDEX "Booking_salonId_idx" ON "Booking"("salonId");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Salon_externalId_key" ON "Salon"("externalId");

-- CreateIndex
CREATE INDEX "Salon_city_idx" ON "Salon"("city");

-- CreateIndex
CREATE UNIQUE INDEX "Followup_customerId_key" ON "Followup"("customerId");

-- CreateIndex
CREATE INDEX "Followup_nextFollowupDate_idx" ON "Followup"("nextFollowupDate");

-- CreateIndex
CREATE INDEX "ActivityLog_customerId_createdAt_idx" ON "ActivityLog"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "ActivityLog_userId_createdAt_idx" ON "ActivityLog"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "RemarkOption_label_key" ON "RemarkOption"("label");

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Registration" ADD CONSTRAINT "Registration_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_salonId_fkey" FOREIGN KEY ("salonId") REFERENCES "Salon"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Followup" ADD CONSTRAINT "Followup_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ActivityLog" ADD CONSTRAINT "ActivityLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImportHistory" ADD CONSTRAINT "ImportHistory_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
