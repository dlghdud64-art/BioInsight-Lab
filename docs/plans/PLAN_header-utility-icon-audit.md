# Implementation Plan: Header Utility Icon Audit

- **Status:** 🔄 Phase 1 complete — Phase 2 pending approval
- **Started:** 2026-04-21
- **Last Updated:** 2026-04-21
- **Estimated Completion:** TBD (scope-reduced, Small)

**CRITICAL INSTRUCTIONS**: After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 Run all relevant quality gate validation commands
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date
5. 📝 Document learnings in Notes section
6. ➡️ Only then proceed to the next phase

⛔ DO NOT skip quality gates or proceed with failing checks
⛔ DO NOT proceed with unresolved source-of-truth conflicts
⛔ DO NOT introduce dead button / no-op / placeholder success
⛔ DO NOT expand into route-level top banner / ontology banner / workflow surface replacement
⛔ DO NOT add new pages or global ontology surfaces
⛔ DO NOT touch safety / inventory / quotes page banners in this plan

> ⚠️ **Scope Lock (2026-04-21, 총괄 지침):**
> 이번 Plan은 **header utility icon 정리**까지만 수행합니다.
> 진행 중 "route-level top banner / ontology banner 컴포넌트 신설"이 필요하다고 판단되면
> **즉시 중단하고 별도 plan으로 재분할**합니다. 이 Plan 안에서 확장 금지.

---

## 0. Truth Reconciliation

### Latest Truth Source
- `apps/web/src/components/dashboard/Header.tsx` (line 274–295) — Compass 아이콘 (OntologyContextLayer "다음 단계" 트리거)
- `apps/web/src/lib/store/ontology-context-layer-store.ts` — `useOntologyContextLayerStore`, `ontologyStore.open(pathname, {})`
- `apps/web/src/components/ontology-context-layer/ontology-context-layer.tsx` — overlay 본체

### Secondary References
- `apps/web/src/lib/ontology/contextual-action/ontology-next-action-resolver.ts`
- 사장님 현장 스크린샷 2장 (조직 관리 / 안전 관리) — 헤더 우상단 정체 불명 아이콘 확인

### Conflicts Found
- Header.tsx line 274 주석: "dead button / no-op CTA 금지 원칙에 따라 nextActionLabel 없으면 숨김"
  → 방어는 **부분만** 걸려 있음. `nextActionLabel`이 있을 때만 렌더하므로 무조건 dead button은 아니나,
  **ontology를 global header launcher로 surface하지 말 것**이라는 상위 LabAxis 원칙을 위반.
- 주석의 하위 원칙(no-op 방어)은 유지하고, **상위 원칙(ontology는 workflow route contextual action)** 을 우선 적용.

### Chosen Source of Truth
- **LabAxis 제품 원칙 우선:** ontology action은 route 내에서만 surface한다.
  header에는 `search / notification bell / help / user menu` 4종만 유지.

### Environment Reality Check
- [ ] repo context: main branch 확인
- [ ] runnable commands: `pnpm lint`, `pnpm typecheck`, `pnpm test` 확인
- [ ] 실행 블로커: vitest install / prisma generate 등 P1 진행중 — 본 plan은 UI-only이므로 독립 진행 가능

---

## 1. Priority Fit

### Current Priority Category
- [ ] P1 immediate
- [ ] Release blocker
- [ ] Post-release
- [x] **P2 (scope-reduced cleanup, 독립 진행 승인)**

### Why This Priority
- release-prep / MutationAuditEvent smoke / RFQ handoff smoke가 여전히 P1. UI 정리는 원칙적으로 P2.
- 단, 본 아이콘은 **전역 header 노출**이라 사용자 신뢰에 즉시 영향. no-op/debug/global placeholder 패턴의 잔재 가능성도 있어 scope-reduced로 먼저 정리 승인.
- P1 흐름을 흐리지 않도록 **route-level banner 재설계로 확장 금지** (scope lock 상단 참조).

---

## 2. Work Type

