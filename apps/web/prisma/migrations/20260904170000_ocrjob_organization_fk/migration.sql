-- §scan-org-identity B-3 (호영님 2026-09-04) — OcrJob.organizationId FK 신설.
--
-- 왜: 이 컬럼에 FK 가 **없어서** OCR 라우트 5곳이 조직 자리에 session.user.id 를 써도
--   DB 가 막지 않았다. 그 값이 ProductInventory(FK 있음)로 승계되며 P2003 으로 터졌고,
--   그때까지 신규 품목 스캔 입고는 100% 실패했다. 같은 형태가 다시 생기지 않게
--   **DB 층에서** 막는다 — 코드 규칙과 sentinel 만으로는 이번에 못 막았다.
--
-- ON DELETE RESTRICT (호영님 결정 2026-09-04):
--   CASCADE 면 조직 하나 지울 때 OcrJob 이 연쇄 삭제되고 InventoryRestock.ocrJobId 가
--   SetNull 로 끊겨 **재고 이력의 스캔 출처가 말없이 사라진다.**
--   SET NULL 은 컬럼이 non-null 이라 불가하며, 가능했더라도 더 나쁘다 —
--   계보는 남는데 누구 것인지 모르게 된다.
--   RESTRICT 는 조직을 지우려면 그 조직의 OCR 기록을 어떻게 할지 **명시적으로 결정하게** 만든다.
--   막히는 것은 비용이 아니라 기능이다.
--
-- 선행 조건(B-2, 2026-09-04 적용 완료):
--   실재하지 않는 조직을 가리키던 OcrJob 1행을 T1 로 보정했다.
--   보정 전에 이 DDL 을 걸면 제약 생성 자체가 실패한다.
--   적용 직전 실측: OcrJob 1행 · 고아 0건.
--
-- additive only: 제약 1개 추가. 컬럼·데이터·인덱스 무접촉.
--   인덱스는 새로 만들지 않는다 — @@index([organizationId, type]) 가 이미 있고
--   선행 컬럼이 organizationId 라 FK 조회에 그대로 쓰인다. 중복 인덱스는 쓰기 비용만 는다.

ALTER TABLE "OcrJob"
  ADD CONSTRAINT "OcrJob_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "Organization"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
