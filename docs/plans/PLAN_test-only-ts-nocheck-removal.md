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
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

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

### Phase 2: Type A Bulk Unlock
**Goal:** Type A 분류된 파일 전체 대상 → `@ts-nocheck` 제거 → tsc GREEN 확인 → 20 files/commit 단위로 분할 커밋.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:**
- Type A 후보 파일 전체에서 `@ts-nocheck` 제거
- `tsc --noEmit` 실행 → 에러 발생 파일 식별
- 에러 발생 파일은 Type B/C/D로 재분류 후 rollback

**🟢 GREEN:**
- 최종 clean 파일들 20 files/commit 단위로 분할 커밋
- 각 커밋 후 tsc --noEmit GREEN 유지 확인
- 사장님 로컬 `npm run test` 회귀 0 확인 (Quality Gate)

**🔵 REFACTOR:**
- commit 메시지에 제거 파일 수 명시 (bisect 편의)
- 남은 Type B/C/D 파일 수 갱신

**✋ Quality Gate:**
- [ ] tsc --noEmit baseline 유지
- [ ] `npm run test` pass rate regression 0 (사장님 로컬 — 실행 불가시 명시)
- [ ] 커밋 분할이 20 files/commit 이하
- [ ] bulk unlock 후 잔여 @ts-nocheck 카운트 기록

**Rollback:** 해당 커밋 revert (파일 단위 bisect 가능).

---

### Phase 3: Type B vi.Mocked<T> 교체
**Goal:** Type B 파일들의 `as vi.Mock` → `vi.Mocked<T>` / `vi.mocked(fn)` 교체.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:**
- Type B 파일별 `as vi.Mock` 패턴 식별
- 해당 파일 `@ts-nocheck` 제거 + 패턴 교체 동시 진행
- 각 파일 tsc GREEN + test 실행 pass 확인

**🟢 GREEN:**
- 교체된 파일 개별 커밋 or 작은 batch 커밋
- 사장님 로컬 해당 test 실행 pass 확인

**🔵 REFACTOR:**
- `vi.fn<T>()` / `vi.mocked(fn)` 중 명확한 쪽 선택
- 재사용 가능한 helper가 보이면 notes에 defer 제안 (본 plan 범위 밖)

**✋ Quality Gate:**
- [ ] 각 파일 tsc clean
- [ ] 각 파일 해당 test 실행 pass (사장님 로컬 확인 필요시 명시)
- [ ] 기존 test 로직 불변

**Rollback:** 파일 단위 revert.

---

### Phase 4: Type C/D Individual + Closeout
**Goal:** Type C/D 개별 처리 or defer 문서화 + non-test 2개 별도 tracker 제안 + plan closeout.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:**
- Type C: types 누락 원인 확인, `@types/*` 설치 필요시 본 plan 밖 분리
- Type D: 실 버그 확인, 간단 수정 가능 건만 이번 plan에 포함, 나머지 defer

**🟢 GREEN:**
- defer 파일 리스트 + 이유 plan notes에 기록
- non-test 2개 별도 tracker 신설 제안 (TaskCreate)
- tracker #47 → completed
- `PLAN_test-runner-and-prisma-stabilization.md`의 `94개 파일 @ts-nocheck 제거 — 별도 plan` 체크박스 업데이트

**🔵 REFACTOR:**
- 최종 잔여 @ts-nocheck 카운트 기록
- Phase 0~4 learnings notes 정리
- 다음 P1 진입 경로 제안

**✋ Quality Gate:**
- [ ] defer 파일 리스트 + 이유 기록
- [ ] non-test 2개 별도 tracker 제안 반영
- [ ] tracker #47 completed
- [ ] stabilization plan 체크박스 업데이트
- [ ] 본 plan Status + Last Updated 갱신
- [ ] tsc --noEmit baseline 유지 (or 개선)

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

- Overall completion: 0%
- Current phase: Phase 0 (baseline)
- Current blocker: 없음 — 승인 완료, 실행 준비
- Next validation step: `npx tsc --noEmit` 샌드박스 runnability 확인

**Phase Checklist:**
- [ ] Phase 0 complete
- [ ] Phase 1 complete
- [ ] Phase 2 complete
- [ ] Phase 3 complete
- [ ] Phase 4 complete

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
- (없음 — Phase 0 시작 전)

**Implementation Notes:**
- (채워질 예정)

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

**Phase 1 Probe Report:**
- (채워질 예정 — 사장님 로컬 실행 후)
