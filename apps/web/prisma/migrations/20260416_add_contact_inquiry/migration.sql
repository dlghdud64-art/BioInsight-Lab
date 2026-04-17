-- CreateTable
CREATE TABLE IF NOT EXISTS "ContactInquiry" (
    "id" TEXT NOT NULL,
    "referenceId" TEXT NOT NULL,
    "inquiryType" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'received',
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewedAt" TIMESTAMP(3),
    "repliedAt" TIMESTAMP(3),

    CONSTRAINT "ContactInquiry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ContactInquiry_referenceId_key" ON "ContactInquiry"("referenceId");
CREATE INDEX IF NOT EXISTS "ContactInquiry_email_idx" ON "ContactInquiry"("email");
CREATE INDEX IF NOT EXISTS "ContactInquiry_inquiryType_idx" ON "ContactInquiry"("inquiryType");
CREATE INDEX IF NOT EXISTS "ContactInquiry_status_idx" ON "ContactInquiry"("status");
CREATE INDEX IF NOT EXISTS "ContactInquiry_createdAt_idx" ON "ContactInquiry"("createdAt");
