-- AlterTable
ALTER TABLE "PenaltyCharge" ADD COLUMN     "periodDate" DATE,
ADD COLUMN     "relatedContainerId" TEXT;

-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN     "ratePerLitre" DECIMAL(65,30) NOT NULL DEFAULT 0;

-- CreateIndex
CREATE UNIQUE INDEX "PenaltyCharge_customerId_type_relatedContainerId_periodDate_key" ON "PenaltyCharge"("customerId", "type", "relatedContainerId", "periodDate");

-- AddForeignKey
ALTER TABLE "PenaltyCharge" ADD CONSTRAINT "PenaltyCharge_relatedContainerId_fkey" FOREIGN KEY ("relatedContainerId") REFERENCES "Container"("id") ON DELETE SET NULL ON UPDATE CASCADE;

