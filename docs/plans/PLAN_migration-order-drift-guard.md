# Implementation Plan: §migration-order-drift-guard — 마이그레이션 순서 역전·silent gap 재발 방지

- **Status:** ✅ Complete — 전 Phase (0–4) 종료, prod 실증 GREEN (커밋 `2a341a3a` + `4e39277a`, push 완료)
- **Started:** 2026-08-04
- **Last Updated:** 2026-08-04
- **Estimated Completion:** 2026-08-04 (완료)

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
⛔ **빌드타임 `prisma migrate deploy` 재도입 절대 금지** (ADR-002 §11.13 영구 결정)
⛔ **`prisma migrate dev` 절대 금지** (2026-06-14 prod 데이터 소실 사고 명령 계열, DEV_RUNBOOK §9.9)

---

## 0. Truth Reconciliation

**Latest Truth Source (2026-08-04 실측, 계획 세션 직접 read):**
- `apps/web/scripts/vercel-migrate.js` — 빌드타임 migrate는 ADR-002 §11.13(2026-04-25)로 **영구 no-op** (Vercel build infra → Supabase pooler 도달 불가, §11.9–§11.12 체인). migrate는 operator-shell 수동 전용. 절차("커밋 → operator migrate → health/smoke 검증 → push")는 스크립트 주석·DEV_RUNBOOK §9에 있으나 **강제 장치 0**.
- git 실측: `20260731120000_receiving_document` 커밋 87e6bfae **2026-08-01 22:51 KST**, `20260801120000_receiving_inspection_decision` 커밋 cec5f766 **2026-08-02 00:48 KST**. 두 폴더명 모두 수기 타임스탬프(생성 시각과 무관).
- 사고 실측(§pocandidate-root-fix Phase 2, 2026-08-04): prod에 0801 applied·0731 pending — **커밋 순서와 적용 순서 역전 + 0731 3일 silent gap**(라이브 `db.receivingDocument.*` 라우트 runtime 실패 장전 상태였음).
- `.husky/pre-push` = `npm run build`만. CI/워크플로의 migration 검사 존재 여부 **미확인**(Phase 0).

**Secondary References:**
- `docs/plans/PLAN_pocandidate-root-fix.md` §12 — drift 발견·해소 기록(2026-08-04 deploy로 0731·0804 동시 적용, 검증 4/4).
- DEV_RUNBOOK §9 (operator migrate 절차·safety guards).

**Conflicts Found:**
- 없음. 단 사고의 정확 메커니즘 2안 미확정: (a) 0731이 없는 워크트리에서 0801 deploy — 같은 트리였다면 deploy가 둘 다 적용했어야 함, (b) resolve성/수동 적용. → Phase 0 prod SELECT로 확정.

**Chosen Source of Truth:**
- **적용 사실 = prod `_prisma_migrations`** / **적용 의도 = repo `prisma/migrations/` 폴더 집합**. 이 둘의 대조가 본 기능의 계약. manifest·probe 출력은 derived projection이며 truth를 대체하지 않는다.

**Environment Reality Check:**
- [ ] prod 읽기전용 SELECT 승인 (쿼리문 사전 제출 게이트)
- [ ] `.github/workflows` 현황 실측 (CI에서 정적 검사 가능 지점)
- [ ] health 라우트(`/api/health`) 현재 응답 형태 실측
- [ ] `npx vitest run <파일>` 실행 환경 확인 (격리 /tmp 패턴 승계)

---

## 1. Priority Fit

- [ ] P1 immediate / [ ] Release blocker
- [x] Post-release (안정화 가드) — **호영님 지정 1순위 트랙 (2026-08-04)**
- [ ] P2 / Deferred

**Why This Priority:**
receiving_document급 잠복 runtime gap 클래스(커밋된 스키마를 라이브 코드가 참조하는데 prod 테이블 부재)의 재발 방지. §pocandidate-root-fix 종료 직후 호영님 지정. 현재 P1과 충돌 없음.

---

## 2. Work Type

