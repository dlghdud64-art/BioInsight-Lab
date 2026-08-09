# Implementation Plan: §migration-rollout-gate

- **Status:** 🔄 In Progress (Phase 0·1·2 sandbox 완료 — 실행 세션 재현·커밋 대기)
- **Started:** 2026-08-08
- **Last Updated:** 2026-08-08
- **Estimated Completion:** 2026-08-09

**CRITICAL INSTRUCTIONS**: After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 Run all relevant quality gate validation commands
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date
5. 📝 Document learnings in Notes section
6. ➡️ Only then proceed to the next phase

⛔ DO NOT skip quality gates or proceed with failing checks
⛔ DO NOT introduce dead button / no-op / placeholder success
⛔ DO NOT run any prod DB write / migrate / reset from the planning sandbox

---

## 0. Truth Reconciliation

### Latest Truth Source (2026-08-08 실측, read-only)

| # | 사실 | 근거 |
| :--- | :--- | :--- |
| T1 | RUNBOOK §9.2 는 5단계 표준 절차를 **이미** 담고 있다: ①schema 변경+`migrate dev` ②commit(push 안 함) ③operator-shell `prisma migrate deploy` ④smoke probe ⑤push | `docs/DEV_RUNBOOK.md` §9.2 |
| T2 | §9.3 "순서 위반 금지" — code 선배포 → schema 후migrate 는 P2021/P2003 500. 정본 순서 = **migrate → verify → push** | `docs/DEV_RUNBOOK.md` §9.3 |
| T3 | DDL 은 **session pooler `:5432`** 로 실행. `:6543` transaction pooler 는 advisory-lock 미지원 → DDL 실패/락. direct host `db.<ref>.supabase.co:5432` 는 P1001 unreachable | §9.2 step 3 주석 (2026-07-04 §cas-hazard-classification 학습) |
| T4 | `apps/web/scripts/vercel-migrate.js` = 완전 NO-OP. DB 접속·spawn·execSync 0, 로그 2줄 후 `process.exit(0)` | 파일 전문 |
| T5 | `apps/web/package.json` prebuild = `generate-migration-manifest.cjs && vercel-migrate.js && copy-pretendard-font.js` | `apps/web/package.json` |
| T6 | drift 게이트 자산 **이미 존재**: `npm run smoke:migration` → `scripts/smoke/migration-drift.ts`. `:6543` 감지 exit 2 / DB 미도달 exit 3(clean 위장 차단) / drift exit 1 / clean exit 0 | 파일 헤더 주석 + `package.json` |
| T7 | `/api/health` 가 `pendingCount` · `clean` 노출 | `apps/web/src/app/api/health/route.ts` L55, L59 |
| T8 | `schema.prisma` 의 `directUrl` 은 주석 처리되어 제거된 상태 (ADR-002 §11.13) | `apps/web/prisma/schema.prisma` datasource 블록 |

### Conflicts Found

**C1 — 루트 `vercel.json` = 미사용 확정, 그러나 `migrate deploy` 문구 잔존**
- 파일 내용: `"buildCommand": "npx prisma generate && npx prisma migrate deploy && npm run build"`
- 반증: 최신 prod 빌드 로그 — `dpl_213TwWpVJPw8RKnHPBMAmyhuwd3q` / commit `c476c2b` / 2026-08-08 02:36 (project `prj_sJ6yIgyW59VrOCbTfFbfwO4aJjim`)
  ```
  Running "install" command: `npm install`
  Running "npm run build"
  > web@0.1.0 prebuild
  > node scripts/generate-migration-manifest.cjs && node scripts/vercel-migrate.js && node scripts/copy-pretendard-font.js
  [prebuild] vercel-migrate.js is a NO-OP since 2026-04-25 (ADR-002 §11.13).
  ```
  → 루트 buildCommand 라인 **미출현**. 실제 실행 경로는 `apps/web` (Root Directory = `apps/web`, `apps/web/vercel.json` + crons 7건이 유효 판본).
