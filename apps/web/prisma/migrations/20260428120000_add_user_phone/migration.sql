-- §11.69 #user-profile-settings-save-404 — User 모델에 phone 추가.
--
-- /dashboard/settings 의 운영자 연락처 입력 → /api/user/profile PATCH
-- 호출이 가능하도록 schema field 추가. nullable — 기존 row 영향 0.
-- /api/user/profile route handler 가 본 migration 과 함께 신규 추가됨
-- (route.ts 에서 phone 을 receive + persist).
--
-- Production rollout:
--   1. Vercel build 에서 `postinstall: prisma generate` 자동 (client 재생성)
--   2. `prisma migrate deploy` 는 manual — 호영님이 prod env 에서
--      `npm run prisma:migrate` (= `prisma migrate deploy`) 한 번 실행.
--   3. 적용 안 하면 endpoint PATCH 시 P2022 (Unknown column) error 가능 —
--      route handler 가 try/catch 로 graceful 처리 (사용자에게 친절 message).

-- AlterTable
ALTER TABLE "User" ADD COLUMN "phone" TEXT;
