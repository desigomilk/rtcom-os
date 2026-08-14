-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ERP_ADMIN', 'PLANT_STAFF', 'FARM_STAFF', 'DELIVERY_BOY');

-- CreateEnum
CREATE TYPE "BatchStatus" AS ENUM ('AT_FARM', 'IN_TRANSIT', 'AT_PLANT');

-- CreateEnum
CREATE TYPE "ContainerType" AS ENUM ('BOTTLE', 'BARREL', 'JAR');

-- CreateEnum
CREATE TYPE "ContainerStatus" AS ENUM ('FILLED', 'IN_TRANSIT', 'DELIVERED', 'RETURNED', 'LOST');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('ACTIVE', 'PAUSED');

-- CreateEnum
CREATE TYPE "DeliveryStopStatus" AS ENUM ('PENDING', 'COMPLETE', 'PARTIAL', 'ISSUE');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('UPI', 'QR', 'CASH', 'BANK');

-- CreateEnum
CREATE TYPE "PenaltyType" AS ENUM ('UNRETURNED_BOTTLE_DAILY', 'LOST_BOTTLE', 'LOST_BARREL', 'AMC');

-- CreateEnum
CREATE TYPE "DeviceType" AS ENUM ('RTCOM_1A', 'RTCOM_1B', 'RTCOM_1C', 'RTCOM_2A', 'RTCOM_2B', 'RTCOM_2C', 'RTCOM_3A');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('ONLINE', 'OFFLINE', 'ERROR');

-- CreateEnum
CREATE TYPE "MessageChannel" AS ENUM ('WHATSAPP', 'VOICE_CALL');

