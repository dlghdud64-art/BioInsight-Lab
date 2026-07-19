# Implementation Plan: 견적 관리 빠른 필터 고도화 (4a 확정안)

> 🗂 **HOUSEKEEPING(호영님 2026-07-13):** 이 PLAN은 코드 배포 완료(위 커밋)됐으나 문서가 워킹트리 미커밋(untracked) 잔존.
> 원 피처(빠른 필터 4a) 맥락에서 `docs(plan)` 단독 커밋으로 정리. 다른 배치 커밋에 혼입 금지, 삭제 금지.

- **Status:** ✅ Complete — 전 단계 배포(P1 e388d393 · P2 3d050050 · P3 15774634 · P4 acc572d9). baseline-delta 0.
- **Started:** 2026-07-11
- **Last Updated:** 2026-07-11
- **Estimated Completion:** TBD (Medium, 5 phase)

**CRITICAL INSTRUCTIONS**: 각 phase 완료 후 —
1. ✅ 체크박스 갱신
2. 🧪 quality gate 검증(sandbox: 파서 구문검증 + sentinel 사전검증 / operator: build + 전체 vitest)
3. ⚠️ gate 전 항목 통과 확인
4. 📅 Last Updated 갱신
5. 📝 Notes 반영
6. ➡️ 그 다음에만 다음 phase 진행

⛔ gate 실패 상태로 다음 phase 금지 · ⛔ source-of-truth 충돌 미해소 진행 금지 · ⛔ dead button / no-op / placeholder success 금지

---

## 0. Truth Reconciliation

**Latest Truth Source:** `apps/web/src/app/dashboard/quotes/page.tsx` (4940 L, 현행 빠른필터 §quote-screen-sian P6.2) + `빠른필터 4a 핸드오프.md`(호영님 지시문) + CLAUDE.md §9(신호등) + P6 색상결정(commit 1a1166dc).

**Secondary References:**
- `@/lib/quote-management/derive` — `computePriority(c) → { level, reason, score, dd }`
- `@/lib/quote-management/from-quote` — `toQuoteCase(q)`
- 기존 §quotes-filter-popover 다축필터(`priorityFilter/replyFilter/arrivalFilter`)
- 서버 persist §11.230c a-4 (`modeChip`, `sortState` PATCH)

**Conflicts Found:**
1. 색상 — 4a §7 조건별 팔레트(Amber/Violet/Teal/Rose/Indigo) vs CLAUDE.md §9 + P6 yellow 신호등 잠금.
2. 필터 이중화 — 4a 상태칩(priority/reply/deadline)이 기존 popover 축과 개념 중복.
3. 상태모델 — `modeChip: string|null`(단일) vs 4a `status: Set`(다중), persist 형태 변경.
4. 데이터 부재 — Quote에 `budget`/`ownerId` 필드 없음. `budget` 칩 실행 불가, `mine`은 `quote.user.id` 대체.

**Chosen Source of Truth (호영님 2026-07-11 결정):**
- **색상 → 신호등으로 흡수.** 4a 팔레트 미채택. §9 sentinel·P6 잠금 유지, canonical 델타 0.
  - 신호등 매핑 테이블:
    | key | 라벨 | tone(신호등) | 배지 | 큰 톤 |
    |---|---|---|---|---|
    | `stalled` | 회신 정체 | 위험 red | `bg-red-100 text-red-700 border-red-200` | `bg-red-50 border-red-200 text-red-700` |
    | `deadline` | 마감 임박 | 주의 yellow | `bg-yellow-100 text-yellow-700 border-yellow-200` | `bg-yellow-50 border-yellow-200 text-yellow-800` |
    | `priority` | 높음 우선 | 주의 yellow (기존 높음=yellow pill 정합) | 동상 | 동상 |
    | `send` | 발송 대기 | 정보 blue | `bg-blue-50 text-blue-700 border-blue-200` | — |
    | `reply` | 회신 대기 | 정보 blue | 동상 | — |
    | `mine` | 내 담당 | 정보 blue(중립) | 동상 | — |
    | `budget` | 예산 초과 | (데이터 부재 → 미도입) | — | — |
  - ❌ Tailwind `amber-*`/`orange-*` 금지 유지. ✅ yellow=주의, red=위험, blue/emerald=정보/정상.
