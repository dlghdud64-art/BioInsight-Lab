# Implementation Plan: 운영 브리핑 리디자인 (single 오늘 할 일 큐 + 인라인 1줄 AI)

- **Status:** ⏳ Pending
- **Started:** 2026-06-28
- **Last Updated:** 2026-06-28
- **정본 spec:** `uploads/운영 브리핑 핸드오프.md` (시안 HTML 미첨부 — 스펙 .md 기준)

**CRITICAL INSTRUCTIONS** — 각 phase 완료 후:
1. ✅ 완료 체크박스 체크
2. 🧪 quality gate 검증 (operator-shell vitest/tsc/build 권위)
3. ⚠️ 모든 gate 통과 확인
4. 📅 Last Updated 갱신
5. 📝 Notes 에 learnings/blocker 기록
6. ➡️ 통과 후에만 다음 phase

⛔ gate 실패·source-of-truth 충돌 미해소·dead button/no-op/fake success 도입 시 진행 금지.

---

## 0. Truth Reconciliation

**Latest Truth Source:** `운영 브리핑 핸드오프.md` (호영님, 2026-06-28). 카테고리-탭 게이트 → 단일 큐 + 필터 칩 + 인라인 1줄 AI근거+조치.

**Secondary References:** 현행 `components/operational-brief/popup.tsx` (1108L), `popup-context.tsx`, `use-operational-brief.ts`, §11.194/198/202/271/311/317 sentinel 군.

**Conflicts Found:**
- 84개 sentinel 파일이 *현 구조*(카테고리 그리드·6-section AI dossier·5 추상카드·LIVE)를 고정 → 리팩토링 시 retire/rewrite 필요.
- 과거 §11.194(3-tier drill-down) / §11.198(6-section) 가 본 리디자인으로 대체됨.

**Chosen Source of Truth:** 핸드오프 .md (최신 호영님 결정). 기존 sentinel 중 구조 가정은 retire, canonical 데이터 보존 항목만 유지.

**승인된 결정 (호영님 2026-06-28):**
1. 범위 = **공유 popup 리디자인 (8 surface 일괄)**. 대시보드 단독 분기 안 함 (page-per-feature 회귀 방지).
2. **LIVE 인디케이터 제거** (실시간 연동 전까지 fake live 차단).
3. 가드 — `act-primary`: 실제 액션 API 있을 때만 노출, 없으면 단일 "화면 이동" CTA. `data-days`: 마감 숫자 파생해 임박마감 계산.

**Environment Reality Check:**
- [ ] repo/branch context (HEAD 4d85ac13, baseline 77)
- [ ] sandbox = 코드작성+정적검증, operator-shell = vitest/tsc/migrate/push 권위
- [ ] sandbox vitest 불가 → 정적 replay 후 operator 실행

## 1. Priority Fit
- [x] Post-release UX 리팩토링 (P1 false-empty / landing-CTA 2건 land 완료 후)
- migration 0, billing 무관.

## 2. Work Type
- [x] Design Consistency / Workflow surface 통합 (same-canvas 리팩토링)

## 3. Overview
**Feature:** 우측 레일 운영 브리핑을 "카테고리 탭 패널"에서 "모듈 무관 단일 오늘 할 일 큐 + 인라인 AI 근거 1줄 + 조치 1"로 재설계. 깊이 4단→사실상 2단. 공유 컴포넌트라 8 surface 일괄.

**Success Criteria:**
- [ ] 카테고리 게이트 제거 — 열면 단일 큐 즉시 노출 (칩은 필터)
- [ ] 지금 처리(hot) / 검토 대기 2섹션 + 모듈 색 액센트 바
- [ ] 요약 스트립(긴급/검토대기/임박마감 + 스파크라인) 필터 연동 동적 recalc
- [ ] 카드 인라인 펼침 = AI 근거 1줄 + act-primary(조건부) + act-go (단일 오픈)
- [ ] LIVE 제거 / dead button·no-op 0 / canonical truth 보존
- [ ] 8 surface 일괄 적용, baseline 신규 RED 0

