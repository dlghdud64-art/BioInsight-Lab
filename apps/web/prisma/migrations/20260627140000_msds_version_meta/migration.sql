-- §msds-version-validation — SDSDocument 버전 메타 컬럼(버전상태 휴리스틱 분류 입력).
-- additive nullable 전용: 기존 행 영향 0, data loss 0, CHECK constraint(SDSDocument_coa_lot_check) 무영향.
ALTER TABLE "SDSDocument" ADD COLUMN "docVersion" TEXT;
ALTER TABLE "SDSDocument" ADD COLUMN "issuedAt" TIMESTAMP(3);
ALTER TABLE "SDSDocument" ADD COLUMN "expiresAt" TIMESTAMP(3);
ALTER TABLE "SDSDocument" ADD COLUMN "supersededAt" TIMESTAMP(3);
