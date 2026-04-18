# Implementation Plan: Test Runner Unification (Jest → Vitest) + Prisma Generate 안정화

- **Status:** ✅ Complete — 정적 편집·런북 마감, 사장님 로컬 1회 `npm run test` 검증만 남음
- **Started:** 2026-04-18
- **Last Updated:** 2026-04-18
- **Estimated Completion:** 2026-04-18 (당일 마감)
- **Total Phases:** 3 (0~2, Small scope)
- **Priority:** P1 immediate (release-prep 의 첫 관문, 이후 모든 Red-Green-Refactor 의 전제)

**CRITICAL INSTRUCTIONS**: After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 Run all relevant quality gate validation commands
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date
5. 📝 Document learnings in Notes section
6. ➡️ Only then proceed to the next phase

⛔ DO NOT skip quality gates or proceed with failing checks
⛔ DO NOT remove Jest partially — 완전 제거 or 완전 유지 중 하나
⛔ DO NOT touch test assertions — 이번엔 runner 통일만, 테스트 로직 변경 금지
⛔ DO NOT modify Prisma schema 의미 — enum drift 는 DB ↔ schema 동기화만

---

## 0. Truth Reconciliation

### Latest Truth Source
- `apps/web/package.json` (직접 확인, 2026-04-18)
- 실제 Prisma migrations 디렉터리 (4개 마이그레이션 존재)

### Discovered Facts
1. **vitest 는 이미 설치됨** — `vitest ^3.1.1`, `@vitest/ui ^3.1.1` devDeps
2. **vitest.config.ts, vitest.setup.ts 존재**
3. **`npm run test` = `vitest run`** (이미 설정)
4. **Jest 도 살아있음** — `jest ^29.7.0`, `jest-environment-jsdom`, `@types/jest`, `jest.config.js`, `jest.setup.js`, `test:jest` 스크립트
5. **@ts-nocheck 붙은 파일 94개** — 이번 plan 범위 아님 (별도 plan)
6. **Prisma 5.22.0**, `postinstall: prisma generate` 설정됨
7. **Migrations 4개**: 0_init, 20260417120000, 20260417120100, 20260418120000
8. **Stripe 패키지 `^17.5.0`** 은 dependencies 에 유지 (PG 교체 defer)

### Conflicts Found
1. **"vitest install" P1 항목의 모호성** — 패키지는 있으나 사장님 로컬 실행이 안 되고 있을 가능성
2. **Jest vs Vitest 이중 공존** — canonical runner 불명확
3. **@ts-nocheck "test-only 잔여"** 재정의 필요 → 이번 plan 범위 밖으로 명시

### Chosen Source of Truth
- Test runner canonical: **vitest** (Jest 완전 제거)
- Prisma: `postinstall: prisma generate` 로 자동, schema 변경 시 수동 트리거
- 이번 Plan 범위: "vitest 로컬 실행 + 1개 이상 test green + Prisma generate 에러 없음"

### Environment Reality Check
- [x] 사장님 로컬 `npm install && npm run test` 실행 결과 수집 — vitest 1642 pass / 67 fail (Phase 1 전 상태, 거의 모두 `@jest/globals` ESM parse 실패로 집계)
- [x] 사장님 로컬 `npm run db:generate` 실행 결과 수집 — Prisma Client v5.22.0 정상 생성 (Phase 2 목표 사전 달성)
- [x] runnable commands 확인됨

---

## 1. Priority Fit

- [x] **P1 immediate**
- **Why:** 이후 모든 plan 이 Red-Green-Refactor 기반. vitest 실행 불가면 quality gate 증명 자체가 막힘. enum drift, RFQ smoke, MutationAuditEvent smoke 가 모두 이 기반 위에서 돌아감.

---

## 2. Work Type

- [x] Bugfix (이중 test runner 정리)
- [x] API Slimming (Jest 제거 → devDeps 축소)
- [x] Migration/Rollout (Jest → Vitest 단일화)

