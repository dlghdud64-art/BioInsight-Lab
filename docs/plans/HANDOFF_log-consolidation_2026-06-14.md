# 세션 인계 — §log-consolidation 트랙 (2026-06-14)

대상: 새 세션 / 클로드코드. 호영님(CEO) 위임 구조. terse-mode.
재개점: `origin/main eb82e198` (clean). 누적 push 33 commit.
재개 명령: **"§log-consolidation P1 가자"**

---

## 1. 통제 구조 (재확인)

- 호영님은 코드/DB/터미널 직접 접근 안 함 — 전부 Claude 위임.
- sandbox = 격리 node 검증·코드 작성만. 실 vitest·`npm run build`·push·prod는 operator-shell/호영님.
- §9.9: sandbox 공유 node_modules 설치 금지, prod 명령 금지, `migrate diff --shadow=prod` 금지.
- sentinel = readFileSync+regex. 구조변경·multi-surface = feature-planner 승인 후 코딩.

## 2. 다음 작업 = §log-consolidation P1 (계약 + sentinel RED)

계획서: `docs/plans/PLAN_log-consolidation.md` (P0 ✅, 20%).

### P0 확정 사실 (재조사 불요)

- 활동 로그 = 실 `ActivityLog` (`/api/activity-logs`, `db.activityLog.*`). mock 아님(주석 line 45 stale).
- 감사 추적 = 실 `AuditLog` (`/api/audit-logs`, `getAuditLogs`). admin-gate + GMP Part 11 + PDF export(§11.89).
- `DataAuditLog` = orphan(UI 0) → 제외. 안전(`/dashboard/safety`) → 별 도메인, 통합 X.
- 통합 형태 = 단일 route + 모드토글, 각 모드가 자기 모델 읽기(병합·migration 없음).
- 권한 비대칭: 활동=org멤버 / 감사=admin → 모드토글 권한 분기 필수.

### P1 산출물

1. sentinel(RED) — 단일 surface 모드토글 계약 + 회귀 0 가드
   (감사 admin-gate·Part11·PDF export 문자열/핸들러 보존, 활동 ActivityLog 보존, 비admin 감사모드 비노출).
2. 격리 node로 RED 확인 → operator-shell 실 vitest + push.

### P2~P4 (P1 후)

- P2 단일 surface 구현(모드토글+권한분기)
- P3 sidebar 1항목 + 구route redirect
- P4 모바일 §mobile-surface + 375px smoke(감사 export 동작)

### 불변 제약

감사 컴플라이언스 회귀 0(규제) · 권한 분기 누락 0(보안) · 데이터 비파괴(읽기 surface만) · 안전 흡수 금지.

## 3. 잔여 named pin (별 트랙)

1. §11.374 P5 — P4(헤더 우측정렬·StatusCountGrid 컴팩트) 라이브 375px 4탭 재smoke. 배포 READY 확인 후 Chrome 실측(밀도 미세조정 가능).
2. safety empty-state 버그 — `dashboard/safety/page.tsx:295` `isPatchError`→"서버 반영 실패"가 빈 계정 first-load에 오노출 의심. bug-hunter 근본진단.
3. kpi-category-axis — 안전 KPI식 카테고리 축을 타 KPI 확장. §1-2⑤ 정직성(빈데이터 예시분포 금지, 0이면 0).
4. mobile-surface 확장 — 활동로그/감사/안전/조직 페이지에 헤더 우측액션·컴팩트·drill-in.
5. 소싱 demo 보강 — A(seed 견적/주문 demo) vs B(실입력) 미결정.
6. 기존: ops-hub/page-shell 제거, inventory-lot Phase 5(per-lot COA smoke, 입고 데이터 필요), DB shadowDatabaseUrl(§9.7).

## 4. 작업 컨벤션

- commit: `§ + #scope + 한국어 요약`, Co-Authored-By 금지.
- push 후 Vercel READY 확인(projectId `prj_sJ6yIgyW59VrOCbTfFbfwO4aJjim` / team `team_vhvPxHLHwK008hJU5MyTJVra`) → Chrome 375px 실측.
- 한 surface = 한 커밋, 독립 rollback.