- 부수 증거: 루트 파일의 `"rootDirectory": "apps/web"` 는 vercel.json 스키마에 없는 **무효 키** — 애초에 의도대로 동작한 적 없음.
- 영향: "push 하면 migration 이 자동 적용된다" 는 오독의 1차 유발원. 2026-08-08 prod 장애의 문서/설정 측 원인.

**C2 — RUNBOOK §9.4 stale (역방향 위험)**
- 현 문구: "`DIRECT_URL` 제거 가능 (영향 0) — `schema.prisma` 의 `directUrl` 가 제거됨"
- 실제: `scripts/smoke/migration-drift.ts` 절차 1 = "`.env`/`.env.local` 에서 **DIRECT_URL(우선)**/DATABASE_URL 로드", 절차 2 = `:5432` 아니면 exit 2.
- 즉 지금 `DIRECT_URL` 을 제거하면 drift 게이트가 `DATABASE_URL`(`:6543`)로 떨어져 **exit 2 로 상시 STOP**. §9.4 는 §11.13 시점엔 맞았으나 §migration-order-drift-guard(2026-08-04) 이후 무효.

**C3 — RUNBOOK §5 에러표 L129 stale**
- 현 문구: `vercel-migrate.js` 의 `P1000` 대응으로 "`DATABASE_URL` 포트는 `:6543` transaction pooler 필수" + "`SKIP_PRISMA_MIGRATE=1` 로 migrate 스텝 우회".
- 실제: 해당 스크립트는 T4 대로 NO-OP 이고 `SKIP_PRISMA_MIGRATE` 는 §9.4 기준 참조되지 않음. DDL 포트는 T3 대로 `:5432`.
- 영향: 표만 읽은 operator 가 `:6543` 으로 migrate 를 시도 → hang. 2026-08-08 세션의 "6543 hang" 오판과 정합하는 문서 측 유발원.

### Chosen Source of Truth
- **정본 = RUNBOOK §9.2/§9.3 + 2026-08-08 빌드 로그 실측.**
- 인계 지시문(2026-08-08)의 "4스텝: ①push ②배포 확인 ③migrate ④health" 는 **채택하지 않음** — §9.3 순서 위반(코드 선배포 구간이 장애 창). 동 지시문 스스로 "DDL 선행 → 코드 배포가 안전" 이라 부기하므로 실질 충돌 아님.
- 따라서 본 트랙의 목표는 "절차 신설" 이 아니라 **모순 유물 제거 + 배포 후 확인 게이트 명문화**로 재정의한다.

### Environment Reality Check
- [x] repo 도달 (`C:\Users\young\ai-biocompare`) — read-only 실측 완료
- [x] 대상 자산 존재 확인 (T6·T7 sentinel/health)
- [ ] **실행 불가(sandbox)**: prod DB 접속, `migrate deploy`, `smoke:migration` 실행 — 실행 세션 전담
- [ ] **미확인**: Vercel env 에 `DIRECT_URL` 실제 존재 여부 → Phase 2 착수 전 1회 확인 필요 (아래 D1)

---

## 1. Priority Fit

- [ ] P1 immediate
- [x] **Post-release 안전 게이트 (P1-adjacent)**
- [ ] Release blocker
- [ ] P2 / Deferred

**Why:** 2026-08-08 prod 장애 1건 실발생, 재발 경로(모순 설정·stale 문서) 미차단 상태. 다만 제품 표면 변경 0·사용자 영향 0 이므로 release blocker 는 아님. 현재 진행 중 P1 과 충돌 없음.

---

## 2. Work Type

- [x] Migration / Rollout
- [x] Documentation / Ops hygiene
- [ ] Feature / Bugfix / API Slimming / Billing / Mobile / Design

---

## 3. Overview