- [ ] Feature
- [ ] Bugfix
- [ ] API Slimming
- [x] **Workflow / Ontology Wiring (surface만 제거, resolver 자체는 건드리지 않음)**
- [ ] Migration / Rollout
- [ ] Billing / Entitlement
- [ ] Mobile
- [x] **Web (Design Consistency)**

---

## 3. Overview

### Feature Description
Dashboard 우상단 헤더에 조건부로 노출되는 Compass("다음 단계") 아이콘은 ontology overlay를 여는 global launcher다.
LabAxis 제품 원칙상 ontology는 workflow route 안에서 contextual action으로만 surface해야 하므로 header에서 제거한다.
Header에는 `search / notification bell / help / user menu` 4종만 남긴다.

### Success Criteria
- [ ] Dashboard 헤더 우상단에 Compass 아이콘 **사라짐** (모든 dashboard route에서 확인)
- [ ] Header DOM에 { search, bell, help, user } 외 유틸리티 아이콘 **없음**
- [ ] `useOntologyContextLayerStore` 호출이 Header.tsx에서 제거되어 불필요 render/re-render 없음
- [ ] 기존 알림/도움말/사용자 메뉴는 동작 그대로 유지 (regression 없음)
- [ ] lint / typecheck / 관련 기존 test 통과

### Out of Scope (⚠️ 절대 구현하지 말 것)
- [ ] route별 top priority banner 재설계
- [ ] OntologyTopBanner 등 신규 surface 컴포넌트 구축
- [ ] safety / inventory / quotes / purchases / orders 페이지 banner 변경
- [ ] global ontology surface 추가
- [ ] 새 페이지 추가
- [ ] ontology resolver / store 로직 수정
- [ ] overlay 본체(`ontology-context-layer.tsx`) 재설계

### User-Facing Outcome
- 사용자는 헤더에서 "정체 불명 아이콘이 사라지고 다시 나타나는" 현상을 더 이상 겪지 않는다.
- Dashboard 헤더는 일관된 4개 유틸리티(search, bell, help, user)만 노출한다.
- Ontology overlay 본체는 살아있으나, 진입점은 이번 Plan 범위 밖. 후속 plan에서 route-level contextual surface로 재배치 예정.

---

## 4. Product Constraints

### Must Preserve
- [x] workbench / queue / rail / dock (건드리지 않음)
- [x] same-canvas (header 1곳만 수정)
- [x] canonical truth (store/resolver 무변경)
- [x] invalidation discipline (query cache 영향 없음)

### Must Not Introduce
- [x] page-per-feature 회귀 없음
- [x] chatbot/assistant 재해석 없음
- [x] dead button / no-op / placeholder success 없음 (오히려 제거)
- [x] fake billing/auth shortcut 없음
- [x] preview overriding actual truth 없음

### Canonical Truth Boundary
- **Source of Truth:** `OntologyContextLayerStore.resolved.nextRequiredAction` (변경 없음)
- **Derived Projection:** Header Compass 아이콘 (제거 대상)
- **Snapshot / Preview:** 없음
- **Persistence Path:** 없음 (client-side zustand)

### UI Surface Plan
- [x] **기존 루트 section 내에서만 작업 (Header.tsx 단일 파일)**
- [ ] Inline expand
- [ ] Right dock
- [ ] Bottom sheet
- [ ] Split panel
- [ ] Settings panel
- [ ] New page (⚠️ 금지)

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| Compass block 전체 제거 (line 274–295) | ontology는 global header가 아닌 route contextual surface여야 함 | ontology overlay 진입점이 이번 plan 내에서는 사라짐 → 후속 plan에서 route-level 재배치 필요 (이번 plan 범위 밖) |
| `useOntologyContextLayerStore` import 및 `ontologyStore` / `nextActionLabel` state 제거 | 미사용 state subscription은 불필요 re-render 유발 | Header.tsx의 ontology 결합도 0으로 낮아짐 (긍정적) |
| `Compass` lucide import 제거 | 미사용 import | 없음 |

### Dependencies
- **Required Before Starting:** 없음 (독립 진행 가능, P1 작업과 충돌 없음)
- **External Packages:** 없음
- **Existing Routes / Models / Services Touched:** `apps/web/src/components/dashboard/Header.tsx` 1개만

