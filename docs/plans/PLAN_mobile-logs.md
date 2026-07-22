# Implementation Plan: 모바일 활동 로그 · 전역 드롭다운 개선 (§mobile-logs)

- **Status:** 🚧 In Progress (P0~P2 ✅ / P3~P5 Pending)
- **Started:** 2026-07-21
- **Last Updated:** 2026-07-22
- **Estimated Completion:** TBD

⛔ quality gate skip 금지 · 미해소 충돌 진행 금지 · dead button/no-op/placeholder 금지
⛔ 검증 = 하네스 원문 실행(F9) · `.tsx`/`.ts` 프로덕션 변경 시 커밋 전 `npm run build`(F10)
⛔ **원칙(핸드오프):** 기본 탭 하드코딩 금지 · 눌리지 않는 행 금지(행=딥링크) · 회색 채색 드롭다운 패널 금지 · 8개+/멀티 = 바텀 시트

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- 호영님 핸드오프 `모바일 활동 로그 핸드오프.md` (2026-07-21) — §0 진단 4 · §1 라우팅/메뉴 · §2 필터/시트/리스트 · §3 전역 드롭다운 토큰 · §4 QA 10항
- 프로토타입 `모바일 활동 로그 지시문.html` (1a·1b·1c·2a~2c)

**repo 실측 (2026-07-21, 1차):**
- **라우트 drift:** 핸드오프 `/logs` → 실제 **`/dashboard/audit`** = §log-consolidation 통합 host(1,196줄,
  활동/감사 모드 토글). `/dashboard/activity-logs` 는 전면 redirect stub(10줄)
- **진단 ① 근본 원인 확정:** audit L367 초기 모드 = "admin 은 감사, 그 외 활동" **하드코딩** + more-sheet
  "활동 로그" 가 redirect 경유 → admin 은 항상 감사 진입. 수정 = `?tab=` 파라미터 반영(하드코딩 제거)
- **진단 ② 실증:** more-sheet L82-83 활동/감사 2항목 병렬 노출
- **진단 ④ 실증:** `components/ui/select.tsx` trigger(L29)·content(L85) `bg-el` 회색 채색 —
  dropdown-menu/popover 는 bg-popover 흰색 정상 → **select 만 교정 = 최소 diff, 전 화면 파급(데스크톱 포함,
  핸드오프 "전역" 명시)**
- 기존 sentinel: `log-consolidation-p1.test.ts` (활동 보존 가드 통합 host 이동) — 회귀 경계
- 비admin 감사 접근 강등 메커니즘 실재(L376~) — 탭 노출 게이팅만 추가하면 정합

**Chosen Source of Truth:** 핸드오프 + 프로토타입. 라우팅은 통합 host 유지(§log-consolidation 존중 —
새 페이지 0), 탭 파라미터로 정합. <768px 경계 · 단 §3 드롭다운 토큰은 전역(데스크톱 포함, 핸드오프 명시).

**Environment Reality Check:**
- [x] main `5508035d` · baseline 130 file fail · F6/F9/F10 승계

## 1. Priority Fit
- [x] Post-release backlog #1 승계. **단 진단 ① = 실사용 라우팅 버그 — 트랙 내 최우선(P2 선행)**

## 2. Work Type
- [x] Feature · Bugfix(라우팅) · Mobile · Web · Design Consistency(전역 드롭다운)

## 3. Overview

