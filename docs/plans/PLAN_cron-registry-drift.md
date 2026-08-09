# Implementation Plan: §cron-registry-drift

- **Status:** ⏳ Pending (Phase 0 완료 — 승인 후 Phase 1 착수)
- **Started:** 2026-08-08
- **Last Updated:** 2026-08-08
- **Estimated Completion:** 2026-08-09
- **선택안:** **B — 라이브 배선** (A 최소diff / C 폐기 대비 승인)

**CRITICAL INSTRUCTIONS**: After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 Run all relevant quality gate validation commands
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date
5. 📝 Document learnings in Notes section
6. ➡️ Only then proceed to the next phase

⛔ DO NOT skip quality gates or proceed with failing checks
⛔ DO NOT introduce dead button / no-op / placeholder success / dead column
⛔ DO NOT touch `apps/web/vercel.json` crons — canonical, 이번 트랙에서 무변경

---

## 0. Truth Reconciliation

### Latest Truth Source (2026-08-08 실측, read-only)

| # | 사실 | 근거 |
| :--- | :--- | :--- |
| T1 | cron route **7개** 실존, `apps/web/vercel.json` crons 7건과 1:1 | `src/app/api/cron/` — catalog-ingest / dashboard-snapshot / inventory-check / order-followup-check / quote-expiry-check / retention-archive / user-soft-delete-purge |
| T2 | `VERCEL_CRON_REGISTRY` = **5 entry**. `catalog-ingest`(`0 3 * * *`) · `retention-archive`(`0 4 * * *`) 누락 | `src/lib/ops-console/vercel-cron-registry.ts` |
| T3 | **registry importer = 0** — 자기 파일과 sentinel 외 소비처 없음 (`app`·`components`·`lib` 전수 grep) | scoped grep, 2026-08-08 |
| T4 | 두 누락 route 모두 파일 헤더에 목적·스케줄·rollback 명시 | `catalog-ingest/route.ts` (flag `CATALOG_PUBLIC_INGEST` + `PROCUREMENT_API_KEY` 이중 gate, 부재 시 no-op 보고) / `retention-archive/route.ts` (soft archive only, `dryRun=1` 지원, hard delete 0) |
| T5 | 두 route 모두 `CRON_SECRET` Bearer 또는 `x-vercel-cron-signature` 검증 — 수동 차단 지점 존재(env 제거) | route.ts 상단 auth 블록 |
| T6 | 두 route 모두 `logCronExecution` 래핑 → `CronExecutionLog` 에 실행 이력 이미 적재 | route.ts import |
| T7 | `/admin/cron` 은 `CronExecutionLog` **실행 이력만** 소비. registry 미참조 → 목적·KST·차단지점·기대결과가 화면에 없음 | `app/admin/cron/page.tsx`, `app/admin/cron/_components/cron-execution-table.tsx`, `app/api/admin/cron/route.ts` |

### RED 3건의 정체 (`src/__tests__/ops/vercel-cron-registry.test.ts`)
1. `#4 총 5 cron entry` — `expect(config.crons.length).toBe(5)` 하드값
2. `#5 vercel.json cron은 운영 레지스트리와 1:1` — paths 동치 실패 (7 vs 5)
3. `#5 모든 cron은 목적·prod-only·수동 차단 지점을 가진다` — 7건 순회 중 registry 미존재 2건에서 실패

`cron-monitoring.test.ts:266` 은 5개 path `toContain` 포함 검사 → 7건에서도 GREEN. **충돌 없음**(실측).

### Conflicts Found
**CF1 — 백로그 등재 시 진술 오류 (자기 정정)**
- 등재 문구: "prod cron 2개가 목적·prod-only 대상·수동 차단 지점 문서 없이 실행 중"
- 실측: **거짓**. T4·T5 대로 route 파일에 전부 있고 auth gate 도 있다.
- 실제 결함: ① 운영 레지스트리(`VERCEL_CRON_REGISTRY`)가 stale ② 그 레지스트리를 **아무 라이브 표면도 읽지 않음**(T3) ③ 그래서 `/admin/cron` 에 목적·차단지점이 없음(T7).
- 교훈: RED 신호를 근거로 결함 성격까지 추정하지 말 것. 신호는 "무언가 어긋남" 까지만 증명한다.

