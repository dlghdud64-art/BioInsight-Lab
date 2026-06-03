# Implementation Plan: §11.317-b — ai-pipeline test @ts-nocheck 잔여 제거

- **Status:** ✅ Complete (호영님 Option A 선택, sandbox 사유 주석 일괄 갱신 완료, 호영님 push 대기)
- **Started:** 2026-05-29
- **Last Updated:** 2026-05-29 (Option A closeout)
- **Estimated Completion:** 2026-05-29 (1일 내 완주)
- **Scope:** Option A 채택 — 34 files 사유 주석 갱신 (tracker #63 통합 defer 명시)
- **호영님 모델 권장:** type annotation 필요 — Opus 4.7 가능, 작업 부담 클 시 4.8 권장
- **Sibling plan:** `PLAN_test-only-ts-nocheck-removal.md` Phase 0 에서 #53 충돌로 defer 된 34 files batch + s0/s6 (Phase 4 tracker #63 통합 defer)

---

## ⚠️ v2 재설계 사유 (2026-05-29, 호영님 greedy 측정 결과)

**호영님 환경 측정:**
- 34 files greedy removal → **0/34 clean unlock**
- 34 files 전부 진짜 implicit-any 타입 부채 (`TS7005/7006/7034`)
- 주요 implicit-any 위치 변수: `adapters`, `eventId`, `baselineId`, `config`, `savedEnv`, `mockPrisma`, `s`
- working tree 깨끗 (sandbox / 호영님 환경 모두 commit 0)

**원래 plan v1 무효:**
- "iterative remove → tsc → residual restore" 패턴 = 0% 회수율
- "#48 prisma generate / d.ts root fix 후 자연 해결" 가정 = 틀림
- residual restore 기반 commit batch 자체가 의미 0 (clean count 0)

**v2 핵심 사실:**
- 34 files 모두 individual type annotation 작업 필요
- 변수 7종 = test 파일에 자주 등장하는 implicit-any source
- s0/s6 = tracker #63 별도 (본 plan scope 제외 유지)
- 호영님 sandbox 임시 script 정리 명령 안내 받음 (호영님 환경에서 처리)

---

## 🔒 통제 구조 (호영님 원칙)
| 구분 | 담당 |
|---|---|
| Evidence 수집 (sandbox grep) | Claude sandbox 직접 |
| tsc --noEmit 검증 | 호영님 로컬 (sandbox 실행 불가, `apps/web/node_modules/typescript/` 없음) |
| Scope 결정 | 호영님 |
| Production push | 호영님 (claude-code 환경) |

⛔ sandbox commit 금지, Phase 별 호영님 로컬 tsc 회신 후 다음 phase.
⛔ test assertion / 로직 변경 금지 — 타입 안정성 복원만
⛔ 새 @ts-nocheck / @ts-ignore 추가 금지
⛔ s0/s6 2 files = tracker #63 통합 — 본 plan scope 제외

---

## 0. Truth Reconciliation

**Latest Truth Source (sandbox 측정, 2026-05-29):**
- `apps/web/src/lib/ai-pipeline/runtime/__tests__/` 디렉토리 = **36 files with @ts-nocheck**
- 그 중 **2 files (s0/s6)** = PLAN_test-only-ts-nocheck-removal Phase 4d 에서 tracker #63 통합 defer 명시
- **본 plan 실질 scope = 34 files**
- `^const \w+ = require\(` 패턴 잔존 = 0 ⇒ #53 require→import 이관 완료 추정

**@ts-nocheck 사유 분포 (sandbox 샘플):**
- "ai-pipeline runtime tests: Prisma 타입 미생성 환경에서 bypass" = 다수 (#48 prisma generate 완료 + Phase 2 d.ts root fix 이후 자연 해결 후보)
- tracker #63 통합 = s0/s6 (제외)

**Secondary References:**
- `PLAN_test-only-ts-nocheck-removal.md` Phase 3 — iterative auto-remediation 패턴 (40/48 clean, residual 16.7%)
- `apps/web/src/types/vitest-globals.d.ts` — Phase 2 d.ts root fix (vitest globals 타이핑)
- `apps/web/tsconfig.json` — strict 설정 (Phase 0 확인 불필요, sibling plan 에서 이미 확인)

**Chosen Source of Truth:**
- 대상 = **ai-pipeline 34 files** (s0/s6 제외)
- 호영님 로컬 `tsc --noEmit` 만이 ground truth (sandbox 추정 금지)

**Environment Reality Check:**
- [x] sandbox grep 작동 확인
- [x] sandbox 안에서 tsc 실행 불가 명시 (이미 sibling plan 에 evidence)
- [ ] 호영님 로컬 tsc baseline 49 (Phase 3 종결치) 그대로 유지되는지 = Phase 1 probe 회신으로 확인

---

## 1. Priority Fit
- [x] **release-prep deferred** (호영님 release-prep P1 lineup 의 마지막 잔여)
- [ ] P1 immediate
- [ ] P2 / Deferred

**Why This Priority:**
- release-prep cleanup tracker 의 마지막 batch
- Batch 10 soft_enforce → full_enforce 전 test suite 타입 안정성 확보 마무리
- functional regression 위험 0 (test-only)

## 2. Work Type
- [x] **Bugfix** (@ts-nocheck 뒤에 숨은 실제 타입 에러 발굴)
- [x] **API Slimming** (타입 안정성 복원)

## 3. Overview

**Feature Description:**
ai-pipeline runtime test 34 files 의 `@ts-nocheck` 제거. PLAN_test-only-ts-nocheck-removal Phase 2 의 d.ts root fix + Phase 3 iterative auto-remediation 패턴 재사용. 호영님 로컬 tsc baseline 49 유지하며 clean unlock 가능한 files 만 제거.

**Success Criteria:**
- [ ] 34 files iterative remove → tsc → residual restore 실행
- [ ] 호영님 로컬 tsc baseline 49 유지 (이탈 시 즉시 rollback)
- [ ] clean unlock 비율 ≥ 60% (PLAN_test-only-ts-nocheck-removal Phase 3 = 83% 참조)
- [ ] residual files 명확한 사유 주석 + 별도 tracker 분리

**Out of Scope:**
- [ ] s0-baseline-freeze.test.ts / s6-soak-exit-gate.test.ts = tracker #63 통합 유지
- [ ] lib/ai/__tests__ 5 files (§11.317-c 별도)
- [ ] test assertion / 로직 변경
- [ ] tsconfig.json / vitest.config.ts 변경
- [ ] 신규 @types/* 패키지 설치
- [ ] ai-pipeline runtime production code 변경

**User-Facing Outcome:**
- 개발자(호영님): test 타입 안정성 ↑, IDE 힌트 작동, mock 타입 실수 조기 감지
- 엔드 유저: 변화 0 (test-only)

## 4. Product Constraints
- ✅ workbench/queue/rail/dock = 해당 없음 (test-only)
- ✅ same-canvas = 해당 없음
- ✅ canonical truth = 해당 없음 (test 파일만 수정)
- ❌ dead button / no-op = N/A
- ❌ chatbot 재해석 = N/A

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
|---|---|---|
| iterative "remove → tsc → auto-restore residuals" | sibling plan Phase 3 검증된 패턴, probe 가정 의존 0 | 호영님 로컬 1회 실행 의존 |
| 34 files single batch (s0/s6 제외) | bulk 처리 효율 우선, cluster 분할은 commit 단위에서 | bisect 시 cluster 추론 가능 |
| commit granularity = ~10 files/commit | 호영님 cluster별 분할 push | PR diff 분산 |
| s0/s6 본 plan scope 제외 | tracker #63 fixture drift 통합 유지 | 잔여 @ts-nocheck 2 files = 명시 defer |

**Dependencies:**
- Required Before Starting:
  - PLAN_test-only-ts-nocheck-removal Phase 2/3 완료 ✅ (d.ts root fix + tsc baseline 49)
  - #48 prisma generate 안정화 ✅
  - #53 require→import 이관 완료 추정 ✅ (sandbox grep 0)
- External Packages: 없음
- Production code Touched: 없음

## 6. Global Test Strategy

Red-Green-Refactor 엄수.

**Test Strategy:**
- 타입 변경 only → tsc --noEmit 이 ground truth
- test assertion 불변 → vitest run 회귀 0 (호영님 로컬 1회 확인)

**Execution Notes:**
- sandbox `tsc --noEmit` 실행 불가 (sibling plan 명시) → 호영님 로컬 의존
- bulk script `phase17b-scale-up.sh` workspace export → 호영님 로컬 1회 실행 → 결과 회신

## 7. Implementation Phases

### Phase 0: Truth Lock + 34 files 확정
**Goal:** sandbox grep evidence 확정, #53 충돌 잔존 0 재확인, s0/s6 제외 list 확정.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:**
- sandbox grep `@ts-nocheck` count = 36 files (확정)
- s0/s6 = tracker #63 defer 사유 주석 grep 확인
- `^const \w+ = require\(` 패턴 잔존 0 재확인

**🟢 GREEN:**
- 34 files 최종 list 확정 (cluster: memory / prisma / persistence / p1 / p2 / p3 / p4 / p5 / p6 / slice)
- script `phase17b-scale-up.sh` 작성 (workspace export 대기)

**🔵 REFACTOR:**
- 본 plan scope = 34 files 명시 (s0/s6 제외 명시)

**✋ Quality Gate:**
- [ ] 34 files list 확정 (cluster 분포 기록)
- [ ] s0/s6 제외 evidence (tracker #63 사유 주석)
- [ ] script 작성 완료 (workspace export 대기)

**Rollback:** 문서/script 만 — 되돌릴 것 없음.

---

### Phase 1: Probe (5 files sample)
**Goal:** 5 files probe → 호영님 로컬 tsc 결과 회신 → 유형 분류 (A 자연해결 / B vi cascade / C types / D 실버그).
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**Probe Sample 5 files (cluster별 균등):**
- memory-repositories.test.ts (cluster: memory)
- prisma-repositories.test.ts (cluster: prisma)
- p1-2-distributed-lock.test.ts (cluster: p1)
- p3-1-ontology-adapters.test.ts (cluster: p3)
- p4-1-recovery-sync-shutdown.test.ts (cluster: p4)

**🔴 RED:**
- 5 files `@ts-nocheck` 한 줄 제거 (sandbox)
- 호영님 로컬: `cd apps/web && npx tsc --noEmit --pretty false 2>&1 | tail -40` 실행
- 결과 회신 → 파일별 에러 수 + 에러 유형 분류

**🟢 GREEN:**
- Type A (에러 0) files = Phase 2 bulk 대상으로 확정
- Type B/C/D files = 원복 + 분류 기록
- 34 files 전체 분포 추정

**🔵 REFACTOR:**
- Type A 파일은 그대로 유지, Type B/C/D 는 즉시 `git checkout --` 원복 (호영님 로컬)

**✋ Quality Gate:**
- [ ] 5 probe 결과 모두 유형 할당
- [ ] tsc baseline 49 변동 확인 (probe 후 원복했으면 49 유지)
- [ ] Type 분포 본 plan notes 기록

**Rollback:** 호영님 로컬 `git checkout -- apps/web/src/lib/ai-pipeline/runtime/__tests__/` 일괄 원복.

---

### Phase 2: 34 files iterative bulk removal
**Goal:** `phase17b-scale-up.sh` script 로 34 files bulk remove → tsc → residual restore → cluster batch commit.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED (자동화 script):**
- `phase17b-scale-up.sh` (workspace export):
  1. 34 files 리스트 하드코딩 (s0/s6 제외)
  2. `sed -i` 로 34 files 전체 `@ts-nocheck` 제거
  3. `cd apps/web && npx tsc --noEmit --pretty false > /tmp/phase17b-tsc.log`
  4. grep 으로 에러 나는 파일 추출 = residual 후보
  5. residual 후보 파일만 `@ts-nocheck` 복원 (사유 주석: `// @ts-nocheck — §11.317-b tsc residual, tracker #63 통합 defer`)
  6. `git diff --stat` 로 최종 제거 파일 수 출력

**🟢 GREEN:**
- script 실행 후 tsc baseline 49 유지 (호영님 로컬 확인)
- clean unlock 파일 수 = (34 - residual)
- cluster별 분포 commit message 에 기록
- 10 files/commit 단위 분할 (bisect 편의) — script 는 stage 만, commit 은 cluster batch

**🔵 REFACTOR:**
- residual 파일 list + 에러 건수를 Phase 3 로 이관
- 잔여 @ts-nocheck 카운트 갱신: 36 → (36 - clean) [s0/s6 2 + residual N]

**✋ Quality Gate:**
- [ ] script workspace export 완료
- [ ] 호영님 로컬 script 실행 성공 (non-zero exit 시 stop)
- [ ] tsc baseline 49 유지 (이탈 시 즉시 rollback)
- [ ] residual 사유 주석 정확
- [ ] cluster batch commit 메시지 분포 기록
- [ ] vitest run ai-pipeline cluster 회귀 0 (pre-existing CJS fail 무관 처리)

**Rollback:** batch commit 단위 revert.

---

### Phase 3: Residual handling + closeout
**Goal:** Phase 2 residual files 사유 분류 → tracker #63 통합 or 별도 tracker → §11.317-b closeout.
- Status: [ ] Pending | [ ] In Progress | [ ] Complete

**🔴 RED:**
- residual 사유 grep 분류
- tracker #63 (ai engine fixture drift) 와 같은 카테고리면 통합, 아니면 별도 tracker 신설

**🟢 GREEN:**
- residual 파일 `@ts-nocheck` 사유 주석 갱신 (tracker 참조)
- 본 plan Status → Complete
- 잔여 @ts-nocheck 최종 카운트 기록
- sibling plan `PLAN_test-only-ts-nocheck-removal.md` Notes 에 본 plan 결과 cross-reference

**🔵 REFACTOR:**
- §11.317-c (lib/ai 5 files) 진입 권장 여부 판단 (tracker #63 와 통합 plan 또는 본 plan 연속 batch)

**✋ Quality Gate:**
- [ ] residual 사유 주석 정확
- [ ] tracker 분리/통합 결정
- [ ] 본 plan Status Complete
- [ ] sibling plan cross-reference

**Rollback:** 문서만.

## 8. Optional Addenda

### C. API Slimming Addendum
**Waste Type:** Type Safety Erosion — `@ts-nocheck` 가 ai-pipeline runtime test 의 타입 안정성 우회 수단으로 쌓였음
**Minimal Diff Fix:** 주석 1 줄 제거 → tsc residual 만 복원 → 사유 주석 갱신

## 9. Risk Assessment

| Risk | 확률 | Impact | Mitigation |
|---|---|---|---|
| sandbox tsc 실행 불가 → 호영님 로컬 의존 | High | Med | sibling plan 에서 이미 검증된 워크플로우. script + 결과 회신 패턴. |
| #53 미완료 충돌 (require 잔재) | Low | Med | Phase 0 grep 0 확인 (sandbox). Phase 1 probe 시 추가 검증. |
| 34 files 중 다수 residual (50% 이상) | Med | Low | Phase 3 에서 tracker 통합 분리 — plan scope 보존, 잔존 @ts-nocheck 명시. |
| vitest run 회귀 (test assertion 변경 없는데 fail) | Low | Med | Phase 2 호영님 로컬 vitest 1회 회귀 확인. pre-existing CJS fail 은 무관 처리. |
| Phase 2 script 실행 중 예외 | Low | Med | `git checkout -- apps/web/src/lib/ai-pipeline/runtime/__tests__/` 일괄 원복. |

## 10. Rollback Strategy

- Phase 0 fail: 문서만
- Phase 1 fail: probe 5 files `git checkout --` 원복 (호영님 로컬)
- Phase 2 fail: batch commit 단위 revert (10 files/commit 단위라 bisect 가능)
- Phase 3 fail: 문서만

**Special Cases:** test 파일만 수정이라 production 영향 0.

## 11. Progress Tracking

- Overall completion: 100% (Option A sandbox 작업 완료, 호영님 push 대기)
- Current phase: closeout
- Next: 호영님 push 회신 → §11.317-b 완전 종결, 다음 트랙(§11.317 호영님 새 spec = §11.322 매핑) 진입

**Sandbox 작업 결과:**
- 34 files 사유 주석 일괄 갱신 (sed batch):
  · 옛: `// @ts-nocheck — ai-pipeline runtime tests: Prisma 타입 미생성 환경에서 bypass`
  · 신: `// @ts-nocheck — §11.317-b implicit-any type annotation 필요 (TS7005/7006/7034), tracker #63 통합 defer (호영님 greedy 0/34 측정, 2026-05-29)`
- grep 검증: 34 files 매칭 ✓
- s0/s6 2 files = tracker #63 사유 주석 그대로 유지 (이미 정확) ✓
- working tree 변경: 34 files (사유 주석 1 line 만)

---

## 🔀 v2 Scope Options (호영님 선택)

### Option A: 전체 defer 통합 (1h, 최소 작업)
- 34 files 전부 `@ts-nocheck` 사유 주석만 갱신: `// @ts-nocheck — §11.317-b implicit-any type annotation 필요, tracker #63 통합 defer`
- 본 plan = closeout 만 (0% clean unlock)
- tracker #63 (ai engine fixture drift) 와 통합 — release-prep cleanup 의 마지막 부채 명시
- release-prep deferred scope 에 가장 정합
- Risk 0, type 작업 0

### Option B: shared type module + pilot (4-6h, 중간 작업)
- `apps/web/src/lib/ai-pipeline/runtime/__tests__/_shared/test-types.ts` 신규
- 7개 공통 type 정의 (`AdaptersBundle`, `EventId`, `BaselineId`, `RuntimeConfig`, `SavedEnv`, `MockPrismaClient`, `SoakRunContext`)
- 가장 단순한 3-5 files pilot (memory-repositories / persistence-bootstrap / p1-2-distributed-lock 후보)
- 호영님 로컬 tsc 회신 후 ROI 판단 → 확장 결정
- pilot 외 잔여 31~29 files = Option A 처리

### Option C: 전체 34 files type annotation (10-15h, 큰 작업)
- 34 files 전부 implicit-any type annotation
- shared type module + 개별 annotation 병행
- release-prep deferred scope 초과 — Opus 4.8 권장
- 가장 타입 안정성 회복 ↑ 하지만 작업 부담 큼
- vitest run 회귀 가드 필수 (호영님 로컬 1회)

---

## 🛑 v2 결정 후 Phase 재정의 (Option 별)

**Option A 선택 시:**
- Phase 0: 34 files 사유 주석 갱신 (sed 단일 batch)
- Phase 1: closeout

**Option B 선택 시:**
- Phase 0: shared type module 설계 + 7 type 정의
- Phase 1: pilot 3-5 files annotation (가장 단순한 cluster)
- Phase 2: 호영님 로컬 tsc 회신 → ROI 판단
- Phase 3: 확장 or 잔여 Option A 처리 + closeout

**Option C 선택 시:**
- Phase 0: shared type module 전체 설계
- Phase 1~4: cluster batch annotation (memory/p1/p2/p3/p4 etc)
- Phase 5: residual + closeout

**Phase Checklist:**
- [ ] Phase 0 complete (Truth Lock + 34 files list + script)
- [ ] Phase 1 complete (Probe 5 files, 유형 분류)
- [ ] Phase 2 complete (34 files bulk, residual restore)
- [ ] Phase 3 complete (Residual handling + closeout)

**잔여 @ts-nocheck 카운트 추정:**
- 시작: 36 (ai-pipeline runtime, s0/s6 포함)
- Phase 1 probe 후: 36 (probe files 원복)
- Phase 2 후: 추정 36 → ~12 (clean 24 + residual 10 + s0/s6 2)
- Phase 3 closeout: 잔존 12 명시 (tracker 분리)

## 12. Notes & Learnings

**Implementation Notes:**
- PLAN_test-only-ts-nocheck-removal Phase 3 검증된 iterative pattern 재사용
- s0/s6 = tracker #63 통합 유지 (본 plan scope 제외 명시)
- sandbox 환경 제약 = sibling plan 과 동일
- script 패턴 = sibling plan Phase 3 `phase3-scale-up.sh` 와 동일 구조

**Pre-Planning Measurement (sandbox 2026-05-29):**
- ai-pipeline/runtime/__tests__ @ts-nocheck count = 36
- `^const \w+ = require\(` 패턴 = 0 (#53 이관 완료 추정)
- s0/s6 사유 주석 = "tracker #63 통합 ... TS2554 인자 수 drift / TS2345 SoakRunContext"
- 나머지 34 files 사유 = "Prisma 타입 미생성 환경에서 bypass" (#48 + d.ts root fix 후 자연 해결 후보 多)

**Cluster 분포 (34 files 추정):**
- memory: 1 (memory-repositories)
- prisma: 1 (prisma-repositories)
- persistence: 1 (persistence-bootstrap)
- p1: 4 (db-contention, closeout, 2, 3)
- p2: 7 (1, 1b, 1c, 2a, 2b, 3, 4a/4b/4c)
- p3: 6 (1, 2, 3, 3b, 4, 5, 6)
- p4: 5 (1, 2, 3, 4, 5)
- p5: 4 (1, 2, 3, 4)
- p6: 1 (guardrail-lock)
- slice: 1 (1f-persistence-cutover)

(정확 count 는 Phase 0 에서 확정)
