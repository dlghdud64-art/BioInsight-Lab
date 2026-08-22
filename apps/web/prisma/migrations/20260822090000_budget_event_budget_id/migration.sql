-- P2 (PLAN_order-budget-reservation): BudgetEvent.budgetId additive
-- canonical 예산 = Budget 판정(2026-08-22) 이행 — 발주 예약 원장이 Budget 을 직접 가리킨다.
-- additive nullable + 인덱스만 — 기존 행 무수정 · FK 미설정(append-only 원장).
ALTER TABLE "BudgetEvent" ADD COLUMN "budgetId" TEXT;

CREATE INDEX "BudgetEvent_budgetId_idx" ON "BudgetEvent"("budgetId");