- [x] Migration / Rollout (안전장치)
- [x] Bugfix (프로세스 결함의 구조적 봉쇄)

---

## 3. Overview

**Feature Description:**
"커밋됨 ≠ 적용됨"을 기계가 감시하게 한다. 빌드 시 migration 폴더명 manifest 생성(DB 무접촉) → 앱 runtime이 `_prisma_migrations`를 읽기전용 SELECT로 대조 → drift(pending / unknown / rolled_back·unfinished)를 health·ops surface에 노출 + operator smoke 1명령 제공.

**재발 클래스 3종 (사고 실측 기반):**
| 클래스 | 사고에서의 발현 | 가드 |
|---|---|---|
| ① silent gap — 커밋 후 operator migrate 누락 | 0731이 3일 pending 잠복 | probe가 pending>0 즉시 노출 |
| ② 부분 시야 deploy — 이전 migration 없는 워크트리에서 적용 | 0801만 applied (추정, P0 확정) | probe unknown/pending 비대칭 노출 + RUNBOOK HEAD 확인 절차 |
| ③ 수기 타임스탬프 역전 | 0731 폴더명 ≠ 실제 생성·커밋 시각 | RUNBOOK 명명 규칙 + probe가 적용 순서로 실사실 노출 |

**Success Criteria:**
- [x] 빌드 산출 manifest = repo migration 폴더명 전수 (52건 = prod 52, 생성 시점 메타 포함)
- [x] drift 계산 서비스: pending[] / unknown[] / rolled_back·unfinished count 정확 (unit 계약 10건)
- [x] `/api/health`에 count/boolean만, 상세는 operator smoke 전용 (스키마 정보 leak 0 — W2 assert)
- [x] operator smoke 1명령 (`npm run smoke:migration` — v2 직접 쿼리, v1 migrate-status hang 해소)
- [x] DEV_RUNBOOK §9.10 갱신: deploy 전 HEAD 일치 확인 + smoke + 폴더명 백데이트 금지 (§9.5 맹점 명시)
- [x] prod 대상 probe 1회 실행 — health `clean:true`·pending 0·unknown 0 + smoke exit 0 실측
- [x] 회귀 게이트 0 RED (실행 세션 독립 검증 26파일 186 passed·prod tsc 0)

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] 빌드타임 `migrate deploy` 재도입 (ADR-002 §11.13 영구 금지)
- [ ] pre-push hook에 prod DB 검사 (매 push network+secret 의존·pgbouncer hang 재도입·오프라인 push 차단 — 기각 확정)
- [ ] 자동 migrate 실행 경로 일체 (probe는 SELECT만, apply 0)
- [ ] alert/notification 인프라 신설 (노출은 기존 surface 한정)

**User-Facing Outcome:**
운영자(호영님·실행 세션)가 배포 직후 health/ops에서 "적용 안 된 migration N건"을 즉시 본다. 잠복 gap이 3일이 아니라 첫 확인 시점에 끝난다.

---

## 4. Product Constraints

**Must Preserve:**
- [x] canonical truth: `_prisma_migrations` = 적용 truth. manifest/probe = derived projection
- [x] ADR-002 §11.13 (빌드타임 migrate 금지) — probe는 이 결정을 보완하지 위반하지 않음
- [x] UI 무접촉 원칙 — 기존 health/ops surface 흡수, 새 페이지 0 (same-canvas)

**Must Not Introduce:**
- [x] placeholder success — probe 실패(DB 도달 불가)와 drift 0을 구분해 노출 (unknown ≠ ok)
- [x] dead path — smoke 스크립트는 실행·판정·종료코드까지 완결

**Canonical Truth Boundary:**
- Source of Truth: prod `_prisma_migrations` (적용 사실) + repo `prisma/migrations/` (의도)
- Derived Projection: 빌드 manifest, drift 계산 결과, health 필드
- Persistence Path: 없음 (읽기전용 — DB 쓰기 0)

