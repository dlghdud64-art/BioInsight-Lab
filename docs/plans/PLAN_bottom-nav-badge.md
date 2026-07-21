# Implementation Plan: 하단 내비 재고 탭 뱃지 (2a-6, F8 후속)

- **Status:** 🚧 P2·P3 Complete (2026-07-21 · 코드 `56b7fa32`) — P4 실기기 스모크만 잔여
- **Started:** 2026-07-21
- **Last Updated:** 2026-07-21
- **Estimated Completion:** TBD

⛔ quality gate skip 금지 · 미해소 충돌 진행 금지 · dead button/no-op/placeholder 금지
⛔ 검증 = 하네스 원문 실행(F9) · `.tsx`/`.ts` 프로덕션 변경 시 커밋 전 `npm run build`(F10)
⛔ **F8 금지 경로 재확인**: ops-store seed 경유(가짜 카운트) ❌ · BottomNav 직접 heavy fetch ❌ · 파생 규칙 중복 구현 ❌

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- `HANDOFF_2026-07-20-dashboard-mobile.md` §3-1 (F8=(a) defer 확정 + 금지 경로 + 브레이크포인트 이슈)
- repo 실측(2026-07-21): 뱃지 truth = `dashboard/stats` route **L581 `reorderNeededCount`** 파생 →
  `lowStockAlerts`. 해당 route 790줄 heavy. **경량 카운트 endpoint 부재.** shell react-query 사용 0.
  `dashboard-stats` queryKey 4곳 사용(타 라우트에선 dedup 안 됨 = heavy 호출 발생).

**Chosen Architecture — (A) 경량 count 신설 + 파생 규칙 단일화:**
1. `reorderNeededCount` 파생 블록 → 서버 lib 함수 추출(`lib/inventory/alert-count.ts` 가칭).
   **stats route 가 동일 함수 재사용** — 규칙 이원화 0, stats 로직 무변경(블록 추출만)
2. 신규 `GET /api/inventory/alert-count` — 인증·조직 스코프 동일, count 쿼리만(overfetch 0)
3. shell 레벨 클라 훅(`useInventoryAlertCount` 가칭, react-query) → `BottomNav` 재고 탭 뱃지

**확정 판정(호영님 이견 시만 변경):**
- 768~1024 뱃지 노출 = **수용** (내비 레벨 정보 — 태블릿 노출은 버그 아님)
- 신선도 = `staleTime` 60s + 재고 mutation invalidation. 대시보드 KPI 와 순간 불일치 가능성 문서화

**Environment Reality Check:**
- [x] main `f514255d` · baseline **130 file fail**(직전 housekeeping 반영)
- [x] F6(vitest sandbox 불가)·F9(원문 실행)·F10(build 필수) 승계

---

## 1. Priority Fit
- [x] Post-release — backlog #1 (F8=(a) 호영님 확정분 소화)

## 2. Work Type
- [x] Feature · Workflow Wiring · Mobile · Web (API+lib+UI 멀티 레이어)

## 3. Overview

**Success Criteria:**
- [ ] 재고 탭 뱃지 = **canonical 파생 실값** (stats 와 동일 규칙·동일 함수)
- [ ] 0건 = 뱃지 미렌더 (정직 — 가짜/고정 카운트 0)
- [ ] §11.311-6 스펙: red 뱃지 `min-w-[15px]` · 9.5px bold · 아이콘 우상단
- [ ] BottomNav 상주 라우트 전체에서 heavy stats 호출 0 (신규 count 라우트만)
- [ ] stats route 응답 무변경 (파생 추출 전후 동일 값)
- [ ] baseline-delta 0

**Out of Scope (⚠️):**
- [ ] ops-store / seed-data 접촉
- [ ] BottomNav 타 탭 뱃지 (재고만)
- [ ] stats route 의 다른 파생 리팩토링

## 4. Canonical Truth Boundary
- Source of Truth: DB(inventory) → 서버 파생 함수(단일)
- Derived Projection: `alert-count` 응답 · 뱃지 숫자 · stats `lowStockAlerts`(동일 함수)
- Persistence Path: 없음(읽기 전용). 클라 캐시는 react-query(staleTime 60s) — truth 아님

## 5. Phases

### Phase 0: Truth Lock — 파생 블록 실측 — ✅ Complete (2026-07-21)
- Status: [x] Complete