**CF2 — sentinel 세대 잠금**
- sentinel 헤더는 "vercel.json crons = canonical (host Vercel 가 읽음)" 이라 선언해 놓고, `#4` 는 `length === 5` 하드값으로 잠근다. canonical 이 늘면 파생 sentinel 이 깨지는 구조.
- §inventory-dead-file-cleanup 의 "옛 값 잠금" 과 동일 클래스. 개수를 잠그지 말고 **정합**을 잠가야 한다.

### Chosen Source of Truth
- **`apps/web/vercel.json` crons(7) = canonical** (host Vercel 이 실제로 읽는 유일 판본).
- `VERCEL_CRON_REGISTRY` · sentinel · `/admin/cron` = 전부 derived → canonical 을 따라간다.
- 이번 트랙에서 `vercel.json` 은 **무변경**. cron 추가/삭제/스케줄 변경 0.

### Environment Reality Check
- [x] repo 도달 (`C:\Users\young\ai-biocompare`) read-only 실측
- [x] RED 3건 위치·원인 특정
- [ ] **실행 불가(sandbox)**: vitest (Windows `node_modules` ↔ 리눅스 VM `@rollup/rollup-linux-x64-gnu` MODULE_NOT_FOUND). 격리 `/tmp` 미니트리로 대체, **권위는 실행 세션 독립 재현**
- [ ] **실행 불가(sandbox)**: prod `CronExecutionLog` 조회 — Phase 4 smoke 는 실행 세션 담당

---

## 1. Priority Fit

- [ ] P1 immediate
- [ ] Release blocker
- [ ] Post-release
- [x] **P2 / 운영 가시성 + baseline 위생**

**Why:** prod 영향 0 — cron 7건 정상 실행, 이력 적재 중(T6). 결함은 ① 운영자가 `/admin/cron` 에서 "이 cron 이 무엇을 하고 어떻게 끄는지" 를 볼 수 없음 ② baseline 에 RED 3건 상주 → 신규 RED 판독을 흐림. 현재 P1 충돌 없음.

---

## 2. Work Type

- [x] Bugfix (stale derived data)
- [x] Design Consistency / 운영 가시성 (same-canvas 컬럼 결합)
- [ ] Feature / API Slimming / Migration / Billing / Mobile

---

## 3. Overview

**Description:** canonical(`vercel.json` crons 7)과 derived(`VERCEL_CRON_REGISTRY` 5) 의 drift 를 해소하고, importer 0 이던 registry 를 `/admin/cron` 라이브 표면에 배선해 운영자가 실행 이력과 함께 **목적·KST 시각·수동 차단 지점·기대 결과**를 한 화면에서 보게 한다.

**Success Criteria:**
- [ ] `VERCEL_CRON_REGISTRY` 가 canonical 7건과 1:1
- [ ] registry importer ≥ 1 (라이브 표면) — 테스트 전용 자산 탈피
- [ ] `/admin/cron` 테이블에 목적·KST·차단지점 표시, **registry 미등록 path 는 경고 행으로 가시화**(무음 누락 금지)
- [ ] sentinel 이 개수 하드값이 아니라 **canonical↔registry 정합**을 잠금 → cron 추가 시 registry 누락이 자동 RED
- [ ] baseline RED 3건 해소, 신규 회귀 0

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] `apps/web/vercel.json` 수정 (crons 7 · schedule · buildCommand 전부 무변경)
- [ ] cron route 로직 변경 / 신규 cron 추가 / 스케줄 조정
- [ ] `CronExecutionLog` 스키마 변경 · migration (DDL 0)
- [ ] `/admin/cron` 을 새 페이지로 분리하거나 rail/dock 구조 변경
- [ ] cron 수동 실행(trigger) 버튼 신설 — 비가역 액션, 별도 트랙
- [ ] `cron-monitoring.test.ts` 의 5-path 포함 검사 변경 (GREEN 유지, 무접촉)

**User-Facing Outcome:** admin 사용자가 `/admin/cron` 에서 각 cron 의 목적·실행 시각(KST)·중단 방법을 실행 이력과 함께 확인. 그 외 사용자 표면 변경 0.

