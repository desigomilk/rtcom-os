-- CreateEnum
CREATE TYPE "BarrelStatus" AS ENUM ('AT_FARM_EMPTY', 'AT_FARM_FILLED', 'IN_TRANSIT_TO_PLANT', 'AT_PLANT_EMPTIED', 'IN_TRANSIT_TO_FARM');

-- CreateEnum
CREATE TYPE "DeliveryScanType" AS ENUM ('DELIVERED', 'RETURNED_EMPTY');

-- DropIndex
DROP INDEX "Customer_phone_key";

-- AlterTable
ALTER TABLE "Batch" ADD COLUMN     "barrelId" TEXT;

-- AlterTable
ALTER TABLE "Chiller" ADD COLUMN     "farmId" TEXT;

-- AlterTable
ALTER TABLE "Customer" ADD COLUMN     "areaLabel" TEXT,
ADD COLUMN     "externalId" TEXT,
ADD COLUMN     "gpsLat" DECIMAL(65,30),
ADD COLUMN     "gpsLng" DECIMAL(65,30);

-- AlterTable
ALTER TABLE "DeliveryContainerScan" ADD COLUMN     "type" "DeliveryScanType" NOT NULL DEFAULT 'DELIVERED';

-- AlterTable
ALTER TABLE "Device" ADD COLUMN     "barrelId" TEXT,
ADD COLUMN     "chillerId" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "externalId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "externalId" TEXT;

-- CreateTable
CREATE TABLE "Barrel" (
    "id" TEXT NOT NULL,
    "qrCode" TEXT NOT NULL,
    "status" "BarrelStatus" NOT NULL DEFAULT 'AT_FARM_EMPTY',
    "currentFarmId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Barrel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "variant" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "sizeLabel" TEXT,
    "unitPrice" DECIMAL(65,30),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Product_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Barrel_qrCode_key" ON "Barrel"("qrCode");

-- CreateIndex
CREATE UNIQUE INDEX "Product_externalId_key" ON "Product"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_externalId_key" ON "Customer"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "Device_chillerId_key" ON "Device"("chillerId");

-- CreateIndex
CREATE UNIQUE INDEX "Device_barrelId_key" ON "Device"("barrelId");

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_externalId_key" ON "Subscription"("externalId");

-- CreateIndex
CREATE UNIQUE INDEX "User_externalId_key" ON "User"("externalId");

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_barrelId_fkey" FOREIGN KEY ("barrelId") REFERENCES "Barrel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Barrel" ADD CONSTRAINT "Barrel_currentFarmId_fkey" FOREIGN KEY ("currentFarmId") REFERENCES "Farm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Chiller" ADD CONSTRAINT "Chiller_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "Farm"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_chillerId_fkey" FOREIGN KEY ("chillerId") REFERENCES "Chiller"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Device" ADD CONSTRAINT "Device_barrelId_fkey" FOREIGN KEY ("barrelId") REFERENCES "Barrel"("id") ON DELETE SET NULL ON UPDATE CASCADE;