**Description:** prod migration rollout 경로에서 "push = 적용" 오독을 만드는 모순 유물(미사용 루트 `vercel.json`, stale RUNBOOK 2곳)을 제거하고, 이미 존재하는 drift 자산(`smoke:migration`, `/api/health`)을 **배포 후 확인 게이트**로 문서상 고정한다.

**Success Criteria:**
- [ ] repo 안에 "빌드가 migration 을 적용한다" 고 읽히는 설정/문서가 0
- [ ] `DIRECT_URL` 이 drift 게이트 의존물임이 RUNBOOK 에 명시 (제거 금지)
- [ ] 배포 후 확인 2단(`smoke:migration` exit code + `/api/health` `clean:true·pendingCount 0`)이 §9 에 단일 절로 존재
- [ ] 위 3건이 sentinel 로 잠김 (RED 선확인)

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] `vercel-migrate.js` 삭제 — 빌드 로그 앵커 목적으로 **유지** (스크립트 주석의 "Why keep the script" 참조)
- [ ] CI / build-time 자동 migrate 재도입
- [ ] §9.10 순서역전 가드 로직 변경
- [ ] `apps/web/vercel.json` (crons 7건 포함) 수정
- [ ] 백로그 2번(page-imports-smoke) · 3번(dead 후보 3호)

**User-Facing Outcome:** 없음(내부 운영). 사용자 표면 변경 0.

---

## 4. Product Constraints

**Must Preserve:**
- [ ] workbench / queue / rail / dock — 무관(미접촉)
- [ ] same-canvas — 무관(미접촉)
- [ ] canonical truth: **prod DB 의 `_prisma_migrations` 테이블이 유일 truth.** manifest / health 응답 / smoke 출력은 전부 derived
- [ ] `apps/web/vercel.json` 의 crons 7건 무손상

**Must Not Introduce:**
- [ ] 빌드가 DB 를 변경하는 경로
- [ ] clean 위장 (미도달을 clean 으로 보고) — `migration-drift.ts` 의 exit 3 계약 유지
- [ ] 문서에만 존재하고 실행 불가한 명령

**Canonical Truth Boundary:**
- Source of Truth: prod DB `_prisma_migrations`
- Derived Projection: `computeMigrationDrift()` (health + smoke 공용 모듈, 계산 이원화 0)
- Snapshot: `src/generated/migration-manifest.json` (빌드 시점 워크트리 스캔)
- Persistence Path: `prisma migrate deploy` (operator shell 단독)

**UI Surface Plan:** 없음 — 설정 파일 + 문서 + 테스트만.

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 루트 `vercel.json` **삭제** (수정 아님) | JSON 은 주석 불가 → "미사용" 을 파일 안에 표기할 방법이 없다. 남기면 다음 operator 가 또 읽는다. 미사용은 빌드 로그로 실증됨(C1) | Root Directory 설정이 향후 repo root 로 바뀌면 빌드 설정 소실 → 복구 스니펫을 §9.11 에 보존 + git revert 1회 |
| `vercel-migrate.js` **유지** | 빌드 로그의 NO-OP 2줄이 discoverability 앵커. 제거하면 "침묵" 이 되어 build-time migrate 재도입 유혹이 커짐 | prebuild 에 무의미해 보이는 스텝 1개 잔존 |
| 신규 스크립트 작성 0, 기존 자산 재사용 | `smoke:migration` + `/api/health` 가 이미 계약·exit code 를 갖춤. 신규 로직은 계산 이원화 위험 | 자동화가 아니라 절차 문서 — operator 수행 의존 |

**Dependencies:**
- Required Before Starting: **D1** — Vercel env 에 `DIRECT_URL` 존재 여부 확인 (호영님 or 실행 세션). 존재 시 §9.4 는 "유지 필수" 로 정정, 이미 삭제됐다면 "재등록 필요" 로 정정.
- External Packages: 없음
- Files Touched: `vercel.json`(루트, 삭제) · `docs/DEV_RUNBOOK.md` · `apps/web/__tests__/**` sentinel 1파일

