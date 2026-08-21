-- §org-settings-redesign — 조직 초대 정책 (additive · 기본 null = 현행 동작 무변경)
ALTER TABLE "Organization" ADD COLUMN "invitePolicy" JSONB;