### Integration Points
- 없음 (client component, 단일 파일 수정)

---

## 6. Global Test Strategy

All phases must strictly follow Red-Green-Refactor.

### Test Strategy
- UI 제거 → DOM snapshot / `getByLabelText("다음 단계")` 부재 확인 test
- Ontology store 호출 횟수 감소 확인 (선택적, 복잡하면 수동 검증으로 대체)
- 기존 Header test가 있으면 regression 확인

### Execution Notes
- `pnpm test`(vitest) 실행 가능 상태 확인 필요 — P1 `vitest install`이 아직 blocker면 **"실행 불가" 명시 + 수동 smoke로 대체**
- `pnpm lint`, `pnpm typecheck`는 독립 실행 가능해야 함

---

## 7. Implementation Phases

### Phase 0: Context & Truth Lock
**Goal:** 제거 대상/범위/대체 경로 없음을 재확인하고 scope creep 방지 체크포인트 박기.
- Status: [ ] Pending | [ ] In Progress | [x] Complete (2026-04-21)

**🔴 RED:**
- Header.tsx에서 Compass block의 exact line range (274–295) 재확인
- `useOntologyContextLayerStore` 사용처 grep → Header.tsx 외에 없는지 확인
- 다른 header 파일(`apps/web/src/app/_components/main-header.tsx`, `apps/web/src/components/layout/page-header.tsx`, `apps/web/src/app/test/_components/test-header.tsx`)에 동일/유사 아이콘이 있는지 확인
- 확장 판단 트리거 — 다른 header에도 있으면 그 header도 이 plan에서 처리할지 결정 (same-scope 확장 허용, route banner 신설은 여전히 금지)

**🟢 GREEN:**
- 제거 대상 블록 목록 확정
- 후속(post-plan) 작업 목록(=route-level surface 재배치)을 **별도 plan 대상**으로 기록만, 이번 plan 범위에 포함 금지

**🔵 REFACTOR:**
- N/A (planning-only)

**✋ Quality Gate:**
- 제거 대상 블록 라인 수/파일 수 확정
- scope creep 없음 확인 (route banner 작업 포함되지 않음)
- `docs/plans/PLAN_header-utility-icon-audit.md` notes 업데이트

**Rollback:** planning-only, no code change

---

### Phase 1: Failing Test + Header Compass 아이콘 제거
**Goal:** Compass 아이콘과 관련 ontology store 결합을 Header.tsx에서 제거.
- Status: [ ] Pending | [ ] In Progress | [x] Complete (2026-04-21, same-scope 확장 포함)

**🔴 RED:**
- Header DOM에 `aria-label="다음 단계"` 요소가 **존재하지 않아야** 한다는 failing test 작성
  - `apps/web/src/__tests__/components/dashboard/header.test.tsx` (없으면 신설, 있으면 추가)
- 실행 → 현재 구현에서 fail하는지 확인

**🟢 GREEN:**
- `Header.tsx` line 274–295 block 제거
- `useOntologyContextLayerStore` import 제거 (line 33)
- `ontologyStore` / `nextActionLabel` 관련 state / derive 제거 (line 83–84)
- `Compass` lucide import 제거 (line 29)
- `Tooltip, TooltipTrigger, TooltipContent` 는 다른 데서 사용 안 하면 제거, 사용하면 유지 — 먼저 grep 확인
- test 통과 확인

**🔵 REFACTOR:**
- import 순서 / 공백 정리
- 주석 중 해당 블록 관련된 부분 정리

**✋ Quality Gate:**
- [⚠️] 신규 failing test — **작성 skip**. 이유: vitest 미설치 (P1 blocker), 대신 `rg` grep 2-file 검증 + Phase 2에서 수동 smoke로 대체
- [⚠️] 기존 Header 관련 test 회귀 없음 — **실행 불가** (vitest 미설치)
- [⚠️] `pnpm lint` 통과 — **실행 불가 기록** (환경 내 미검증)
- [⚠️] `pnpm typecheck` 통과 — **실행 불가 기록** (tsc 미설치, P1 blocker)
- [x] Tooltip import — DashboardHeader.tsx에서 Compass block이 유일 사용처였으므로 함께 제거 (grep 확인 완료)
- [x] dead button / no-op / placeholder 추가 없음 (오히려 dead branch 2건 + global launcher 1건 제거)
- [x] scope 외부 canonical path 보존 확인 — `dashboard-shell.tsx:59` `<OntologyContextLayer />` mount, `ontology-context-layer.tsx` overlay 본체, `ontology-context-layer-store.ts` store, `use-ontology-context-bridge.ts` bridge, `support-center/page.tsx` updateContext caller 모두 **수정 없음**