---

## 4. Product Constraints

**Must Preserve:**
- [ ] `/admin/cron` same-canvas — 기존 `CronExecutionTable` 에 **컬럼 결합**, 새 페이지·새 탭 0
- [ ] admin gate 2-layer (server `isAdmin()` + client `useSession`)
- [ ] `admin/rum` 레이아웃 패턴 (page.tsx + `_components` 분리)
- [ ] `CronExecutionLog` read-only — mutation 0

**Must Not Introduce:**
- [ ] dead column — registry 값이 비는 열
- [ ] 무음 누락 — registry 미등록 cron 이 화면에서 조용히 사라지는 것
- [ ] canonical 을 UI/registry 가 대신 드는 역전
- [ ] 개수 하드값 재도입 (CF2 재발)

**Canonical Truth Boundary:**
- Source of Truth: `apps/web/vercel.json` crons (host 가 읽는 판본) + `CronExecutionLog` (실제 실행 사실)
- Derived Projection: `VERCEL_CRON_REGISTRY` (운영 메타), `/api/admin/cron` 집계 응답
- Snapshot / Preview: 없음
- Persistence Path: 없음 (이번 트랙 write 0)

**UI Surface Plan:**
- [x] Existing route section — `/admin/cron` 테이블 컬럼 확장
- [ ] 새 페이지 (❌ 금지)

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| registry join 을 **서버(`/api/admin/cron`)** 에서 수행 | 클라이언트가 registry 를 import 하면 운영 메타가 번들에 실려 표면 확대. 서버 조인이 응답 계약 1곳으로 수렴 | 응답 payload 소폭 증가 |
| sentinel 잠금을 개수 → **정합**으로 이전 | canonical 이 늘어도 깨지지 않고, registry 누락은 반드시 잡힌다 (CF2 해소) | 개수 자체는 더 이상 고정되지 않음 → cron 신설 자체는 sentinel 이 막지 않음(의도) |
| registry 미등록 path 는 **경고 행**으로 렌더 | 조용히 빠지면 §11.250b(dead cron) 같은 사건을 다시 못 잡는다 | 화면에 예외 상태 분기 1개 추가 |
| `vercel.json` 무변경 | canonical 은 이미 옳다. 고칠 것은 derived 쪽 | 없음 |

**Dependencies:**
- Required Before Starting: 없음 (§migration-rollout-gate 종결됨)
- External Packages: 없음
- Files Touched (예상 5):
  - `src/lib/ops-console/vercel-cron-registry.ts` (+2 entry)
  - `src/app/api/admin/cron/route.ts` (registry join)
  - `src/app/admin/cron/_components/cron-execution-table.tsx` (컬럼 + 경고 행)
  - `src/__tests__/ops/vercel-cron-registry.test.ts` (잠금 이전)
  - (신규) `src/__tests__/ops/cron-registry-live-wiring.test.ts` — importer ≥ 1 잠금

**Integration Points:** `GET /api/admin/cron?period=7d|30d` 응답 계약 / `/admin/cron` 테이블 / `CronExecutionLog` 집계

---

## 6. Global Test Strategy

- **Red-Green-Refactor 엄수.** 각 phase 의 RED 를 **실행 캡처**로 먼저 확인 — 통과하면 단언이 공허(2026-08-08 교훈).
- registry 완비 = 데이터 단언 (unit).
- API join = 응답 계약 단언 (integration).
- 화면 배선 = **importer 실측** — "registry 를 읽는 라이브 파일이 존재한다" 를 정적으로 잠근다(§inventory-dead-file-cleanup 계보: 스타일·문자열 존재는 라이브의 증거가 아니다).
- 부정 단언은 **주석 제거본 기준**으로 설계 (2026-08-08 false RED 교훈).
- 실행 권위: 실행 세션 독립 vitest. sandbox 는 격리 `/tmp` 참고값.

---

## 7. Implementation Phases

### Phase 0: Context & Truth Lock
**Goal:** canonical 확정, RED 3건 원인 특정, 결함 성격 정정.
- Status: [x] Complete (2026-08-08)

