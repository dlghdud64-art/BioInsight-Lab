-- §invite-flow Phase 1 (2026-08-31) — "선택의 거처" 를 세운다.
--
-- 왜 필요한가 (실측 · docs/plans/inventory/org-scope-callers.md):
--   사용자의 활성 조직을 담는 자리가 **없다.** 그래서 API 22곳이
--   `organizationMember.findFirst({ where: { userId } })` 로, UI 15곳이 `orgs[0]` 로
--   각자 첫 조직을 골랐다. 지금은 3a(가입 시 조직 자동 생성)로 모두 조직이 1개라
--   오선택이 잠재 상태지만, 초대 수락이 열리는 순간(§invite-flow Phase 3) 2중 소속이
--   생기고 39곳이 동시에 서로 다른 조직을 고를 수 있다.
--   → 수락보다 거처가 먼저다(§onboarding-blocker #7 순서 ①).
--
-- 왜 NULLABLE 인가:
--   기존 사용자에게 백필하지 않는다. null = "아직 고른 적 없음" 이고, resolver 가
--   createdAt asc 첫 멤버십으로 fallback 한다 — api/team/route.ts:118 의 현행 규칙과
--   같은 값이라 **무변경 사용자의 행동 변화가 0** 이다.
--   NOT NULL + 백필로 가면 그 순간 39곳의 선택을 마이그레이션이 대신 확정해버린다.
--
-- 왜 SET NULL 인가:
--   조직이 삭제되면 거처는 사라진 곳을 가리킬 수 없다. 멤버십만 잃은 경우(탈퇴)는
--   FK 가 못 막으므로 resolver 가 멤버십을 재검증해 fallback 한다 — 두 층이 각자 다른
--   실패를 막는다.
--
-- Rollback: DROP CONSTRAINT + DROP COLUMN (읽는 코드가 resolver 1곳뿐이라 안전).

ALTER TABLE "User" ADD COLUMN "activeOrganizationId" TEXT;

CREATE INDEX "User_activeOrganizationId_idx" ON "User"("activeOrganizationId");

ALTER TABLE "User"
  ADD CONSTRAINT "User_activeOrganizationId_fkey"
  FOREIGN KEY ("activeOrganizationId") REFERENCES "Organization"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