**Rollback:**
- `Header.tsx` + `main-header.tsx` 2곳만 `git checkout --`로 원상 복구

---

### Phase 2: Smoke + Post-removal Verification
**Goal:** 제거 이후 dashboard 전역에서 회귀 없음 확인 + ontology store orphan 상태 기록.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:**
- 주요 dashboard route(`/dashboard`, `/dashboard/organizations`, `/dashboard/safety`, `/dashboard/inventory`, `/dashboard/purchases`) 5곳 smoke 경로 문서화
- 각 route에서 헤더에 **Compass 아이콘 없음**, 알림/도움말/사용자 메뉴 정상 동작이라는 체크리스트 작성

**🟢 GREEN:**
- 로컬 빌드 기동 (`pnpm dev`) 후 smoke 실제 수행 (또는 실행 불가 시 "실행 불가" 기록 + Vercel preview로 대체)
- Ontology overlay가 이번 plan 범위 밖에서 여전히 열릴 수 있는 경로가 있는지 확인 (있다면 그대로 유지, 없다면 "임시로 닫힘 — 후속 plan에서 재배치" 기록)

**🔵 REFACTOR:**
- Phase 1에서 남긴 임시 주석/계측 정리
- Notes 섹션에 "후속 plan으로 이관할 항목" 명시
  - route-level top priority banner 설계
  - safety/inventory/quotes의 ontology contextual surface 재배치
  - (별도 P1 bug-hunter 후보) `MSDS 점검 실행` / 상단 alert CTA 실제 동작 여부 검증

**✋ Quality Gate:**
- [ ] 5 route smoke 모두 회귀 없음
- [ ] Header에 { search, bell, help, user } 외 아이콘 없음 (screenshot 1장 첨부 권장)
- [ ] 후속 plan 이관 항목이 Notes에 기록됨
- [ ] rollback path 유효 (Phase 1 revert로 원상 복구)

**Rollback:**
- Phase 1 revert

---

## 8. Addenda

해당 없음 (단일 파일 UI-only cleanup).

---

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| Ontology overlay 진입점이 Plan 범위 밖에서 완전 소실될 수 있음 | Med | Low | 후속 plan으로 재배치 명시, 본 plan 완료 후 즉시 follow-up plan 기안 |
| 다른 header(`main-header.tsx`, `page-header.tsx`)에 유사 global icon 잔재 가능 | Low | Low | Phase 0에서 grep으로 선제 확인, 있으면 same-scope 확장 |
| Vitest 미설치 상태로 test 실행 불가 | High | Low | "실행 불가" 명시 + DOM 수동 검증 + 관련 snapshot file diff로 대체 |
| scope creep (route banner 신설 욕구) | Med | Med | 상단 Scope Lock + Phase 0/2 quality gate에서 scope creep 명시적 차단 |

**Risk Categories:** Technical / Dependency / Quality / Canonical Truth — 모두 Low 이하

---

## 10. Rollback Strategy

- **Phase 0 Fails:** planning-only, 아무 변경 없음
- **Phase 1 Fails:** `Header.tsx` + test 파일 2곳 `git checkout -- <file>`
- **Phase 2 Fails:** Phase 1 revert. Ontology entry point는 본 plan 이전 상태로 복귀

**Special Cases:**
- UI disabled fallback 불필요 (server-side 영향 없음)
- migration / billing / webhook 영향 없음

---

## 11. Progress Tracking