**UI Surface Plan:**
- [x] Existing route section (`/api/health` 필드 + 기존 admin/ops 응답 확장)
- 새 페이지: 없음

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 빌드 시 manifest 생성 (prebuild에 폴더명 목록 JSON 생성 1스크립트) | serverless 번들에 `prisma/migrations/` 폴더 미포함 → runtime이 repo 의도를 알 방법 필요. DB 무접촉이라 ADR §11.13 무저촉 | 로컬 dev에서 manifest stale 가능 → 생성 시점 메타 포함으로 완화 |
| runtime probe = `db.$queryRaw` SELECT on `_prisma_migrations` | 앱 runtime은 DB 도달 가능(ADR 실측) — 매 배포 후 자동 감시 | Prisma 내부 테이블 스키마 의존 (5.22.0 고정, 낮음) |
| health = count/boolean, 상세 = admin/ops 전용 | migration 이름 = 스키마 정보 leak 방지 | — |
| smoke 스크립트 5432 direct + timeout | §pocandidate-root-fix deploy에서 검증된 패턴 (6543 hang 회피) | — |

**Dependencies:**
- Required Before Starting: Phase 0 prod SELECT 승인
- External Packages: 없음
- Touched: prebuild 스크립트(신규 1 + `package.json` prebuild 체인) / drift 서비스(신규) / health 라우트 / admin·ops 라우트(P0 실측 후 확정) / `scripts/smoke/`(신규 1) / DEV_RUNBOOK §9 / 테스트

**Integration Points:**
- `package.json` prebuild 체인 (`vercel-migrate.js` no-op 앞뒤 — no-op 자체는 무변경)
- `/api/health` 응답 계약 (기존 소비자 호환 — 필드 추가만)

---

## 6. Global Test Strategy

Red-Green-Refactor 강제. §pocandidate-root-fix 검증 규율 승계:
- corrupt→RED 없이 GREEN 금지. 원복 후 diff 잔존 0.
- 구문이 아니라 계약을 잠근다 (drift 계산: 입력 집합 → 출력 집합 관계식).
- probe 실패 상태(도달 불가)와 drift 0 구분을 계약에 포함 (false-ok 차단).
- Migration/Rollout 유형 → smoke + rollback 검증 필수.
- 격리 /tmp vitest 환경 패턴 승계, full-suite 신규 실패 0은 실행 세션 push 전 게이트가 최종 권위.

---

## 7. Implementation Phases

#### Phase 0: Context & Truth Lock (코드 변경 0)
**Goal:** 사고 메커니즘 확정 + 접점 실측.
- Status: [x] Complete (2026-08-04 — 4/4 실측, §12 기록)

**🔴 RED (확인 항목):**
- [ ] prod `_prisma_migrations` 읽기전용 SELECT (쿼리문 사전 제출·승인 후): 0801·0731·전체 행의 started_at/finished_at/applied_steps_count → 역전 메커니즘 (a) 부분 시야 deploy vs (b) resolve성 적용 확정
- [ ] `.github/workflows` 전수 — CI 정적 검사 삽입 지점 유무
- [ ] `/api/health` 현재 응답 형태·소비자 (스모크·모니터링 의존 여부)
- [ ] admin/ops 상세 노출 지점 후보 실측 (기존 surface 한정)
**🟢 GREEN:** 4건 답을 §12에 기록, drift 계약 문장 확정
**🔵 REFACTOR:** 메커니즘 확정에 따라 RUNBOOK 절차 항목 조정

**✋ Quality Gate:** 미확인 0건, prod 쓰기 0
**Rollback:** planning-only

#### Phase 1: Contract & Failing Tests
**Goal:** drift 계산·manifest 계약을 RED로 고정.
- Status: [x] Complete (2026-08-04 — RED 10/10 실증)

**🔴 RED:**
- [ ] drift 계산 unit: (manifest 집합, applied 행 집합) → pending/unknown/counts 관계식 테스트 → RED
- [ ] false-ok 차단 계약: probe 도달 불가 시 ok=false·상태 구분 → RED
- [ ] manifest 생성 계약: 폴더 전수·정렬·메타 → RED
**🟢 GREEN:** 스캐폴딩만 (구현 금지)
**🔵 REFACTOR:** 파일 헤더 커버리지 경계 명시

