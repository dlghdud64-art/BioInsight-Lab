# Implementation Plan: 입고 목록 웹 리디자인 v2 (문서 확보 모달 + 목록 정합)

- **Status:** 🔄 In Progress
- **Started:** 2026-07-08
- **Last Updated:** 2026-07-08
- **Estimated Completion:** 2026-07-XX

**CRITICAL INSTRUCTIONS** — 각 phase 완료 후: 체크박스 갱신 → 게이트(빌드+sentinel, 클로드코드) → Last Updated 갱신 → Notes 기록 → 다음 phase.
⛔ 게이트 실패/미검증 상태로 다음 phase 금지. ⛔ dead button / no-op / placeholder success 금지. ⛔ canonical/GMP 모델 다운그레이드 금지.

---

## 0. Truth Reconciliation

**Latest Truth Source:** `입고 목록 웹 리디자인 v2.html`(시안) + `입고 퍼널 현재집중 규칙.md`(focus 규칙, `8ba864d8`로 이미 배포).

**Secondary References:** 현재 라이브 컴포넌트(`receiving-desktop-list.tsx`, `receiving-doc-attach-modal.tsx`, `receiving/[receivingId]/page.tsx`).

**Conflicts Found:**
- v2 문서 확보 모달 = 문서타입별(COA·거래명세서·MSDS) 간소 mock. 라이브 = **라인/lot별** CoA·MSDS(GMP 정확). → 목업 채택 시 per-lot granularity 손실.
- `inbound-quarantine-temp-exclude-p3-ui` sentinel이 `onAttach(line.id, type)` 요구 ↔ §action-toast(aa2e08ab)가 `handleAttach` 경유로 변경 → 이미 어긋남.

**Chosen Source of Truth:** v2 = **비주얼/폼팩터 시안**. 데이터/문서 모델은 라이브 per-lot canonical 유지(GMP 우선). 시안의 per-doc-type 간소화는 채택하지 않음.

**Environment Reality Check:**
- [x] repo/branch: main, origin/main = `8ba864d8`
- [x] 게이트 커맨드: `cd apps/web && npx vitest run <files>` + `npm run build` — **클로드코드 전용**(sandbox 금지)
- [x] 실행 blocker: sandbox commit/push/패키지설치 금지

## 1. Priority Fit
- [ ] P1 immediate  [ ] Release blocker  [x] Post-release  [ ] P2
- 근거: focus 버그(P1급)는 이미 해소. 본 트랙은 디자인 정합 폴리시. release blocker 아님.

## 2. Work Type
- [x] Design Consistency  [x] Web  [x] Workflow(문서 확보 same-canvas)

## 3. Overview
**Feature:** 입고 목록 화면 + 문서 확보 모달을 v2 시안 비주얼로 정합. per-lot 문서 canonical·실 wiring 보존.

**Success Criteria:**
- [ ] 문서 확보 모달 = v2 폼팩터(센터 Dialog·드롭존 시각·통합/문서별 탭·pill), per-lot 모델·실 attach·정직-disabled 업로드 보존
- [ ] 목록 카드 = v2(입고일+담당 2컬럼·meta·간격), 입고일=updatedAt 정직 표기
- [ ] 툴바 필터(공급사·상태) 실 클라이언트 필터(dead 아님)
- [ ] 헤더 라벨 스캔 = 기존 스캐너 연결

**Out of Scope (⚠️ 구현 금지):**
- [ ] 입고 등록 버튼/모달 — ops-store에 create 액션 부재 → **미노출**(disabled/"준비 중"도 금지). 조건부: `createReceiving` 추가 시 노출.
- [ ] per-doc-type 간소화(GMP 다운그레이드)
- [ ] 데모 시나리오 칩(데모 전용)

**User-Facing Outcome:** 입고 목록·문서 확보가 v2 라이트 디자인으로 통일, 기능(첨부→게이트 해제)은 동일.

## 4. Product Constraints
**Must Preserve:** [x] same-canvas [x] canonical truth(per-lot 문서) [x] 퍼널 focus 규칙
**Must Not Introduce:** [x] dead button(입고 등록) [x] placeholder success(업로드) [x] page-per-feature [x] GMP 모델 다운그레이드
**Canonical Truth Boundary:**
- Source of Truth: ops-store `unifiedInboxItems` / lot 문서 상태(`attachReceivingDocument`)
- Derived: `buildReceivingFunnel/TabCounts`, `resolveReceivingRowVisual/FocusIndex`
- Persistence: `attachReceivingDocument`(게이트 전이). 파일 실업로드는 DB-backed 트랙(별건)
**UI Surface:** [x] 목록 same-route [x] 센터 Dialog(문서 확보) — 신규 페이지 없음

