-- §11.133 #admin-user-soft-delete
-- User soft delete marker. null=active, truthy=반려/삭제.
-- audit 보존 강화 — User row 보존 + USER_DELETED audit + cascade FK 그대로

ALTER TABLE "User" ADD COLUMN "deletedAt" TIMESTAMP;

-- 운영자가 deletedAt IS NOT NULL user 빠르게 cleanup 위해 index 권장 (선택)
-- CREATE INDEX "User_deletedAt_idx" ON "User"("deletedAt");
