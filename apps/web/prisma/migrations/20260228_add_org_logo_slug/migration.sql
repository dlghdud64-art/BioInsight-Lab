-- AlterTable: Organization에 logoUrl, slug 필드 추가
ALTER TABLE "Organization"
  ADD COLUMN "logoUrl" TEXT,
  ADD COLUMN "slug"    TEXT;

-- slug는 전역 유니크 제약
CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