- **popover → 제거, 칩으로 일원화.** `priorityFilter`(높음)→`priority` 칩, `replyFilter`(회신대기)→`reply` 칩 흡수. `arrivalFilter`(단가도착)는 칩 후보로 P0에서 필요성 검토(불요 시 제거).
- **상태모델 → `status:Set` 다중.** persist는 CSV 직렬화(`"deadline,stalled"`)로 기존 PATCH 채널 재사용.
- **budget 칩 → 미도입(데이터 부재).** 4a 자체 규칙("데이터 있을 때만")과 정합. 실질 5칩(deadline/stalled/priority/send/reply) + mine + period.

**Environment Reality Check:**
- [x] repo/branch: `ai-biocompare` main, sandbox 편집 전용(build/push X)
- [x] runnable: sandbox = tsc --noEmit(대상 파일) + 파서 구문검증. **vitest 실행 불가**(마운트된 Windows node_modules에 linux rollup 바이너리 부재, 설치 금지) → 전체 vitest = operator 게이트
- [x] execution blockers: 대형 파일(4940 L, 한글) → Edit truncation 위험 → P2+는 bash node 편집 + tail 재확인 필수

## 1. Priority Fit

- [ ] P1 immediate
- [ ] Release blocker
- [x] Post-release
- [ ] P2 / Deferred

**Why:** quotes surface는 이미 배포됨. 4a는 UX 고도화(죽은 필터 → 정직·다중·일원화). release-blocker 아님. 단 호영님 "새트랙" 명시 착수 → 활성 작업. 핸드오프 P1(OCR)은 로그 대기 별개 블록.

## 2. Work Type

- [x] Feature (UX 고도화)
- [x] Design Consistency (신호등 흡수)
- [ ] Bugfix / API Slimming / Migration / Billing / Mobile

## 3. Overview

**Feature Description:** 견적 리스트 상단 빠른필터를 ① 다중선택(AND) 토글 칩 ② 결과 있는 조건만 노출(0건 숨김, 활성칩 예외) ③ 조합 기준 정직한 실시간 배지 ④ 내담당·마감기간 통합 ⑤ 적용요약·정렬 3종으로 고도화. 기존 popover 제거·칩 일원화. 색상은 신호등 흡수.

**Success Criteria:**
- [ ] 칩 다중선택 AND로 결과 좁힘
- [ ] 매 선택마다 전 칩 배지 문맥 재계산(정직 카운트)
- [ ] 비활성 0건 칩 숨김 / 활성 0건 칩 노출·해제 가능(데드락 방지)
- [ ] 내담당·기간·상태·검색·정렬 전부 AND
- [ ] 적용요약 토큰 × 개별 해제, 초기화는 검색·정렬 유지
- [ ] 정렬 3종(마감임박/우선순위/금액) 기본=마감임박順
- [ ] 빈결과 안내 + 초기화 유도
- [ ] URL 쿼리 복원(`?mine&period&status&sort&q`)
- [ ] a11y(aria-pressed/radiogroup) + ≤1024 세그먼트→Select
- [ ] popover 제거 후 회귀 0(priority/reply 칩 흡수)

**Out of Scope (⚠️ 구현 금지):**
- [ ] budget(예산 초과) 칩 — 데이터 부재
- [ ] 4a 조건별 팔레트(Amber/Violet/Teal/Rose/Indigo) — 신호등 흡수로 대체
- [ ] 서버 필터(안 A) — 현행 클라 파이프(안 B) 유지, 서버 facets는 별도 트랙
- [ ] 좌측 GNB / KPI 스텝퍼 / 우선순위 추천 배너 변경

**User-Facing Outcome:** 죽은 필터가 사라지고, 급한 상태만 신호등으로 눈에 띄며, 다중 조합·정직한 건수·적용요약으로 "지금 뭘 걸렀는지" 즉시 체감.

## 4. Product Constraints

**Must Preserve:**
- [ ] workbench/queue/rail/dock (quotes 리스트 same-canvas)
- [ ] same-canvas (신규 페이지 0)
- [ ] canonical truth (필터·정렬은 computePriority 파생, 저장 0 — UI state가 truth 대체 금지)
- [ ] §9 신호등 sentinel / P6 잠금

