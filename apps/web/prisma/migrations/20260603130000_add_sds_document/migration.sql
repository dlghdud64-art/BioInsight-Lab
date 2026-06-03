-- CreateTable
CREATE TABLE "SDSDocument" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "organizationId" TEXT,
    "fileName" TEXT NOT NULL,
    "bucket" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'upload',
    "contentType" TEXT,
    "sizeBytes" INTEGER,
    "extractionStatus" TEXT,
    "extractionResult" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SDSDocument_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SDSDocument_productId_idx" ON "SDSDocument"("productId");

-- CreateIndex
CREATE INDEX "SDSDocument_organizationId_idx" ON "SDSDocument"("organizationId");

-- CreateIndex
CREATE INDEX "SDSDocument_extractionStatus_idx" ON "SDSDocument"("extractionStatus");

-- AddForeignKey
ALTER TABLE "SDSDocument" ADD CONSTRAINT "SDSDocument_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SDSDocument" ADD CONSTRAINT "SDSDocument_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