**Integration Points:** Vercel 빌드 설정 / RUNBOOK §5·§9 / vitest sentinel

---

## 6. Global Test Strategy

- 코드 로직 변경 0 → unit/integration 신규 없음.
- **sentinel(readFileSync + regex)** 으로 문서·설정 계약을 잠근다. CLAUDE.md "Sentinel Test 패턴" 준수.
- **RED 선확인 강제**: 각 단언이 현 워크트리에서 실제로 실패하는지 캡처 후 Phase 2 진입. (2026-08-08 세션 교훈 — 공허 단언 주의)
- 회귀 0 describe 필수: §9.2 5단계·§9.3 순서 규칙·§9.10 가드 문구가 **보존**됨을 명시 매칭.
- 실행 권위: **실행 세션의 독립 vitest**. sandbox 실측은 참고값.

---

## 7. Implementation Phases

### Phase 0: Context & Truth Lock
**Goal:** truth·충돌·우선순위 확정.
- Status: [x] Complete (2026-08-08)

**🔴 RED:** 인계 지시문의 "4스텝 신설" 전제가 §9.2 와 중복인지 검증 → 중복 확인
**🟢 GREEN:** T1–T8 실측, C1–C3 충돌 확정, 빌드 로그로 C1 실증
**🔵 REFACTOR:** 스코프를 "절차 신설" → "모순 제거 + 확인 게이트 명문화" 로 축소

**✋ Quality Gate:** [x] 미해결 충돌 0 [x] 추정과 실측 구분 표기 [x] priority fit 기록
**Rollback:** planning-only, 코드 변경 0

---

### Phase 1: Contract & Failing Sentinel (RED)
**Goal:** 제거 대상 3건을 테스트로 먼저 고정하고, 현 상태에서 실제 RED 임을 캡처.
- Status: [ ] Pending

**🔴 RED:**
- [ ] sentinel 파일 신설 (예: `apps/web/__tests__/ops/migration-rollout-gate.sentinel.test.ts`)
- [ ] 단언 A: repo 루트에 `vercel.json` 부재 — 또는 존재 시 `migrate deploy` 문자열 부재
- [ ] 단언 B: `docs/DEV_RUNBOOK.md` 에 `SKIP_PRISMA_MIGRATE` 우회 **권장** 문구 부재
- [ ] 단언 C: `docs/DEV_RUNBOOK.md` 에 "DIRECT_URL — ... 제거 가능" 문구 부재
- [ ] 단언 D: `docs/DEV_RUNBOOK.md` 에 `smoke:migration` + `pendingCount` 확인 절 존재
- [ ] **A~D 4건 전부 현 워크트리에서 FAIL 하는지 실행 캡처** (통과하면 단언이 공허 → 재작성)

**🟢 GREEN:** 회귀 0 describe 추가 — §9.2 step 3 의 `:5432` 문구, §9.3 "순서 위반 금지", §9.10 HEAD 일치 확인 문구 보존 매칭
**🔵 REFACTOR:** 정규식을 라인번호·구현 내부명에 종속시키지 않는다 (dead-file 세대 잠금 재발 방지)

**✋ Quality Gate:**
- [ ] A~D RED 캡처 존재 (공허 단언 0)
- [ ] 회귀 0 describe 는 현 상태에서 GREEN
- [ ] 기존 vitest 통과 수 변동 없음 (실행 세션 독립 재현)
- [ ] lint / typecheck 통과 or "실행 불가" 명기

**Rollback:** sentinel 파일 삭제 1회

---

### Phase 2: 모순 유물 제거 (GREEN)
**Goal:** C1·C2·C3 제거. 단언 A·B·C 를 GREEN 으로.
- Status: [ ] Pending
- **선행: D1 (Vercel env `DIRECT_URL` 존재 여부) 확인 완료여야 착수**