**Must Not Introduce:**
- [ ] page-per-feature
- [ ] chatbot/assistant 재해석
- [ ] dead button / no-op / placeholder success
- [ ] amber-*/orange-* Tailwind
- [ ] preview가 actual truth 덮기

**Canonical Truth Boundary:**
- Source of Truth: `quote.status`, `computePriority(c)`(dd/level/reason), `quote.user.id`
- Derived Projection: 칩 predicate 결과, chipCount, sortedQuotes
- Snapshot/Preview: 없음(실시간 파생)
- Persistence Path: `status` CSV + `sort` → 기존 §11.230c PATCH 채널. URL 쿼리는 공유/복원용(truth 아님)

**UI Surface Plan:**
- [x] Existing route section (quotes 리스트 상단, 검색줄↔테이블 사이)
- [ ] New page (❌)

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
|---|---|---|
| 클라 파이프(안 B) 유지 | 프로토타입·현행 방식, 서버 facets 별도 트랙 | 대량 리스트 시 클라 계산 부담(현 규모 허용) |
| `status:Set` + CSV persist | 다중선택 + 기존 PATCH 채널 재사용 | 직렬화/역직렬화 1겹 추가 |
| popover 제거·칩 흡수 | 단일 필터면, UX 혼선 제거 | priorityFilter/replyFilter/arrivalFilter 제거 회귀 검증 필요 |
| 신호등 흡수 | canonical 델타 0, sentinel 유지 | 4a 팔레트 대비 색 구분도 낮음(라벨·건수 텍스트 병기로 보완) |

**Dependencies:**
- Required Before Starting: P0 truth lock
- External Packages: 없음(신규 설치 금지)
- Touched: `page.tsx`(MODE_CHIPS/modeChip/filteredQuotes/sortedQuotes/popover), 관련 sentinel(§quote-screen-sian, §quotes-filter-popover)

**Integration Points:**
- `filteredQuotes` useMemo(1959~), `sortedQuotes` useMemo(2001~)
- `modeChip/setModeChip`(1126), persist PATCH(1617~)
- `useSearchParams`(URL 동기화)

## 6. Global Test Strategy

Red-Green-Refactor 엄수. Work type = UI + 파생 로직 → **sentinel(readFileSync+regex) 회귀보호 + 순수함수 단위 검증**.

- 칩 predicate / chipCount / show → 순수함수 단위테스트(가능 시) + sentinel 패턴 매칭
- popover 제거 → 회귀 0 describe(제거된 심볼 부재 + 흡수 칩 존재 명시)
- URL 동기화 → sentinel(파라미터 read/write 존재)
- **실행 경계:** sandbox = 파서 구문검증 + 대상 sentinel 파일 사전 vitest. 전체 build·vitest = operator 게이트("실행 불가" 아닌 "operator 위임" 명시).

## 7. Implementation Phases

### Phase 0: Context & Truth Lock
- Status: [x] Complete
- **락 결과:** send=PENDING · reply=SENT&무회신 · deadline=dd≤3 · priority=level high · stalled=reason "회신정체" · period all/week(dd≤7)/d3(dd≤3) · mine=`quote.user.id===session.user.id`(요청자 user 대체, 별도 ownerId 없음). budget=데이터 부재 미도입 · arrival=4a 셋 외 미도입. session.user.id 코드베이스 전역 사용 + `/api/quotes` route가 `user:{id,name,email}` select(528행) 확인.
- **🔴 RED:** 칩 predicate별 데이터 소스 확정(budget 부재·mine=user.id·arrivalFilter 존치 여부), 신호등 매핑 확정, popover 제거 범위 확정
- **🟢 GREEN:** computePriority 출력·quote.user·session id 소스 실재 확인
- **🔵 REFACTOR:** 5칩으로 scope 축소(budget drop), stale 가정 제거
- **✋ Gate:** 충돌 4건 해소 기록, 데이터 부재 칩 명시, priority fit 문서화
- **Rollback:** planning-only

