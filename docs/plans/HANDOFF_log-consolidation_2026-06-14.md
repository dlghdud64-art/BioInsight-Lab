# 세션 인계 — §log-consolidation 트랙 (2026-06-14)

대상: 새 세션 / 클로드코드. 호영님(CEO) 위임 구조. terse-mode.
재개점: `origin/main 0f37176b` (clean, P2 push 완료). 누적 push 35 commit.
재개 명령: **"§log-consolidation P3 가자"**

> 진척: P0 ✅ · P1 ✅(sentinel `4e3ee0d4`) · P2 ✅(단일 surface `0f37176b`,
> build EXIT 0 / vitest 17/17 / 규제 3중 보존). 다음 = P3.

---

## 1. 통제 구조 (재확인)

- 호영님은 코드/DB/터미널 직접 접근 안 함 — 전부 Claude 위임.
- sandbox = 격리 node 검증·코드 작성만. 실 vitest·`npm run build`·push·prod는 operator-shell/호영님.
- §9.9: sandbox 공유 node_modules 설치 금지, prod 명령 금지, `migrate diff --shadow=prod` 금지.
- sentinel = readFileSync+regex. 구조변경·multi-surface = feature-planner 승인 후 코딩.

## 2. 다음 작업 = §log-consolidation P3 (메뉴 1항목 + 구 route redirect)

계획서: `docs/plans/PLAN_log-consolidation.md` (P0·P1·P2 ✅, 65%).

### P0~P2 확정 사실 (재조사 불요)

- 활동 로그 = 실 `ActivityLog` (`/api/activity-logs`). 감사 = 실 `AuditLog` (`/api/audit-logs`, admin-gate + Part11 + PDF/CSV export).
- 통합 host = canonical `dashboard/audit/page.tsx` (단일 route + 모드토글). 모델 병합 없음(각 모드 자기 모델).
- 활동 라벨 단일 소스 = `src/lib/activity/activity-labels.ts` (P2 신규).
- 권한 3중 보존: 감사 query `enabled: canAccessAudit && mode==="audit"` / 감사 탭 `canAccessAudit &&` 게이트 / 비admin 감사모드 진입 시 `setMode("activity")` 강등.
- sentinel = `__tests__/regression/log-consolidation-p1.test.ts` (계약 5 GREEN + GUARD).

### P3 산출물

1. `_components/dashboard-sidebar.tsx` adminMenuItems(152-153): "활동 로그"+"감사 추적" 2항목 → **1항목**(통합 진입). dead link 0.
2. 구 route `/dashboard/activity-logs` → 통합 route(`/dashboard/audit`) **redirect** (비admin 도 활동 모드 진입 가능하므로 redirect 안전).
3. sentinel 보강: sidebar 1항목 + redirect 가드. → 격리 node 확인 → operator 실 vitest + build + push.
   ⚠️ activity-logs/page.tsx 의 GUARD(`/api/activity-logs`·org멤버 enabled·ACTIVITY_TYPE_LABELS)는 redirect 전환 시 위치 이동 가능 — sentinel 경로 동기화 필요.

### P4 (P3 후)

- P4 모바일 §mobile-surface(헤더 우측액션·컴팩트·drill-in) + 375px smoke(감사 export 동작).

### 잔여 smoke (P2 미완)

- 비admin 계정 `/dashboard/audit` UI 실측(활동 모드만/감사 탭 비노출) — 호영님 OAuth 계정 필요(현재 demo 계정만). 코드레벨 3중 보존은 build+sentinel 로 확정.

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
