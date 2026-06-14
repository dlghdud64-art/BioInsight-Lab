# Implementation Plan: 모바일 surface 통일 — 헤더·상태요약 단일화 (§11.374)

- **Status:** 🔄 In Progress
- **Started:** 2026-06-14
- **Last Updated:** 2026-06-14

**CRITICAL INSTRUCTIONS**: 각 phase 후 — 체크박스 갱신 / quality gate 검증 / Last Updated / Notes / 그다음 phase.
⛔ quality gate 실패·SoT 충돌·dead button/no-op 도입 금지. ⛔ count 데이터 경로 변경 금지(표현만 통일).

---

## 0. Truth Reconciliation  ✅ (P0 완료)

**조사 결과 (코드 근거):**
- `components/layout/page-header.tsx` — `AppPageHeader`(props: `breadcrumbs?`/`title`/`description?`/`statusChip?`/`actions?`) + `PageShell` 정의. **importers 0.** git: 2026-04-18 생성, 이후 amber sweep(05-28)만 → *폐기 흔적 없음, 단지 미채택*.
- `components/ops-hub/page-shell.tsx` — **별도 PageShell, importers 0.** 경쟁 orphan.
- 4탭(대시보드/견적/구매/재고) 전부 헤더를 **인라인 재구현**(공용 shell 미사용). 견적/구매는 operational-brief 컴포넌트 인라인 조합.
- 상태요약: 공유 컴포넌트 **없음**. 견적/구매=가로 카운트탭, 재고=2x2 카드, 대시보드=액션카드. count는 각 페이지 자체 query에서 산출.

**Chosen Source of Truth:**
- **캐노니컬 헤더 = `AppPageHeader`(layout/page-header.tsx) 부활·채택.** API가 목표 문법과 정확히 일치.
- ops-hub/page-shell = orphan → 본 트랙 out-of-scope(향후 제거 핀).
- 상태요약 = **신규 단일 컴포넌트 `StatusCountGrid`(2x2, §11.311 토큰)** 추출. count는 surface별 props 주입 — truth 경로 불변.

**Priority Fit:** Post-release UX 정합(P2). 직전 §mobile-surface 트랙 연장.

## 1. Work Type
Design Consistency + Mobile + **multi-surface 구조 변경**.

## 2. Overview
**목표:** 4 대시보드 탭의 헤더·상태요약을 단일 컴포넌트로 정합. 4축 drift(헤더구조/상태요약/타입스케일/필터칩) 제거.

**Success Criteria:**
- [ ] 4탭이 `AppPageHeader` 채택 — breadcrumb?/title/subtitle?/actions(우측 고정). 견적 좌측 스캔 drift 제거.
- [ ] 상태요약 4탭 `StatusCountGrid`(2x2) 통일 — 표현만, count 소스 불변.
- [ ] 타입 스케일·필터 칩 토큰 통일.
- [ ] sentinel GREEN, canonical count 무변경, 인라인 헤더 재구현 0.

**Out of Scope (⚠️ 절대):** count 집계/데이터 로직 변경, 비-대시보드 surface, ops-hub PageShell 손대기, 신규 shell 제작(AppPageHeader 부활로 충당).

**User-Facing Outcome:** 4탭 헤더·상태요약이 동일 문법·동일 시각언어. 모바일 가로5탭 빽빽 해소(2x2).

## 3. Product Constraints
**Must Preserve:** workbench/queue/rail/dock, same-canvas, **탭별 canonical count 소스**, 각 탭 고유 액션 wiring.
**Must Not Introduce:** page-per-feature, dead button, count를 UI state로 대체, 표현 통일하며 데이터 누락.
**Canonical Truth Boundary:** SoT = 각 탭 자체 query(count). 본 트랙 = presentation layer만. 신규 컴포넌트는 props로 count 수신, 자체 fetch 금지.

## 4. Architecture & Dependencies
| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| `AppPageHeader` 부활·채택(신규 제작 X) | 목표 API 이미 보유, 최소 diff | orphan 부활 — 첫 채택 surface에서 회귀 점검 필요 |
| `StatusCountGrid` 신규 추출(2x2) | 공유 컴포넌트 부재, §11.311 토큰 | 4탭 count 형태 정규화 필요(label/value/tone/href) |
| surface별 1개씩 점진 rollout | 광역 blast 제어 | phase 수 증가 |