**Out of Scope (⚠️ 구현 금지):**
- [ ] 대시보드 단독 변형 (page-per-feature)
- [ ] 신규 데이터 truth 생성 (BriefingItem 은 기존 UnifiedInboxItem 파생만)
- [ ] act-primary 실액션 없는데 가짜 성공 표시
- [ ] LIVE/실시간 표시 (연동 전)
- [ ] 신규 AI/chatbot UI

**User-Facing Outcome:** 운영자가 레일을 열면 카테고리 선택 없이 "오늘 할 일" 우선순위 큐를 즉시 봄. 카드 펼치면 1줄 근거 + 한 번의 조치 또는 해당 모듈 화면으로 이동.

## 4. Product Constraints
**Must Preserve:** workbench/queue/rail/dock · same-canvas · canonical truth · invalidation discipline
**Must Not Introduce:** page-per-feature · ontology→chatbot · dead button/no-op/fake success · preview가 truth 덮기

**Canonical Truth Boundary:**
- Source of Truth: 기존 unified inbox 데이터 (UnifiedInboxItem) + 카테고리 stats
- Derived Projection: BriefingItem (module/hot/due/title/subtitle/ai/goHref/primaryAction)
- Snapshot/Preview: 없음 (preview 금지)
- Persistence Path: act-primary → 기존 모듈 액션 API (신규 persistence 0)

**UI Surface Plan:** [x] Right dock (기존 rail 리팩토링, same-canvas)

## 5. Architecture & Dependencies
| Decision | Rationale | Trade-offs |
|---|---|---|
| popup.tsx 리팩토링 (신규 컴포넌트 X) | 인프라 재사용(viewMode·stats·narrative·expand), page-per-feature 회피 | 1108L 파일 대수술, sentinel 결합 정리 부담 |
| BriefingItem = UnifiedInboxItem 파생 | 신규 truth 0 | dueState 숫자화·primaryAction 가용성 파생 추가 필요 |
| LIVE 제거 | deterministic narrative라 fake live | 시각적 "실시간감" 상실 (연동 시 복원) |

**Touched:** `components/operational-brief/popup.tsx`, `popup-context.tsx`, `use-operational-brief.ts`(필요시), 파생 헬퍼, 결합 sentinel 군.
**Integration Points:** unified inbox 데이터 훅, `useOperationalBriefNarrative`(1줄 근거), 모듈 deep-link 라우팅, (조건부) 모듈 액션 API.

## 6. Global Test Strategy
- 구조 변경 → sentinel(readFileSync+regex) rewrite + 신규.
- 파생 로직(BriefingItem, data-days, hot/검토 분리, recalcStrip) → 단위 검증.
- 8 surface user-visible flow → smoke path.
- sandbox vitest 불가 → 정적 replay, operator-shell 실행 권위.

## 7. Implementation Phases

### Phase 0: Context & Contract Lock  *(planning only, no code)*
- Status: [x] Complete (2026-06-28)
- **🔴 RED:** ① BriefingItem ↔ UnifiedInboxItem 필드 맵 작성 ② 신규 파생 필요분 확정(data-days 숫자, primaryAction 가용성) ③ 84 sentinel 분류(retire/rewrite/keep) ④ 8-surface mount 인벤토리
- **🟢 GREEN:** 매핑·gap·sentinel 표 산출, 공유-popup 범위 재확인
- **🔵 REFACTOR:** scope 축소 가능분 식별
- **✋ Gate:** 충돌·false assumption 0, 계약 표 확정
- **Rollback:** planning only

### Phase 1: Contract & Failing Tests
- Status: [x] Complete (2026-06-28) — sandbox 작성, operator RED 확인 대기
- **🔴 RED:** 신규 sentinel 실패 작성 — 단일큐 기본(카테고리 게이트 부재)·칩=필터·스트립 동적 recalc·hot/검토 2섹션·인라인 1줄AI+버튼·단일오픈·a11y(aria-expanded). 구 구조 sentinel retire 표시
- **🟢 GREEN:** 최소 계약 스캐폴딩
- **🔵 REFACTOR:** 네이밍/scope 정리
- **✋ Gate:** 실패테스트 real, 기존 테스트 영향 파악, lint/typecheck 문서화
- **Rollback:** 테스트/스캐폴딩 revert

