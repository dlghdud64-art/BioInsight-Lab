-- §scan-recognition-upgrade P4 (2026-08-31 상신 · 적용은 호영님 "진행" 후 CLI migrate deploy) —
-- 공급사별 파싱 템플릿 학습 저장소 신설.
--
-- 왜: 보정은 현재 OcrJob 단위로만 남아 다음 파싱에 재사용되지 않는다(핸드오프 §3 G4).
--   사람이 확정 시 보정한 필드의 앵커 문맥을 조직·공급사·문서종류 단위로 축적 →
--   다음 파싱에 힌트(후보)로 주입. 자동 확정 축 없음 — 확정은 언제나 사람.
--
-- additive only: CREATE TABLE 1 + CREATE UNIQUE INDEX 1 + CREATE INDEX 1.
--   기존 테이블·CHECK·FK 접촉 0 (FK 없음 — organizationId 는 scalar, 신규 테이블 선례 동일).

CREATE TABLE "VendorParseTemplate" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "vendorKey" TEXT NOT NULL,
    "docType" TEXT NOT NULL,
    "fieldKey" TEXT NOT NULL,
    "anchorPattern" TEXT NOT NULL,
    "valuePattern" TEXT,
    "hits" INTEGER NOT NULL DEFAULT 0,
    "lastUsedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VendorParseTemplate_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "VendorParseTemplate_org_vendor_doc_field_anchor_key" ON "VendorParseTemplate"("organizationId", "vendorKey", "docType", "fieldKey", "anchorPattern");

CREATE INDEX "VendorParseTemplate_org_vendor_doc_idx" ON "VendorParseTemplate"("organizationId", "vendorKey", "docType");