**Touched(예상):** `layout/page-header.tsx`(AppPageHeader 보강 시), 신규 `StatusCountGrid`, 4 route(`dashboard`/`quotes`/`purchase-orders`/`inventory`).

## 5. Global Test Strategy
Sentinel(readFileSync+regex): 헤더 단일문법 채택·StatusCountGrid 계약·인라인 재구현 금지·count prop 주입(자체 fetch 0). 실 vitest는 operator-shell.

## 6. Implementation Phases
### Phase 0: Truth/Inventory Lock — ✅ Complete
캐노니컬 shell 확정(AppPageHeader), 4탭 현행·count 소스 매핑. 위 §0 기록.

### Phase 1: Contract & Sentinel — ✅ Complete
- `status-count-grid-374.test.ts` 작성. StatusCountGrid 계약(items[{key,label,count,tone,active,disabled,onClick}]) + 견적 채택 + 회귀 가드. 격리 node 17/17 GREEN.

### Phase 2: StatusCountGrid 추출 + 견적 적용 — ✅ Complete
- `components/layout/status-count-grid.tsx` 신규(2x2, §11.311 토큰, interactive 게이팅, a11y).
- 견적 `sm:hidden` 가로5탭 → StatusCountGrid 교체. canonical `summaryStats.*.count` 주입(데이터 경로 불변), `setStatusFilter` 토글 + 비교(RESPONDED) 0건 가드 + isLoadingTimeout fallback 보존. 데스크탑 5-cell grid 유지.
- Gate: count 무변경 ✓, dead button 0 ✓, sentinel GREEN ✓.

### Phase 3: 헤더 AppPageHeader 채택 + 상태요약 rollout(전 탭)
- Status: [ ] Pending
- 🟢 4탭 `AppPageHeader` 채택(breadcrumb?/title/subtitle?/actions 우측). 견적 좌측 스캔 drift 제거. StatusCountGrid 전 탭 적용.
- Gate: 4탭 헤더 단일문법, 액션 wiring 보존, 인라인 헤더 0. Rollback: surface별 인라인 복귀.

### Phase 4: 타입 스케일 + 필터 칩 토큰(③④)
- Status: [ ] Pending
- 🟢 제목/부제/카드 숫자 토큰화(임의값 제거), 2차 필터 칩 스타일·위치 통일.
- Gate: 토큰 일관, 위계 정립. Rollback: 토큰 revert.

### Phase 5: Smoke / Rollback
- Status: [ ] Pending
- 375px 4탭 정렬 육안(Chrome) + canonical count 무변경 확인. Rollback: phase별.

## 9. Risk Assessment
| Risk | Prob | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 표현 통일 중 count 누락/오매핑 | Med | High | presentation-only, props 주입, surface별 1개씩, count 무변경 sentinel |
| orphan AppPageHeader 부활 회귀 | Med | Med | 1-surface-first(견적) 후 rollout |
| 4-surface 광역 blast | Med | Med | 점진 rollout, phase별 rollback |

## 10. Rollback Strategy
phase별 surface 인라인 복귀. 컴포넌트/표현 한정 — 데이터 비파괴.

## 11. Progress Tracking
- Overall: 15% (P0 완료)
- Current: P1 진입 대기
- Phase Checklist: [x] P0 · [ ] P1 · [ ] P2 · [ ] P3 · [ ] P4 · [ ] P5

## 12. Notes & Learnings
- [2026-06-14] P0: 캐노니컬 shell 후보 2개(AppPageHeader / ops-hub PageShell) **둘 다 0 importer** — 헤더 drift의 코드 근원. AppPageHeader가 목표 API 보유 → 부활 채택, ops-hub는 제거 핀(별 트랙).
- [2026-06-14] §11.372/373 직후 동일 §mobile-surface 트랙 연장(페이지별 surface 재구현이라는 한 근본).
