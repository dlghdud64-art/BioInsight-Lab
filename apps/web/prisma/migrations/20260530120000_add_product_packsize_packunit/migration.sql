-- §11.326 스마트 입고 데이터 모델 분리: 통 1개 함량(packSize/packUnit) 신규.
-- nullable ADD COLUMN — 메타데이터 변경, 기존 데이터 영향 0, 가역(DROP COLUMN).
ALTER TABLE "Product" ADD COLUMN "packSize" DOUBLE PRECISION;
ALTER TABLE "Product" ADD COLUMN "packUnit" TEXT;
