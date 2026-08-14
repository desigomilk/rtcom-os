-- CreateIndex
CREATE UNIQUE INDEX "Invoice_customerId_periodStart_periodEnd_key" ON "Invoice"("customerId", "periodStart", "periodEnd");