**🔴 RED:** Phase 1 의 A·B·C 가 FAIL 상태임을 재확인
**🟢 GREEN:**
- [ ] 루트 `vercel.json` 삭제
- [ ] §9.4 정정 — `DIRECT_URL` 은 `smoke:migration` 의 우선 로드 대상이므로 **유지 필수** (D1 결과에 따라 "재등록 필요" 로 분기). `SKIP_PRISMA_MIGRATE` 는 제거 가능으로 유지
- [ ] §5 에러표 L129 행 — obsolete 표기 + "DDL 포트는 `:5432`(§9.2), `vercel-migrate.js` 는 NO-OP(T4)" 로 교체
- [ ] 커밋 메시지에 C1 실증 근거(deployment id · commit · 로그 3줄) 명기

**🔵 REFACTOR:** 문서 내 `:6543`/`:5432` 언급을 §9 pooler 표 단일 출처로 링크 (중복 진술 축소)

**✋ Quality Gate:**
- [ ] 단언 A·B·C GREEN
- [ ] §9.2/§9.3/§9.10 회귀 0 describe GREEN
- [ ] `apps/web/vercel.json` diff 0 (crons 7건 무손상)
- [ ] **삭제 후 배포 1회 실측**: 빌드 로그에 `web@0.1.0 prebuild` + NO-OP 2줄 여전히 출현, 빌드 READY
- [ ] prod DB 무변경 (본 phase 는 DDL 0)

**Rollback:** `git revert` 1회 — 루트 `vercel.json` 원문 복구 스니펫은 §9.11 에 보존되어 있어 수동 복구도 가능

---

### ~~Phase 3: 배포 후 확인 게이트 명문화 (§9.11 신설)~~ — **폐기 (2026-08-08)**

**폐기 사유(실측)**: §9.10 (L400–450) 이 이미 가드 3종을 전부 담고 있다 —
① deploy 전 HEAD 일치 확인 ② `npm run smoke:migration --prefix apps/web`
(exit 0 clean / 1 drift / 2 env 위반 / 3 미도달) ③ `/api/health` 의
`pendingCount`·`clean:true`. §9.11 신설은 **중복 문서화 = 공허**. 대신 §9.4
정정 안에 "적용 확인은 §9.10 이 정본" 상호참조 1줄로 흡수했다.

<details><summary>원안 (참고용, 실행하지 않음)</summary>

#### (원안) Phase 3: 배포 후 확인 게이트 명문화 (§9.11 신설)
**Goal:** 단언 D GREEN. 기존 자산을 절차로 고정.
- Status: [ ] Pending

**🔴 RED:** 단언 D FAIL 확인
**🟢 GREEN:** `docs/DEV_RUNBOOK.md` 에 **§9.11 배포 후 확인 (post-deploy gate)** 신설:
- [ ] 정본 순서 재확인 1줄: **migrate → verify → push** (§9.2/§9.3), "push ≠ 적용" 명시 + T4/C1 근거
- [ ] 확인 1: `npm run smoke:migration --prefix apps/web` — exit 0 clean / 1 drift / 2 포트위반(`:6543`) / 3 DB 미도달(**clean 아님**)
- [ ] 확인 2: `/api/health` → `clean: true`, `pendingCount: 0`
- [ ] 실패 시 분기표: exit 2 → `DIRECT_URL` `:5432` 확인 / exit 3 → 자격증명·네트워크(무판정, clean 아님) / exit 1 → §9.2 step 3 재실행
- [ ] 루트 `vercel.json` 복구 스니펫 보존 블록 (Phase 2 rollback 대비)
- [ ] §9.10 HEAD 일치 확인과의 관계 1줄 (워크트리 기준 한계 상속)

**🔵 REFACTOR:** §9 하위 절 상호참조 정리, 중복 문장 제거

