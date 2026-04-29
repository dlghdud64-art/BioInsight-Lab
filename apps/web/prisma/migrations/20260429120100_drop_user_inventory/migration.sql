-- §11.101 #userInventory-schema-drop
-- §11.58 #inventory-model-consolidation 에서 application code 는 모두
-- ProductInventory 로 정렬 완료 (Phase 1~4, commit 3dbd3a33 / e4d2822f).
-- legacy receipt log table 제거 — silent shape drift 회귀 영구 차단.
--
-- Pre-checks:
--   1) /api/user-inventory/* endpoint 모두 §11.58 Phase 2 에서 삭제
--   2) db.userInventory.* / tx.userInventory.* application 사용 0건
--      (#labaxis-no-userinventory-usage CI guard 검증)
--   3) admin orders DELIVERED transition 의 자동 입고는 ProductInventory
--      via runDeliveryInventorySync (§11.58 Phase 1)
--
-- Production migrate 시 데이터 보존 필요 시 manual export → ProductInventory
-- 변환 SQL 별도 작성 후 적용. 현재 pilot 환경은 데이터 0건 (운영 시작 전)
-- 으로 즉시 drop 가능.

DROP TABLE IF EXISTS "UserInventory";
