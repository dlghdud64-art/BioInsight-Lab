-- CreateEnum
DO $$ BEGIN
  CREATE TYPE "BillingStatus" AS ENUM ('ACTIVE', 'TRIALING', 'PAST_DUE', 'CANCELED');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "stripeCustomerId" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "stripeSubscriptionId" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "stripePriceId" TEXT;
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "stripeCurrentPeriodEnd" TIMESTAMP(3);
ALTER TABLE "Workspace" ADD COLUMN IF NOT EXISTS "billingStatus" "BillingStatus";

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Workspace_stripeCustomerId_key" ON "Workspace"("stripeCustomerId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Workspace_stripeSubscriptionId_key" ON "Workspace"("stripeSubscriptionId");