### Phase 2: Data Layer (BriefingItem 파생)
- Status: [x] Complete (2026-06-28) — sandbox node 로직 16/16, operator vitest 확인 대기
- **🔴 RED:** 파생 단위테스트 (module/hot/due+data-days/title/subtitle/ai=narrative/goHref/primaryAction)
- **🟢 GREEN:** 캐노니컬에서 파생 구현. **act-primary 가드**: 실액션 있을 때만, 없으면 단일 go CTA. **data-days** 숫자 파생 → 임박마감
- **🔵 REFACTOR:** DRY, 추측 코드 제거
- **✋ Gate:** 파생 테스트 통과, truth-boundary 위반 0, overfetch/N+1 0, fake success 0
- **Rollback:** 파생 레이어 revert

### Phase 3: UI Refactor (popup.tsx)
- Status: [x] Complete (2026-06-28) — sandbox 정적검증, operator tsc/build/vitest 확인 대기
- **🔴 RED:** 통합 테스트 — 칩 필터/recalcStrip/아코디언 단일오픈/버블 차단
- **🟢 GREEN:** 기본 viewMode→단일 list, 카테고리 그리드→필터 칩, 요약 스트립, hot/검토 2섹션+액센트 바, 인라인=1줄AI+act-primary+act-go. 구 6-section·5카드·LIVE 마크업 제거
- **🔵 REFACTOR:** same-canvas 유지, 중복 제거
- **✋ Gate:** dead button/no-op 0, front-only success 0, loading/error/empty/disabled 상태 존재
- **Rollback:** UI revert to P2

### Phase 4: Sentinel 정합 + Smoke + Rollback
- Status: [x] Complete (2026-06-28, sandbox) — operator vitest/build/baseline 확인 대기
- **🔴 RED:** rollout 실패모드·smoke path(8 surface) 정의
- **🟢 GREEN:** 결합 sentinel retire/rewrite, baseline-delta 측정, 8 surface smoke
- **🔵 REFACTOR:** 임시 계측 제거, notes 확정
- **✋ Gate:** baseline 신규 RED 0, rollback 문서화, 잔존 blocker 격리
- **Rollback:** popup.tsx 구조 revert (git), 컴포넌트 단위 복원

## 8. Workflow / Ontology Addendum
- Resolver Input: route/selection/stage/blocker/snapshot validity
- Output: nextAction/priority/blockers[]/allowedActions[]
- Surface: dashboard=강노출 최소, workflow route=강 contextual. rail/row CTA/filtered queue만. chatbot/terminal 금지
- Validation: [ ] hot 우선순위 정렬 [ ] 칩 필터 [ ] act-go 라우팅 [ ] act-primary 실액션 가드

## 9. Risk Assessment
| Risk | Prob | Impact | Mitigation |
|---|---|---|---|
| 84-sentinel 결합 | High | Med | P1/P4 명시 retire/rewrite, baseline-delta |
| act-primary dead-button | Med | High | 실액션 있을 때만 노출, 없으면 단일 go CTA |
| data-days 숫자 부재 | Med | Med | P2 dueState→숫자 파생 |
| 8-surface blast radius | Med | Med | 공유 컴포넌트 일괄 + 전 surface smoke |
| popup.tsx 대수술 truncation | Med | High | Edit 후 무결성 체크(decode/brace/tail), byte-precise 우선 |

## 10. Rollback Strategy
- P1 실패: 테스트/스캐폴딩 revert
- P2 실패: 파생 레이어 revert
- P3 실패: popup.tsx UI revert
- P4 실패: 구조 git revert + 구 sentinel 복원

## 11. Progress Tracking
- Overall: 100% (sandbox), operator 검증 대기
- Current phase: 완료 (operator land 대기)
- Current blocker: 없음
- Next: operator vitest/tsc/build/baseline → P1~P4 한 묶음 land

**Phase Checklist:**
- [x] Phase 0
- [x] Phase 1
- [x] Phase 2
- [x] Phase 3
- [x] Phase 4

## 12. Notes & Learnings