**✋ Quality Gate:**
- [ ] 단언 A~D 전부 GREEN + 회귀 0 GREEN
- [ ] 문서에 적힌 명령이 **실제 실행 가능**한 형태 (스크립트명·경로 실측 일치)
- [ ] 다음 실제 migration 때 이 절만 보고 수행 가능한지 1인 리뷰
- [ ] Notes 섹션에 D1 결과 기록

**Rollback:** §9.11 절 삭제 (문서 단독, 코드 영향 0)

</details>

---

## 8. Addenda
해당 없음 (Workflow/Ontology · Billing · API Slimming · Mobile 전부 미접촉).

---

## 9. Risk Assessment

| Risk | P | I | Mitigation |
| :--- | :--- | :--- | :--- |
| Vercel Root Directory 가 향후 repo root 로 변경되면 루트 `vercel.json` 부재로 빌드 설정 소실 | Low | Med | §9.11 에 원문 복구 스니펫 보존 + git revert 1회. Phase 2 quality gate 에 배포 1회 실측 포함 |
| `DIRECT_URL` 이 이미 Vercel/로컬 env 에서 삭제된 상태 → §9.4 정정 방향 오판 | Med | Low | D1 선행 확인. 삭제됐으면 "재등록 필요" 로 문구 분기 |
| sentinel 정규식이 문서 사소 편집에 과민 → 향후 false RED | Med | Low | 라인번호·문장 전체가 아니라 **키워드 1~2개**로 매칭. 회귀 describe 는 구조 문구만 |
| 문서 변경이 실제 operator 행동을 바꾸지 못함 (동일 장애 재발) | Med | High | 확인 2단을 명령+exit code 표로 고정. 다음 migration 트랙 P4 에서 §9.11 준수 여부를 체크 항목으로 인용 |
| 본 트랙이 prod 를 건드린다는 오해 | Low | Med | 전 phase DDL 0. Phase 2 의 유일한 prod 접점은 "배포 1회 실측"(읽기) |

---

## 10. Rollback Strategy

- Phase 1 실패: sentinel 파일 삭제
- Phase 2 실패: `git revert` (루트 `vercel.json` 복구) — 빌드 로그로 재확인
- Phase 3 실패: §9.11 절 삭제
- **DB**: 본 트랙은 schema 변경·migration 생성 0 → DB rollback 대상 없음

---

## 11. Progress Tracking

- Overall completion: 100% — 트랙 종료 (커밋 `7827b2cd` · 배포 `dpl_B3jo8tWL6P8U1G18ATYaY8ta2AEp` 로그 실측 완료)
- Current phase: 완료
- Current blocker: 없음 — 루트 `vercel.json` 삭제는 실행 세션이 `git rm -f` 로 수행(sandbox 는 device 파일 삭제 불가)
- Next validation step: 없음. 후속은 §cron-registry-drift(별도 트랙, out of scope)

**Phase Checklist:**
- [x] Phase 0 complete
- [x] Phase 1 complete (sentinel 배치 + RED 캡처, 격리 `/tmp` vitest 2.1.9)
- [x] Phase 2 complete — 문서 2곳 정정 + 루트 `vercel.json` 삭제(실행 세션 `git rm -f`), sentinel 10/10 GREEN 실트리 재현
- [x] ~~Phase 3~~ 폐기 (§9.10 중복)

---

## 12. Notes & Learnings

**Blockers Encountered:**
- [2026-08-08] 인계 지시문의 "4스텝 명문화" 전제가 §9.2 와 중복 → 스코프 재정의(신설 아님, 모순 제거). 해결: 정본을 §9.2/§9.3 으로 고정.
- [2026-08-08] 인계 지시문의 4스텝 순서(①push 선행)가 §9.3 "순서 위반 금지" 와 충돌 → 미채택. 정본 = migrate → verify → push.