**Success Criteria (핸드오프 §4 QA 10항 = 인수 기준):**
- [ ] 더보기 "활동 로그" → 활동 탭 진입(감사 진입 버그 해소) · 메뉴 하이라이트 = 실제 경로
- [ ] 더보기 = 활동 로그 1항목(`?tab=activity`) · 감사 추적 = 페이지 내 탭, 관리자만 노출
- [ ] 기본 탭 하드코딩 0 — `?tab=` 파라미터 그대로 반영
- [ ] 필터 한 줄(도메인 칩+구분선+기간·7일▾+담당자▾+⚙세부) 가로 스크롤+페이드 · 라벨 없는 "전체" 0
- [ ] 세부 시트 = 선택 도메인 타입만 · 칩 멀티 선택 + `필터 적용 · N개` · 활성 칩 ✕ 해제 + 배지
- [ ] 리스트 날짜 그룹(오늘/어제/날짜) + 도메인 이니셜 칩 + 행 탭 딥링크(눌리지 않는 행 0)
- [ ] 전역 select: 흰 패널+그림자(0 12px 32px rgba(15,23,42,.14))+44px 항목+선택 ✓(`#eff6ff`/`#1d4ed8`) · 회색 채색 패널 0
- [ ] 단일선택 ≤7 = 드롭다운(내부 스크롤 0) · 8+/멀티 = 바텀 시트
- [ ] 터치 44px+ · baseline-delta 0 · 데스크톱 로그 화면 회귀 0

**Out of Scope (⚠️):**
- [ ] 로그 데이터 모델/API 변경 · 새 페이지(통합 host 유지)
- [ ] dropdown-menu/popover 컴포넌트 변경(이미 흰 패널 — select 만)
- [ ] 감사 모드 권한 로직 변경(기존 강등 메커니즘 유지, 탭 노출 게이팅만)

## 4. Product Constraints
**Must Preserve:** §log-consolidation 통합 host 구조 · 기존 sentinel(log-consolidation-p1) · 비admin 강등 메커니즘 · 감사 GMP timestamp 표기
**Must Not Introduce:** page-per-feature 회귀(activity-logs 부활 금지) · dead link 딥링크 · 가짜 필터(적용 안 되는 칩)

**Canonical Truth Boundary:**
- Source of Truth: ActivityLog/AuditLog(모델 무접촉) · 현재 탭 = URL `?tab=` (state 아닌 URL)
- Derived Projection: 날짜 그룹 · 도메인 칩 필터 · 활성 필터 칩
- Persistence Path: 없음(읽기 전용)

**UI Surface Plan:** [x] Existing route section + [x] Bottom sheet(세부 필터) — 새 페이지 0

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 탭 = URL 파라미터(`?tab=`) 단일 소스 | 하드코딩 제거·딥링크/하이라이트 정합·버그 근본 해소 | 초기 모드 분기 로직 재작성 |
| 전역 토큰 = select.tsx 만 수정 | 진단 ④ 원인 지점 한정·최소 diff | 전 화면 시각 파급(스모크 범위 확대) |
| 모바일 필터/리스트 = §mobile-reports 패턴(md 분기) | 검증된 패턴 | audit 1,196줄 접촉 |

## 6. Global Test Strategy
- 정적 sentinel + F9 원문 + F10 build + `log-consolidation-p1` GREEN 유지(**현행 21건 기준** —
  P1 정정·P4 진화 판정 참조) + baseline-delta 0

## 7. Implementation Phases

### Phase 0: Context & Truth Lock — ✅ Complete (2026-07-21)
- Status: [x] Complete

**실측 결과 (다음 배치 인수인계용 — 자족 기록):**
- **모드 상태 구조:** `mode`("activity"|"audit") + `modeInitialized` (audit L349-350). 초기화 =
  L367-373 useEffect `setMode(canAccessAudit ? "audit" : "activity")` — **P2 수정 지점**:
  `useSearchParams()` 의 `tab` 파라미터 우선 → 없을 때만 기존 분기. `canAccessAudit` =
  ADMIN 또는 manager(L358) — 감사 탭 노출 게이팅에 그대로 재사용
- 비admin 감사 강등 메커니즘 L378-392(toast+활동 강등) — 무접촉 보존
- **활동 데이터 계약:** `/api/activity-logs` (limit 100, activityType·entityType 파라미터) ·
  ActivityLog { activityType, entityType(QUOTE/ORDER/INVENTORY/AI_ACTION/PRODUCT…), entityId?,
  beforeStatus/afterStatus, metadata, createdAt } · 라벨 맵 = ENTITY_TYPE_LABELS(L185)·
  ACTIVITY_TYPE_LABELS 기존 실재 — 도메인 칩·이니셜 칩 파생에 재사용(신설 0)