**P0 계약 (2026-06-28 락):**
- 매핑: sourceModule quote/po/receiving/stock_risk → m-quote/m-order/m-recv/m-inv. hot=priority(p0/p1)∨isOverdue∨blocked. title←title·subtitle←summary·due←dueState·goHref←entityRoute·ai.reason←narrative(1줄).
- data-days: resolveDueState 가 dueAt→diffDays 이미 숫자 계산(라벨만 노출). dueState 에 daysUntil 노출 추가 → 임박마감. 저위험.
- primaryAction: 구조화 인라인 액션 부재(nextAction 텍스트+route, vendorEmail PO quick-action 한정). 가드 확정 — 실액션 있을 때만 act-primary, 기본 단일 act-go.
- sentinel 86: rail/트리거 유지라 floating/multi-surface/cache/narrative/injection/hook = KEEP. retire/rewrite = 내부 구조(category-grid·6-section·5-card·eyebrow-density·mobile-tab-switch·LIVE) ~15-25, P1 확정.
- 8-surface mount 확인.
- [2026-06-28] 핸드오프 기반 plan 생성. 시안 HTML 미첨부 — 스펙 .md 기준. 시안 HTML 확보 시 색토큰/마크업 대조.
- 환경 교훈: Edit/Write 후 CRLF/대용량 파일 끝 truncation 사례 → 무결성 체크 필수.

**P1 결과 (2026-06-28):**
- 신규 RED sentinel: `__tests__/components/operational-brief/popup-redesign-single-queue.test.ts`.
- **계약 토큰 (P3 가 충족해야 GREEN)**: present — `지금 처리`·`검토 대기`·`임박 마감`·`AI 판단`·`data-brief-chip`. removed — `카테고리 선택`·`먼저 처리할 영역`·`useState<"category"|"list">("category")`·`LABAXIS AI INSIGHT`·`Critical Evidence`·`Real-time Operations`·`bg-emerald-400`(LIVE 도트). preserved — `aria-expanded`·`selectedItemId`(단일오픈).
- 정적 replay: 목표 토큰 전부 현재 absent / 구 구조 전부 present / 보존 토큰 present = genuinely RED 확인. sandbox vitest 불가 → operator RED 확인 권위.
- **retire/rewrite 후보(P4 확정, ~13)**: popup-category-tabs-d5 · popup-category-color-and-urgent-badge-e1-e2 · operational-brief-mobile-tab-switch-264a · popup-visual-uplift-f1(6-section+LIVE) · operational-brief-3-section-compress · quote-brief-rail-tabs-sian · operational-brief-eyebrow-density · operational-briefing-eyebrow-korean-279c · popup-card-priority-hierarchy-d4 · popup-cta-shorten-and-last-updated-label · derive-active-category-from-path · mobile-brief-inline-257 · quote-briefing-collapse-toggle/panel-responsive.
- **KEEP(~70)**: cache*·narrative*·injection*·hook-call-sites·rail-mount*(rail-inbox/inventory/receiving/rfq-quote/work-queue)·floating-*·fab-position*·build-rationale*·find-most-urgent-inventory·popup-self-contained·inventory handoff*. (rail/트리거/백엔드 유지)

**P2 결과 (2026-06-28):**
- `lib/ops-console/inbox-adapter.ts`: dueState 에 `daysUntil?: number|null` 추가, resolveDueState 4분기 채움(optional 로 타 생산처 tsc 안전).
- 신규 `lib/operational-brief/derive-briefing-item.ts`: BriefingItem 타입 + deriveBriefingItem/isHot/resolvePrimaryAction(null 가드)/soonestDueDays/summarizeBriefing.
- 신규 단위테스트 `__tests__/derive-briefing-item.test.ts` (모듈맵·hot·data-days·primaryAction null·스트립 집계).
- sandbox node 로직 replay 16/16 pass. tsc 안전: dashboard-adapter 는 별도 DashboardItem 타입(무관), daysUntil optional.
- act-primary 는 현재 전부 null(실액션 미연동) → UI 단일 act-go. 실액션 wiring 시 resolvePrimaryAction 확장.