## 5. Architecture & Dependencies
| Decision | Rationale | Trade-off |
|---|---|---|
| 문서 확보 Sheet→반응형 Dialog | v2 데스크탑 센터 모달 | 모바일 폼팩터 재확인 필요 |
| per-lot 모델 유지 | GMP 성적서 granularity | v2 mock과 구조 차이 |
| 입고 등록 미노출 | store create 부재, dead 방지 | v2 대비 버튼 1개 부재(문서화) |

**Touched:** `receiving-doc-attach-modal.tsx`, `receiving-desktop-list.tsx`, `receiving/[receivingId]/page.tsx`(모달 마운트), sentinel 다수.

## 6. Global Test Strategy
- 컴포넌트 sentinel(readFileSync+regex) — 기존 패턴. wiring/토큰/회귀 0 강제.
- 게이트 실행: 클로드코드(sandbox 실행 불가 → "실행 불가" 표기).

## 7. Implementation Phases

### Phase 1: 문서 확보 모달 v2 폼팩터
- Status: [ ] Pending
- 🔴 sentinel: 센터 Dialog·드롭존(정직-disabled)·통합/문서별 탭·pill + **회귀 0**(handleAttach 경유·labToast·remaining===1·per-lot). stale `inbound-quarantine` assertion(onAttach→handleAttach) 정합.
- 🟢 Sheet→반응형 Dialog 전환, v2 비주얼, per-lot·실 attach·정직-disabled 보존.
- ✋ Gate: 빌드 EXIT 0 + doc-attach 관련 sentinel GREEN. dead/fake 0.
- Rollback: 모달 파일 revert.

### Phase 2: 목록 카드 v2
- Status: [ ] Pending
- 🔴 sentinel: 입고일+담당 2컬럼·meta·토큰. focus 회귀 0.
- 🟢 카드 레이아웃 v2, 입고일=updatedAt 정직 라벨.
- ✋ Gate: 빌드 + desktop-list/focus sentinel GREEN.

### Phase 3: 툴바 필터(공급사·상태)
- Status: [ ] Pending
- 🔴 sentinel: 필터 state·실 필터링(dead 아님).
- 🟢 클라이언트 필터 state 추가(공급사·상태), 결과 0건 empty state.
- ✋ Gate: 빌드 + sentinel. no-op 0.

### Phase 4: 헤더 라벨 스캔 연결 (입고 등록 미노출)
- Status: [ ] Pending
- 🔴 sentinel: 라벨 스캔 = 기존 스캐너 연결. 입고 등록 버튼 부재 단언.
- 🟢 라벨 스캔 버튼 wiring. 입고 등록 미노출 + 조건부 노출 주석.
- ✋ Gate: 빌드 + sentinel. dead 0.

### Phase 5: Smoke / Rollback
- Status: [ ] Pending
- 전체 sentinel + 빌드, 육안 smoke(문서 확보·목록·필터), rollback 확인.

## 9. Risk Assessment
| Risk | Prob | Impact | Mitigation |
|---|---|---|---|
| GMP 모델 다운그레이드 | Med | High | per-lot 유지, 시안은 비주얼만 |
| stale sentinel 충돌 | High | Med | P1에서 동반 정합 |
| Sheet→Dialog 모바일 영향 | Med | Med | 반응형 분기 유지 |
| 입고일=updatedAt 의미 오인 | Med | Low | 라벨 정직("최근 갱신"/"입고일" 결정) |

## 10. Rollback
- P1~P4 각 phase 단독 revert(파일 단위). 커밋 분리.

## 11. Progress Tracking
- Overall: 0% · Current: P1 · Blocker: 없음 · Next: P1 sentinel 작성

**Phase Checklist:** [ ] P1 [ ] P2 [ ] P3 [ ] P4 [ ] P5

## 12. Notes & Learnings
- [2026-07-08] 입고 등록: ops-store create 액션 부재(호영님 확인) → 미노출 확정. `createReceiving` 추가 시 조건부 노출.
- [2026-07-08] v2 문서 확보는 per-doc-type mock이나 라이브 per-lot 유지(GMP).