**✋ Quality Gate:** 신규 RED 전건 "처음부터 RED", 기존 회귀 0
**Rollback:** 테스트 파일 revert

#### Phase 2: Core — manifest 생성 + drift 서비스
**Goal:** Phase 1 RED → GREEN (로직만, wiring 없음).
- Status: [x] Complete (2026-08-04 — 10/10 GREEN·corrupt→RED 3종·0_init 계약 교정, §12)

**🟢 GREEN:**
- [ ] `scripts/generate-migration-manifest.cjs` + prebuild 체인 연결 (DB 무접촉)
- [ ] drift 계산 서비스 (`$queryRaw` SELECT, 쓰기 0)
**🔵 REFACTOR:** 없음 (최소 diff)

**✋ Quality Gate:** P1 unit GREEN, corrupt→RED 각 1회+원복, build 통과(프리빌드 체인 포함), 회귀 0
**Rollback:** 스크립트·서비스 파일 revert + prebuild 체인 원복

#### Phase 3: Wiring — health/ops 노출 + smoke + RUNBOOK
**Goal:** 감시가 실제 surface에 도달.
- Status: [x] Complete (2026-08-04 — W1·W2·W3 GREEN·corrupt→RED·회귀 315/0, §12)

**🔴 RED:** health 필드·admin 상세 통합 테스트 (mock db) → RED
**🟢 GREEN:**
- [ ] `/api/health` count/boolean 필드 (기존 계약 필드 추가만)
- [ ] admin/ops 상세 (P0 확정 지점)
- [ ] `scripts/smoke/migration-drift.cjs` (5432 override·timeout·종료코드)
- [ ] DEV_RUNBOOK §9: deploy 전 `migrate status` 선실행 / 워크트리 HEAD·pull 확인 / 폴더명 명명 규칙(수기 백데이트 금지)
**🔵 REFACTOR:** 없음

**✋ Quality Gate:** wiring 테스트 GREEN, no dead path·no placeholder success(도달 불가≠ok), 기존 health 소비자 회귀 0
**Rollback:** 라우트 필드 제거 + 스크립트 삭제로 완전 복원 (스키마·DB 무접촉이라 잔존 위험 0)

#### Phase 4: Rollout / Smoke / Rollback 문서화
**Goal:** prod에서 1회 실증 + 마감.
- Status: [x] Complete (2026-08-04 — health clean:true·smoke v2 exit 0, §12 실증 원문)

**🟢 GREEN:**
- [ ] 배포 후 prod probe 1회 — 현 drift 0 실측 (또는 발견 시 즉시 보고·정지)
- [ ] smoke 스크립트 prod 1회 실행 로그 §12 기록
- [ ] full-suite 신규 실패 0 (push 전 게이트, 실행 세션)
**🔵 REFACTOR:** 임시 계측 제거, §12 정리

**✋ Quality Gate:** path-specific 커밋 준비, 커밋·푸시는 호영님 명시 승인 후
**Rollback:** Phase 3 → 2 순서 revert. DB·스키마 무접촉이라 down-migration 불요.

---

## 8. Optional Addenda

### Migration Addendum (해당)
- 본 계획 자체는 **migration을 만들지 않는다** (DB 쓰기 0, SELECT만).
- probe·smoke가 발견한 pending의 해소는 기존 절차(operator-shell `migrate deploy` + project-ref echo + 명시 "진행" 게이트)를 따른다 — 이 계획은 발견 장치만.

---

## 9. Risk Assessment

| Risk | Prob | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| `_prisma_migrations` 내부 스키마 변경 | Low | Med | Prisma 5.22.0 고정. 컬럼 최소 의존(name·finished_at·rolled_back_at) |
| manifest stale (로컬 dev) | Med | Low | 생성 시점 메타 포함 + health에 generatedAt 노출 |
| health 필드 추가가 기존 소비자를 깨움 | Low | Med | P0에서 소비자 실측, 필드 추가만(제거·형변경 0) |
| probe가 앱 시작·응답 지연 유발 | Low | Med | health 핸들러 내 lazy·timeout, 캐시(짧은 TTL) 검토 — P2에서 확정 |
| 발견해도 아무도 안 봄 (가드 무력화) | Med | High | smoke를 RUNBOOK 배포 절차의 필수 스텝으로 명문화 + 실행 세션 인계 지시문에 포함 |

