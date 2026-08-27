-- AlterTable
ALTER TABLE "Subscription" ADD COLUMN "amount" REAL;
ALTER TABLE "Subscription" ADD COLUMN "currentPeriodEnd" DATETIME;
ALTER TABLE "Subscription" ADD COLUMN "shopifyChargeId" TEXT;
ALTER TABLE "Subscription" ADD COLUMN "shopifyPlan" TEXT;
