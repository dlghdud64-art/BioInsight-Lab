-- CreateEnum
CREATE TYPE "InboundEmailStatus" AS ENUM ('MATCHED', 'UNMATCHED', 'FAILED');

-- CreateTable
CREATE TABLE "QuoteRfqToken" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "expiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteRfqToken_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InboundEmail" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'sendgrid',
    "messageId" TEXT NOT NULL,
    "to" TEXT NOT NULL,
    "from" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "text" TEXT,
    "html" TEXT,
    "rawHeaders" JSONB,
    "attachmentsMeta" JSONB,
    "matchedQuoteId" TEXT,
    "status" "InboundEmailStatus" NOT NULL DEFAULT 'UNMATCHED',
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InboundEmail_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteReply" (
    "id" TEXT NOT NULL,
    "quoteId" TEXT NOT NULL,
    "vendorName" TEXT,
    "fromEmail" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "bodyText" TEXT,
    "bodyHtml" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QuoteReply_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuoteReplyAttachment" (
    "id" TEXT NOT NULL,
    "replyId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "contentType" TEXT,
    "sizeBytes" INTEGER NOT NULL,
    "bucket" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "QuoteReplyAttachment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "QuoteRfqToken_quoteId_key" ON "QuoteRfqToken"("quoteId");

-- CreateIndex
CREATE UNIQUE INDEX "QuoteRfqToken_token_key" ON "QuoteRfqToken"("token");

-- CreateIndex
CREATE INDEX "QuoteRfqToken_token_idx" ON "QuoteRfqToken"("token");

-- CreateIndex
CREATE INDEX "QuoteRfqToken_enabled_idx" ON "QuoteRfqToken"("enabled");

-- CreateIndex
CREATE UNIQUE INDEX "InboundEmail_messageId_key" ON "InboundEmail"("messageId");

-- CreateIndex
CREATE INDEX "InboundEmail_messageId_idx" ON "InboundEmail"("messageId");

-- CreateIndex
CREATE INDEX "InboundEmail_status_idx" ON "InboundEmail"("status");

-- CreateIndex
CREATE INDEX "InboundEmail_matchedQuoteId_idx" ON "InboundEmail"("matchedQuoteId");

-- CreateIndex
CREATE INDEX "InboundEmail_receivedAt_idx" ON "InboundEmail"("receivedAt");

-- CreateIndex
CREATE INDEX "QuoteReply_quoteId_idx" ON "QuoteReply"("quoteId");

-- CreateIndex
CREATE INDEX "QuoteReply_fromEmail_idx" ON "QuoteReply"("fromEmail");

-- CreateIndex
CREATE INDEX "QuoteReply_receivedAt_idx" ON "QuoteReply"("receivedAt");

-- CreateIndex
CREATE INDEX "QuoteReplyAttachment_replyId_idx" ON "QuoteReplyAttachment"("replyId");

-- AddForeignKey
ALTER TABLE "QuoteRfqToken" ADD CONSTRAINT "QuoteRfqToken_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InboundEmail" ADD CONSTRAINT "InboundEmail_matchedQuoteId_fkey" FOREIGN KEY ("matchedQuoteId") REFERENCES "Quote"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteReply" ADD CONSTRAINT "QuoteReply_quoteId_fkey" FOREIGN KEY ("quoteId") REFERENCES "Quote"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuoteReplyAttachment" ADD CONSTRAINT "QuoteReplyAttachment_replyId_fkey" FOREIGN KEY ("replyId") REFERENCES "QuoteReply"("id") ON DELETE CASCADE ON UPDATE CASCADE;