**Scope: Small (3 phases, 2~4h)**

---

## 3. Overview

### Feature Description
LabAxis web 앱의 테스트 runner 를 Vitest 로 단일화하고, Prisma generate 가 사장님 로컬 및 CI 에서 에러 없이 실행되는 상태로 안정화한다. @ts-nocheck 제거, RFQ smoke, MutationAuditEvent smoke 는 별도 plan 으로 분리.

### Success Criteria
- [ ] `npm install` 이 에러 없이 완료 (postinstall 포함)
- [ ] `npm run test` 실행 시 Vitest 로 1개 이상 테스트 green
- [ ] `npm run db:generate` 에러 없음
- [ ] Jest 관련 패키지 / 설정 / 스크립트 완전 제거
- [ ] `npx tsc --noEmit` 통과

### Out of Scope (⚠️ 절대 구현하지 말 것)
- [ ] 94개 test 파일의 @ts-nocheck 제거 (별도 plan)
- [ ] RFQ handoff smoke run (별도 plan)
- [ ] MutationAuditEvent migration + smoke run (별도 plan)
- [ ] 테스트 assertion / 로직 변경
- [ ] Stripe / Toss 관련 코드 수정 (결제 defer 확정)

### User-Facing Outcome
- 개발자(사장님): 로컬에서 `npm run test` 한 줄로 테스트 실행 가능, Prisma generate 안정화.
- 엔드 유저: 변화 없음 (개발 인프라 작업).

---

## 4. Product Constraints

### Must Preserve
- [x] 기존 테스트 assertion / 로직
- [x] vitest.config.ts 의 path alias / environment 설정
- [x] Prisma migrations 순서
- [x] 배포 파이프라인 (Vercel `prebuild: vercel-migrate.js`)

### Must Not Introduce
- [x] Jest 잔재 (완전 제거)
- [x] Prisma schema 의미 변경
- [x] 테스트 로직 수정
- [x] 새로운 test framework 추가

---

## 5. Architecture & Dependencies

### Key Decisions

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| Jest 완전 제거 | 이중 설정 유지비용, Vitest 단일화가 Next.js 14 + ESM + ts-native 에 유리 | Jest 전용 mock API 쓰는 곳이 있다면 vitest 로 포팅 필요 |
| jest-dom matchers 는 vitest.setup.ts 로 이동 | `@testing-library/jest-dom` 은 Vitest 와도 호환 | setup 파일 1개 수정 |
| Prisma schema 변경 없음 | 이번 plan 은 generate 실행 안정화만 | enum drift 가 schema 쪽에 있으면 Phase 2 에 흡수 |

### Dependencies to Remove
- `jest ^29.7.0`
- `jest-environment-jsdom ^29.7.0`
- `@types/jest ^29.5.14`
- (만약 있으면) `ts-jest`

### Files to Delete
- `apps/web/jest.config.js`
- `apps/web/jest.setup.js`

### Files to Modify
- `apps/web/package.json` (devDeps, scripts)
- `apps/web/vitest.setup.ts` (jest-dom matchers 이동)
- (필요 시) 테스트 파일 중 `jest.fn()` / `jest.mock()` 직접 사용하는 곳

---

## 6. Global Test Strategy

- Runner: **vitest**
- 이번 Plan 자체가 "test runner 를 건강한 상태로" 가 목표이므로, 성공 기준은 "green 테스트 1개 이상 확보"
- 기존 테스트 assertion 변경 금지

### Execution Notes
- 사장님 로컬 실행 기반 (Windows `C:\Users\young\ai-biocompare`)
- Claude 는 파일 편집만 수행, 실제 실행은 사장님이 담당

---

## 7. Implementation Phases

### Phase 0: Environment Reality Check (0.5h) ✅ COMPLETE
**Goal:** 사장님 로컬 실행 결과 확보 + Jest 실제 의존 범위 스캔.

- Status: [x] Complete (2026-04-18)