**P3 결과 (2026-06-28):**
- `components/operational-brief/popup.tsx` 전면 리팩토링(1108→704L, CRLF→LF rewrite). 구 PopupCategoryGrid/List/6-section/LIVE 제거 → BriefQueue(헤더+칩+스트립+2섹션) + BriefCard + BriefCardInline(1줄 AI) + PopupDockChip/useIsMobile/mobile Sheet/desktop aside 보존.
- P1 계약 토큰 GREEN: 지금 처리·검토 대기·임박 마감·AI 판단·data-brief-chip·aria-expanded·selectedItemId 전부 present. 구 토큰(카테고리 선택·LABAXIS AI INSIGHT·Critical Evidence·Real-time Operations·bg-emerald-400) 전부 absent.
- 정적검증: braces/paren 균형·null 0·최장 184자·import 전부 사용·외부 import(dashboard-shell→OperationalBriefPopup) 안전.
- act-go 항상 라우팅(dead button 0), act-primary 가드(null→미렌더), empty state 보존, 단일오픈 아코디언 유지.
- mobile-bottom-sheet.tsx = 별도 객체-컨텍스트 시트(구 카테고리 0) → 무관.
- ⚠️ **환경 사고**: Write 가 대용량 파일 끝에 null 23,936바이트 패딩(truncation 패밀리). text rstrip 으로 미제거 → 바이너리 strip 으로 해소. 신규 교훈: Write 후 `grep -c $'\\x00'`/awk longest-line 점검.
- ⚠️ **operator 주의**: P3 가 구 구조 제거 → retire 대상 ~13 sentinel 이 일시 RED(예상). P4 retire 후 baseline clean. P1~P4 한 묶음 land(중간 push 금지).

**P4 결과 (2026-06-28, sandbox):**
- popup.tsx 를 읽는 test 전수 처리. 잔존 RED 0(정적 기준).
- **RETIRE 6 (삭제)**: popup-category-tabs-d5 · popup-category-color-and-urgent-badge-e1-e2 · popup-visual-uplift-f1 · popup-card-priority-hierarchy-d4 · popup-context-aware-wiring · popup-rail-conversion-g1.
- **REWRITE 4**: popup-header-cutoff(width 460/432 + trace marker) · popup-cta-shorten-and-last-updated-label(D2 라벨 블록 retire, D1 보존) · operational-brief-popup-self-contained(3-tier/6-section/priority/owner/flex-shrink/entityRoute 블록 retire, context/shell/FAB/minimize/useIsMobile/aside·Sheet/eyebrow/shortenCtaLabel 보존) · inventory-header-brief-migration-317(popup 5-card describe retire, 재고헤더+popup-context 보존).
- **KEEP**: popup-redesign-single-queue(신규 GREEN) + quotes/dashboard page-reading + mobile-tab-switch(mobile-bottom-sheet) + derive-* 등.
- 보존 assertion 전부 신규 popup 대비 정적 PASS 확인.
- orphan(무해): derive-priority-reason.ts / derive-active-category-from-path.ts (popup 미사용 dead code, 해당 test 는 모듈 직접 import 라 GREEN). 차후 cleanup 선택.

**Smoke 체크리스트 (operator build 후 8 surface 수동):**
1. /dashboard · 2. /dashboard/quotes · 3. /dashboard/purchases · 4. /dashboard/purchase-orders · 5. /dashboard/inventory(헤더 "운영 브리핑 열기" 포함) · 6. /dashboard/inbox · 7. work-queue-console · 8. mobile bottom sheet.
각: FAB→rail 단일큐(카테고리 게이트 0) / 칩 필터 / 지금처리·검토대기 2섹션 / 카드 펼침→AI 판단 1줄+화면이동(dead button 0) / LIVE 0.

**operator 인계 (land gate):**
1. `vitest` — 신규 popup-redesign-single-queue + derive-briefing-item + rewrite 4 GREEN, 삭제 6 부재.
2. `tsc / build` — popup.tsx 전면 리팩토링 + inbox-adapter daysUntil + derive helper.
3. baseline-delta vs 77 측정(삭제 6 + 신규 2 + rewrite 4 반영) — 신규 RED 0 확인.
4. `git status` 누락 0 + skip-worktree 잔존 0 확인 후 P1~P4 한 묶음 commit/push.
