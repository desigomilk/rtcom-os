/*
  Warnings:

  - You are about to drop the column `pausedDates` on the `Subscription` table. All the data in the column will be lost.

*/
-- CreateEnum
CREATE TYPE "DeliveryExceptionType" AS ENUM ('PAUSE', 'EXTRA');

-- AlterTable
ALTER TABLE "Subscription" DROP COLUMN "pausedDates";

-- CreateTable
CREATE TABLE "DeliveryDateException" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" "DeliveryExceptionType" NOT NULL,
    "extraQuantityLitres" DECIMAL(65,30),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeliveryDateException_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeliveryDateException_customerId_date_key" ON "DeliveryDateException"("customerId", "date");

-- AddForeignKey
ALTER TABLE "DeliveryDateException" ADD CONSTRAINT "DeliveryDateException_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