- Overall completion: **~66%** (Phase 0 + Phase 1 complete, Phase 2 pending approval)
- Current phase: Phase 2 착수 전 승인 대기
- Current blocker: typecheck / test runner 실행 불가 (vitest, tsc 미설치 — P1 blocker 공유)
- Next validation step: Phase 2 수동 smoke (사장님 승인 후) — 6개 route 체크리스트 수행

### Phase Checklist
- [x] Phase 0 complete
- [x] Phase 1 complete
- [ ] Phase 2 complete

---

## 12. Notes & Learnings

### Blockers Encountered
- (비워둠 — 실행 중 기록)

### Phase 0 Findings (2026-04-21)

**Header 파일 인벤토리:**
| 파일 | 역할 | 사용 범위 | Compass/Ontology 결합 |
| :--- | :--- | :--- | :--- |
| `components/dashboard/Header.tsx` (DashboardHeader) | Top app header (dashboard) | `/dashboard/*` 전용 (`dashboard-shell.tsx`) | **있음** (line 274–295, icon-only) |
| `app/_components/main-header.tsx` (MainHeader) | Top app header (비-dashboard) | 공개 사이트 + `/app/*`, `/billing/*`, `/settings/*`, `/inventory`, `/admin/*` 등 28곳 | **있음** (line 63–71 desktop + 179–195 mobile, 텍스트+아이콘) |
| `components/layout/page-header.tsx` (AppPageHeader / PageHeader) | Section header (page body 내부) | 일반 페이지 내부 | 없음 |
| `app/_components/page-header.tsx` (PageHeader) | Section header (legacy) | 일부 페이지 | 없음 |
| `app/test/_components/test-header.tsx` | Test route header | `/test/*` | (조사 불필요, test 전용) |

**DashboardHeader utility icon inventory:**
| # | 심볼 | 위치 | Render 조건 | onClick / effect | 실제 outcome | 분류 | 권고 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | `CommandPalette` | 우측 검색 영역 | 항상 (desktop) | 내부 modal/palette | keyboard-shortcut 포함 검색 | search | **keep** |
| 2 | `Search` icon button | 우측 (모바일 전용) | `md:hidden` | `router.push("/app/search")` | 검색 페이지 이동 | search | **keep** |
| 3 | **`Compass` ("다음 단계")** | 우측 유틸리티 구역 | `pathname.startsWith("/dashboard") && nextActionLabel` | `ontologyStore.open(pathname, {})` | Ontology overlay 오픈 | **global ontology launcher (원칙 위반)** | **remove** (Phase 1 대상) |
| 4 | `Bell` (알림) | 우측 | 항상 | DropdownMenu 열기 + navigate | 실제 알림 목록 → route 이동 | notification | **keep** |
| 5 | `HelpCircle` (도움말) | 우측 (`hidden md:flex`) | 항상 (desktop) | DropdownMenu → support-center links | 실제 route 이동 | help | **keep** |
| 6 | User Avatar | 우측 | 데스크탑 | DropdownMenu → settings/billing/logout | 실제 route/action | user | **keep** |
| 7 | `Menu` (햄버거) | 우측 끝 | `lg:hidden` | `onMenuClick` → 사이드바 open | 실제 동작 | nav | **keep** |

**MainHeader utility icon inventory (비-dashboard 범용):**
| # | 심볼 | 위치 | Render 조건 | onClick / effect | 실제 outcome | 분류 | 권고 |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| 1 | Nav links (서비스 소개 / 요금 / 검색) | 데스크탑 nav | 항상 | `<Link>` navigate | 실제 route | nav | keep |
| 2 | **`Compass` "다음 작업" blue button** | 데스크탑 nav 끝 | `session?.user && pathname.startsWith("/dashboard")` | `openContextLayer(pathname, {})` | overlay 오픈 | **global ontology launcher (dead code)** | **remove** |
| 3 | **모바일 메뉴 내 "다음 작업"** | 모바일 시트 | `session?.user && pathname.startsWith("/dashboard")` | `openContextLayer` + `close()` | overlay 오픈 | **global ontology launcher (dead code)** | **remove** |
| 4 | `UserMenu` | 데스크탑 | 항상 | 메뉴 | user | keep |
| 5 | `Menu/X` (햄버거) | 모바일 | 항상 | 모바일 시트 open | nav | keep |

