-- CreateTable
CREATE TABLE "ProductAnalysis" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "analysedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "scoreOverall" INTEGER NOT NULL DEFAULT 0,
    "scoreCRO" INTEGER NOT NULL DEFAULT 0,
    "scoreAEO" INTEGER NOT NULL DEFAULT 0,
    "rawAnalysis" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending'
);

-- CreateTable
CREATE TABLE "ChangeHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shop" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "beforeValue" TEXT NOT NULL,
    "afterValue" TEXT NOT NULL,
    "appliedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "undoneAt" DATETIME
);

-- CreateIndex
CREATE UNIQUE INDEX "ProductAnalysis_shop_productId_key" ON "ProductAnalysis"("shop", "productId");