### Phase 1: State + Predicate + 정직배지 (Contract & Failing Tests)
- Status: [x] Complete (sandbox) → operator vitest 게이트 대기
- **산출:** `lib/quote-management/quick-filter.ts`(순수 predicate/periodMatch/mineMatch/searchMatch/applyQuickFilter/chipCount/chipShow/sortQuotes/serialize·parse) + `__tests__/dashboard/quotes/quick-filter-4a.test.ts`(다중 AND·정직 배지·0건 숨김/활성 노출·정렬·URL 라운드트립·budget/arrival 미도입 검증). page.tsx 무접촉(순수 lib+test only).
- **sandbox 검증:** tsc --noEmit(lib+deps) EXIT 0(타입 클린). vitest는 operator 게이트.
- **🔴 RED:** predicate 테이블·`chipCount(id)=문맥카운트`·`show(id)=count>0||active` 순수함수 계약 정의 + 실패 sentinel/단위테스트 작성
- **🟢 GREEN:** `filterState{q,mine,period,status:Set,sort}` + predicate + chipCount/show 최소 구현
- **🔵 REFACTOR:** 네이밍·중복 정리, computePriority 파생 경계 준수
- **✋ Gate:** 실패테스트 실재→통과, 기존 sentinel 무회귀, 파서 구문검증 OK
- **Rollback:** predicate/테스트 스캐폴딩 revert

### Phase 2: 칩행 + 대상/기간행 렌더
- Status: [x] Complete (sandbox) → operator vitest 게이트 대기
- **산출(page.tsx):** ① 상태모델 swap `modeChip:string|null`→`quickStatus:Set` + `quickMine` + `quickPeriod` ② 5칩 신호등 렌더(chipCount 정직 배지·비활성 0건 숨김·활성 항상 노출) + 내담당 토글(aria-pressed) + 마감기간 radiogroup(전체/이번주/3일) + 초기화(검색·정렬 유지) ③ filteredQuotes에 AND 배선(canonical `deriveQuote`/`periodMatch`/`mineMatch`/`STATUS_PREDICATES`) ④ **popover 제거·칩 일원화**(priorityFilter/replyFilter/arrivalFilter/filterOpen 전량 제거) ⑤ indicator·empty-state 참조 갱신 ⑥ modeChip 서버 persist 제거(복원은 P4 URL로 이관). 신규 sentinel `quick-filter-4a-render.test.ts`.
- **sandbox 검증:** tsc --noEmit(page.tsx 서브그래프) 오류 0 · sentinel 패턴 전량 grep 사전검증 통과 · 제거 심볼 라이브 참조 0(주석만 잔존) · tail 정상(truncation 0). vitest는 operator.
- **P3로 이관(dead button 아님, 기능 완결):** 적용요약 토큰 *표시* row(개별 해제는 활성칩 토글로 이미 가능) · 정렬바 3종(마감임박/우선순위/금액) · 빈결과 문구 미세조정.
- **Rollback:** page.tsx 단일 revert(기존 MODE_CHIPS 3칩 + popover 복원) + sentinel 제거.

### Phase 3: 정렬바 + 적용요약 (popover 제거·AND는 P2 완료)
- Status: [x] Complete (sandbox) → operator vitest 게이트 대기
- **호영님 P3 결정:** 정렬 기본값 = **우선순위순 유지**(§quote-management-redesign P3 prioMap override 보존). 4a "기본 마감임박順"은 미채택 — computePriority가 이미 마감 가중.
- **산출:** ① 정렬바 3종 radiogroup(우선순위순=key null 기본 / 마감임박순=dday / 금액 높은순=amount) 우측정렬 + "총 N건 중 M건" ② 적용요약 토큰 row(내담당·기간·상태칩 개별 × 해제, quickActive 게이트) ③ `sortedQuotes`에 dday/amount early-return(canonical `sortQuotesLib`) — **기본순 branch·dep array 불변**(priority-override-p3 sentinel 무손상) ④ `sortState.key` union + validKeys + persist 타입(user-preferences.ts) + API Zod enum(route.ts)에 dday/amount 추가(+ price 드리프트 정합). 신규 sentinel `quick-filter-4a-p3.test.ts`.
- **sandbox 검증:** page.tsx+user-preferences+route tsc 0(auth.ts role은 baseline noise·미터치) · P3 sentinel 패턴 전량 grep 통과 · **편집후 sentinel sweep**(P2 학습): quote-management-p3b(substring 유지 무손상)·preferences-quotes-view(loose)·radiogroup(toMatch)·API enum(미pin) 확인.
- **⚠ 절단 2건 복구:** Edit 도구가 user-preferences.ts(꼬리 3줄)·route.ts(꼬리 5줄) 절단 → HEAD 대조 후 bash writeFileSync 스티칭 복구(라인수 379/399 일치 확인). **교훈 재확인: 대형/멀티바이트 파일은 Edit 대신 bash node.**
- **P4 이관:** ≤1024 세그먼트→Select 축약 · URL 동기화(정렬바·기간·칩 복원).
- **add-list(4):** page.tsx · user-preferences.ts · app/api/user/preferences/route.ts · quick-filter-4a-p3.test.ts
- **Rollback:** 정렬바/요약 render revert + union/enum revert(dday/amount) + sentinel 제거.