- **딥링크 판정(중요):** 개별 상세 라우트 `[id]` 전부 **부재**(quotes·inventory·receiving·purchases·
  purchase-orders X, budget/[id]만 존재) → 행 딥링크 = 라우트 신설 금지, **기존 오버레이 딥링크 규약
  (`hooks/use-overlay-deep-link.ts`) 재사용**으로 방향 확정. 도메인별 실규약(쿼리 키) 매핑은 P2 착수
  첫 작업으로 실측 — 규약 없는 도메인은 목록 라우트+필터 폴백(dead link 0 원칙)
- **sentinel 경계:** `log-consolidation-p1.test.ts` 23 어서션(통합 host·활동 보존 가드) — P2~P4 편집 후
  원문 GREEN 유지 강제. 충돌 발견 시 임의 진화 금지 — 호영님 판정 상신
  - **P1 정정(2026-07-22 실측 — 격리 node + F9 실 vitest 일치):** 현행 **21 GREEN / 2 RED**.
    RED 2건 = P4 KPI describe(`log-activity-kpi-grid` · `isAiActivity`) — 2026-07-04 시안정합
    (호영님, 활동 KPI 3카드 제거, audit L479 주석)로 **stale**(제거된 기능 기대). P0 기록 "23 GREEN"
    은 부정확 → "전건 GREEN 유지" 게이트 = **21건 기준**으로 정정.
  - **판정 상신:** (a) sentinel 진화(부재-lock 전환) = 2026-07-04 승인 결정과 정합 — **권장,
    P4 배치에서 호영님 승인 후 별도 커밋**. (b) KPI 복원 = 승인 결정 회귀 — 비권장.
- select.tsx `bg-el` 2곳(trigger L29·content L85)만 교정 대상 재확인 — 별도 커밋·단독 revert 경로 유지
- **✋ Gate:** [x] 딥링크 방향 확정(오버레이 규약 재사용, 신규 라우트 0) [x] sentinel 경계 식별
  [x] phase 유지(P2 첫 작업 = 오버레이 규약 도메인별 실측)

### Phase 1: Contract & RED — ✅ Complete (2026-07-22)
- Status: [x] Complete — 커밋 `55c6d174` push 완료(origin/main, pre-push build 통과)
- 🆕 `src/__tests__/regression/mobile-logs-p1.test.ts` **30 어서션** — 계약 19(P2 라우팅/메뉴 6 ·
  P3 필터 한 줄+세부 시트 6 · P4 리스트 3 + 전역 select 토큰 4) + 회귀 가드 11(강등 메커니즘 ·
  데이터 계약/라벨 맵 · GMP timestamp · select §11.73 · 더보기 §11.359)
- **✋ Gate:** [x] RED 실증 — F9 실 vitest **19 fail(계약) / 11 pass(가드)** 정확 계수 일치
  [x] 기존 GREEN 유지 — `log-consolidation-p1` 21 pass / 2 fail(P4 KPI stale — §P0 정정·판정 상신 참조)
- **Rollback:** 테스트 revert

### Phase 2: 라우팅 · 메뉴 (1c — 버그픽스 선행) — ✅ Complete (2026-07-22)
- Status: [x] Complete — 커밋 `70e429eb` push 완료(F10 EXIT 0 · pre-commit GREEN)
- 구현(2파일 최소 diff):
  - audit `page.tsx` 초기 모드 useEffect → **`?tab=` 우선**(activity/audit 만 유효 · 비admin 의
    `?tab=audit` 은 활동 폴백 — 기존 강등 메커니즘과 이중 안전) · tab 부재 시 기존 분기
    (`setMode(canAccessAudit ? ...)`) **원문 보존**(폴백) · `force-dynamic` 페이지라 useSearchParams
    Suspense 경계 불요(F10 실측: `/dashboard/audit` = ƒ Dynamic, prerender 에러 0)
  - more-sheet → 활동 로그 **1항목**(`/dashboard/audit?tab=activity`) · 감사 추적 항목 제거 ·
    하이라이트 `split("?")` pathname 정규화는 **startsWith 분기만**(exact 분기 = §11.359-2
    sentinel 잠금 원문 보존) · `adminItems` const/`adminItems.map` 보존(§11.359 sentinel 정합)
