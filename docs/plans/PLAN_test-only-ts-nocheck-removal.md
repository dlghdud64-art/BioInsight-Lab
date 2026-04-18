# Implementation Plan: Test-Only @ts-nocheck 잔여 제거

- **Status:** 🔄 In Progress
- **Started:** 2026-04-18
- **Last Updated:** 2026-04-18
- **Estimated Completion:** 2026-04-20

**CRITICAL INSTRUCTIONS**: After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 Run all relevant quality gate validation commands
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date
5. 📝 Document learnings in Notes section
6. ➡️ Only then proceed to the next phase

⛔ DO NOT skip quality gates or proceed with failing checks
⛔ DO NOT modify test assertion/로직 — 타입 안정성 복원만
⛔ DO NOT introduce new @ts-nocheck / @ts-ignore
⛔ DO NOT touch non-test 2개 파일 (Out of Scope, 별도 tracker)

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- HEAD `affe1151` (docs(plans): #48 enum-drift plan closeout)
- 샌드박스 실측 (2026-04-18):
  - 전체 `@ts-nocheck` 파일 = **94**
  - test 파일 = **92** (`**/*.test.ts(x)`, `**/__tests__/**`)
  - non-test 파일 = **2** (Out of Scope)
- tracker `#47 Test-only @ts-nocheck 잔여 제거` Pending

**Secondary References:**
- `PLAN_test-runner-and-prisma-stabilization.md:88` — Out of Scope에 "94개 test 파일의 @ts-nocheck 제거 (별도 plan)" 명시 위임
- `vitest.setup.ts` — canonical test setup
- `apps/web/tsconfig.json` — strict 설정 확인 (Phase 0)
- tracker `#46 Vitest 81 failing tests 원인별 분류 및 우선순위 지정` completed — mock 타입 이슈 상당수 자연 해결 추정
- tracker `#53 ai-pipeline runtime 34개 테스트 require() → import 이관` **in_progress** — 본 plan `apps/web/src/lib/ai-pipeline/**` 36개 cluster와 인접. Phase 0에서 충돌 확인.

**Conflicts Found:**
- 위임 문서는 "94개 test 파일"로 기록 → 실측은 **test 92 + non-test 2**. non-test 2개는 본 plan 범위에서 제외.

**Non-test 2개 (Out of Scope):**
1. `apps/web/src/app/test/compare/page.tsx` (page component)
2. `apps/web/src/lib/ai-pipeline/runtime/core/persistence/types.ts` (runtime type file)

**Chosen Source of Truth:**
- 대상 = **test 92개 파일 only**
- non-test 2개 → Phase 4 closeout에서 별도 tracker 분리 제안

**Environment Reality Check:**
- [ ] `npx tsc --noEmit` 샌드박스 runnable 여부 — Phase 0에서 확인
- [ ] `npm run test` runnable — Phase 2 회귀 검증용
- [x] rg 작동 확인
- [x] git add / commit 가능 확인 (이전 커밋 `affe1151` 성공)

---

## 1. Priority Fit

**Current Priority Category:**
- [x] **P1 immediate**
- [ ] Release blocker
- [ ] Post-release
- [ ] P2 / Deferred

**Why This Priority:**
- `PLAN_test-runner-and-prisma-stabilization.md` P1 목록에 명시 위임
- Batch 10 `soft_enforce → full_enforce` 전에 test suite 타입 안정성 확보가 선행 조건
- #48 closeout 직후이므로 P1 연쇄 완결 흐름에 붙이기 적합
- functional regression 위험 낮음 (test-only) → blocker 적어서 빠른 GREEN 도달

---

## 2. Work Type

- [ ] Feature
- [x] **Bugfix** (@ts-nocheck 뒤에 숨은 실제 타입 에러 발굴)
- [x] **API Slimming** (타입 안정성 복원)
- [ ] Workflow / Ontology Wiring
- [ ] Migration / Rollout
- [ ] Billing / Entitlement
- [ ] Mobile
- [ ] Web
- [ ] Design Consistency

---

## 3. Overview

**Feature Description:**
`apps/web/src/` 하위 test 파일 92개의 `// @ts-nocheck` 주석을 제거하여 test suite 타입 안정성을 복원한다. #43~#48의 선행 작업(Vitest 포팅 완료, Prisma generate 안정화, enum drift 0건 확정)으로 자연 해결된 케이스가 다수로 추정되므로, probe를 통해 에러 유형을 분류한 뒤 유형별 batch로 처리한다.

**Success Criteria:**
- [ ] test 92개 중 타입 클린 가능한 파일에서 `@ts-nocheck` 제거
- [ ] `npx tsc --noEmit` 전체 GREEN (or 명확한 baseline 에러 집합만 남음)
- [ ] `npm run test` 기존 pass rate 유지 또는 개선 (regression 0)
- [ ] defer 된 파일은 개수 + 이유 + 별도 tracker 기록
- [ ] non-test 2개 파일은 별도 tracker로 분리 신설 제안

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] `apps/web/src/app/test/compare/page.tsx` 수정 (non-test, 별도 tracker)
- [ ] `apps/web/src/lib/ai-pipeline/runtime/core/persistence/types.ts` 수정 (non-test, 별도 tracker)
- [ ] test assertion / 로직 변경
- [ ] 새 `@ts-nocheck` / `@ts-ignore` 추가
- [ ] `vitest.config.ts` / `tsconfig.json` strict 옵션 변경
- [ ] 신규 @types/* 패키지 설치 (Phase 1에서 필요성 발견 시 본 plan 범위 밖으로 분리)

**User-Facing Outcome:**
- 개발자(사장님): test 파일 타입 안정성 복원, IDE 타입 힌트 작동, mock 타입 실수 조기 감지
- 엔드 유저: 변화 없음 (test-only 작업)

---

## 4. Product Constraints

**Must Preserve:**
- [x] workbench / queue / rail / dock — 해당 없음 (test-only)
- [x] same-canvas — 해당 없음
- [x] canonical truth — 해당 없음
- [x] invalidation discipline — 해당 없음

**Must Not Introduce:**
- [x] page-per-feature — 해당 없음
- [x] chatbot/assistant reinterpretation — 해당 없음
- [x] **dead button / no-op / placeholder success — N/A (test-only)**
- [x] fake billing/auth shortcut — 해당 없음
- [x] preview overriding actual truth — 해당 없음

**Canonical Truth Boundary:**
- Source of Truth: N/A (test-only)
- Derived Projection: N/A
- Snapshot / Preview: N/A
- Persistence Path: N/A

**UI Surface Plan:**
- [ ] 해당 없음 — test-only 작업

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| Probe → Cluster Unlock → Individual Handling 3단계 접근 | 94개 파일 한 번에 건드리면 bisect 불가, 유형 카탈로그가 있으면 bulk unlock 가능성 조기 파악 | Phase 1에 2h 추가, 총 소요 8~12h 예상 |
| 유형 카탈로그 A/B/C/D 고정 | A=자연 해결, B=vi.Mocked 교체, C=types 누락, D=실 버그 | 4 유형에 들어맞지 않는 edge case는 Type D로 합류 |
| 커밋 granularity = 20 files/commit | bisect / revert 용이 | PR diff 분산, PR 하나에 5~6 커밋 포함 가능 |
| non-test 2개 Out of Scope | scope blur 방지, 각각 타입이 page component/runtime이라 별도 맥락 필요 | 추가 tracker 신설 필요 |
| Type D defer 원칙 | 실 버그 발견 시 본 plan scope blowup 방지 | 잔여 @ts-nocheck 0 목표는 이번 plan에서 달성 안 될 수 있음 |

**Dependencies:**
- Required Before Starting: #48 enum drift closeout (완료 `affe1151`), #46 Vitest 81 failing 분류 (완료)
- External Packages: 새 @types/* 설치 없음 (필요 시 plan 밖으로 분리)
- Existing Routes / Models / Services Touched: 없음 (test 파일만)

**Integration Points:**
- `vitest.setup.ts` — 필요 시 타입만 참고 (수정 없음)
- `tsconfig.json` — 현재 strict 설정 유지 (수정 없음)

**#53 ai-pipeline 충돌 관리:**
- #53이 in_progress이고 본 plan `apps/web/src/lib/ai-pipeline/**` 36개 cluster와 인접
- Phase 0에서 #53 진행 파일 목록 확인
- 충돌 파일은 본 plan에서 일시 defer, #53 완료 후 재진입

---

## 6. Global Test Strategy

Red-Green-Refactor 엄수.

**Test Strategy by Work Type:**
- 타입 변경 only → tsc --noEmit 이 1차 gate
- test assertion 불변 → `npm run test` pass rate regression 0 이 2차 gate
- vi.Mocked<T> 교체 → 해당 test 실행 로컬 pass 확인

**Execution Notes:**
- 샌드박스에서 `tsc --noEmit` 가 runnable 이면 Phase 0부터 CI 역할 대리
- `npm run test` 는 node_modules 준비 / postinstall 의존성 이슈로 샌드박스 불가 가능성 → 사장님 로컬에서 Phase 2, 3 끝날 때 회귀 확인 부탁드림 (본 plan Quality Gate에 명시)
- 실행 불가한 gate는 "실행 불가"로 명시, 추정 통과 금지

---

## 7. Implementation Phases

### Phase 0: Truth Lock + tsc Baseline
**Goal:** 샌드박스에서 `tsc --noEmit` runnability 확인 + baseline 에러 수 확보 + 92개 대상 리스트 확정.
- Status: [ ] Pending | [ ] In Progress | [x] Complete (2026-04-18)
- **주요 발견 3가지:**
  1. **tsc --noEmit 샌드박스 실행 불가** — `apps/web/node_modules/typescript/` 없음. 이건 prisma binary 403과 유사한 샌드박스 제약. Phase 1 probe + Phase 2/3 tsc 검증은 **사장님 로컬 의존**으로 전환.
  2. **strict: true 확정** — `packages/tsconfig/base.json`에 `"strict": true`. @ts-nocheck 제거 시 실제 타입 에러 다수 유발 가능성. probe 결과가 더 중요해짐.
  3. **#53 ai-pipeline 충돌 = 34/36 (94%)** — ai-pipeline 36개 중 34개가 #53 최근 커밋(Batch 2, 3)에서 이미 touch된 파일. **본 plan scope에서 34개 일시 defer**, #53 완료 후 재진입. scope 축소: **92 → 58**.
- **본 plan final scope (58 files):**
  - `lib/ai/**`: 39
  - `__tests__/**`: 6
  - `lib/ontology/**`: 5
  - `lib/budget/**`: 4
  - `lib/security/**`: 2
  - `lib/ai-pipeline/**` (#53 touch 안 된 2개만):
    - `apps/web/src/lib/ai-pipeline/runtime/__tests__/s0-baseline-freeze.test.ts`
    - `apps/web/src/lib/ai-pipeline/runtime/__tests__/s6-soak-exit-gate.test.ts`
- **#53 완료 후 재진입 대상 (34 files, deferred):** ai-pipeline 나머지, 본 plan Phase 4 closeout에서 별도 tracker 신설 제안

**🔴 RED:**
- `npx tsc --noEmit --pretty false 2>&1 | tail -20` 샌드박스 실행 가능 여부
- 현재 clean error 수 baseline 확보
- `apps/web/tsconfig.json` strict 설정 확인
- #53 in_progress 파일과 본 plan cluster 중복 여부 확인

**🟢 GREEN:**
- baseline tsc 상태 기록 (에러 0 or 기존 에러 목록)
- 92개 파일 리스트 (cluster별) 확정 commit
- non-test 2개 별도 목록 기록

**🔵 REFACTOR:**
- Phase 1 probe sample 10개 선정 (cluster별 균등 추출):
  - ai: 3
  - ai-pipeline: 3 (단, #53 충돌 파일 회피)
  - __tests__: 2
  - ontology/budget/security: 각 1

**✋ Quality Gate:**
- [x] `tsc --noEmit` runnable 여부 명시 → **실행 불가 (샌드박스 `apps/web/node_modules/typescript/` 없음)**. 사장님 로컬 의존으로 전환.
- [x] strict 설정 확인 → `packages/tsconfig/base.json: "strict": true`
- [x] 92개 파일 리스트 확정 → **58로 축소** (#53 충돌 34개 defer)
- [x] #53 충돌 파일 식별 → 34/36 ai-pipeline, 본 plan에서 defer
- [x] probe sample 10개 선정 예정 (Phase 1 직전에 cluster별 균등 추출):
  - ai (39 → 3개 sample)
  - __tests__ (6 → 2개 sample)
  - ontology (5 → 1개)
  - budget (4 → 1개)
  - security (2 → 1개)
  - ai-pipeline remaining 2 (s0-baseline-freeze, s6-soak-exit-gate → 각 1개, 총 2개 → 2개)
  - 합계 10개

**Rollback:** 문서만 — 되돌릴 것 없음.

---

### Phase 1: Probe (유형 카탈로그)
**Goal:** sample 10개 `@ts-nocheck` 제거 → tsc 돌려서 에러 유형 4개(A/B/C/D)로 분류 → 전체 92개 분포 추정.
- Status: [ ] Pending | [ ] In Progress | [x] Complete (2026-04-18)
- 사장님 로컬 `probe-ts-nocheck.sh` 실행 결과: A 5, B 3, C 2, D 0. 자세한 수치는 Notes 섹션 Phase 1 Probe Report 참조.
- **Type B root cause 확정:** `tsconfig.json` 에 `vitest/globals` types 선언 없음 (runtime globals: true, tsc만 모름). **Fix:** `apps/web/src/types/vitest-globals.d.ts` 1 파일 추가 (1 line)로 전체 Type B unlock 예상.

**🔴 RED:**
- probe sample 10개 `@ts-nocheck` 한 줄 제거
- `tsc --noEmit` 실행 → 에러 전체 수집
- 파일별 에러 유형 할당

**🟢 GREEN:**
- 유형 카탈로그 완성:
  - **Type A** (에러 0): 자연 해결
  - **Type B** (`as vi.Mock` 타입 이슈): `vi.Mocked<T>` 교체 필요
  - **Type C** (types 누락): `@types/*` 또는 import 누락
  - **Type D** (실 버그): 개별 수정 or defer
- 전체 92개 분포 추정 (e.g. A 60 / B 15 / C 10 / D 7)

**🔵 REFACTOR:**
- probe 파일 중 Type A는 그대로 유지 (Phase 2에서 bulk commit)
- probe 파일 중 Type B/C/D는 rollback (원래 `@ts-nocheck` 복원)

**✋ Quality Gate:**
- [ ] 10개 probe 결과 모두 유형 할당
- [ ] 카탈로그 표 plan notes에 기록
- [ ] Type A 파일은 Phase 2 bulk 대상으로 확정
- [ ] tsc --noEmit 기존 baseline 유지 (probe 파일은 원복 상태)

**Rollback:** probe 파일 `git checkout --` 로 즉시 원복.

---

### Phase 2: d.ts Root Fix + Probe 6 Files Pilot Unlock (2 residual 복원)
**Goal:** Phase 1 probe에서 확정된 **Type B root cause**(vitest globals 미타이핑)를 단일 `d.ts` 파일로 해소하고, **probe 8 files** 중 **6 files**만 clean unlock, **2 files는 Type B-residual로 판정되어 `@ts-nocheck` 복원**.
- Status: [ ] Pending | [ ] In Progress | [x] **Complete (2026-04-18, commit `c86073c3`, 로컬 tsc 검증 baseline 49 유지)**

**중요 learning (Probe 분류 한계):**
- Probe 시점 "Type A" 판정은 **vi cascade 제거 후 다른 type 이슈가 드러나지 않았다는 가정** 하에 성립. 실제로는 2/8 (25%) 파일이 **cascade + 독립 타입 이슈 혼재** (`mockJsonResponse` redeclare 등).
- → **Phase 3 scale-up은 probe 가정에 의존하지 말고 iterative "remove → tsc → auto-restore residuals" 워크플로우 필수.**

**설계 원칙:**
- **최소 diff 원칙**: `tsconfig.json` 미접촉. `@types/*` 기본 자동 포함(`types` 배열 생략 시의 TypeScript 기본)을 보존하기 위해 ambient reference 방식 채택.
- **probe로 확증된 파일만 먼저 unlock**: A 5 + B 3 = 8 files. 나머지 50 files는 Phase 3에서 bulk 확장.
- **single root fix (1 line)로 Type B 전체 해소**: `/// <reference types="vitest/globals" />`.
- `vitest ^3.1.1` 설치 확인됨 → `vitest/globals` 타입 공급자 검증 완료.

**🔴 RED:**
- `apps/web/src/types/vitest-globals.d.ts` 신규 생성 (single line): `/// <reference types="vitest/globals" />`
- probe 확증 파일 8개에서 `// @ts-nocheck` 제거 시도
- 로컬 tsc 검증 → baseline 49 → 81 (+32 errors) 발견
- 2 files (`compare-sessions/routes.test.ts` 24 errors / `work-queue/compare-sync.test.ts` 8 errors) residual 확정

**🟢 GREEN (실제 최종):**
- **Clean unlock 6 files:**
  - `lib/ai/__tests__/app-runtime-signal.test.ts`
  - `lib/ai/__tests__/approval-governance-stress.test.ts`
  - `lib/ai/__tests__/batch13-productization.test.ts`
  - `lib/ontology/contextual-action/__tests__/resolver-support-recovery.test.ts`
  - `lib/budget/__tests__/budget-lifecycle-wiring.test.ts`
  - `lib/security/__tests__/csrf-batch10.test.ts`
- **`@ts-nocheck` 복원 2 files (사유 주석 정확히 갱신):**
  - `__tests__/api/compare-sessions/routes.test.ts` — `// @ts-nocheck — mockJsonResponse 재선언 등 test helper 타입 이슈 (Phase 4 deferred)`
  - `__tests__/api/work-queue/compare-sync.test.ts` — 동일 사유
- 로컬 tsc baseline 49 유지 (0 증가) ✅
- 로컬 `vitest run` 8 files → 137 tests passed (3 files fail = pre-existing CJS `@/lib/db` module resolution, Phase 2와 무관)
- commit `c86073c3` (사장님 로컬 main 푸시 완료, `ba3a766e` 문서 갱신 포함)

**🔵 REFACTOR:**
- 잔여 @ts-nocheck: 58 → 52 (clean 6 제거; 2 residual은 Phase 4 defer)
- residual 2 files는 `mockJsonResponse` const 재선언 + TS 중복 선언 에러 → Phase 4 helper type 정리 or 개별 `as any` 적용으로 해결 가능

**✋ Quality Gate:**
- [x] `apps/web/src/types/vitest-globals.d.ts` 신규 생성, 단 1 line
- [x] `tsconfig.json` **미접촉** (Out of Scope 준수)
- [x] 6 files clean 제거, 2 files `@ts-nocheck` 복원 + Phase 4 defer 표시
- [x] 로컬 tsc baseline 49 유지 (Phase 1 이전 대비 0 증가)
- [x] 로컬 `vitest run` 137 tests pass (3 pre-existing fail은 Phase 2 무관)
- [x] commit 2개 (`c86073c3` feat + `ba3a766e` docs), main 푸시 완료

**Rollback:** `c86073c3` + `ba3a766e` 2개 commit revert.
- d.ts 포함이므로 Type B 3개가 다시 깨지는 점 유의 → 단일 unit으로 처리

---

### Phase 3: 나머지 50 Files Iterative Auto-Remediation
**Goal:** Phase 2 learning(Type B-residual 25% 비율) 반영 → **"bulk remove → tsc → auto-restore residuals"** 자동화 스크립트로 50 files 처리. probe 가정에 의존하지 않고 tsc 에러 0 파일만 clean unlock.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**Phase 2 learning 반영 설계:**
- Phase 2에서 2/8 (25%) residual 비율 관측 → 50 files 투영 시 **12~13 files residual 예상**
- probe 분류에 추가 의존하지 않음. **tsc 실측만이 ground truth**
- 샌드박스 tsc 불가 → 사장님 로컬 스크립트 `phase3-scale-up.sh` 1회 실행으로 처리

**50 files 구성 (cluster별):**
- `lib/ai/**`: 39 → 36 (probe 3 제외)
- `lib/ontology/**`: 5 → 4 (probe 1 제외)
- `lib/budget/**`: 4 → 3 (probe 1 제외)
- `lib/security/**`: 2 → 1 (probe 1 제외)
- `lib/ai-pipeline/**` (#53 non-conflict 2): 2 → 2 (probe 제외 없음 → Type C 예상이므로 Phase 4로 분리)
- `__tests__/api/**` 나머지: 4 (probe 2 제외)

→ 본 phase 실질 대상: **50 - 2 (ai-pipeline s0/s6 Phase 4 이관) = 48 files**

**🔴 RED (자동화 스크립트):**
- `phase3-scale-up.sh` (workspace export):
  1. 대상 48 files 리스트 하드코딩
  2. `sed`로 48 files 전체 `@ts-nocheck` 제거
  3. `cd apps/web && npx tsc --noEmit --pretty false > /tmp/phase3-tsc.log`
  4. grep으로 에러 나는 파일 추출 = residual 후보
  5. residual 후보 파일만 `@ts-nocheck` 복원 (사유 주석: `// @ts-nocheck — Phase 3 tsc residual, Phase 4 deferred`)
  6. `git diff --stat` 로 최종 제거 파일 수 출력
  7. (optional) 자동 commit 생성 or 사장님 수동 commit 대기

**🟢 GREEN:**
- 스크립트 실행 후 tsc baseline = 49 (Phase 2 최종치)와 동일 유지
- clean unlock 파일 수 = (48 - residual 수)
- cluster별 분포를 commit message에 기록
- 30 files/commit 단위로 분할 (bisect 편의) — 스크립트는 stage만, commit은 사장님이 cluster별 batch로
- 로컬 `vitest run` 해당 cluster 회귀 0 확인

**🔵 REFACTOR:**
- residual 파일 리스트 + 에러 건수를 Phase 4로 이관
- 잔여 @ts-nocheck 카운트 갱신: 52 → (52 - clean count)
- 본 plan notes에 실측 residual 비율 기록 (probe 가설 검증 결과)

**✋ Quality Gate:**
- [ ] `phase3-scale-up.sh` workspace export 완료
- [ ] 로컬 스크립트 실행 성공 (non-zero exit 시 stop)
- [ ] 스크립트 실행 후 tsc baseline 49 유지 (이탈 시 즉시 rollback)
- [ ] residual 파일 모두 `@ts-nocheck` 복원 + 사유 주석 정확
- [ ] clean commit 30 files/batch 이하, cluster 분포 기록
- [ ] 로컬 `vitest run` 해당 batch 회귀 0 (pre-existing fail은 Phase 2와 동일하게 무관 처리)

**Rollback:** batch commit 단위 revert.
- 스크립트 실행 도중 예외 → 변경된 파일 `git checkout -- apps/web/src/**` 로 일괄 원복 후 스크립트 수정

---

### Phase 4: Residual Hybrid 처리 + Closeout
**Goal:** Pattern-level quick win (4a/4b) + 큰 덩어리 tracker 이관 (4c/4d) + non-test 2개 tracker 제안 + plan closeout.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**Residual Error Pattern 분류 (Phase 3 종료 시점, 2026-04-19):**

| Pattern | 파일 | 에러 수 | 원인 | 처리 |
| :--- | :--- | ---: | :--- | :--- |
| **A. `mockJsonResponse` 재선언** | compare-sessions/routes.test.ts (24)<br>work-queue/compare-sync.test.ts (8) | 32 | `vi.mock` factory 내부 + 모듈 상단 중복 선언 | **4a** helper 추출 |
| **B. `vi.Mock` type-as-value 오용** | lib/api/products.test.ts (9)<br>lib/ai/openai.test.ts (2) | 11 | `(fn as vi.Mock).method()` — `vi.Mock` 은 타입 | **4b** `vi.mocked()` 치환 |
| **C-defer. product-acceptance-e2e** | lib/ai/__tests__/product-acceptance-e2e.test.ts | 67 | engine API 재설계 후 fixture 미동기화 | **4c** tracker #50 재사용 |
| **C-individual. ai engine + button** | fire-approval(1) / governance-batch2(2) / operational-readiness(1) / stock-release(3) / button.test.tsx(3) | 10 | ai engine 타입 drift + button 별도 | **4d** 신규 tracker #63 |
| **E. Phase 0 선제 defer (Type C)** | s0-baseline-freeze.test.ts (1)<br>s6-soak-exit-gate.test.ts (2) | 3 | TS2554 arg count / TS2345 SoakRunContext | **4e** tracker #63 통합 |

---

#### Phase 4a: `mockJsonResponse` Helper 추출 (Pattern A, 2 files, 32 err)

**🔴 RED:**
- 신규 helper 파일 `apps/web/src/__tests__/helpers/response-mock.ts` 미존재 확인
- 2개 파일에서 `mockJsonResponse` 재선언 라인 식별 (각 파일 8~10행)

**🟢 GREEN:**
- `__tests__/helpers/response-mock.ts` 생성:
  ```ts
  import type { NextResponse } from "next/server";

  export interface MockJsonResponse<T> {
    status: number;
    json: () => Promise<T>;
  }

  export const mockJsonResponse = <T>(
    data: T,
    init?: { status?: number }
  ): MockJsonResponse<T> => ({
    status: init?.status ?? 200,
    json: async () => data,
  });
  ```
- `compare-sessions/routes.test.ts` / `work-queue/compare-sync.test.ts`:
  - 모듈 상단 `const mockJsonResponse = ...` 제거
  - `vi.mock("next/server", ...)` / `vi.mock("@/lib/api-error-handler", ...)` factory에서 import 대신 inline helper 사용 (vi.mock 은 hoisting으로 top-level import 허용 불가 → factory 내부 closure 유지)
  - **핵심 제약:** vi.mock factory는 import 금지 → helper import는 모듈 상단에 두고, factory는 factory-local 재선언 없이 바로 참조
- `@ts-nocheck` 제거
- `npx tsc --noEmit` → baseline 49 유지 확인

**🔵 REFACTOR:**
- 두 파일 간 중복된 `vi.mock("next/server", ...)` 보일러플레이트 일관성 확인
- helper 파일에 JSDoc 1줄 추가 (사용처 명시)

**✋ Quality Gate:**
- [ ] helper 파일 생성 + export 정상
- [ ] 2개 파일 `@ts-nocheck` 제거
- [ ] tsc --noEmit 실행 결과 baseline 49 유지 (±0)
- [ ] vitest run 해당 2개 파일 pass (pre-existing CJS 이슈와 별개)
- [ ] ESM import/vi.mock hoisting 충돌 없음

**Rollback:** 해당 커밋 revert (helper 파일 + 2개 edit). 1커밋.

---

#### Phase 4b: `vi.mocked()` 치환 (Pattern B, 2 files, 11 err)

**🔴 RED:**
- `products.test.ts` 7 sites, `openai.test.ts` 2 sites 확인 (`grep -c "as vi\\.Mock"`)

**🟢 GREEN:**
- sed 치환: `(X as vi.Mock).method(...)` → `vi.mocked(X).method(...)`
  - products.test.ts: `(db.product.findMany as vi.Mock)` 등 7 sites
  - openai.test.ts: `(fetch as vi.Mock)` 2 sites
- `@ts-nocheck` 제거
- `npx tsc --noEmit` → baseline 49 유지 확인

**🔵 REFACTOR:**
- `vi.mocked()` 첫 인자 타입이 추론되는지 수동 확인 (TS2339 없음)
- 필요시 `vi.mocked(fetch as typeof fetch)` 로 좁힘 (최소한 적용)

**✋ Quality Gate:**
- [ ] 2개 파일 `@ts-nocheck` 제거
- [ ] tsc --noEmit baseline 49 유지
- [ ] vitest run 해당 2개 파일 pass
- [ ] `as vi.Mock` 잔재 0 grep 확인

**Rollback:** 해당 커밋 revert. 1커밋.

---

#### Phase 4c: `product-acceptance-e2e.test.ts` → tracker #50 이관 (Pattern C-defer)

**🔴 RED:**
- 기존 tracker `#50 [pending] product-acceptance-e2e.test.ts 전체 rewrite (engine 실 API 동기화)` 존재 확인

**🟢 GREEN:**
- `@ts-nocheck` 코멘트 갱신:
  `// @ts-nocheck — tracker #50에서 전체 rewrite 예정 (engine 실 API 동기화, 67 errors)`
- 코드 수정 없음 — 상태 유지, 추적 경로만 명시

**🔵 REFACTOR:**
- 없음

**✋ Quality Gate:**
- [ ] tracker #50 description에 "product-acceptance-e2e.test.ts 67 errors 흡수" 명시 확인
- [ ] `@ts-nocheck` 코멘트 tracker #50 참조로 교체
- [ ] tsc 영향 없음 (동일 상태)

**Rollback:** 코멘트 1줄 revert.

---

#### Phase 4d: 신규 tracker #63 + @ts-nocheck 코멘트 일괄 갱신 (5 files, 10 err)

**🔴 RED:**
- 5 residual 파일 목록 확정:
  - lib/ai/__tests__/fire-approval-and-permission-scenarios.test.ts (1)
  - lib/ai/__tests__/governance-batch2-e2e.test.ts (2)
  - lib/ai/__tests__/operational-readiness.test.ts (1)
  - lib/ai/__tests__/stock-release-governance.test.ts (3)
  - __tests__/components/ui/button.test.tsx (3)

**🟢 GREEN:**
- `TaskCreate` → **tracker #63 `#47-residual: ai engine fixture 타입 drift 개별 정리`** (P2)
- 각 파일 `@ts-nocheck` 코멘트 갱신:
  `// @ts-nocheck — tracker #63에서 개별 정리 예정 (ai engine 타입 drift)`
- s0/s6 (Phase 0 선제 defer 2 files) 코멘트도 tracker #63 참조로 통합:
  `// @ts-nocheck — tracker #63 통합 (TS2554 arg count / TS2345 SoakRunContext drift)`

**🔵 REFACTOR:**
- 없음

**✋ Quality Gate:**
- [ ] tracker #63 created
- [ ] 7 파일 (5 + s0/s6 2) 코멘트 갱신
- [ ] tsc 영향 없음

**Rollback:** 커밋 revert (코멘트만). tracker #63은 유지 (유효한 P2).

---

#### Phase 4e: Closeout (plan + tracker 최종 정리)

**🔴 RED:**
- non-test 2 files (`app/test/compare/page.tsx`, `lib/ai-pipeline/runtime/core/persistence/types.ts`) 별도 tracker 필요성 판단
- #53 ai-pipeline 34 files tracker 필요성 (sibling plan 존재 여부 확인)

**🟢 GREEN:**
- non-test 2 files: 필요시 별도 tracker 제안 (또는 Out of Scope 확정 기록)
- #53 완료 시점에 별도 tracker 신설 지침 notes에 기록
- tracker #47 → completed
- `PLAN_test-runner-and-prisma-stabilization.md`의 `94개 파일 @ts-nocheck 제거 — 별도 plan` 체크박스 업데이트
- 본 plan Status → Complete, Last Updated 갱신

**🔵 REFACTOR:**
- Phase 0~4 learnings notes 정리
- 다음 P1 진입 경로 제안 (Batch 10 soft_enforce)

**✋ Quality Gate:**
- [ ] tracker #47 completed
- [ ] tracker #63 pending (#47-residual)
- [ ] tracker #50 설명 갱신 (product-acceptance-e2e 67 err 흡수)
- [ ] stabilization plan 체크박스 갱신
- [ ] 본 plan Status + Last Updated 갱신

**Rollback:** 문서만 — 되돌릴 것 없음.

---

## 8. Optional Addenda

### A. Workflow / Ontology Addendum
해당 없음 (workflow surface 미접촉)

### B. Billing / Entitlement Addendum
해당 없음

### C. API Slimming Addendum (부분 적용)
**Waste Type:** Type Safety Erosion — `@ts-nocheck` 가 타입 안정성 우회 수단으로 쌓였음
**Minimal Diff Fix:** 주석 한 줄 제거 > (필요시) `vi.Mocked<T>` 교체 > (거의 없음) types import 추가

### D. Mobile Addendum
해당 없음

### E. Migration / Rollout Addendum
해당 없음 — type-only 변경, 배포 영향 0

---

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 샌드박스에서 `tsc --noEmit` 실행 불가 | Med | High | Phase 0 확인, 불가시 사장님 로컬 의존 + 샌드박스는 정적 검사만 |
| Type D (실 버그)가 다수 발견되어 scope blowup | Low | Med | defer 원칙 엄수, 별도 tracker 분리, plan scope 고정 |
| #53 ai-pipeline in_progress와 충돌 | Med | Med | Phase 0에서 #53 파일 목록 확인, 충돌 파일은 본 plan에서 일시 defer |
| 일부 파일이 Jest → Vitest 포팅 잔재로 다른 에러 produce | Low | Low | Phase 1 probe에서 조기 발견, Type B/D로 분류 |
| 20 files/commit 기준이 PR 리뷰 부담 | Low | Low | 커밋 분할 granularity는 유지, PR은 한 번에 묶음 |
| @types/* 설치 필요가 다수 발견 | Low | Med | 발견시 본 plan 밖 분리 (별도 tracker) |

**Risk Categories:** Type Safety / Test Infrastructure / Contract Drift.

---

## 10. Rollback Strategy

- If Phase 0 Fails: tsc runnability 불가시 사장님 로컬 전환, baseline만 문서로 확보
- If Phase 1 Fails: probe sample 파일 git checkout 즉시 원복
- If Phase 2 Fails: bulk commit 단위 revert (파일 20개 단위라 bisect 가능)
- If Phase 3 Fails: 파일별 revert
- If Phase 4 Fails: 문서만 변경 — 되돌릴 것 없음

**Special Cases:** test 파일만 수정이라 production 영향 0, Batch 10 full_enforce 이후에도 rollback 가능.

---

## 11. Progress Tracking

- Overall completion: 85% (Phase 0~3 완료 + Phase 4 설계 확정, 46 clean / 58 test scope)
- Current phase: Phase 4 Hybrid (4a helper 추출 → 4b vi.mocked 치환 → 4c/4d tracker 이관 → 4e closeout)
- Current blocker: 없음
- Next validation step: 4a 실행 (helper 파일 생성 + 2 files 제거), 로컬 tsc baseline 49 유지 확인

**Phase Checklist:**
- [x] Phase 0 complete (2026-04-18)
- [x] Phase 1 complete (2026-04-18)
- [x] Phase 2 complete (2026-04-18, commit `c86073c3`+`ba3a766e`, 로컬 tsc baseline 49 유지)
- [x] Phase 3 complete (2026-04-18, commits `6ebac5a0`+`379f717d`+`99a674ab`+`3852f50a`, 40/48 clean, residual 16.7%, tsc baseline 49 유지)
- [ ] Phase 4 complete (Hybrid: 4a / 4b / 4c / 4d / 4e)

**잔여 @ts-nocheck 현재 카운트:**
- 시작: 94 (test 92 + non-test 2)
- Phase 2 후: 86 (clean 6 제거, 2 residual 복원)
- Phase 3 후: 46 (clean 40 추가 제거, 8 residual 복원) ← **현 상태**
- Phase 4 4a+4b 완료 시: 42 (clean 4 추가 = helper 2 + vi.mocked 2)
- 최종 closeout 시 남는 @ts-nocheck: **12 files** (tracker 명시됨)
  - tracker #50: 1 file (product-acceptance-e2e, 67 err)
  - tracker #63 (신규): 7 files (ai 5 + button 1 + s0/s6 2 → 10 + 3 err)
  - #53 ai-pipeline: 34 files (#53 완료 후 별도 tracker)
  - non-test Out of Scope: 2 files (별도 tracker 필요성 판단)
  - → **#47 test scope (58) 기준 최종 clean 비율: 46/58 = 79.3% (4a+4b 후 50/58 = 86.2%)**

---

## 12. Notes & Learnings

**Pre-Planning Measurement (2026-04-18, sandbox):**
```
전체 @ts-nocheck 파일 수: 94
test 파일: 92 (lib/ai 39, lib/ai-pipeline 36, __tests__ 6, lib/ontology 5, lib/budget 4, lib/security 2)
non-test 파일: 2 (Out of Scope)
  - apps/web/src/app/test/compare/page.tsx
  - apps/web/src/lib/ai-pipeline/runtime/core/persistence/types.ts
as jest.Mock 잔재: 0 파일 (Vitest 포팅 완료)
as vi.Mock 잔재: 2 파일만 (blast radius 매우 작음)
```

**@ts-nocheck 주석에 명시된 이유 샘플:**
- "vitest/prisma schema drift, 임시 우회" — #48 완료로 자연 해결 가능성 큼
- "vitest/jest 미설치 환경에서 타입 체크 bypass" — 환경 문제, 지금은 vitest 설치됨 (#44 완료)
- "jest mock setup and type mismatches" — 포팅 잔여물
- "jest mocking creates type mismatches; db is mocked with never type" — mock 타입 문제
- "node types (@types/node) not available" — types 문제

**예상 유형 분포 (probe 전 가설, Phase 1에서 실측):**
- Type A (자연 해결): 60~70%
- Type B (`vi.Mocked<T>` 교체): 5~15%
- Type C (types 누락): 5~10%
- Type D (실 버그): 5~10%

**Blockers Encountered:**
- [2026-04-18] 샌드박스 tsc 실행 불가 → 사장님 로컬 probe 스크립트로 대체. Phase 1 완료.
- [2026-04-18] #53 ai-pipeline in_progress 파일과 34/36 중복 → 본 plan scope 축소 92 → 58. 34 파일 별도 tracker 제안.
- [2026-04-18] Phase 2 `git am` 실패 (CRLF 인코딩) → 사장님 로컬 수동 재구성.
- [2026-04-18] **Phase 2 residual 2/8 (25%) 발견** — `compare-sessions/routes.test.ts` (24 errors) / `work-queue/compare-sync.test.ts` (8 errors). probe 당시 "Type A"로 분류됐으나 실측에서 `mockJsonResponse` 재선언 등 독립 type 이슈 확인 → `@ts-nocheck` 복원 + Phase 4 defer.
- [2026-04-18] **Phase 3 iterative remediation 실행** — 48 files 대상, 40 clean / 8 residual (16.7%). tsc baseline 49 → 49 불변. 4 cluster 커밋 `6ebac5a0`+`379f717d`+`99a674ab`+`3852f50a`. product-acceptance-e2e.test.ts 단일 파일이 residual 88 err의 76% (67 err) 점유.
- [2026-04-19] **Phase 4 Hybrid 설계 확정** — Pattern A(mockJsonResponse)/B(vi.Mock)는 quick win fix, Pattern C 대덩어리(product-acceptance-e2e 67 err)는 tracker #50 재사용, Pattern C 잔여(10 err)+Phase 0 defer(s0/s6 3 err)는 신규 tracker #63으로 통합 defer.

**Implementation Notes:**
- Phase 1 probe (10 files) 결과: A 5 / B 3 / C 2 / D 0. Type B 346 에러가 단일 원인(vitest globals 미타이핑)에서 나옴 → single `.d.ts` (1 line) root fix로 일괄 해소 가능 판정.
- Phase 2 실행 결과: d.ts 신규 + 8 files 중 6 clean / 2 residual. 로컬 tsc baseline 49 유지 달성. Vitest: 137 tests pass, 3 files fail = pre-existing CJS `@/lib/db` module resolution (Phase 2 무관).
- **Probe 분류 한계 learning:** vi cascade 제거 후 드러나는 독립 type 이슈가 존재. Phase 3는 probe 의존하지 않고 `remove → tsc → auto-restore` iterative 접근 채택.
- Phase 3 자동화 스크립트 `phase3-scale-up.sh` workspace export 완료. 48 files 대상 (ai 36 + __tests__ 4 + ontology 4 + budget 3 + security 1).
- **Phase 3 실행 결과:** 40 clean / 8 residual (16.7%, 예상 25%보다 양호). residual 8 files 중 product-acceptance-e2e 하나가 88 err 중 67 err(76%) 점유.
- **Phase 4 Pattern 분류 (grep -c "as vi\\.Mock" 근거):**
  - products.test.ts 7 sites + openai.test.ts 2 sites → Pattern B 확정 (9/11 err 일치)
  - compare-sessions + compare-sync 2개 파일만 `mockJsonResponse` 사용 → Pattern A 확정
  - 나머지 5 ai engine/button 파일은 별도 fixture drift → Pattern C-individual
- **Phase 4a helper 추출 제약:** `vi.mock(...)` factory는 hoisting 되어 factory 내부 import 금지. helper import는 모듈 상단(ESM import)에서만 가능. factory는 helper 참조만 가능 (재선언 없이).

**Phase 1 Probe Sample 10개 (2026-04-18 확정):**
```
ai (3):
  apps/web/src/lib/ai/__tests__/app-runtime-signal.test.ts
  apps/web/src/lib/ai/__tests__/approval-governance-stress.test.ts
  apps/web/src/lib/ai/__tests__/batch13-productization.test.ts

__tests__ (2):
  apps/web/src/__tests__/api/compare-sessions/routes.test.ts
  apps/web/src/__tests__/api/work-queue/compare-sync.test.ts

ontology (1):
  apps/web/src/lib/ontology/contextual-action/__tests__/resolver-support-recovery.test.ts

budget (1):
  apps/web/src/lib/budget/__tests__/budget-lifecycle-wiring.test.ts

security (1):
  apps/web/src/lib/security/__tests__/csrf-batch10.test.ts

ai-pipeline remaining (2):
  apps/web/src/lib/ai-pipeline/runtime/__tests__/s0-baseline-freeze.test.ts
  apps/web/src/lib/ai-pipeline/runtime/__tests__/s6-soak-exit-gate.test.ts
```

**Phase 1 사장님 로컬 실행 스크립트:** `probe-ts-nocheck.sh` (workspace에 제공)
- 10개 파일 `@ts-nocheck` 한 줄 제거 → `npx tsc --noEmit` → 에러 로그 수집 → 즉시 `git checkout --` 원복
- output → 제가 유형 분류 (A/B/C/D) → Phase 2/3/4 구체화

**Phase 1 Probe Report (2026-04-18, 사장님 로컬):**
```
# 파일                                             에러 분류
1 app-runtime-signal.test.ts                       0    A
2 approval-governance-stress.test.ts               0    A
3 batch13-productization.test.ts                   0    A
4 compare-sessions/routes.test.ts                  157  B (vi/types 미인식)
5 work-queue/compare-sync.test.ts                  54   B (vi/types 미인식)
6 resolver-support-recovery.test.ts                0    A
7 budget-lifecycle-wiring.test.ts                  0    A
8 csrf-batch10.test.ts                             135  B (describe/it/expect globals)
9 s0-baseline-freeze.test.ts                       1    C (TS2554 인자 수)
10 s6-soak-exit-gate.test.ts                       2    C (TS2345 SoakRunContext)
```
- Type A: 5/10 (50%)
- Type B: 3/10 (30%) — **346 에러 대부분이 cascade, single root cause**
- Type C: 2/10 (20%) — 실 시그니처 drift
- Type D: 0/10
- probe 외 apps/web 전체 baseline 에러 = 2725 lines (B cascade 포함)

**Type B Root Cause 확정 (2026-04-18, sandbox):**
- `apps/web/vitest.config.ts` → `test.globals: true` 설정되어 런타임 inject는 O
- `apps/web/tsconfig.json` → `"types": ["vitest/globals"]` **선언 없음** → tsc만 globals 인식 못 함
- `vitest ^3.1.1` → vitest 패키지 자체에 globals types 포함 (`vitest/globals` reference 가능)
- **Minimal Diff Fix:** `apps/web/src/types/vitest-globals.d.ts` 신규 파일 1개에 `/// <reference types="vitest/globals" />` 추가. tsconfig.json 미접촉 (Out of Scope 준수).

**전체 58 files 유형 분포 추정 (probe 10개 × 5.8배 스케일):**
- Type A ≈ 29 files (바로 제거 가능)
- Type B ≈ 17 files (d.ts 1 fix로 일괄 해결)
- Type C ≈ 12 files (개별 handling, s0/s6 패턴)
- Type D ≈ 0 files
