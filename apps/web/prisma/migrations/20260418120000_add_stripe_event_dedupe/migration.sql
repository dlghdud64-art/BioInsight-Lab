-- Task #40: Stripe Webhook 멱등성 보장 테이블
-- 참조: https://docs.stripe.com/webhooks (Handle duplicate events)
-- Stripe 는 at-least-once delivery 이므로 같은 event 가 여러 번 수신될 수 있다.
-- event.id 를 PK 로 insert 해서 UNIQUE constraint violation 으로 duplicate 을 감지한다.

-- CreateTable
CREATE TABLE "StripeEvent" (
    "eventId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StripeEvent_pkey" PRIMARY KEY ("eventId")
);

-- CreateIndex
CREATE INDEX "StripeEvent_type_idx" ON "StripeEvent"("type");

-- CreateIndex
CREATE INDEX "StripeEvent_processedAt_idx" ON "StripeEvent"("processedAt");