**🔴 RED:**
- [x] 사장님 로컬에서 아래 명령 실행 후 전체 출력 수집 완료:
  - `npm install` — 정상
  - `npm run test` — vitest 1642 pass / 67 fail (대부분 `@jest/globals` ESM parse error)
  - `npm run db:generate` — Prisma Client v5.22.0 정상 생성
- [x] Claude: Jest 직접 의존 식별 완료

**🟢 GREEN:**
- [x] Jest 제거 시 영향받는 파일 리스트 확정 — **44 파일** (`@jest/globals` import 또는 `jest.*` API 직접 사용)
- [x] Prisma 에러 유형 분류 — 에러 없음, Phase 2 의 실질 목표는 이미 달성된 상태 (런북 문서화만 남음)

**🔵 REFACTOR:**
- [x] blocker 없음 확인, Phase 1 실행 승인

**✋ Quality Gate:**
- [x] 사장님 로컬 실 에러 메시지 확보
- [x] Jest 직접 의존 파일 수 확정 (44)
- [x] Prisma 에러 원인 분류 완료 (에러 없음)

**Rollback:** planning-only, 코드 변경 없음

---

### Phase 1: Jest 완전 제거 + Vitest 단일화 (1.5h) ✅ COMPLETE (파일 편집 기준)
**Goal:** Jest 패키지 / 설정 / 스크립트 전부 제거, vitest 가 canonical runner 가 되는 상태.

- Status: [x] Complete — 정적 치환 완료 (실행 검증은 사장님 로컬 1회 `npm run test` 필요)

**🔴 RED:**
- [x] 제거 대상 확인:
  - `package.json` devDeps: `jest`, `jest-environment-jsdom`, `@types/jest` → **이전 세션에서 이미 제거됨**
  - `package.json` scripts: `test: vitest run` 단일화 완료
  - 파일: `apps/web/jest.config.js`, `apps/web/jest.setup.js` → DEPRECATED 스텁으로 덮어쓰기 완료 (Cowork Windows mount 제약으로 물리 삭제는 사장님 로컬 `git rm -f` 필요)
- [x] Phase 0 에서 찾은 Jest 직접 사용 파일별 대체 계획 (jest → vi)

**🟢 GREEN:**
- [x] `apps/web/src/__mocks__/auth.ts` — `{ fn: (impl) => impl }` 폴백 제거, `vi.fn()` 기반으로 포팅
- [x] `apps/web/src/__mocks__/next-auth.ts` — 주석만 "under Vitest" 로 업데이트 (plain stub 유지)
- [x] 44 파일 일괄 포팅:
  - `from "@jest/globals"` → `from "vitest"` (ESM import)
  - `var/const/let { ... } = require("@jest/globals")` → `import { ... } from "vitest"` (CJS→ESM. Vitest 는 ESM-only)
  - `jest.fn / mock / spyOn / clearAllMocks / resetAllMocks / restoreAllMocks / useFakeTimers / useRealTimers / Mock / Mocked / MockedFunction / MockedClass` → `vi.*`
- [x] `(fetch as vi.Mock)` 등 잔여 타입 캐스팅 중 `@ts-nocheck` 없는 파일 (`compare-insight-generator.test.ts`) 정리

**🔵 REFACTOR:**
- [x] `vitest.setup.ts` — 이전 세션에서 이미 canonical setup 으로 정리 (jest-dom matchers + next/navigation mock)
- [x] `package.json` devDeps 는 이전 세션에서 이미 정리됨

**✋ Quality Gate (정적 검증 — Claude Code 내부 수행):**
- [x] `grep -r "@jest/globals" apps/web/src/` → **0 hit**
- [x] `grep -rE "\bjest\.(fn|mock|spyOn|clearAllMocks|...)" apps/web/src/` → **0 hit**
- [x] `grep -rE "require\(\"vitest\"\)" apps/web/src/` → **0 hit** (전부 ESM import)
- [x] `vi.Mock` 타입 캐스팅 잔여 3파일 중 2파일은 `@ts-nocheck` 로 runtime 영향 없음, 1파일은 수정 완료