### Phase 4: URL 동기화 (핵심만 — 호영님 2026-07-12 결정)
- Status: [x] Complete (sandbox) → operator vitest 게이트 대기 (**= 피처 마지막**)
- **범위 축소(호영님 결정):** URL 동기화 핵심만.
- **⚠ 파라미터 충돌 처리:** 기존 `?status`(statusFilter 레거시)와 4a 칩 CSV 충돌 → 칩은 **`chips`** 파라미터 사용(status/selected/dock/source/entity_id 무손상). 나머지 mine/period/sort/q는 free.
- **산출(page.tsx):** `useRouter` 도입 · 복원 effect(1회, `qfUrlHydratedRef` 게이트: mine/period/chips/sort/q → state) · 반영 effect(`window.location.search` 기반 재구성으로 타 파라미터 보존, `debouncedSearchQuery`로 q 저churn, `router.replace(...,{scroll:false})`). 칩 CSV는 canonical `parseStatusCsv` 재사용. 신규 sentinel `quick-filter-4a-p4.test.ts`.
- **P4에서 제외(명시 후속 backlog):** ≤1024 세그먼트→Select 축약 · 화살표키 radiogroup 네비게이션(현재 aria-pressed/radiogroup/aria-checked·Tab·클릭 = WCAG 2.1 기본 충족).
- **sandbox 검증:** page.tsx tsc 0(auth.ts baseline 제외) · P4 sentinel 패턴 전량 통과 · status-clobber 0(statusFilter 보존 확인) · tail 정상 · 편집후 sweep(next/navigation import 미pin 확인).
- **add-list(2):** page.tsx · quick-filter-4a-p4.test.ts
- **Rollback:** URL read/write effect + useRouter import revert(칩·정렬·요약은 유지).

## 8. Optional Addenda

### A. Workflow / Ontology Addendum (해당 — quotes)
- **Resolver Input:** route(quotes 리스트) / selection(칩·기간·검색) / stage(quote.status) / dd(computePriority)
- **Surface Rules:** 리스트 상단 same-canvas 칩행만. chatbot/terminal 금지. 강한 우선 배너는 기존 유지(변경 X).
- **Validation:**
  - [ ] 칩 조합 AND 결과 정확
  - [ ] 정렬 기본 마감임박順
  - [ ] 정직 배지 재계산
  - [ ] 활성 0건 칩 해제 가능

## 9. Risk Assessment