-- CreateEnum
CREATE TYPE "IntentStatus" AS ENUM ('PENDING_CONFIRMATION', 'CONFIRMED', 'REJECTED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "InvoiceStatus" AS ENUM ('DRAFT', 'ISSUED', 'PARTIALLY_PAID', 'PAID');

-- CreateEnum
CREATE TYPE "LeadSource" AS ENUM ('WHATSAPP', 'CALL', 'REFERRAL', 'OTHER');

-- CreateEnum
CREATE TYPE "LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'LOST');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "refreshTokenHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "City" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "City_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Area" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "cityId" TEXT NOT NULL,

    CONSTRAINT "Area_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Route" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "areaId" TEXT,

    CONSTRAINT "Route_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Farm" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ownerName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "village" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Farm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FarmMilkEntry" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "litres" DECIMAL(65,30) NOT NULL,
    "fat" DECIMAL(65,30) NOT NULL,
    "snf" DECIMAL(65,30) NOT NULL,
    "adulterationResult" JSONB,
    "enteredById" TEXT NOT NULL,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "batchId" TEXT,

    CONSTRAINT "FarmMilkEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "qrCode" TEXT NOT NULL,
    "status" "BatchStatus" NOT NULL DEFAULT 'AT_FARM',
    "dispatchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlantReceipt" (
    "id" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "fat" DECIMAL(65,30) NOT NULL,
    "snf" DECIMAL(65,30) NOT NULL,
    "adulterationResult" JSONB,
    "mismatchFlag" BOOLEAN NOT NULL DEFAULT false,
    "mismatchNotes" TEXT,
    "receivedById" TEXT NOT NULL,

    CONSTRAINT "PlantReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Chiller" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacityLitres" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Chiller_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChillerBlend" (
    "id" TEXT NOT NULL,
    "chillerId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "litres" DECIMAL(65,30) NOT NULL,
    "percentContribution" DECIMAL(65,30) NOT NULL,
    "blendedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChillerBlend_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BottlingRun" (
    "id" TEXT NOT NULL,
    "chillerId" TEXT NOT NULL,
    "manualCount" INTEGER NOT NULL,
    "cameraCount" INTEGER,
    "mismatchFlag" BOOLEAN NOT NULL DEFAULT false,
    "runAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "staffId" TEXT NOT NULL,

    CONSTRAINT "BottlingRun_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Container" (
    "id" TEXT NOT NULL,
    "qrCode" TEXT NOT NULL,
    "containerType" "ContainerType" NOT NULL,
    "variant" TEXT NOT NULL,
    "sealColor" TEXT,
    "status" "ContainerStatus" NOT NULL DEFAULT 'FILLED',
    "bottlingRunId" TEXT,
    "currentCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Container_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContainerQrReassignment" (
    "id" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "oldQrCode" TEXT NOT NULL,
    "newQrCode" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "reassignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reassignedById" TEXT NOT NULL,

    CONSTRAINT "ContainerQrReassignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lead" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "source" "LeadSource" NOT NULL,
    "areaId" TEXT,
    "status" "LeadStatus" NOT NULL DEFAULT 'NEW',
    "assignedToId" TEXT,
    "notes" TEXT,
    "convertedCustomerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Lead_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "routeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RouteStop" (
    "id" TEXT NOT NULL,
    "routeId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL,
    "sequenceOptimized" INTEGER,
    "plannedLat" DECIMAL(65,30),
    "plannedLng" DECIMAL(65,30),

    CONSTRAINT "RouteStop_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "dailyQuantityLitres" DECIMAL(65,30) NOT NULL,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "pausedDates" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryLog" (
    "id" TEXT NOT NULL,
    "routeStopId" TEXT NOT NULL,
    "deliveryBoyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "DeliveryStopStatus" NOT NULL DEFAULT 'PENDING',
    "emptyContainersReturned" INTEGER NOT NULL DEFAULT 0,
    "scannedLat" DECIMAL(65,30),
    "scannedLng" DECIMAL(65,30),
    "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "overridePhotoUrl" TEXT,
    "handedOverFromDeliveryBoyId" TEXT,
    "handoverAt" TIMESTAMP(3),
    "clientEventId" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3),
    "syncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryContainerScan" (
    "id" TEXT NOT NULL,
    "deliveryLogId" TEXT NOT NULL,
    "containerId" TEXT NOT NULL,
    "scannedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryContainerScan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmptyContainerReconciliation" (
    "id" TEXT NOT NULL,
    "deliveryBoyId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "takenCount" INTEGER NOT NULL,
    "deliveredCount" INTEGER NOT NULL,
    "returnedCount" INTEGER NOT NULL,
    "discrepancy" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "EmptyContainerReconciliation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Invoice" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "periodStart" DATE NOT NULL,
    "periodEnd" DATE NOT NULL,
    "totalAmount" DECIMAL(65,30) NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InvoiceLineItem" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "kind" TEXT NOT NULL,

    CONSTRAINT "InvoiceLineItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "method" "PaymentMethod" NOT NULL,
    "referenceId" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PenaltyCharge" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "type" "PenaltyType" NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,

    CONSTRAINT "PenaltyCharge_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Device" (
    "id" TEXT NOT NULL,
    "type" "DeviceType" NOT NULL,
    "serialNumber" TEXT NOT NULL,
    "location" TEXT NOT NULL,
    "status" "DeviceStatus" NOT NULL DEFAULT 'OFFLINE',
    "lastSeenAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Device_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceReading" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceReading_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerMessage" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "channel" "MessageChannel" NOT NULL,
    "direction" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerMessage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParsedIntent" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "intentType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "IntentStatus" NOT NULL DEFAULT 'PENDING_CONFIRMATION',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParsedIntent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IntentConfirmation" (
    "id" TEXT NOT NULL,
    "parsedIntentId" TEXT NOT NULL,
    "confirmedAt" TIMESTAMP(3),
    "confirmationChannel" "MessageChannel" NOT NULL DEFAULT 'WHATSAPP',

    CONSTRAINT "IntentConfirmation_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "City_name_key" ON "City"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Area_cityId_name_key" ON "Area"("cityId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Route_code_key" ON "Route"("code");

-- CreateIndex
CREATE INDEX "FarmMilkEntry_farmId_timestamp_idx" ON "FarmMilkEntry"("farmId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_qrCode_key" ON "Batch"("qrCode");

-- CreateIndex
CREATE UNIQUE INDEX "PlantReceipt_batchId_key" ON "PlantReceipt"("batchId");

-- CreateIndex
CREATE INDEX "ChillerBlend_chillerId_blendedAt_idx" ON "ChillerBlend"("chillerId", "blendedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Container_qrCode_key" ON "Container"("qrCode");

-- CreateIndex
CREATE UNIQUE INDEX "Lead_convertedCustomerId_key" ON "Lead"("convertedCustomerId");

-- CreateIndex
CREATE INDEX "Lead_status_idx" ON "Lead"("status");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "RouteStop_routeId_sequence_idx" ON "RouteStop"("routeId", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "RouteStop_routeId_customerId_key" ON "RouteStop"("routeId", "customerId");

-- CreateIndex
CREATE INDEX "Subscription_customerId_effectiveFrom_idx" ON "Subscription"("customerId", "effectiveFrom");

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryLog_clientEventId_key" ON "DeliveryLog"("clientEventId");

-- CreateIndex
CREATE INDEX "DeliveryLog_deliveryBoyId_date_idx" ON "DeliveryLog"("deliveryBoyId", "date");

-- CreateIndex
CREATE UNIQUE INDEX "EmptyContainerReconciliation_deliveryBoyId_date_key" ON "EmptyContainerReconciliation"("deliveryBoyId", "date");

-- CreateIndex
CREATE INDEX "Invoice_customerId_periodStart_idx" ON "Invoice"("customerId", "periodStart");

-- CreateIndex
CREATE UNIQUE INDEX "Device_serialNumber_key" ON "Device"("serialNumber");

-- CreateIndex
CREATE INDEX "DeviceReading_deviceId_recordedAt_idx" ON "DeviceReading"("deviceId", "recordedAt");

-- CreateIndex
CREATE UNIQUE INDEX "IntentConfirmation_parsedIntentId_key" ON "IntentConfirmation"("parsedIntentId");

-- AddForeignKey
ALTER TABLE "Area" ADD CONSTRAINT "Area_cityId_fkey" FOREIGN KEY ("cityId") REFERENCES "City"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Route" ADD CONSTRAINT "Route_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmMilkEntry" ADD CONSTRAINT "FarmMilkEntry_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmMilkEntry" ADD CONSTRAINT "FarmMilkEntry_enteredById_fkey" FOREIGN KEY ("enteredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FarmMilkEntry" ADD CONSTRAINT "FarmMilkEntry_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantReceipt" ADD CONSTRAINT "PlantReceipt_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PlantReceipt" ADD CONSTRAINT "PlantReceipt_receivedById_fkey" FOREIGN KEY ("receivedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChillerBlend" ADD CONSTRAINT "ChillerBlend_chillerId_fkey" FOREIGN KEY ("chillerId") REFERENCES "Chiller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChillerBlend" ADD CONSTRAINT "ChillerBlend_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChillerBlend" ADD CONSTRAINT "ChillerBlend_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BottlingRun" ADD CONSTRAINT "BottlingRun_chillerId_fkey" FOREIGN KEY ("chillerId") REFERENCES "Chiller"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BottlingRun" ADD CONSTRAINT "BottlingRun_staffId_fkey" FOREIGN KEY ("staffId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Container" ADD CONSTRAINT "Container_bottlingRunId_fkey" FOREIGN KEY ("bottlingRunId") REFERENCES "BottlingRun"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Container" ADD CONSTRAINT "Container_currentCustomerId_fkey" FOREIGN KEY ("currentCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContainerQrReassignment" ADD CONSTRAINT "ContainerQrReassignment_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContainerQrReassignment" ADD CONSTRAINT "ContainerQrReassignment_reassignedById_fkey" FOREIGN KEY ("reassignedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_areaId_fkey" FOREIGN KEY ("areaId") REFERENCES "Area"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_convertedCustomerId_fkey" FOREIGN KEY ("convertedCustomerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_routeId_fkey" FOREIGN KEY ("routeId") REFERENCES "Route"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RouteStop" ADD CONSTRAINT "RouteStop_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryLog" ADD CONSTRAINT "DeliveryLog_routeStopId_fkey" FOREIGN KEY ("routeStopId") REFERENCES "RouteStop"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryLog" ADD CONSTRAINT "DeliveryLog_deliveryBoyId_fkey" FOREIGN KEY ("deliveryBoyId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryLog" ADD CONSTRAINT "DeliveryLog_handedOverFromDeliveryBoyId_fkey" FOREIGN KEY ("handedOverFromDeliveryBoyId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryContainerScan" ADD CONSTRAINT "DeliveryContainerScan_deliveryLogId_fkey" FOREIGN KEY ("deliveryLogId") REFERENCES "DeliveryLog"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryContainerScan" ADD CONSTRAINT "DeliveryContainerScan_containerId_fkey" FOREIGN KEY ("containerId") REFERENCES "Container"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmptyContainerReconciliation" ADD CONSTRAINT "EmptyContainerReconciliation_deliveryBoyId_fkey" FOREIGN KEY ("deliveryBoyId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Invoice" ADD CONSTRAINT "Invoice_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InvoiceLineItem" ADD CONSTRAINT "InvoiceLineItem_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PenaltyCharge" ADD CONSTRAINT "PenaltyCharge_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceReading" ADD CONSTRAINT "DeviceReading_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerMessage" ADD CONSTRAINT "CustomerMessage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParsedIntent" ADD CONSTRAINT "ParsedIntent_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "CustomerMessage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IntentConfirmation" ADD CONSTRAINT "IntentConfirmation_parsedIntentId_fkey" FOREIGN KEY ("parsedIntentId") REFERENCES "ParsedIntent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
