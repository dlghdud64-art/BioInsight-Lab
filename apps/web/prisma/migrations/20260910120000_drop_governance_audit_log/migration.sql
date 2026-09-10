-- §activity-source-of-truth 5 (호영님 2026-09-10) — GovernanceAuditLog 제거
--
-- 근거 (실측 2026-09-10):
--   쓰는 심볼   0   (소스 참조는 주석 4건뿐 — 코드 사용 0)
--   FK 관계     0   (독립 테이블 · 참조하는 모델 없음)
--   prod 행수   0
--   PrismaAuditAdapter 가 "Batch 6 실제 구현" 으로 완성돼 있었으나 호출자가 0이었고,
--   그 어댑터는 §facade 제거(2026-09-07)로 이미 걷어냈다. 테이블만 남아 있었다.
--
-- 되돌림: 이 파일의 역방향은 0_init 의 CREATE TABLE "GovernanceAuditLog" + 인덱스 6종이다.
--   데이터 손실 0 (0행). 되살릴 일이 생기면 그 DDL 을 그대로 다시 적용하면 된다.
--
-- 🛑 이 마이그레이션은 **prod 자동 적용되지 않는다** — 이 저장소는 ADR-002 로
--    빌드타임 migrate 를 차단했다(scripts/vercel-migrate.js NO-OP).
--    prod 반영은 operator 가 `migrate deploy` 로 별도 수행하며, 그건 DDL 이므로
--    호영님 명시 승인 사안이다(CLAUDE.md 절대 원칙 · 예외 없음).

DROP TABLE IF EXISTS "GovernanceAuditLog";
