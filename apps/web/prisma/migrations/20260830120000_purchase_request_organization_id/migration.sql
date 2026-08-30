-- §purchase-request-org-axis (2026-08-30) — PurchaseRequest 에 조직 소속 축을 세운다.
--
-- 왜 NOT NULL 인가:
--   코드 7곳이 이미 `purchaseRequest.organizationId` 를 **있다고 가정**하고 읽는다
--   (컬럼이 없어 전부 undefined · `?? ""` 와 `if(...)` 로 조용히 흘렀다).
--   소속 축은 team 경유(`team?.organizationId`)뿐이었고 teamId 가 nullable 이라 커버 불가.
--   🛑 예산 검증이 필요한 유일한 경로(quoteId 를 채우는 유일한 생성 지점)가 teamId 를
--      안 채워 orgId 가 undefined 였고, 그래서 예산 게이트를 통째로 건너뛰었다.
--      소속 축 부재가 곧 예산 통제 부재였다.
--
-- 안전성 실측 (2026-08-30 · prod ref xhid…dhsw · read-only):
--   PurchaseRequest 0행 · Team 0 · TeamMember 0 → 백필 대상 0.
--   required 로 갈 수 있는 유일한 시점이다. nullable 로 넣으면 7곳의 방어(`?? ""`)가
--   그대로 살아 "없는 필드" 가 "null 일 수 있는 필드" 로 바뀔 뿐이다.

ALTER TABLE "PurchaseRequest" ADD COLUMN "organizationId" TEXT NOT NULL;

CREATE INDEX "PurchaseRequest_organizationId_idx" ON "PurchaseRequest"("organizationId");

ALTER TABLE "PurchaseRequest"
  ADD CONSTRAINT "PurchaseRequest_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