- [2026-08-08] **D1 해소 (실행 세션 실측)**: prod `/api/health` → `hasDirectUrl: false`. Vercel env 에 `DIRECT_URL` **부재**. 배포 코드에 읽는 주체 0 (전수 검색 — docs/markdown/.env.example 만). → C2 문안을 "유지 필수"(무스코프)에서 **스코프 분리**로 교정: Vercel = 재추가 금지 / operator 로컬 `.env` = 유지 필수. 무스코프 "유지 필수" 는 ADR-002 §11.13 을 뒤집고 과거 `DATABASE_URL` 변형 사고를 재유발할 뻔한 오설계였음.
- [2026-08-08] sentinel 자기결함 1건: `execSync` 부정 단언이 `vercel-migrate.js` **주석 문구**("no spawn, no execSync")에 걸려 false RED → require/import 구문 한정으로 교정. 부정 단언은 항상 "주석 제거본 기준" 으로 설계할 것.
- [2026-08-08] vitest 를 호영님 트리에서 실행 불가: `node_modules` 가 Windows 설치본이라 리눅스 VM 에서 `@rollup/rollup-linux-x64-gnu` MODULE_NOT_FOUND. 설치 시도 안 함(공유 node_modules 오염 금지, CLAUDE.md). 검증은 격리 `/tmp` 미니트리 + vitest 2.1.9 로 수행.
- [2026-08-08] sandbox 는 device 파일 **삭제 불가** — 루트 `vercel.json` 제거는 실행 세션 `git rm` 위임.

**Implementation Notes:**
- C1(루트 `vercel.json` 미사용)은 **추정이 아니라 빌드 로그 실증** — 향후 재논쟁 시 `dpl_213TwWpVJPw8RKnHPBMAmyhuwd3q` 로그 참조.
- 이번 트랙은 "새 안전장치 추가" 가 아니라 **이미 있는 안전장치를 가리던 노이즈 제거**. 자산(§9.2·smoke:migration·health drift)은 전부 선존재.
- 2026-08-08 세션 4대 사고 중 #4(migration 자동 적용 오판)의 직접 대응. #1(훅 순서)·#2(csrfFetch)·#3(dead-file)은 별도 트랙.
- Phase 2 실제 변경 3건: ① §5 `P1000` 행 → OBSOLETE 표기 + DDL 포트 `:5432` 로 교체 ② §5 "migration 파일이 push 되지 않음" 행 → `P2021/P2022` + "push ≠ 적용" 행으로 교체 (신규 발견 오독 유발원, C3b) ③ §9.4 전면 재작성 — 스코프 표 + 재추가 금지 + 루트 `vercel.json` 삭제 근거·복구 스니펫 보존.
- sentinel 최종: RED 5 / GREEN 5 → Phase 2 적용 후 **10/10 GREEN** (격리 실행). 회귀 0 항목(§9.2 `:5432`, §9.3 순서 위반 금지 + `migrate → verify → push`, §9.10 3종, crons 7, NO-OP 앵커) 전 구간 보존 확인.