**🔴 RED:** 백로그 진술("문서·차단지점 없음") 검증 → T4·T5 로 **반증**
**🟢 GREEN:** T1–T7 실측, CF1·CF2 확정, canonical = `vercel.json` crons(7)
**🔵 REFACTOR:** 안 A/B/C 비교 후 B 확정 — importer 0 유지(A)는 §migration-rollout-gate 가 제거한 유물과 동종

**✋ Quality Gate:** [x] 미해결 충돌 0 [x] 추정/실측 구분 [x] priority fit 기록 [x] 자기 진술 오류 정정 기록
**Rollback:** planning-only

---

### Phase 1: Contract & Failing Tests (RED)
**Goal:** 잠금을 개수 → 정합으로 이전하고, 목표 상태를 테스트로 먼저 고정.
- Status: [ ] Pending

**🔴 RED:**
- [ ] `vercel-cron-registry.test.ts` `#4` 의 `length === 5` 제거 → **`vercel.json` crons 길이와 registry 길이 동치** 로 교체
- [ ] `#5` 1:1 정합·필드 필수 단언 유지 (현 상태 RED 그대로)
- [ ] 신규 단언: `vercel.json` 의 모든 path 에 대해 registry entry 필수 + `schedule` 일치 + `scheduleKst` = UTC+9 환산값
- [ ] 신규 파일 `cron-registry-live-wiring.test.ts`: `VERCEL_CRON_REGISTRY` 를 import 하는 **비테스트 소비처 ≥ 1** (경로 화이트리스트 없이 `src/app`·`src/components` 스캔)
- [ ] **RED 실행 캡처** — 신규 단언 전부 현 상태에서 FAIL 확인

