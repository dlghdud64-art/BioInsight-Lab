# Implementation Plan: 설정탭 카드 compact 토큰 sweep (§11.373)

- **Status:** ✅ Complete
- **Started:** 2026-06-14
- **Last Updated:** 2026-06-14
- **Estimated Completion:** 2026-06-14

**CRITICAL INSTRUCTIONS**: 각 phase 완료 후 — ① 체크박스 갱신 ② quality gate 검증 ③ 통과 확인 ④ Last Updated 갱신 ⑤ Notes 기록 ⑥ 그다음 phase.

⛔ quality gate 실패 / SoT 충돌 / dead button·no-op·placeholder success 도입 금지.

---

## 0. Truth Reconciliation

**Latest Truth Source:** §11.311 (호영님 P1, 2026-05-26) 모바일 공통 원칙 — 카드 `p-3 md:p-4`, 단일 필드 full-box 금지·compact row, 0건 비활성 톤. CLAUDE.md 박제.

**Secondary References:** §11.372(직전 batch — 알림/더보기/설정 drill-in), CEO 스크린샷(Image 4/5 워크스페이스 명칭·코드·통화 full-box 세로 적층).

**Conflicts Found:** 없음. §11.372 drill-in(레이아웃 토글)과 직교 — 본 작업은 카드 **내부 토큰**만.

**Chosen Source of Truth:** §11.311 토큰.

**Environment Reality Check:**
- [x] repo/branch: main, mount 정상
- [x] 대상 단정(확인됨): `SectionCard`(page.tsx:1469, 설정 **로컬**, 13곳), workspace 식별 grid(889), `FieldBlock`(1497)
- [x] 실행 블로커: sandbox vitest = 공유 node_modules linux 바이너리 부재(§9.9) → 격리 node 검증, 실 vitest는 operator-shell/pre-push

## 1. Priority Fit
- [ ] P1 immediate
- [ ] Release blocker
- [x] Post-release (밀도 개선, 버그 아님)
- [ ] P2 / Deferred

§11.372로 세로 적층 자체는 해소됨. 본 작업은 잔여 세로폭 압축. CEO 권장·승인으로 착수.

## 2. Work Type
- [x] Design Consistency
- [x] Mobile (단일 surface = 설정)

## 3. Overview
**Description:** 설정 13개 SectionCard 및 workspace 식별 필드를 §11.311 compact 토큰으로 정리. 단일 필드 full-box 적층 제거.

**Success Criteria:**
- [x] SectionCard 모바일 패딩 compact(`p-3`), md+ 밀도 유지(`md:p-5`)
- [x] workspace 명칭/코드/통화 모바일 compact row(full-box 제거), md+ 카드 grid 유지
- [x] sentinel GREEN 전수 통과 + 회귀 0

**Out of Scope (⚠️ 절대 금지):**
- [ ] drill-in(§11.372) 재변경
- [ ] 비-설정 surface
- [ ] SectionCard를 공용 컴포넌트로 승격
- [ ] billing 카드 구조 변경(이미 `p-6 md:p-7` 반응형)

**User-Facing Outcome:** 모바일 설정 first-fold 내 카드 수 증가, 끝없는 세로 스크롤 감소. 데스크톱 무변화.

## 4. Product Constraints
**Must Preserve:** same-canvas, canonical truth(workspace fetch §11.159/164), md+ 업무 밀도.
**Must Not Introduce:** page-per-feature, dead button/no-op, preview가 truth 덮기.
**Canonical Truth Boundary:** SoT = `/api/workspaces`(pickActiveWorkspace). 본 작업은 표시 토큰만 — 데이터 경로 무변경.
**UI Surface Plan:** [x] Existing route section(설정), [x] Settings panel. 신규 페이지 0.

## 5. Architecture & Dependencies
| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| SectionCard primitive 1곳 토큰 수정 | 13카드 일괄·최소 diff | 공유 primitive라 회귀 blast(완화: 설정 로컬 + sentinel) |
| workspace 모바일 compact row / md+ 카드 dual | §11.311 full-box 금지 + md 밀도 유지 | className 분기 증가 |

**Touched:** `apps/web/src/app/dashboard/settings/page.tsx` (SectionCard 1479, FieldBlock 1497, workspace grid 889).

## 6. Global Test Strategy
Sentinel(readFileSync+regex) — Design Consistency 토큰 검증. 실 vitest 불가 시 "실행 불가" 표기 + 격리 node 대체 검증.

## 7. Implementation Phases

### Phase 0: Context & Truth Lock
- Status: [x] Complete
- Gate: SoT=§11.311 확정, 대상 인벤토리 확정, 충돌 0. ✅

### Phase 1: Compact Sentinel (RED)
- Status: [x] Complete (RED 7/7 격리 node 확인)
- 🔴 sentinel 작성: SectionCard `p-3 md:`, workspace `md:grid-cols-3` + 모바일 비-full-box, fallback 카피. 현재 코드 대비 RED.
- Gate: RED 실재 확인(격리 node), 기존 §11.372 sentinel 무영향.
- Rollback: sentinel 파일 삭제.

### Phase 2: Primitive Compact (GREEN)
- Status: [x] Complete (SectionCard header/body 토큰)
- 🟢 SectionCard header `px-5 py-4`→`px-4 py-3 md:px-5 md:py-4`, body `p-5`→`p-3 md:p-5`.
- Gate: 13카드 반영, md+ 밀도 유지, JSX 안정(§11.303).
- Rollback: primitive 토큰 revert.

### Phase 3: Workspace Compact Row + Copy + Smoke
- Status: [x] Complete (compact row + 카피 + sentinel GREEN)
- 🟢 workspace 3필드 모바일 compact row(label·value 인라인, meta `hidden md:block`)/md+ 카드 grid. `"데이터 미동기화"`→`"워크스페이스 미연결"`.
- Gate: sentinel 전수 GREEN, full-box 제거 확인, 375px first-fold smoke(육안/구조).
- Rollback: workspace 블록 revert.

## 9. Risk Assessment
| Risk | Prob | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| SectionCard 공유 → 13카드 회귀 | Med | Med | 설정 로컬 한정 + P1 sentinel + md 밀도 가드 |
| md+ 밀도 저하 | Low | Med | `md:p-5`/`md:grid-cols-3` 유지 가드 |

## 10. Rollback Strategy
- P1 실패: sentinel 삭제. P2 실패: primitive 토큰 revert. P3 실패: workspace 블록 revert. 모두 토큰/표시 한정 비파괴.

## 11. Progress Tracking
- Overall: 100%
- Current phase: 완료
- Blocker: 없음
- Next: operator-shell `cd apps/web && npm run test` (실 vitest) + push

**Phase Checklist:**
- [x] Phase 0
- [x] Phase 1
- [x] Phase 2
- [x] Phase 3

## 12. Notes & Learnings
- [2026-06-14] §11.372 직후 분리 batch. SectionCard 설정 로컬 확인 → blast radius 설정 한정.
- [2026-06-14] sentinel `not.toMatch("데이터 미동기화")` 가 동작-설명 주석(863)까지 잡아 1차 FAIL → 주석도 현행 카피로 정합. 렌더 카피는 1차에 이미 교체됨.
- [2026-06-14] 검증: §11.373 sentinel 7/7 GREEN + §11.372 회귀 6/6 PASS (격리 node). 실 vitest 는 §9.9(공유 node_modules) 로 sandbox 불가 → operator-shell.
