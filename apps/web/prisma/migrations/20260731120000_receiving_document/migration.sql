-- §receiving-doc-attach-canonical (T1) — 입고 증빙 문서 테이블 신설.
--
-- ⚠️ 설계 근거: 안전문서 테이블(GMP: sds/coa)은 CHECK 제약이 문서 종류를 두 분기로 하드 잠금한다
--   (coa→입고 lot 필수, sds→lot 없음). 거래명세서 등 제3 종류를 거기에 넣으려면 CHECK 재정의가 필요하고,
--   오작성 시 기존 안전문서 INSERT 까지 전면 차단되는 운영 정지급 리스크가 있다.
--   → 입고 증빙 전용 테이블 신설(additive)로 회피. 본 migration 은 안전문서 테이블을 일절 건드리지 않는다.
--
-- 안전성: additive-only (신규 테이블 + FK + 인덱스). 기존 테이블/제약/데이터 변경 0, data loss 0.

CREATE TABLE "ReceivingDocument" (
    "id"             TEXT NOT NULL,
    "orderId"        TEXT NOT NULL,
    "restockId"      TEXT,
    "organizationId" TEXT,
    "uploadedById"   TEXT,
    "docType"        TEXT NOT NULL,
    "fileName"       TEXT NOT NULL,
    "bucket"         TEXT NOT NULL,
    "path"           TEXT NOT NULL,
    "contentType"    TEXT,
    "sizeBytes"      INTEGER,
    "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceivingDocument_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ReceivingDocument_orderId_idx"        ON "ReceivingDocument"("orderId");
CREATE INDEX "ReceivingDocument_restockId_idx"      ON "ReceivingDocument"("restockId");
CREATE INDEX "ReceivingDocument_organizationId_idx" ON "ReceivingDocument"("organizationId");
CREATE INDEX "ReceivingDocument_docType_idx"        ON "ReceivingDocument"("docType");

ALTER TABLE "ReceivingDocument" ADD CONSTRAINT "ReceivingDocument_orderId_fkey"
    FOREIGN KEY ("orderId") REFERENCES "Order"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ReceivingDocument" ADD CONSTRAINT "ReceivingDocument_restockId_fkey"
    FOREIGN KEY ("restockId") REFERENCES "InventoryRestock"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReceivingDocument" ADD CONSTRAINT "ReceivingDocument_organizationId_fkey"
    FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "ReceivingDocument" ADD CONSTRAINT "ReceivingDocument_uploadedById_fkey"
    FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Rollback (수동):
--   DROP TABLE IF EXISTS "ReceivingDocument";
--   (SDSDocument·기존 테이블 무접촉이므로 추가 복구 작업 없음. 유실 범위 = 본 트랙에서 업로드된 입고 증빙 메타뿐,
--    스토리지 원본 파일은 별도 보존.)