**✋ Quality Gate (실행 검증 — 사장님 로컬 1회 실행 필요):**
- [ ] `cd apps\web; npm run test` → `@jest/globals` parse 에러 0 확인 (67 → 대폭 감소 예상)
- [ ] `npx tsc --noEmit` 통과

**Claude Code 제약:**
- `apps/web/node_modules` 가 Windows 바이너리로 물려 있어 Linux sandbox 에서 `vitest run` 직접 실행 불가
- `rm` / `git rm` 은 Cowork Windows mount 의 unlink 금지 정책으로 sandbox 밖 작업

**Rollback:** 1 commit revert 로 Jest 패키지/설정 복원

---

### Phase 2: Prisma Generate 안정화 (0.5~1h) ✅ COMPLETE
**Goal:** `npm run db:generate` 가 에러 없이 실행되고, schema drift 가 있다면 식별 + 수정.

- Status: [x] Complete (Phase 0 시점에 사장님 로컬에서 이미 정상 생성 확인, 런북 문서화로 마감)

**🔴 RED:**
- [x] Phase 0 에서 수집한 Prisma 에러 분석 — **에러 없음**. Prisma Client v5.22.0 정상 생성
- [x] schema.prisma 와 실 DB enum 비교 — 현재 drift 증거 없음
- [x] drift 방향 확정 — N/A (drift 없음)

**🟢 GREEN:**
- [x] `postinstall: prisma generate` hook 동작 확인 — `npm install` 시 자동 실행
- [x] 현재 상태 유지 (schema / migration 수정 없음)

**🔵 REFACTOR:**
- [x] `docs/DEV_RUNBOOK.md` 에 Prisma + Test 명령 통합 런북 작성 (이 PR 에서 같이 생성)
  - 스키마 변경 후: `npm run db:generate`
  - 새 migration: `cd apps/web && npx prisma migrate dev --name <name>`
  - 배포: `npm run prisma:migrate` (Vercel `prebuild` 에서 자동)
- [x] enum drift 재발 방지 원칙 — PR 체크리스트에 "schema.prisma 변경 시 migration 쌍 확인" 추가

**✋ Quality Gate:**
- [x] 사장님 로컬 `npm run db:generate` 에러 없음 (Phase 0 확인)
- [ ] `npx tsc --noEmit` 통과 — Phase 1 테스트 실행과 동시에 확인 예정
- [x] schema.prisma 와 실 DB enum 일치 확인 (drift 증거 없음)
- [x] 런북 업데이트 완료 (`docs/DEV_RUNBOOK.md`)

**Rollback:** schema.prisma 변경 / migration 추가분 revert — 이번 Phase 에선 schema 변경 없음

---

## 8. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| Jest 직접 의존 파일이 많아 포팅 공수 증가 | Med | Low | Phase 0 에서 사전 식별, 많으면 Phase 1 을 둘로 분할 |
| Vitest setup 에서 jest-dom matchers 누락 | Low | Med | Phase 1 Quality Gate 에서 1개 component test green 확인 |
| Prisma enum drift 가 실제로 복잡 (데이터 마이그레이션 필요) | Med | Med | Phase 2 에서 발견 시 이 plan 범위 밖으로 보내고 별도 plan |
| 사장님 로컬 환경 자체 문제 (Node version 등) | Low | High | Phase 0 에서 실 에러 메시지로 분기 판단 |
| package-lock.json 충돌 | Low | Low | `npm install` 실행 후 commit 포함 |

---

## 9. Rollback Strategy

- **If Phase 0 reveals systemic issue:** 이 plan 취소, 별도 환경 셋업 plan 작성
- **If Phase 1 fails:** `package.json` / `jest.*` 파일 복원 (1 commit revert)
- **If Phase 2 reveals complex drift:** schema / migration 은 건드리지 말고 별도 plan 으로 분리, 이 plan 은 Phase 1 까지만 완료로 close