**중요 발견 — MainHeader의 Compass branch는 dead code:**
- MainHeader는 비-dashboard route 28곳에서 사용됨 (`/intro`, `/pricing`, `/settings/*`, `/app/*`, `/billing/*` 등)
- 이 route들의 pathname은 **절대 `/dashboard`로 시작하지 않음**
- 따라서 `pathname.startsWith("/dashboard")` 조건은 MainHeader가 실제 렌더되는 컨텍스트에서 **영원히 false**
- → 데스크탑 "다음 작업" 버튼과 모바일 메뉴 내 "다음 작업" 항목은 **dead branch** (no-op이 아니라 never-render)
- `useOntologyContextLayerStore`, `OntologyContextLayer` import, `openContextLayer` 선언, `<OntologyContextLayer />` 글로벌 마운트도 dead dependency일 가능성이 있으나, `OntologyContextLayer` global mount는 `dashboard-shell.tsx`(line 59)에도 이미 있으므로 중복 마운트 위험

**Scope 판단:**
- **Header.tsx 단일 수정만으로 끝나지 않음** — MainHeader의 dead Compass branch도 같이 제거하는 것이 동질적 정리. same-scope 확장 허용 범위 내.
- **route-level banner replacement는 필요 없음** — Phase 2 범위에 넣지 말 것. 사장님 지침 그대로 유지.
- **별도 plan 분리 트리거 감지되지 않음** — ontology overlay 본체와 store는 건드리지 않고, 두 header의 launcher만 제거하면 scope 완결.
- **후속 plan 대상 (본 plan 범위 밖 확정):**
  - ontology overlay 진입점을 route-level contextual surface(top priority banner / row CTA / dock)로 재배치하는 작업
  - safety/inventory/quotes 각 route별 ontology surface 설계

**Phase 1 착수 시 수정 대상 확정 범위:**
- `apps/web/src/components/dashboard/Header.tsx` (line 29 Compass import, line 33 store import, line 83–84 store state, line 274–295 Compass button block)
- `apps/web/src/app/_components/main-header.tsx` (line 6 Compass import, line 11–12 store & overlay import, line 26 openContextLayer, line 63–71 desktop button, line 179–195 mobile menu item, line 319 `<OntologyContextLayer />` 글로벌 마운트 — **단, dashboard-shell.tsx에 이미 마운트되어 있으므로 MainHeader 측은 중복이라 제거해도 안전한지 재확인 필요**)