| Risk | Prob | Impact | Mitigation |
|---|---|---|---|
| 대형 파일 Edit truncation | High | Med | bash node 편집 + tail/구문 재확인(핸드오프 반복패턴 #1) |
| 신호등 sentinel 충돌 | Med | High | P0에서 §9 sentinel grep, yellow/red만 사용, amber 클래스 0 |
| popover 제거 회귀 | Med | Med | 흡수 칩 존재 + 제거 심볼 부재 회귀 describe |
| modeChip persist 형태 변경 | Med | Med | CSV 직렬화로 채널 재사용, 역호환 파싱 |
| sandbox 타입맹점(Set 제네릭·신규 param) | Med | Med | arrow param·Set/Map 제네릭 선제 명시(반복패턴 #3) |
| currentUser id 소스 불확실 | Low | Med | P0에서 session.user.id 실재 확인, 부재 시 mine 칩 defer |

## 10. Rollback Strategy

- P1 실패: predicate/테스트 스캐폴딩 revert
- P2 실패: 칩/대상/기간 UI revert (기존 MODE_CHIPS 3칩 복귀)
- P3 실패: 정렬/AND/popover 제거 revert (modeChip 단일 + popover 복원)
- P4 실패: URL/persist/a11y revert (칩은 유지, 동기화만 롤백)
- 전체: single-commit revert (배포는 operator 게이트 통과분만)

## 11. Progress Tracking

- Overall: 100% (P4 게이트 통과 시 피처 완료)
- Current phase: P4 → operator gate 대기 (= 마지막)
- Current blocker: 없음(P3 배포 완료). P4 operator 게이트만 남음.
- Next validation step: operator — main → add 2파일(page.tsx·quick-filter-4a-p4.test.ts) → `cd apps/web && npm run build && npx vitest run`(baseline-delta 0, 신규 p4 sentinel GREEN)

**Phase Checklist:**
- [x] Phase 0
- [x] Phase 1 (배포 e388d393)
- [x] Phase 2 (배포 3d050050)
- [x] Phase 3 (배포 15774634)
- [x] Phase 4 (sandbox; operator vitest 대기)

**남은 backlog(피처 외 후속):** ≤1024 세그먼트→Select 축약 · radiogroup 화살표키 네비 · per-lot 정밀잔량 B안(별개 트랙).

## 12. Notes & Learnings

**Blockers:**
- (없음)

**★ 학습 (P2 operator-catch, P3+ 필수 반영):**
- **sentinel sweep 누락** — P2에서 sandbox가 "제거 심볼 라이브 참조 0"(소스 grep)만 확인하고, 제거된 modeChip/MODE_CHIPS/popover/상태Select를 *positive assert* 하던 기존 sentinel 11개(quote-mode-reset-264h5·filter-toolbar-259c·mode-chips-nowrap-264h·mobile-redesign·empty-onboarding-q4·preferences-quotes-filter·mode-chips-touch-264h4·kpi-dedup·table-due-date·status-count-374·batch-select-264h2)를 sweep 안 함 → operator 게이트서 27+ assert CI red 적발. operator가 REPOINT(44px·정직성·마감 진입점→신 QUICK_CHIP/resetQuick)/RETIRE(setModeChip·MODE_CHIPS.map·priorityFilter→absence 가드)/KEEP(검색·전체선택·fade) 로 전량 진화, baseline-delta 0 회복. 배포 3d050050(12 sentinel 152/152 GREEN).
- **규칙 확정**: 편집(특히 심볼/UI 제거) 전 `grep -rl "<제거대상 심볼>" src/__tests__` 로 add-list 밖 sentinel 을 반드시 sweep. "소스 라이브 참조 0"은 불충분 — readFileSync sentinel 은 소스 grep 에 안 잡힘.

**Implementation Notes:**
- 색상: 호영님 2026-07-11 결정 = 신호등 흡수(4a 팔레트 미채택).
- popover: 호영님 2026-07-11 결정 = 제거·칩 일원화. arrivalFilter(견적 도착/대기)는 4a 셋 외 → 제거 예정(reply 칩이 회신대기 부분 커버). 재도입 원하면 후속 칩 추가.
- budget 칩: 데이터 부재로 미도입(4a 규칙 정합).
- stalled predicate: 4a 정의("회신대기+3일 무응답")를 canonical `computePriority.reason==='회신정체'`로 매핑(기존 §quote-screen-sian 칩과 정합). 더 엄격한 직접 술어 필요 시 후속.
- mine: LabAxis 별도 ownerId 부재 → `quote.user`(요청자)로 대체. 담당자 개념 도입 시 재정의.
- 배포: sandbox 편집·검증 → 클로드코드 operator가 build+전체 vitest 게이트+push. sandbox는 build/push 안 함.
- **sandbox vitest 불가**: 마운트된 Windows node_modules에 `@rollup/rollup-linux-x64-gnu` 부재. `npm i`는 공유 node_modules 오염 금지(CLAUDE.md). 대안 = tsc --noEmit 타입체크 + operator vitest.