**🟢 GREEN:** 기존 GREEN 단언(#1 JSON 유효성·#2 신규 2건·#3 보존·path/schedule 형식) 무변경 확인
**🔵 REFACTOR:** sentinel 헤더 주석을 CF2 반영해 갱신 — "개수가 아니라 정합을 잠근다" 명시

**✋ Quality Gate:**
- [ ] 신규 단언 RED 캡처 존재 (공허 0)
- [ ] `cron-monitoring.test.ts` 무접촉·GREEN 유지
- [ ] lint / typecheck 통과 or "실행 불가" 명기

**Rollback:** sentinel 변경 revert (1 커밋)

---

### Phase 2: Registry 완비 (GREEN)
**Goal:** canonical 7건과 1:1. 값은 **route 헤더 실측 근거**만 사용, 날조 0.
- Status: [ ] Pending

**🔴 RED:** Phase 1 의 1:1 단언 FAIL 재확인
**🟢 GREEN:** `VERCEL_CRON_REGISTRY` 에 2 entry 추가
- [ ] `/api/cron/catalog-ingest` — `0 3 * * *` / **매일 12:00 KST** / 목적: 조달청 공공데이터 식별 계층 nightly ingest (`procurementCatalogRef` upsert 전용, `db.product` write 0) / 차단: env `CATALOG_PUBLIC_INGEST` 또는 `PROCUREMENT_API_KEY` 제거 시 즉시 no-op / 확인: ingest 건수·`remainingCodes` cursor / 기대: 카탈로그 ref 증분 적재
- [ ] `/api/cron/retention-archive` — `0 4 * * *` / **매일 13:00 KST** / 목적: FREE 플랜 보존기간(`RETENTION_MONTHS`=3) 경과 데이터 soft archive(`archivedAt`), hard delete 0 / 차단: `PRICING_ENFORCE_CUTOFF` 미설정 시 skip, `?dryRun=1` 로 write 0 예행 / 확인: archived 건수·dryRun 카운트 / 기대: 만료 데이터 soft 아카이브
- [ ] 기존 5건 필드 무변경 (diff 최소)

**🔵 REFACTOR:** `environment: "prod-only"` 일관성 확인, 문구 톤 통일

**✋ Quality Gate:**
- [ ] Phase 1 의 1:1·필드 필수 단언 GREEN
- [ ] registry 값이 route 헤더와 모순 0 (schedule·gate·rollback)
- [ ] `vercel.json` diff 0
- [ ] 기존 5 entry diff 0

**Rollback:** 2 entry 제거 (revert 1회)

---

### Phase 3: 라이브 배선 — `/admin/cron` (GREEN)
**Goal:** importer 0 해소. 실행 이력 옆에 운영 메타를 붙인다.
- Status: [ ] Pending

**🔴 RED:**
- [ ] `/api/admin/cron` 응답에 registry 메타 필드 부재를 단언 → FAIL 확인
- [ ] `cron-registry-live-wiring.test.ts` importer ≥ 1 FAIL 재확인

**🟢 GREEN:**
- [ ] `app/api/admin/cron/route.ts` — 집계 행에 `getVercelCronRegistryEntry(cronPath)` 조인, `purposeKo`·`scheduleKst`·`manualGateKo`·`expectedResultKo` 부착. `CronExecutionLog` read-only 유지
- [ ] registry 에 없는 `cronPath` 는 `registry: null` 로 반환 — **드롭 금지**
- [ ] `cron-execution-table.tsx` — 목적 / KST / 차단 지점 표시. `registry: null` 행은 **"레지스트리 미등록" 경고 행**으로 렌더
- [ ] 실행 이력이 0건인 registry 항목도 "아직 실행 없음" 으로 표시 (등록됐으나 안 도는 cron = §11.250b 재발 신호)
- [ ] loading / error / empty 상태 유지

**🔵 REFACTOR:** 테이블 열 폭·모바일 축약(같은 캔버스 내 반응형), 중복 라벨 제거

**✋ Quality Gate:**
- [ ] importer ≥ 1 GREEN
- [ ] dead column 0 (모든 열이 실제 값 또는 명시적 경고를 가짐)
- [ ] admin gate 2-layer 보존
- [ ] no-op / front-only success 0 — 표시 전용, mutation 0
- [ ] `cron-monitoring.test.ts` 전건 GREEN 유지

**Rollback:** route join + 컬럼 revert → Phase 2 상태(테이블은 기존 실행 이력만)

---

### Phase 4: Smoke / Rollout / Rollback
**Goal:** 실제 화면·응답으로 확인하고 회귀 없음을 확정.
- Status: [ ] Pending

**🔴 RED:** 실패 모드 정의 — ① registry 미등록 cron 이 화면에서 사라짐 ② 실행 이력 0인 항목 누락 ③ admin 아닌 계정 접근
**🟢 GREEN:**
- [ ] 전체 vitest — RED 3건 해소, 신규 GREEN, 그 외 실패 수 불변(반증 실험 병행)
- [ ] prod `/admin/cron` 실측 — 7행 표시, 목적·KST·차단지점 채워짐, `catalog-ingest`·`retention-archive` 포함
- [ ] 비-admin 세션 접근 차단 확인
- [ ] 배포 후 빌드 로그 `[prebuild] vercel-migrate.js is a NO-OP` 2줄 확인 (§9.4 정본 절차)

**🔵 REFACTOR:** 임시 계측 제거, 계획서 §11·§12 마감

**✋ Quality Gate:**
- [ ] 실패 모드 3종 전부 방어됨
- [ ] rollback 문서화
- [ ] DDL 0 · prod DB 무변경 확인

**Rollback:** 코드 revert 단독 (DB 조치 없음)

---

## 8. Addenda
해당 없음 (Billing · Migration · Mobile · API Slimming 미접촉). Workflow/Ontology 도 미접촉 — admin 운영 화면 단독.

---

## 9. Risk Assessment

| Risk | P | I | Mitigation |
| :--- | :--- | :--- | :--- |
| 잠금을 정합으로 이전하면 cron 신설 자체는 sentinel 이 막지 못함 | High | Low | 의도된 설계. 신설 시 registry 누락이 즉시 RED 이므로 "조용한 추가" 는 불가 |
| registry 값이 route 실제 동작과 어긋난 채 화면에 표시 (문서형 거짓) | Med | High | Phase 2 값은 route 헤더 실측만 사용. Phase 4 에서 실제 실행 이력과 대조 |
| admin 테이블 컬럼 증가로 모바일 가독성 저하 | Med | Low | 같은 캔버스 내 반응형 축약. 새 페이지 분리 금지 |
| `/api/admin/cron` payload 증가 | Low | Low | registry 는 정적 상수 — DB 쿼리 증가 0 |
| Phase 3 이 registry 없는 path 를 드롭해 무음 누락 재생산 | Low | High | `registry: null` 명시 반환 + 경고 행. Phase 4 실패 모드 ①로 검증 |

---

## 10. Rollback Strategy

- Phase 1 실패: sentinel 변경 revert
- Phase 2 실패: registry 2 entry 제거
- Phase 3 실패: route join + 테이블 컬럼 revert (Phase 2 상태 유지 — sentinel 은 여전히 GREEN)
- Phase 4 실패: 해당 커밋 `git revert`
- **DB**: 전 phase DDL·mutation 0 → DB rollback 대상 없음

---

## 11. Progress Tracking

- Overall completion: 100% — 트랙 종료 (커밋 `7ea264e0` · 배포 `dpl_8aLi58UDe2jB6a2Gk3PZMkDhpaem` · prod 육안 실측 ①~⑥ 전항 PASS)
- Current phase: 완료
- Current blocker: 없음
- Next validation step: 없음. 후속 백로그 3건은 별도 트랙(§12 참조)

**Phase Checklist:**
- [x] Phase 0 complete
- [x] Phase 1 complete (sentinel 계약 전환 — 개수 → 정합)
- [x] Phase 2 complete (registry 완비 5 → 7)
- [x] Phase 3 complete (`/admin/cron` 라이브 배선 — importer 0 해소)
- [x] Phase 4 complete (배포 + prod 육안 실측)

---

## 12. Notes & Learnings

**Blockers Encountered:**
- [2026-08-08] 백로그 등재 진술("prod cron 2개 미문서화·차단지점 없음")이 실측으로 **거짓** 판명 → 결함 성격 재정의(stale registry + importer 0 + admin 가시성). RED 신호로 결함 성격까지 추정하지 말 것.

**Implementation Notes:**
- 선행 트랙 §migration-rollout-gate 종결(커밋 `7827b2cd`, 배포 `dpl_B3jo8tWL6P8U1G18ATYaY8ta2AEp` READY)에서 파생된 발견.
- CF2(개수 하드값 세대 잠금)는 §inventory-dead-file-cleanup 의 "옛 값 잠금" 과 동일 클래스 — 파생 자산은 canonical 을 **참조**해야지 **복사**하면 안 된다.
- A안(registry 2건만 추가)을 기각한 이유: importer 0 유지 = 아무도 읽지 않는 문서 자산 존속. 방금 §migration-rollout-gate 에서 제거한 유물과 동종.
- sandbox vitest 실행 불가(Windows `node_modules` ↔ 리눅스 VM) — 격리 `/tmp` 미니트리 사용, 권위는 실행 세션.

**실행 세션 마감 실측 (2026-08-09, 커밋 `7ea264e0`):**

- **(a) amber 위반 발견·교정 — 설계 단계 §9 미확인이 원인.**
  앰버 경고 UI 6곳(`cron-execution-table.tsx`: 배너 1 · 행 배경 1 · 텍스트 4)이 CLAUDE.md §9(주의색=**yellow**, `amber-*`/`orange-*` 전면 금지)를 위반해 §11.302d-6d-3 sentinel 이 RED 로 잡았다. yellow 신호등으로 치환(배너 `bg-yellow-50 border-yellow-200 text-yellow-800` = §9 큰 카드 규격, 텍스트 `text-yellow-700` = §9 배지 규격), **의미(주의) 보존**. 잔존 amber/orange 0.
  원인은 UI 색상 클래스를 새로 쓰면서 §9 색상 정책을 조회하지 않은 것 — sandbox 에 마운트돼 있었는데 읽지 않았다. **규율 추가: UI 클래스 신규 작성 전 §9 확인 + 정적 검사 목록(`check-brand-regression.sh` 계열) 선조회.** 정적 sentinel 이 잡아준 것은 다행이나 설계 단계에서 걸렀어야 했다.

- **(b) 전체 스위트 회계 분해 — 단순 차분은 오판을 부른다.**
  1차 측정 `252 → 250`(-2)은 판정 기준(-3)에 미달하는 것처럼 보였으나, 실제 분해는 **-3(cron 해소) +1(amber 회귀) -1(flaky 노이즈)** 였다. 파일 단위 집합 대조로 증가분을 특정해 amber 회귀를 잡아냈다. 교정 후 최종 **249 failed / 11378 passed / 112 failed files** = baseline(252/11369/113) 대비 **-3, 증가 0**.
  교훈: 총합 차분만 보면 "해소"와 "신규 회귀"가 상쇄돼 서로를 가린다. **집합 대조**가 필수.

- **(c) flaky 크레딧 배제.**
  `src/lib/ai/__tests__/dispatch-execution-handoff.test.ts` 가 baseline 실패 목록에서 사라졌으나 **미접촉 파일**이었고, 단독 재실행에서 **다시 실패** → flaky 확정. 해소 크레딧으로 계상하지 않았다. 간헐 RED 는 baseline 판독을 오염시키므로 별도 트랙으로 등재.

- **(d) 빌드 실측으로 alias 확증 (sandbox 미검증 구간 해소).**
  `@/lib/ops-console/vercel-cron-registry` 가 서버 route 번들에서 해석되는지는 vitest alias 통과로 증명되지 않는다. `npm run build` → `✓ Compiled successfully` 에 더해 **산출물로 확증**: `BUILD_ID` 갱신 · app-path 매니페스트에 `"/api/admin/cron/route"` 등재 · `.next/server/app/api/admin/cron/route.js` 실존. 상대경로 교체 불요.
  로그의 `[admin/cron] Dynamic server usage` 는 `headers` 사용 라우트의 프리렌더 정상 메시지로 canary·users·quotes 등 admin 계열 다수에 동일 출현 — 빌드 실패가 아니다.

- **(e) 커밋·배포·prod 육안 실측 (①~⑥ 전항 PASS).**
  커밋 `7ea264e0` / 배포 `dpl_8aLi58UDe2jB6a2Gk3PZMkDhpaem`(production, alias `labaxis.co.kr` 승계, build 246s).
  ① **7행 전부 표시** — `catalog-ingest`·`retention-archive` 포함(registry 순회 누락 0)
  ② **11열 전부 채워짐, 빈 열 0** — CRONPATH·실행 시각·목적·차단 지점·실행 수·성공률·실패·평균 시간·P95·마지막 실행·마지막 결과. 우측 절단 컬럼(P95·마지막 실행·마지막 결과)까지 가로 스크롤해 육안 확인 — dead column 0
  ③ **미등록 배너 미출력** — canonical 7 = registry 7 이므로 `unregisteredCount = 0` 정상. join 결함 없음
  ④ `catalog-ingest` 6회 · `retention-archive` 7회 실행 이력 실재(성공률 100%). 판정 대상인 **행 존재** 충족
  ⑤ **가로 스크롤 정상** — 테이블 자체 `overflow-x-auto` 스크롤바 작동, 페이지 body 가로 넘침 0
  ⑥ **미인증 401** (`{"error":"인증이 필요합니다."}`). 라우트 가드는 401(세션 없음) → 403(`isAdmin` 불통과) 2단 실재. ⚠️ *로그인한 비-admin* 403 경로는 별도 계정이 필요해 **런타임 미실행** — 코드 분기 확인까지만(정직 표기)
  색상 정합도 확인: 성공 배지 emerald·실패 0 회색, amber 0 (§9 준수).

**후속 백로그 (본 트랙 out of scope, 등재 완료):**
- `dispatch-execution-handoff.test.ts` flaky 원인 규명 — 간헐 RED 가 baseline 판독 오염
- `__tests__/helpers/page-imports-smoke.ts` 부재로 테스트 1파일 로드 실패(tsc baseline 27 의 TS2307 포함)
- dead 후보 3호 `app/_workbench/_components/vendor-responses-panel.tsx`(importer 0 실측) 조사

**To Revisit Later:**
- `/admin/cron` 에서 cron 수동 실행(trigger) — 비가역 액션이라 승인 게이트 설계 필요. 별도 트랙.
- registry 를 `vercel.json` 에서 자동 생성할지(단일 출처화) 여부 — 현재는 수기 2중 관리. Phase 4 이후 판단.