**aiPanelOpen / Safety CTA 관련 (Task #6):**
- `MSDS 점검 실행` 버튼 handler = `setAiPanelOpen(true)` (line 417, `priorityBacklogCount > 0` 가드 있음). **즉시 no-op 아님** — panel 열림까지는 실제 effect 존재.
- Panel 내부 실제 분석 동작이 canonical action / persistence로 이어지는지는 **미확인**. Phase 0 diagnostic 금지 범위이므로 더 파지 않음.
- 상단 alert 배너 `지금 확인하기` 버튼 handler = `setSelectedItemId(queueItems[0]?.id)` (line 381–384). **즉시 no-op 아님** — 첫 immediate 항목 선택까지는 effect 존재.
- **별도 bug-hunter 대상 후보로만 기록.** 본 plan A에서는 수정하지 않음.

**Phase 0 Quality Gate 점검:**
- [x] code diff 없음
- [x] scope expansion 없음 (same-scope 확장 1건: MainHeader dead code 제거 — route-level banner 신설 없음)
- [x] header icon별 keep/remove/absorb 판단 근거 기록됨
- [x] no-op/debug/placeholder 분류됨
- [x] route-level 작업 필요성 없음 확인됨 (→ 후속 plan 대상만 기록)

### Phase 1 Execution Report (2026-04-21)

**수정 파일 (2개, same-scope 확장 포함):**

1. `apps/web/src/components/dashboard/Header.tsx` (DashboardHeader)
   - Removed: `Tooltip, TooltipTrigger, TooltipContent` import
   - Removed: `Compass` from lucide-react import
   - Removed: `useOntologyContextLayerStore` import
   - Removed: `const ontologyStore = useOntologyContextLayerStore()` + `nextActionLabel` derive
   - Removed: Compass button block (icon-only, line 274–295 in pre-edit state)

2. `apps/web/src/app/_components/main-header.tsx` (MainHeader)
   - Removed: `Compass` from lucide-react import (line 6)
   - Removed: `useOntologyContextLayerStore` import
   - Removed: `OntologyContextLayer` import
   - Removed: `const openContextLayer = useOntologyContextLayerStore(...)` (line 24)
   - Removed: Desktop "다음 작업" blue button block (dead branch, `pathname.startsWith("/dashboard")` — MainHeader는 비-dashboard 컨텍스트에서만 렌더됨)
   - Removed: Mobile menu "다음 작업" item block (dead branch, 동일 이유)
   - Removed: `<OntologyContextLayer />` 글로벌 마운트 (중복 마운트 — `dashboard-shell.tsx:59`가 canonical)

**Canonical Path 보존 확인 (Plan A scope 외부, 무변경):**
- `components/ontology-context-layer/ontology-context-layer.tsx` — overlay 본체 무변경
- `lib/store/ontology-context-layer-store.ts` — store 무변경
- `app/dashboard/_components/dashboard-shell.tsx:59` — `<OntologyContextLayer />` canonical mount 유지 (dashboard 라우트에서만 overlay 렌더됨)
- `app/dashboard/support-center/page.tsx:394` — `updateContext` caller 무변경 (페이지 내부 정상 사용)
- `hooks/use-ontology-context-bridge.ts` — 페이지→store bridge 무변경

**Grep 검증 결과 (2026-04-21):**
- `rg "Compass|다음 작업|openContextLayer|OntologyContextLayer"` on 2 edited files → **No matches**
- 나머지 레포 잔여 매치는 전부 canonical path (overlay 본체, store, dashboard-shell 마운트, support-center updateContext, bridge hook) → **수정 금지 대상 그대로 보존**

**실행 불가 기록:**
- `pnpm typecheck` — tsc 미설치 상태 (P1 blocker). Phase 1에서 실행 불가로 기록.
- `pnpm lint` — 본 세션에서 미실행. Phase 2 smoke 시 사장님 환경에서 확인 요청.
- vitest 단위 test 신설 skip — Phase 2 수동 smoke로 대체 (Scope-Reduced 승인 조건과 부합).

**Phase 2 착수 전 smoke 체크리스트 (6 route):**
- `/dashboard` — 헤더 우상단에 Compass 없음, 알림/도움말/사용자 메뉴 정상
- `/dashboard/organizations` — 동일 (사장님 원본 스크린샷 지점)
- `/dashboard/inventory` — 동일
- `/dashboard/safety` — 동일 (Task #6 safety 페이지 내용 변경 없음, header만 영향)
- `/pricing` — MainHeader 렌더, "다음 작업" 버튼 사라짐, 기존 3 nav link 유지
- `/intro` — MainHeader 모바일 메뉴에서 "다음 작업" 항목 사라짐
- `/support` — MainHeader 렌더 정상

**후속(본 plan 외) 기록:**
- Task #6 (Safety no-op audit): 별도 P1 bug-hunter flow — 본 plan 완료 후 상신
- route-level contextual surface 재배치 설계 (ontology 진입점 부재 상태 해소용): 별도 plan
- Plan B (`PLAN_safety-semantic-color-cleanup`): P1 release-prep + MutationAuditEvent smoke 완료 후 재검토

### Implementation Notes
- **2026-04-21 승인 조건:**
  - scope-reduced cleanup으로만 승인
  - route-level top banner 대체 작업은 범위 제외
  - 진행 중 route banner 필요성 감지 시 즉시 중단 → 별도 plan 재분할
  - Plan B(`PLAN_safety-semantic-color-cleanup`)는 본 plan 완료 + P1 release-prep / MutationAuditEvent smoke 완료 후 재검토
  - Safety 쪽 `MSDS 점검 실행` / 상단 alert CTA가 no-op으로 판정되면 색상 cleanup이 아니라 **별도 P1 bug-hunter flow**로 상신