---

## 10. Rollback Strategy

- Phase 1 실패: 테스트 revert
- Phase 2 실패: 스크립트·서비스 revert + prebuild 체인 원복
- Phase 3 실패: 라우트 필드·smoke 스크립트 revert
- Phase 4 실패: 전체 revert (DB 무접촉 — 잔존물 0)

---

## 11. Progress Tracking

- Overall completion: 100% — 트랙 종료 (2026-08-04)
- Current phase: 없음 (전 Phase 완료)
- Current blocker: 없음
- Next validation step: 없음 — 상시 감시는 `/api/health` migrations 필드 + `npm run smoke:migration`

**Phase Checklist:**
- [x] Phase 0 / [x] Phase 1 / [x] Phase 2 / [x] Phase 3 / [x] Phase 4

---

## 12. Notes & Learnings

**계획 시점 기록 (2026-08-04, 계획 세션):**
- 발단: §pocandidate-root-fix Phase 2에서 0731 receiving_document 3일 잠복 gap + 0801과의 적용 순서 역전 발견 (해소는 완료, 재발 방지가 본 계획).
- pre-push prod DB 검사 기각 확정 (network·secret·hang·오프라인 push — §9 Out of Scope 근거).
- 빌드타임 migrate 재도입 아님을 ADR-002 §11.13에 대한 보완 관계로 명시 — probe는 SELECT만.

**Phase 0 Truth Lock 실측 (2026-08-04):**

*측정1 — health 라우트 (계획 세션):* `/api/health` 존재 (§11.14 구조 — status/db/urlOk/count 필드). 필드 추가형 확장 안전. drift count 삽입 지점 확정.

*측정2 — CI 워크플로 5종 전수 (계획 세션):* 전부 정적 검사(ubuntu, prod DB secret 없음 — AGENT_BOARD_TOKEN만 별건). CI에서 DB 검사 불가 → runtime probe + operator smoke 설계와 정합.

*측정3 — admin/ops 상세 지점 (계획 세션, 스코프 축소 확정):* **admin 라우트 신설 불요.** 상세 목록(pending/unknown 이름)은 smoke 스크립트(operator-shell)가 직접 출력, health는 count/boolean만. UI 무접촉 완전 달성. §7 P3의 "admin/ops 상세" 항목은 smoke 출력으로 대체.

*측정4 — prod `_prisma_migrations` SELECT (호영님 승인, 실행 세션 2026-08-04, 읽기전용 2건):*
- Q1 (≥20260725, UTC): `0801_receiving_inspection_decision` started 08-01 16:19:15, steps=1 / `0731_receiving_document` started **08-04 12:18:00**, steps=1 / `0804_pocandidate_quote_binding` 08-04 12:18:00, steps=1. 전 행 rolled_back null.
- Q2: total 52 · unfinished 0 · rolled_back 0.
- git 실측(실행 세션): 87e6bfae(0731 도입) 08-01 13:51 UTC landing(author==committer, rebase 흔적 0) / cec5f766(0801 도입) 08-01 15:48 UTC.

*Phase 0 판정 — 사고 메커니즘 확정:*
- **(b) resolve 조작 = 반증 확정**: 전 행 applied_steps_count=1(resolve-mark이면 0), rolled_back 0.
- **메커니즘 = 부분 시야 deploy**: 0801 적용 시점(16:19)에 0731(13:51 커밋)은 미적용 → 그 deploy 트리에 0731 부재. 커밋 시각상 0731이 먼저 존재했으므로, deploy가 **main HEAD가 아닌 트리(병렬 워크트리/브랜치, 87e6bfae 미포함)**에서 실행된 것. 폴더명(0731<0801)이 만든 "역전"은 착시이고 실질은 **deploy 트리 ≠ main HEAD**.
- **계약 기준 교정(실행 세션 지적 수용)**: 재발 가드 판정은 커밋 시각이 아니라 **deploy 트리 상태** 기준. git 커밋 시각만으로는 완전 확정 불가(deploy 로그 필요)하나, 가드 설계에는 충분 — probe의 pending/unknown 비대칭이 정확히 이 클래스를 관측한다.