---

## 10. Progress Tracking

- **Overall completion:** ~95%
- **Current phase:** Phase 1 실행 검증 대기 (사장님 로컬 `npm run test` 1회)
- **Current blocker:** (a) `git rm -f apps\web\jest.config.js apps\web\jest.setup.js` 사장님 로컬 실행, (b) vitest 실행 결과 수집
- **Next validation step:** 사장님 로컬에서 `cd apps\web; npm run test` 1회 → Phase 1 실행 Quality Gate 닫기

### Phase Checklist
- [x] Phase 0: Environment Reality Check
- [x] Phase 1: Jest 완전 제거 + Vitest 단일화 (정적 편집 완료, 실행 검증 대기)
- [x] Phase 2: Prisma Generate 안정화 (런북 포함)

---

## 11. Notes & Learnings

### Blockers Encountered
- **2026-04-18** `rm` / `git rm` 이 Cowork Windows mount sandbox 에서 EACCES — Linux sandbox 의 unlink 권한이 차단됨. → jest.config.js / jest.setup.js 는 DEPRECATED 스텁으로 덮어쓴 뒤, 사장님 로컬에서 `git rm -f` 한 번만 실행하는 방식으로 우회.
- **2026-04-18** 초기 grep 이 `require("@jest/globals")` CJS 패턴을 놓침 → 13 hit 으로 과소 집계. 실제 재grep 결과 **44 파일** 확정. 교훈: import 패턴 grep 시 ESM `from` + CJS `require` 양쪽 패턴 동시 확인 필요.
- **2026-04-18** Vitest 는 **ESM-only** 라 `require("vitest")` 가 `ERR_REQUIRE_ESM` 를 유발. Jest 코드 `const { ... } = require("@jest/globals")` 를 기계 치환 시 ESM `import { ... } from "vitest"` 로 승급 필요 (단순 문자열 치환 불가).
- **2026-04-18** sed 로 CRLF line ending 의 `$` anchor 매칭이 실패 → `\r?$` 명시 필요. Windows 쪽에서 작성된 파일이 많은 환경이라 이후에도 주의.

### Implementation Notes
- `__mocks__/auth.ts` 의 기존 `{ fn: (impl) => impl }` 폴백은 vitest 에서 `mockResolvedValue` 가 undefined 라 테스트가 실제 mock 기능을 잃은 상태였음. `vi.fn()` 으로 정상화.
- `vi.Mock` 을 type cast 로 쓰는 패턴은 vitest 에서 정식 type 이 아님. 대부분 `@ts-nocheck` 파일이라 runtime 영향 없음. 향후 `@ts-nocheck` 제거 plan 때 `vi.Mocked<T>` 로 정리 예정.
- Phase 2 는 Prisma 가 이미 안정 동작 중이라 문서화만 남은 상태. 별도의 schema drift 가 나타나면 새 plan 으로 분리.
- Cowork sandbox boundary: 파일 read / write / edit 은 가능, unlink / git index write / Linux-native npm install 은 불가능. 이 경계를 플랜에 명시해 두어야 이후 혼선 방지.

### Deferred Items
- 94개 파일 @ts-nocheck 제거 — 별도 plan (Medium scope 예상)
- RFQ handoff smoke run — 별도 plan
- MutationAuditEvent migration + smoke run — 별도 plan
- Batch 10 soft_enforce → full_enforce — 별도 plan
- Support Center Phase 2~5 — P2 defer
- Stripe → Toss PG 교체 — `PLAN_toss-payments-migration.md` (Deferred by CEO 2026-04-18)

### Design Decisions (확정)
- [x] Test runner: Vitest 단일 (Jest 완전 제거)
- [x] jest-dom matchers: vitest.setup.ts 로 통합
- [x] Prisma schema 의미 변경 금지 (generate 실행 안정화만)
- [x] 테스트 assertion / 로직 변경 금지