**핵심 발견 — 파생 추출 불요(아키텍처 단순화):**
`reorderNeededCount = allInventories.filter(isReorderNeeded).length` (stats L510) 이고,
**`isReorderNeeded` 는 이미 `lib/inventory/reorder-need.ts` 공유 lib** (§stock-risk-consolidation P3 가
"인라인 복합 정의 제거 — inventory·recommendations 와 단일"로 통일 완료, stats L509 주석 명시).
→ **규칙은 이미 단일.** Phase 2 는 "stats 에서 추출"이 아니라 **동일 lib 재사용 count 라우트 신설**로 축소:
- `GET /api/inventory/alert-count` — 조직 스코프 inventories 를 **최소 필드 select** 로 조회 후
  `isReorderNeeded` 적용(JS 단일 규칙 유지 — SQL 번역 시 규칙 이원화 위험이라 금지)
- **stats route 무접촉**(회귀 위험 High→0 으로 강등)

**✋ Gate:** [x] 코드 0 [x] 충돌 0 [x] Risk 표의 "stats 파생 추출 회귀(High/High)" → **소멸**

### Phase 1: Contract & RED — ✅ Complete (2026-07-21)
- Status: [x] Complete
- 🆕 `src/__tests__/regression/bottom-nav-badge-p1.test.ts` — count route 계약(공유 `isReorderNeeded`
  재사용·최소 select·SQL 규칙중복 금지) + 뱃지(§11.311-6 스펙·0건 미렌더·canonical 훅·seed/stats 미경유)
  + 회귀 0 블록(4탭·purchasing 게이트·stats lib import). ※ 파생 lib unit 은 불요 — `isReorderNeeded`
  기존 lib 이라 기존 테스트 소관(P0 발견 반영).
- **✋ Gate:** [x] RED 실증 — route 부재 + NAV 신규 4어서션 전건 실패, 회귀 블록 4/4 통과(원문·수동 병행)
- **다음(P2·P3, 미착수):** count 라우트 신설(레포 인증 패턴 — vendor-requests 의 `enforceAction`/스코프
  패턴 참조 필요) → `useInventoryAlertCount` 훅 + 뱃지. **컨텍스트 관리상 새 배치 착수 권장 지점.**

### Phase 2: 서버 — 파생 추출 + count 라우트 — ✅ Complete (2026-07-21)
- Status: [x] Complete
- lib 추출(로직 무변경) → stats route 가 재사용 → 신규 `/api/inventory/alert-count`
- 실구현 축소: stats 무접촉 + 공유 `isReorderNeeded` 재사용 count 라우트 신설(select 4필드·take:500 stats 정합).
- **✋ Gate:** [x] P1 하네스 10/10 · [x] build EXIT 0 · [x] baseline-delta 0 · [x] canonical `isReorderNeeded` 경유(SQL 번역 0)·overfetch 0
- **Rollback:** lib+route revert, stats 원복

### Phase 3: UI — 훅 + 뱃지 — ✅ Complete (2026-07-21)
- Status: [x] Complete
- `useInventoryAlertCount`(staleTime 60s) + BottomNav 재고 탭 뱃지(0건 미렌더) + invalidation 배선
- invalidation = `["inventories"]` prefix 편승(계획 대비 0-diff 단순화) — 기존 재고 mutation 9곳이 추가 배선 0으로 뱃지까지 자동 invalidate.
- **✋ Gate:** [x] dead render 0(4상태 렌더 가드 소스 실증) · [x] §11.311-6 스펙 · [x] 로딩/에러 시 뱃지 생략(`count != null && count > 0`·가짜 0 노출 금지)
- **Rollback:** BottomNav+훅 revert (서버 유지 무해)
- 배포: 코드 `56b7fa32` (3파일). push 대기(별도 승인).

### Phase 4: 스모크 · 롤아웃
- Status: [ ] Pending
- 경고 1+건/0건/로딩/에러 4상태 · 375px·768~1024 확인 경로 문서화 → operator 게이트
- **잔여:** 라이브 375px·768~1024 스모크(경고 1+건 계정) — **호영님 실기기**(로그인 자격증명·시드 데이터 필요, operator 브라우저 불가). dead-render 핵심 4상태는 Phase 3에서 소스 실증 완료.
- **✋ Gate:** baseline-delta 0 · 롤백 문서화

## 6. Risks

| Risk | P | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| stats 파생 추출 회귀 (790줄 heavy) | High | High | 블록 추출만·로직 무변경·응답 동일성 검증·기존 sentinel 가드 |
| 뱃지-KPI 순간 불일치 | Med | Low | staleTime 60s + mutation invalidation·문서화 |
| BottomNav 상주로 인한 호출 빈도 | Low | Med | count 쿼리 1개·staleTime·refetchOnWindowFocus off 검토 |

## 7. Notes
- [2026-07-21] 계획서 생성 승인(호영님). F8 금지 경로 3종 헤더에 명문화.
