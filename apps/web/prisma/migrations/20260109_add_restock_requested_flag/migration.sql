-- AlterTable
ALTER TABLE "UserInventory" ADD COLUMN "restockRequested" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "UserInventory_restockRequested_idx" ON "UserInventory"("restockRequested");