- **✋ Gate:** [x] F9 — mobile-logs-p1 **13 fail(P3/P4 계약만)/17 pass** = P2 계약 6 GREEN 전환 ·
  회귀 4파일 delta 0(2 fail = log-consolidation P4 KPI 기왕 stale) [x] F10 EXIT 0
  [ ] 런타임 스모크(더보기 활동 로그 → 활동 탭 진입, admin 포함) — P5 QA 10항에서 확정
- 부수 실측: `audit-page-mobile-311b` "일시 / ID" 1 fail = **P2 이전부터 부재(기존 baseline,
  무접촉)** · 재고 위험(`?filter=low`) 하이라이트가 정규화로 정상 활성화(동종 버그 동시 해소)
- **Rollback:** 라우팅/메뉴 revert(70e429eb 단독)

### Phase 3: 필터 한 줄 + 세부 시트 (1a/1b)
- Status: [ ] Pending
- **✋ Gate:** 라벨 없는 "전체" 0 · 시트 = 선택 도메인 타입만 · 적용/해제 실동작(가짜 필터 0)
- **Rollback:** 필터 섹션 revert

### Phase 4: 리스트 + 전역 select 토큰 (2a~2c)
- Status: [ ] Pending
- 날짜 그룹+이니셜 칩+행 딥링크 · select.tsx bg-el→흰 패널+그림자+44px+선택 ✓
- **✋ Gate:** 딥링크 dead link 0 · 전역 시각 파급 스모크 경로 문서화
- **Rollback:** 리스트 revert / select.tsx 단독 revert 가능(커밋 분리)

### Phase 5: 스모크 · 종결
- Status: [ ] Pending
- 프로덕션 스모크(QA 10항 + 전역 드롭다운 대표 화면 3곳 시각) · 롤백 문서화
- **✋ Gate:** QA 판정표 · baseline-delta 0 · build EXIT 0
- **Rollback:** phase별 커밋 revert(마이그레이션 0)

## 8. Risk Assessment

| Risk | P | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| log-consolidation sentinel 충돌 | Med | High | P0 어서션 경계 실측 → 충돌 시 진화 판정 상신(임의 진화 금지) |
| 전역 select 파급 — 전 화면 시각 회귀 | Med | Med | select.tsx 커밋 분리·대표 화면 스모크·단독 revert 경로 |
| 딥링크 대상 부재(dead link) | Med | High | P0 매핑 전건 실재 확인 · 대상 없는 도메인은 행 비링크 대신 상세 시트 판정 |
| 1,196줄 단일 파일 접촉 | Med | High | md 경계 엄수·기존 테스트 전건 |

## 9. Rollback Strategy
- P2/P3/P4 커밋 분리 revert. select.tsx = 별도 커밋(전역 파급 단독 롤백). 마이그레이션 0.

## 10. Notes & Learnings
- [2026-07-21] 계획서 생성 승인(호영님 "생성"). 라우트 drift(/logs→/dashboard/audit) · 진단 ①②④ 실증 완료.
- [2026-07-22] P0 커밋 `5685c75f` · P1 커밋 `55c6d174` push 완료. F9 계수 정확 일치(19/11 · 21/2).
  log-consolidation-p1 P4 KPI 2건 stale 실측(2026-07-04 KPI 제거 미진화) — (a) 진화 상신,
  P4 배치에서 호영님 승인 후 실행. P2~P4 구현은 새 배치 착수.
- [2026-07-22] P2 커밋 `70e429eb` push 완료(진단 ① 라우팅 버그픽스 배포). F9 계수 일치 —
  P2 계약 6 GREEN 전환, 회귀 delta 0. F10 EXIT 0. 다음 배치 = P3(필터 한 줄 + 세부 시트 1a/1b,
  계약 6어서션 GREEN 목표 — testid: log-filter-row · log-domain-chip- · log-filter-sheet ·
  log-filter-active-chip, CTA "필터 적용 · N개", 시트 h-11).