*Phase 1–3 실행 기록 (2026-08-04, 격리 /tmp vitest 환경 — 공유 node_modules 무접촉):*
- **P1**: 계약 테스트 10건(C1 관측 5·C2 rolled-back 1·C3 false-ok 2·manifest 2) 처음부터 RED 확인 후 착수.
- **P2**: `migration-drift.ts`(computeMigrationDrift + probeMigrationDrift) + `generate-migration-manifest.cjs` 구현 → 10/10 GREEN. corrupt→RED 3종(rolled-back 무시·probe clean 위장·sql 필터 제거) 각각 해당 테스트만 RED + 원복 diff-clean. prebuild 체인 연결(`generate-migration-manifest.cjs` 선행).
- **P2 계약 교정 (실측 발견)**: 계획의 "14자리 타임스탬프 패턴" 필터가 오류 — repo에 `0_init`(비패턴, prod 적용 실재) 존재, 패턴 필터면 영구 unknown 오탐(51 vs prod 52 불일치로 발견). 계약을 **"migration.sql 보유 디렉토리 전수"**로 교정. 실repo CLI 실행 = 52건, prod 52행 정합.
- **P3**: health 라우트 `migrations` 필드(count/boolean만, W2 leak 가드 — 이름 배열 미노출 assert) RED 2→GREEN. probe 실패는 additive(`{ok:false,reachable:false}`), 기존 status 의미 불변(W3). corrupt→RED(필드 소실) 1회 + 원복 GREEN. smoke `scripts/smoke/migration-drift.cjs` = **`prisma migrate status` 래퍼**(계산 재구현 0 — 단일 소스): .env 로드·`:5432` 선검증(6543/부재 exit 2 실증)·마스킹 echo·90s timeout·종료코드 전달. DEV_RUNBOOK **§9.10 신설**(HEAD 일치 선확인·smoke 1명령·health 자동 감시·백데이트 금지).
- **P3 truth 보완 (Phase 0 누락분 실측)**: ① DEV_RUNBOOK **§9.5 drift 게이트(2026-06-13)가 이미 존재** — 단 tree-상대 검사라 0801-사고(부분 시야 deploy 트리에서는 status "up to date" 통과)를 못 막음 → §9.10이 이 맹점을 명시하고 main HEAD 일치 선확인 + manifest 기반 health 감시(트리 무관)로 보완. ② **prior art**: `scripts/smoke/migrate-revision-diff.ts`(ADR-001 §7, smoke DB 전용) 의 diffMigrationSets가 동일 취지 — 재사용 안 함(smoke guard 결합·rolled_back/false-ok 의미론 부재), 관계·동기화 주의를 migration-drift.ts 헤더에 명시.
- **회귀 게이트**: 참조·인접 스위트 **37파일 315 passed·0 failed·1 todo** (신규 12 포함; health lib·orders·bulk-po·budget·schema sentinel 전수). full-suite 신규 실패 0 + next build(프리빌드 체인 포함)는 push 전 게이트(실행 세션) 몫 — 이 환경에서 build 실행 불가.
- manifest JSON은 커밋 대상(dev/테스트 import 해석용) + 매 빌드 prebuild가 재생성(generatedAt 갱신). 커밋본 generatedAt은 참고값.