**실행 세션 마감 실측 (2026-08-08, 커밋 `7827b2cd`) — sandbox 계획과의 차이 해소:**
- **sentinel RED 수치 차이는 시점 차이였다.** sandbox 의 RED 5(격리 `/tmp` 미니트리, Phase 2 문서 정정 **전**) ↔ 실행 세션 실트리 첫 실행 **RED 1**(문서 정정이 이미 디스크에 반영된 **후**라 B·C·C2 는 이미 GREEN, A 만 잔존). 모순이 아니라 측정 시점 차. 루트 `vercel.json` 삭제 후 **10/10 GREEN**.
- **경로 해석 정합성 실증**: A 가 삭제 **전** RED(실파일 도달) → 삭제 **후** GREEN 으로 뒤집혔다. 경로(`REPO_ROOT` 5단계)가 틀렸다면 A 는 처음부터 공허 GREEN 이었을 것이므로, 이 뒤집힘 자체가 도달성 증명이다. C2 는 양성 단언(`유지 필수` 매칭)이라 파일 미도달 시 실패 → 공허 통과 배제.
- **(a) "실패 수 불변" 은 반증 실험으로 확인했고, 절대 수치 대조는 하지 못했다.** 동일 트리의 before 측정이 없어 baseline 절대값 비교는 불가(과거 메모의 242/107 은 다수 커밋 이전 시점이라 대조 기준으로 쓰면 오판). 대신 **루트 `vercel.json` 을 복원한 상태에서 재실행 → 동일 3건이 그대로 실패** 하는 것을 확인해 기존 결함임을 확정했다. 추정으로 "무관"이라 적지 않는다.
- **(b) 전체 스위트 실측**: `113 failed files · 1057 passed · 8 skipped (1178)` / tests `252 failed · 11369 passed · 86 skipped · 1 todo (11708)`. `migration-rollout-gate` 는 실패 목록에 부재, 신규 +10 passed 기여.
- **영향 전수 증명**: `DEV_RUNBOOK` 을 읽는 테스트는 신규 sentinel **단독**(옛 값 sweep clean) → §9.4 전면 재작성이 다른 sentinel 잠금을 깨지 않음. `vercel.json` 독자 2건(`vercel-cron-registry`·`cron-monitoring`)은 `../../../vercel.json` = **`apps/web/vercel.json`** 을 읽으므로 루트 삭제와 무관.
- **(c) CRLF→LF 부수**: 반증 실험용 복원(`git restore`) 시 워킹카피가 LF 로 기록돼 git 이 "local modifications" 로 잡아 `git rm` 이 거부됨. `cat -A` 로 **내용 동일·개행만 차이** 확인 후 `git rm -f` 로 처리. 삭제 대상 파일이므로 무해.
- **(d) 지나가며 발견한 기존 결함 → §cron-registry-drift 등재**: `apps/web/vercel.json` crons **7** ↔ 운영 레지스트리 **5** 불일치. prod cron 2건(`catalog-ingest`·`retention-archive` 계열)이 목적·prod-only 대상 환경·수동 차단 지점 문서 없이 실행 중 = 운영 가시성 결함. `vercel-cron-registry.test.ts` 3건 RED 로 **이미 활성 신호**(잠재 결함 아님). 본 트랙에 흡수하지 않음 — 다음 트랙 후보 1순위.
- **(5) 배포 로그 실측 (유일한 prod 접점, 추정 금지)**: 배포 `dpl_B3jo8tWL6P8U1G18ATYaY8ta2AEp`(commit `7827b2c`) 빌드 로그 02:51:31 에 판정 2줄 모두 출현 — `> web@0.1.0 prebuild` / `[prebuild] vercel-migrate.js is a NO-OP since 2026-04-25 (ADR-002 §11.13).` → 루트 `vercel.json` 삭제가 빌드 설정에 **무영향** 확증. `npm install` → `npm run build` 경로 불변, crons 7건 무손상. 삭제 후에도 로그 어디에도 `prisma generate`/`migrate deploy` 가 나타나지 않는다 = 애초에 실행된 적 없었다는 재확인.
  `readyState: READY`(ready 02:54:49), prod alias `www.labaxis.co.kr`·`labaxis.co.kr` 전환 정상(`aliasError: null`).
  **배포 후 health(rollout 4스텝 ④)**: `migrations.clean:true · pendingCount 0 · unknown 0 · rolledBack 0`, `hasDirectUrl:false`(§9.4 Vercel 스코프 재확인), `manifestGeneratedAt 2026-08-09T02:51:31` — 빌드 로그의 prebuild 시각과 일치하므로 **이번 빌드가 서빙 중**임까지 확증(구 배포 잔존 오판 배제).

**To Revisit Later:**
- 배포 후 health pending 자동 확인의 **자동화**(수동 절차 → CI/알림)는 본 트랙 out of scope. §9.11 이 정착한 뒤 별도 판단.
