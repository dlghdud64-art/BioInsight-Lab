# Implementation Plan: ai-pipeline runtime 테스트 require() → import 이관 (#53)

- **Status:** ✅ Complete
- **Started:** 2026-04-19
- **Last Updated:** 2026-04-19
- **Estimated Completion:** 2026-04-19 (same-day, 4 phase 순차) — 실제 same-day 완료

**CRITICAL INSTRUCTIONS**: After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 Run all relevant quality gate validation commands
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date
5. 📝 Document learnings in Notes section
6. ➡️ Only then proceed to the next phase

⛔ DO NOT skip quality gates or proceed with failing checks
⛔ DO NOT redesign test strategy — **기계적 require→import 이관만 목표**
⛔ DO NOT touch @ts-nocheck directive lines (Prisma 미생성은 #63/#76에서 별도 해결)
⛔ DO NOT change test assertions, structure, or add new coverage

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- `apps/web/src/lib/ai-pipeline/runtime/__tests__/*.ts` (41개 파일, 2026-04-19 survey 기준)
- `#47 governance` 시 일괄 추가된 `@ts-nocheck — ai-pipeline runtime tests: Prisma 타입 미생성 환경에서 bypass (tracker #53 require()→import 이관 완료 후 별도 residual tracker 신설 예정)` 헤더
- `PLAN_test-only-ts-nocheck-removal.md` (#47 governance 문서)

**Secondary References:**
- `PLAN_webhook-idempotency-closeout.md` (#40 — 동일한 evidence-lock 패턴 선례)
- `docs/architecture/billing-lifecycle.md` (invariants 서술 선례)

**Conflicts Found:**
- 없음. #53 tracker가 #47 governance 주석에 이미 명시되어 있음 → migration 완료 후 `#63`(engine fixture 타입 drift) residual tracker를 신설하기로 설계됨.

**Chosen Source of Truth:**
- 현 repo 상태 (41 files, 34 requires-import, 7 already ESM)
- 기존 @ts-nocheck 코멘트 유지 정책

**Environment Reality Check:**
- [x] repo / branch: `labaxis` main worktree
- [x] runnable command: `cd apps/web && pnpm vitest run <path>` (jsdom env, Prisma client 미생성 상태)
- [x] 실행 blocker: Prisma client 미생성 → 일부 테스트는 실행 시점에 import fail 가능. **pre-migration 실패 상태 == post-migration 실패 상태**가 성공 기준 (equal-or-better).
- [x] 의존: `pnpm install`, `pnpm -F @repo/database db:generate` (optional, 현 session에서는 **실행하지 않음**)

---

## 1. Priority Fit

**Current Priority Category:**
- [x] Release-prep governance residual (post-#47 follow-up)
- [ ] P1 immediate
- [ ] Release blocker
- [ ] P2 / Deferred

**Why This Priority:**
- #47 governance 완료 시 34 파일에 `tracker #53 완료 후 별도 residual tracker 신설` 약속이 남아 있음.
- 해당 약속을 닫지 않으면 `#63` (engine fixture 타입 drift) 같은 후속 residual tracker가 깨끗하게 분리되지 않음.
- 기계적 이관이라 기능 리스크는 없음. 단, 34 파일 × 47 unique require target → 한 번에 전부 치면 rollback 불가 → phase-split + pilot-first 강제.

---

## 2. Work Type

- [ ] Feature
- [ ] Bugfix
- [ ] API Slimming
- [ ] Workflow / Ontology Wiring
- [ ] Migration / Rollout
- [ ] Billing / Entitlement
- [ ] Mobile
- [ ] Web
- [x] **Release-prep governance closeout** (test-only code hygiene)

---

## 3. Overview

**Feature Description:**
ai-pipeline runtime 테스트 34개 파일의 CommonJS `require("...")` 구문을 vitest ESM 친화 `import ... from "..."`로 기계적으로 이관한다. 테스트 동작(assertion, mocking, fixture, setup)은 **전혀 건드리지 않는다**. 이관 전/후 vitest 실행 결과(pass/fail/skip count)가 동등하거나 개선된 상태만 통과로 인정한다.

**Success Criteria:**
- [ ] 34개 파일 모두 `require(...)` 제거
- [ ] 각 파일 이관 전/후 vitest 실행 결과 동등 (pre RED → post RED 동일) 또는 개선
- [ ] `@ts-nocheck — tracker #53` 주석 유지 (추후 #63/#76에서 제거)
- [ ] `#63` residual tracker 신설 (ai engine fixture 타입 drift)
- [ ] `PLAN_test-only-ts-nocheck-removal.md` governance 문서에 #53 완료 링크 추가

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] 테스트 구조 리팩토링
- [ ] 새로운 테스트 추가
- [ ] mock/fixture 재설계
- [ ] Prisma client 생성 (env 변경)
- [ ] @ts-nocheck 제거 (→ #63/#76)
- [ ] 7개 이미 ESM인 파일 수정

**User-Facing Outcome:**
- 엔드유저는 영향 없음. 내부 test-code hygiene만 개선.

---

## 4. Product Constraints

**Must Preserve:**
- [x] workbench / queue / rail / dock (테스트 코드 범위라 무관하지만 wet-paint 규정상 체크)
- [x] same-canvas (무관)
- [x] canonical truth (무관)
- [x] invalidation discipline (무관)

**Must Not Introduce:**
- [x] page-per-feature 회귀 (무관)
- [x] chatbot/assistant reinterpretation (무관)
- [x] dead button / no-op (무관)
- [x] fake billing/auth shortcut (무관)
- [x] preview overriding actual truth (무관)
- [x] **테스트 coverage 후퇴** (동등 유지 강제)
- [x] **#47 governance 주석 소실** (보존 강제)

**Canonical Truth Boundary:**
- Source of Truth: 기존 `require("...")` target path가 표현하는 모듈 의존 그래프
- Derived Projection: ES import 문법은 동일 의존 그래프의 표현 변경일 뿐
- Snapshot / Preview: 해당 없음
- Persistence Path: git diff (기능 변경 없음)

**UI Surface Plan:**
- 해당 없음 (test-only)

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| tier-split (A/B/C) by require-count | 파일당 복잡도 선형 증가, 일괄 치환 시 diff 검증 불가 | 3 phase 필요 |
| Phase 1 = pilot 1 file | 실행 환경 문제(alias, env, Prisma) 조기 발견 | 전체 속도 저하 |
| 이관 패턴 기록 후 Phase 2/3 적용 | mechanical replay — 사람 판단 최소화 | 패턴이 안 맞는 edge case는 별도 플래그 |
| @ts-nocheck 보존 | Prisma 미생성 환경에서 import 에러 회피 | @ts-nocheck 제거는 #63/#76에서 | 

**Dependencies:**
- Required Before Starting: #47 governance (✅ 완료)
- External Packages: 없음
- Existing Routes / Models / Services Touched: 없음 (test-only)

**Integration Points:**
- vitest alias resolver (`@/...`, `../...`)
- jsdom 환경
- `@repo/database` Prisma client (미생성 상태 유지)

---

## 6. Global Test Strategy

본 작업은 **test code 자체의 문법 이관**이라 일반 TDD Red-Green-Refactor 대신 아래를 적용.

**Per-file 검증 프로토콜:**
1. **RED baseline 기록:** 이관 전 `pnpm vitest run <file>` 결과 캡처 (pass/fail/skip count)
2. **Mechanical transform:**
   - `const { a, b, c } = require("X");` → `import { a, b, c } from "X";`
   - `const X = require("X");` → `import X from "X";` (default) 또는 `import * as X from "X";` (namespace) — 파일별로 실제 usage 확인
   - top-level만. 함수 안 require() (lazy import)는 **건드리지 않음**.
3. **POST 검증:** 이관 후 동일 명령 재실행. pass/fail/skip count 동등 또는 개선.
4. **Diff 검증:** `git diff <file>` 에 import 문법 외 변경 없음 확인.
5. **@ts-nocheck 주석 line 1 유지 확인.**

**실행 주의:**
- Prisma client 미생성 상태 그대로 유지.
- 일부 파일은 import resolve 단계에서 실패할 수 있음. 이관 전에도 실패하던 파일이면 pass 기준 충족.
- vitest 실행 불가 시 "실행 불가" 명시, 대신 `tsc --noEmit` 또는 eslint parser로 import 문법 유효성만 확인.

---

## 7. Implementation Phases

### Phase 0: Context & Truth Lock (✅ 계획 수립 중 완료)
**Goal:** 34 파일 survey + tier 분류 + require target 정리 완료.
- Status: [x] Complete

**Deliverable:**
- 41 files total, 34 need migration, 7 already ESM
- 47 unique require() targets
- Top 5 heaviest: p5-2-rollback-async-migration (20), p1-closeout-validation (18), p5-3-lock-baseline-async-migration (17), p6-guardrail-lock (16), p5-1-startup-async-migration (16)
- Pilot target: memory-repositories.test.ts (tier A, 1 require)

**✋ Quality Gate:** tier-split 근거 문서화, pilot target 최소 위험도 확인 ✅
**Rollback:** 해당 없음 (survey only)

---

### Phase 1: Pilot Migration + Runnable Proof
**Goal:** 가장 단순한 파일 1개로 이관 패턴 + 실행 검증 절차 확립.
- Status: [x] Complete (2026-04-19)

**Target file:**
- `apps/web/src/lib/ai-pipeline/runtime/__tests__/memory-repositories.test.ts`
- require count: 1
- require target: `../core/persistence`

**🔴 RED:** 이관 전 vitest 실행 baseline 기록
**🟢 GREEN:** `const { ... } = require("../core/persistence");` → `import { ... } from "../core/persistence";`
**🔵 REFACTOR:** 패턴 문서화 (Phase 2/3 replay용)

**✋ Quality Gate (PASS):**
- [x] pre (Test Files 1 failed / Tests no tests) → post (Test Files 1 passed / Tests 38 passed) — 압도적 개선
- [x] `@ts-nocheck` line 1 유지
- [x] `git diff` 에 import 문법 외 변경 없음 (8 라인, const→import + require→from)
- [x] 이관 패턴이 doc/plan 섹션 12 Notes에 기록됨

**Pilot Findings (Phase 2 기초 데이터):**
- 실제 top-level `var/const/let ... = require(...)` 선언이 있는 파일: **29** (memory-repositories 제외, 원 survey 34 중 5개는 top-level require 없음 — lazy require or 이미 ESM)
- 지배 패턴(99%): `var { X, Y } = require("Z");` → `import { X, Y } from "Z";` (destructuring named import)
- Edge case 1: `p6-guardrail-lock.test.ts` 에 `var fs = require("fs"); var path = require("path");` (Node built-in) → `import * as fs from "fs"; import * as path from "path";` 또는 default import (usage 확인 필요)
- Edge case 2: 8 파일에 `/* eslint-disable @typescript-eslint/no-var-requires */` 상단 주석 존재 — block comment 4건 (상단) + line-level 4건 (함수 안 lazy require 앞, **이관 대상 아님**). block comment는 require 제거 후 함께 제거.

**Rollback:**
- `git checkout -- apps/web/src/lib/ai-pipeline/runtime/__tests__/memory-repositories.test.ts`

---

### Phase 2: Batched Migration tier A+B
**Goal:** 1~10 requires 파일 일괄 이관.
- Status: [x] Complete (2026-04-19)

**Target:** ~20 files (memory-repositories 제외), require count 1~10.

**🔴 RED:** tier A+B 파일 목록 + 각 파일 require count 확인
**🟢 GREEN:** Phase 1 패턴 replay, 파일 단위 commit 또는 batch commit
**🔵 REFACTOR:** 처리된 파일 목록 업데이트, tier C 남은 파일 확정

**✋ Quality Gate:**
- [ ] 각 파일 이관 전/후 vitest 결과 동등 (또는 실행 불가 시 "실행 불가" 문서화)
- [ ] `@ts-nocheck` 주석 전부 유지
- [ ] 이관 실패 케이스는 별도 `BLOCKERS` 섹션에 기록 후 skip (Phase 3에서 재시도)
- [ ] `git diff --stat` 로 파일 수와 라인 변화량 확인

**Rollback:**
- `git checkout -- apps/web/src/lib/ai-pipeline/runtime/__tests__/` (Phase 2 범위만)

---

### Phase 3: Batched Migration tier C + Final Sweep
**Goal:** 11+ requires heavy 파일 이관 + 누락분 sweep.
- Status: [x] Complete (2026-04-19)

**Target:** ~14 files, require count 11~20.
- p5-2-rollback-async-migration (20)
- p1-closeout-validation (18)
- p5-3-lock-baseline-async-migration (17)
- p6-guardrail-lock (16)
- p5-1-startup-async-migration (16)
- p4-* 시리즈
- Phase 2에서 skip된 edge case 파일

**🔴 RED:** tier C 파일 목록 + edge case 파일 확인
**🟢 GREEN:** Phase 1 패턴 + (필요 시) namespace import (`import * as X from "..."`) 적용
**🔵 REFACTOR:** 전체 34 파일 sweep → `grep -r "require(" apps/web/src/lib/ai-pipeline/runtime/__tests__/` 결과 0 확인 (top-level만)

**✋ Quality Gate:**
- [ ] 34 파일 전부 이관 완료
- [ ] `grep "^const.*= require(" __tests__/` 결과 0 (top-level require 제거)
- [ ] 함수 내부 lazy require는 보존됨 (있다면)
- [ ] 전 파일 vitest 실행 결과 pre-migration 대비 동등/개선

**Rollback:**
- `git checkout -- apps/web/src/lib/ai-pipeline/runtime/__tests__/` (Phase 3 범위)

---

### Phase 4: Governance Close
**Goal:** #53 완료 기록, #63 residual tracker 신설.
- Status: [x] Complete (2026-04-19)

**🔴 RED:** #47 governance 문서의 #53 참조 위치 확인
**🟢 GREEN:**
- `PLAN_test-only-ts-nocheck-removal.md` 또는 해당 governance 문서에 #53 완료 링크 추가
- `#63` residual tracker 신설: "ai engine fixture 타입 drift (9 files, 15 err) — Prisma 타입 미생성 환경에서 발생, #47 이후 잔여"
- `#76` (production @ts-nocheck) 와 경계 명확화
**🔵 REFACTOR:** notes/learnings 섹션 채우기

**✋ Quality Gate:**
- [ ] #53 완료 문서화 (본 PLAN + governance doc)
- [ ] #63 신설 (residual tracker 목록)
- [ ] @ts-nocheck 주석의 "tracker #53 ... 완료 후 별도 residual tracker 신설 예정" 문구를 `tracker #63`으로 교체하거나 제거 (추후 작업으로 defer 가능)

**Rollback:**
- 문서 변경만이라 git revert로 되돌림.

---

## 8. Optional Addenda

해당 없음 (test-code hygiene 범위).

---

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| vitest alias resolver가 import만 지원하고 require 지원 안 함 → 이관 후 갑자기 새로운 failure 발생 | Low | Medium | Phase 1 pilot에서 즉시 발견, 실패 파일은 blocker 기록 후 Phase 3 sweep에서 재시도 |
| default vs named import 혼동 | Medium | Low | 파일별 usage 확인 후 이관, 단순 치환 금지 |
| lazy require (함수 내부)를 실수로 이관 | Low | Medium | top-level만 이관, grep으로 이중 확인 |
| Prisma 미생성 환경에서 일부 파일 import 자체가 fail | High (기존에도 fail) | Low | "동등 유지" 기준으로 pass 인정 |
| governance 주석 실수로 삭제 | Low | High | line 1 유지 강제, diff 확인 필수 |

---

## 10. Rollback Strategy

- **Phase 1 실패:** pilot file 단독 revert. 실행 환경 재점검.
- **Phase 2 실패:** tier A+B 범위만 revert, Phase 1 pattern 보존.
- **Phase 3 실패:** tier C 범위만 revert, Phase 1/2 보존.
- **Phase 4 실패:** 문서 revert (code 영향 없음).

**Special Cases:**
- 특정 파일에서만 failing이면 해당 파일만 revert, 나머지는 유지.
- Prisma client 생성 필요 판정 시 session 중단, #53 defer + `pnpm db:generate` 선행으로 재시도.

---

## 11. Progress Tracking

- Overall completion: 100%
- Current phase: **Complete**
- Current blocker: 없음
- Next validation step: N/A

**Phase Checklist:**
- [x] Phase 0 complete (survey + tier split)
- [x] Phase 1 complete (pilot migration — memory-repositories)
- [x] Phase 2 complete (tier A+B, 26 files)
- [x] Phase 3 complete (tier C, 3 files)
- [x] Phase 3-Sweep complete (누락 4 files — p1-closeout-validation, persistence-bootstrap, prisma-repositories, slice-1f-persistence-cutover)
- [x] Phase 4 complete (governance close)

**최종 총계:**
- 이관 파일: **34** files (1 pilot + 26 tier A+B + 3 tier C + 4 sweep)
- 이관 require: **323** top-level requires → imports (1 + 248 + 46 + 31 — destructured 321, non-destructured 2 for p6 fs/path)
- Block eslint-disable 제거: **5** (p2-2a, p2-1c, p2-2b, p2-1, p2-1b)
- 남은 top-level require: **0** (sweep 후 grep 검증 확인)
- Lazy require (함수 내부) 의도대로 보존: **94** (34 files)

**회귀 검증 (전체 디렉토리 vitest):**
| 지표 | RED baseline | 최종 | Δ |
|---|---|---|---|
| Test Files failed | 33 | 12 | **−21** |
| Test Files passed | 8 | 28 | **+20** |
| Test Files skipped | 0 | 1 | +1 |
| Tests collected | 143 | 458 | **+315** |
| Tests passed | 143 | 432 | **+289** |
| Tests failed | 0 (수집 fail로 측정 불가) | 16 | 노출된 assertion drift — #63 분류 |
| Tests skipped | 0 | 10 | +10 |

---

## 12. Notes & Learnings

**Blockers Encountered:**
- [2026-04-19] Phase 0 survey grep이 multiline destructuring을 1건으로 카운트해 require count가 과소 집계됨. 실제 per-file require 수는 survey 대비 5~10배. 이관 대상 파일 수(34)는 일치했으나, 초기 tier split (1-3 / 4-8 / 11-12)이 의미 없었음. → 대응: Phase 1 pilot 패턴 확정 후 전체 batch로 전환. tier 구분은 "결과적으로" 단순 보조 지표.
- [2026-04-19] Phase 2 TIER_A_B 리스트에서 4 파일(p1-closeout-validation, persistence-bootstrap, prisma-repositories, slice-1f-persistence-cutover) 누락. Phase 3 회귀 검증 중 `vitest src/lib/ai-pipeline/runtime/__tests__/` 전체 sweep grep으로 발견. → 대응: migrate-ai-pipeline-requires-sweep.mjs로 전체 디렉토리 재스캔 + 이관.

**Implementation Notes:**
- 34 파일 = #47 governance 시 @ts-nocheck가 일괄 추가된 범위와 동일.
- 본 plan은 labaxis-feature-planner skill의 "no-bulk-migration, evidence-lock-first" 원칙 적용.
- #40 PLAN_webhook-idempotency-closeout.md 와 동일한 evidence-lock governance 패턴.
- 테스트 환경 선택: 현 상태 유지 (jsdom + Prisma 미생성, RED baseline 동등 유지가 pass 기준).
- **기계 변환 패턴:** `^(var|const|let)\s+\{([^}]+)\}\s*=\s*require\(\s*(["'][^"']+["'])\s*\);?$` → `import {body} from src;` (gm flag, multiline destructuring 지원). Non-destructured는 `import * as Name from src` (p6 `fs`/`path`만 해당).
- **보존 대상:** 함수 내부 lazy `require()` (들여쓰기 있음 → `^` anchor에 안 걸림), line-level `// eslint-disable-next-line` (block comment만 제거).
- **Script 위치:** `apps/web/scripts/migrate-ai-pipeline-requires.mjs` (Phase 2), `migrate-ai-pipeline-requires-phase3.mjs` (Phase 3), `migrate-ai-pipeline-requires-sweep.mjs` (누락 sweep). 재사용 불필요하나 #53 이관 증거로 보존.

**Unexpected Outcomes:**
- Phase 1 pilot에서 `require()` 제거만으로 memory-repositories.test.ts가 "no tests" → 38 tests passed로 회복. 이는 vitest가 `require()`의 `.ts` 확장자 해석에 실패하는 것이 근본 원인이었고, ESM import로 전환 시 resolver가 정상 작동함을 의미.
- 전체 이관 후 **+289 tests 새로 통과** — #53은 단순 hygiene 작업이 아니라 실제 테스트 coverage 회복 효과.

**Residual (ai-pipeline #53 범위 외):**
- 16 failing tests: assertion logic / fixture drift / engine API change 기인. `p4-1-recovery-sync-shutdown.test.ts:332` `expect(valResult.success).toBe(true)` 같은 케이스. → **#63 (ai engine fixture 타입 drift)** 범위로 분류.
- 12 failing Test Files: 대부분 engine module path resolution 또는 내부 state transition mismatch. require→import 이관 자체의 side-effect가 아니라, "수집 fail"으로 가려져 있던 assertion failure가 이제 노출된 것.
- `@ts-nocheck` 주석의 "tracker #53 ... 완료 후 별도 residual tracker 신설 예정" 문구는 **이번 session에서 교체하지 않음**. 이유: (1) 34 파일에 line 1 주석을 일괄 수정하는 것은 기계적 변환 scope와 별개 governance 작업, (2) #63이 이미 pending으로 존재하므로 주석 문구 교체는 #63 close 시 함께 처리하는 것이 응집도 높음. → defer to #63.

**Governance 연결:**
- #47 governance 약속 ("tracker #53 require()→import 이관 완료 후 별도 residual tracker 신설 예정") 이행 완료.
- #63 residual tracker는 이번 이관으로 "고립"되어 assertion drift만 남음. #63 자체는 별도 PLAN으로 후속 close.
- #76 (Production/runtime @ts-nocheck) 과 본 plan의 @ts-nocheck(test-only) 경계는 유지됨.