*Phase 4 실행 기록 (2026-08-04, 실행 세션 + 계획 세션):*
- 커밋 `2a341a3a`(11파일 + tsc 조임, 오염 0), push 완료(pre-push build hook 통과 — 1차 push는 hook build 2분 초과로 미완, 타임아웃 연장 재push 성공). 독립 검증(실행 세션): vitest 26파일 186 passed·0 failed, production tsc 0, 총 tsc 27(baseline 유지).
- **① health**: build log `[prebuild] migration-manifest: 52 migrations` PASS (manifest 52 = prod 적용 52). `/api/health` fetch는 배포 READY 후 실측.
- **② smoke FALSE STOP (설계 결함 실측)**: v1(.cjs)의 `prisma migrate status` 래퍼가 operator 환경 **5432에서도 90s hang**(exit null) → smoke가 STOP(3) 오판. DB 실상태는 직접 SELECT로 clean 확정(52·unfinished 0·rolled_back 0) — 실드리프트 아님. **§9.5 step 2(migrate status)도 동일 한계 상속** 확인.
- **해소 (a-변형, 재구현 아닌 재사용)**: smoke v2 = `scripts/smoke/migration-drift.ts`(tsx) — 런타임 probe와 **동일 모듈**(computeMigrationDrift) + generateManifest(워크트리 실시간) + `@prisma/client` 직접 SELECT(30s timeout). 계산 이원화 0 유지 + hang 제거. pending/unknown 이름 전체 출력(operator 전용 — health는 count만 원칙 불변). v1 .cjs 폐기(git rm). RUNBOOK §9.10-2 문구 갱신.
- 교훈: "CLI 래퍼 = 단일 소스" 논리는 CLI hang 인프라 실측 앞에서 기각 — 단일 소스는 CLI가 아니라 **공유 모듈 재사용**으로 달성.
- **smoke v2 실증 (실행 세션)**: `npx tsx` 실행 → :5432 echo·manifest 52·applied 52·unfinished 0·rolledBack 0·**exit 0, hang 0** — v1 FALSE STOP 해소 확인. 추가 발견: 문서 표기 `pnpm exec tsx`가 npm 설치본 operator 셸에서 미해석 → **package.json `smoke:migration` 스크립트(런너 중립) 채택**, 문서 command 통일 (호영님 (2)안 승인 2026-08-04).

*최종 마감 (2026-08-04, P4 GREEN 3건 원문 접수):*
- 커밋 계보: `2a341a3a`(가드 본체 11파일) → `4e39277a`(smoke v2 전환 5파일, .cjs 폐기). 원격 HEAD `4e39277a`, 두 push 모두 build hook 통과.
- P4 실증: ① health `migrations` = `{ok:true, reachable:true, pendingCount:0, unknownCount:0, unfinishedCount:0, rolledBackCount:0, clean:true}` / ② smoke v2 `npm run smoke:migration` exit 0 (manifest 52·applied 52·hang 0) / ③ build log prebuild 52.
- 확증: 직접 `$queryRawUnsafe`는 pooler에서 정상(probe reachable:true), `migrate status` CLI만 hang — 직접-쿼리 패턴이 표준(메모리 고정, 실행 세션).
- **트랙 종료.** 상시 감시 운영: 배포 후 health `clean:true` 확인(§9.2 step 4) + push 전 `npm run smoke:migration`(§9.10-2) + deploy 전 HEAD 일치(§9.10-1).

*계약 문장 확정 (Phase 1 RED의 대상):*
1. **관측 계약**: main HEAD 기준 manifest 집합 M, prod 적용 집합 A에 대해 `pending = M − A`, `unknown = A − M`, 그리고 unfinished/rolled_back count가 항상 계산·노출된다. (0801-사건 시그니처 = pending>0 지속 또는 unknown>0.)
2. **false-ok 차단 계약**: DB 도달 불가/쿼리 실패는 `ok=false`·`reachable=false`로 drift 0과 명확히 구분된다 (placeholder success 금지).
3. **절차 계약(RUNBOOK §9 갱신)**: deploy 직전 (i) `git fetch` + main HEAD 일치 확인(워크트리 포함), (ii) `migrate status` 선실행, (iii) 폴더명 타임스탬프 수기 백데이트 금지(도구 생성 타임스탬프 유지).
- prod 조회 종료 (추가 쿼리 없음).
