# Implementation Plan: §pocandidate-root-fix — POCandidate ↔ Quote 결속

- **Status:** ✅ Phase 0–4 완료 (커밋·푸시 승인 게이트 대기)
- **Started:** 2026-08-04
- **Last Updated:** 2026-08-04
- **Estimated Completion:** 2026-08-04 (구현·검증 완료)

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
⛔ **`prisma migrate dev` 절대 금지** (2026-06-14 prod 데이터 소실 사고 명령 계열, DEV_RUNBOOK §9.9)

---

## 0. Truth Reconciliation

**Latest Truth Source (2026-08-04 실측, 계획 세션 직접 read):**
- `apps/web/prisma/schema.prisma` L2914-2944 — POCandidate 모델에 `quoteId` 부재. `vendor`는 free-text String (Vendor FK 아님).
- `apps/web/src/app/api/work-queue/purchase-conversion/bulk-po/route.ts` — candidate fetch가 `where: { userId, organizationId }` 뿐. 자기 주석("quote 별 결재 통과 POCandidate[] fetch")이 선언한 quoteId·approvalStatus 필터 둘 다 부재. **quote 루프 안에서** fetch → multi-quote 발주 시 같은 candidate가 quote마다 반복 변환.
- `apps/web/src/lib/orders/convert-pocandidate-to-orders.ts` L94-106 — dup-guard가 `(quoteId, vendorId)` composite. NULL vendor 2건이면 둘째가 `reason:"duplicate"`로 유실.
- `apps/web/src/lib/persistence/po-candidate-server.ts` L131-132 — `input.items.map` 길이 검증 없음. `items:[]` 통과.
- `apps/web/src/app/api/orders/route.ts` — 예산 차감액 = quote 기준(`quote.totalAmount ?? Σ item.lineTotal`). Order 생성액 = candidate 기준(`candidate.totalAmount` pass-through). 대조 코드 없음.
- prod 실측 (2026-08-04 읽기전용 SELECT): Q1 candidate 3건 / Q1b `in_app_approval_pending` 1건 변환 풀 상주 / Q2 중복 Order 0행 / Q3 UserBudgetTransaction 0행 / Q4 NULL vendor 매핑 2건(Sigma-Aldrich·VWR).

**Secondary References:**
- `__tests__/lib/orders/pocandidate-reachability-tracks.test.ts` — E 패턴 3트랙 계약 문장 + 재개 조건 원문.
- `project_money_path_coverage_restore.md`, 세션 인계 지시문 (2026-08-04).

**Conflicts Found:**
- bulk-po 주석(계약) vs 실제 쿼리(구현) — 주석이 계약, 쿼리가 결함. 인계 문서와 실측 일치, 충돌 없음.
- 인계 문서에 없던 추가 발견: multi-quote 반복 변환 (증상 4, 아래).

**Chosen Source of Truth:**
- 스키마 주석·라우트 주석·E 파일 계약 문장 = 계약. 현재 구현 상태는 계약이 아니다 (G-page 재기준 경고와 동일 원칙).

**Environment Reality Check:**
- [ ] 실행 세션(Claude Code) worktree `C:\Users\young\ai-biocompare` 단독 git 접근 확인
- [ ] `npx vitest run <파일>` 실행 가능 확인
- [ ] prod 접근은 읽기전용 SELECT만, 쿼리문 사전 제출·승인

---

## 1. Priority Fit

- [x] P1 immediate
- [ ] Release blocker / Post-release / P2

**Why This Priority:**
돈 경로. Track 2는 prod에 장전 상태 — `in_app_approval_pending` candidate가 변환 풀에 상주하며 쿼리에 결재·quote 필터가 없어, 해당 유저의 다음 bulk-po 실행 즉시 승인 안 된 발주가 생성된다. 인계 문서가 첫 작업으로 고정. 우선순위 충돌 없음.

---

## 2. Work Type

- [x] Bugfix (근본: 스키마 결속 부재)
- [x] Migration / Rollout (additive column)
- [x] Workflow / Ontology Wiring (purchase-conversion 변환 풀 규칙)

---

## 3. Overview

**Feature Description:**
POCandidate에 `quoteId`를 추가해 candidate를 발주 대상 견적에 결속하고, 변환 풀 쿼리를 (quote, 결재 통과, stage)로 한정한다. 네 증상의 공통 뿌리 수정.

**하나의 뿌리 → 네 갈래 (근거):**
| 증상 | 뿌리와의 연결 |
|---|---|
| §pocandidate-null-vendor-collapse | dup-guard가 `(quoteId, vendorId)`에 의존하는 이유 = candidate 자체가 quote에 안 묶여 candidate 단위 식별로 중복을 못 가름. quoteId 결속 후 dup-guard를 `poCandidateId` 기반으로 교체 가능 |
| §pocandidate-approval-filter-missing | 쿼리에 quoteId 필터를 넣을 수 없었던 이유 = 필드 자체가 없음. approvalStatus 필터도 같은 쿼리 수정에서 함께 |
| §budget-quote-candidate-amount-divergence | candidate가 quote에 묶이지 않아 차감액(quote 기준)과 발주액(candidate 기준)의 대조 지점이 없음. 결속 후 금액 원천 통일 가능 |
| (신규 실측) multi-quote 반복 변환 | quote 루프 안에서 유저 전체 candidate fetch → quote마다 전량 변환. dup-guard는 quoteId가 다르면 통과 → N-quote × 전 candidate 중복 발주 가능 |

따로 고치면 네 번 고친다. quoteId 결속 하나로 네 갈래의 수정 지점이 한 쿼리·한 가드에 모인다.

**Success Criteria:**
- [x] POCandidate.quoteId 스키마 반영 (prod `migrate deploy` 2026-08-04 완료·검증 4/4)
- [x] bulk-po 변환 풀 = 해당 quote + 결재 통과 + `po_conversion_candidate` stage로 한정
- [x] 서로 다른 candidate는 vendor 매핑 실패와 무관하게 각자 Order 획득
- [x] `items:[]` candidate 생성 거부 (§pocandidate-empty-items-order, 호영님 2026-08-04 포함 승인)
- [x] E 패턴 skip 승격: Track 1·2 active GREEN, Track 3 재기준
- [x] 회귀 게이트 0 RED 유지 (참조 스위트 13파일 78 passed — full-suite 기존 실패는 범위 밖)

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] Vendor free-text → FK 전환 (별건, 이번엔 dup-guard 교체로 우회)
- [ ] full-suite triage ~9 작업 단위 (이 계획 다음)
- [ ] UserBudgetTransaction 기록 경로 신설 (Track 3 동적 검증은 UBT 첫 표본 후)
- [ ] UI surface 변경 (라우트·서비스·스키마만)
- [ ] **candidate 생성 흐름 정의 (누가·언제 candidate를 만드는가) — 별건 백로그 `§pocandidate-creation-flow`.** Phase 0 실측: 라이브 생성 caller 부재(POST /api/po-candidates 클라이언트 0, seedPOCandidates dead). 이 계획은 quoteId **입력 계약만** 준비(향후 caller 대비); 실제 생성 흐름은 제품 스펙 필요 → 별도.

**User-Facing Outcome:**
승인 안 된 candidate가 발주로 새는 경로 차단. multi-vendor 견적에서 vendor 미등록 공급사 2곳 이상일 때 둘째 발주 유실 해소. 내역 0개 발주서 생성 차단.

---

## 4. Product Constraints

**Must Preserve:**
- [x] canonical truth: Order(DB)가 발주 truth, POCandidate는 변환 전 후보
- [x] workbench / queue / rail / dock — 이번 작업 UI 무접촉
- [x] atomic per-candidate transaction + audit graceful 패턴

**Must Not Introduce:**
- [x] placeholder success (변환 skip 사유를 "duplicate" 하나로 뭉개는 현 구조를 확장하지 않고 구분값 도입)
- [x] page-per-feature / chatbot 재해석 — 해당 없음

**Canonical Truth Boundary:**
- Source of Truth: Order (DB). Quote ↔ POCandidate ↔ Order 결속은 FK.
- Derived Projection: 변환 풀 쿼리 결과 (필터 규칙이 계약).
- Persistence Path: `migrate deploy` (prod), `db push` 계열 전면 금지.

**UI Surface Plan:**
- [x] 없음 (API/service/schema 한정)

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| `quoteId String?` nullable + relation + index | 기존 3건 호환, additive migration → 롤백 무해 | NULL candidate 잔존 → "quoteId NULL은 변환 제외" 규칙 필요 |
| dup-guard를 `(quoteId, vendorId)` → `poCandidateId` 기반으로 교체 | candidate 단위가 진짜 중복 식별자. NULL vendor collapse 원천 해소 | **Phase 0 확정: `poCandidateId`는 `@@index`뿐, `@@unique` 아님** → Phase 2 migration에 `@@unique([poCandidateId])` 추가 필요(nullable → legacy NULL Order 다건은 NULL-distinct 유지) |
| 변환 풀 쿼리를 루프 밖 1회 + quoteId group 또는 루프 내 `quoteId: q.id` 필터 | multi-quote 반복 변환 차단 | 최소 diff는 루프 내 필터 — Phase 3에서 최소 diff 우선 |
| approvalStatus 필터 = "승인 통과 집합" (`not_required` + 승인완료 값) | 계약은 "승인 안 된 것이 안 들어온다" — enum 값 집합은 Phase 0에서 `POCandidateApprovalStatus` enum 실측 후 확정 | — |
| empty-items 입구 가드 (`createPOCandidate` items 길이 검증) + 변환부 1줄 거부 | 입구 1곳 최소 diff + 이중 방어 | 기존 empty candidate가 prod에 있으면 별도 처리 판단 |

**Dependencies:**
- Required Before Starting: Phase 0 prod 실측 승인 (읽기전용 SELECT)
- External Packages: 없음
- Touched: `schema.prisma` / bulk-po route / `convert-pocandidate-to-orders.ts` / `po-candidate-server.ts` / `po-candidates/route.ts`(POST 입력 검증) / E 테스트 파일

**Integration Points:**
- candidate 생성 caller가 quoteId를 전달하는 지점 — **Phase 0 확정: 라이브 caller 부재.** 이 계획은 `POCandidateCreateInput`·POST 입력 계약에 `quoteId?`를 **계약만** 추가(향후 caller 대비). 실제 생성 흐름 정의는 별건 `§pocandidate-creation-flow`(Out of Scope).
- orders route 예산 차감 (Track 3 — 이번엔 구조 소거까지만, 동적 검증은 별도 재개 조건)

---

## 6. Global Test Strategy

Red-Green-Refactor 강제. 인계 테스트 규율 승계:
- 계약 문장 먼저, assertion 나중. 검증 가능한 레이어 확인 후 작성.
- **corrupt→RED 없이 GREEN 금지.** 오염 원복 후 `git diff`로 잔존 0 확인.
- 구문(where 키 형태)이 아니라 계약을 잠근다 — Track 2 재기술 시 E 파일 자체 경고(L176-179) 준수.
- 관계식은 잠그고 값의 출처는 잠그지 않는다.
- vitest는 `it()`당 첫 실패만 보고 — 권위는 run.
- 커버리지 경계를 파일 헤더에 명시 (무엇을 커버하지 않는지 포함).

**Work Type별:**
- 스키마/서비스 로직 → 동적 behavior 테스트 (축 1·2·3 기존 파일 회귀 0 유지)
- 라우트 계약 → route POST 통합 테스트 (mock tx 관측)
- Migration → dry-run + 롤백 경로 문서화, prod apply는 게이트 후

---

## 7. Implementation Phases

#### Phase 0: Context & Truth Lock (실행 세션, 코드 변경 0)
**Goal:** 미확인 3건 실측으로 계약 확정.
- Status: [ ] Pending

**🔴 RED (확인 항목):**
- [ ] candidate 생성 caller 전수 식별 (`grep -rn "createPOCandidate\|po-candidates" src/` → 호출부에서 quoteId 획득 가능 여부)
- [ ] `POCandidateApprovalStatus` enum 전체 값 실측 → "승인 통과 집합" 확정
- [ ] `Order.poCandidateId` 스키마 제약(unique/index) 실측
- [ ] prod 읽기전용 SELECT (쿼리문 사전 제출·승인 후): 기존 candidate 3건의 quote 매핑 가능성, empty-items candidate 존재 여부
**🟢 GREEN:** 위 4건의 답을 이 문서 Notes에 기록, 계약 문장 확정
**🔵 REFACTOR:** 매핑 불가 candidate 처리 규칙 확정 (기본: NULL 잔존 + 변환 제외)

**✋ Quality Gate:** 미확인 0건, prod 쓰기 0
**Rollback:** planning-only

#### Phase 1: Contract & Failing Tests
**Goal:** 결함 4갈래를 RED로 실증.
- Status: [ ] Pending

**🔴 RED:**
- [ ] Track 1 `describe.skip` → `describe` 승격 → RED 확인 (호영님 승격 승인 = 이 계획 승인으로 갈음, 수정 전까지 suite RED 상태는 Phase 3까지 한시 허용 — branch 내 한정)
- [ ] Track 2 의도 기반 재기술("승인 안 된 candidate가 변환 대상에 없다" — 관측 방식은 결과 기반) 후 승격 → RED
- [ ] 증상 4: 2-quote bulk 시 같은 candidate 반복 변환 테스트 신규 → RED
- [ ] empty-items: `createPOCandidate({items:[]})` 거부 계약 테스트 → RED
**🟢 GREEN:** 테스트 스캐폴딩만 (구현 금지)
**🔵 REFACTOR:** 각 파일 헤더에 커버리지 경계 명시

**✋ Quality Gate:** 신규 RED 4건 모두 "처음부터 RED" 확인(이미 GREEN이면 하네스 불신 → corrupt 검증), 기존 축 1·2·3 회귀 0
**Rollback:** 테스트 파일 revert

#### Phase 2: Schema — quoteId 결속 + poCandidateId unique
**Goal:** `POCandidate.quoteId String?` + relation + index. **+ `Order @@unique([poCandidateId])`** (측정3 확정 — dup-guard poCandidateId 교체의 DB 전제).
- Status: [ ] Pending

**🔴 RED:** 마이그레이션 SQL 생성 (`migrate diff --from-url`(read-only)만 사용 — `--shadow-database-url` 계열 절대 금지)
**🟢 GREEN:**
- [ ] schema.prisma 수정: POCandidate.quoteId 추가 + `Order @@unique([poCandidateId])` 추가 + 로컬 검증
- [ ] **`@@unique([poCandidateId])` apply 전 dry-run에서 기존 poCandidateId 중복 0행 재확인**(Phase 0 Q2 = 0행, apply 시점 재측정 — nullable이라 NULL 다건은 무해, non-null 중복만 차단 대상)
- [ ] **prod 게이트: `migrate deploy` 만. project-ref echo → 평이한 한국어 보고 → 호영님 명시적 "진행" 후에만 apply. `migrate dev` 금지.**
- [ ] backfill **불필요 확정** (Phase 0 Q-A/Q-A2: candidate owner의 quote 0개 → 매핑 대상 없음 → NULL 잔존 + 변환 제외). UPDATE 없음.
**🔵 REFACTOR:** 없음 (additive만)

**✋ Quality Gate:** additive-only diff 확인 (DROP/ALTER 파괴 구문 0), 기존 테스트 회귀 0
**Rollback:** 코드 revert만으로 충분 (nullable 컬럼 잔존 무해). down-migration 불요.

#### Phase 3: Logic — 변환 풀 결속 + dup-guard 교체 + 입구 가드
**Goal:** Phase 1 RED 4건 전부 GREEN.
- Status: [x] Complete (2026-08-04 — quality gate 통과, §12 실행 기록)

**🟢 GREEN (최소 diff):**
- [ ] bulk-po fetch: `where: { userId, organizationId, quoteId: q.id, approvalStatus: { in: 승인통과집합 }, stage: "po_conversion_candidate" }` (quoteId NULL candidate 자동 제외)
- [ ] dup-guard: `(quoteId, vendorId)` → `poCandidateId` 기반. skipped reason 구분값 도입 (진짜 중복 vs 기타)
- [ ] `POCandidateCreateInput`·POST 입력 계약에 `quoteId?` 추가 (향후 caller 대비 **계약만** — 실제 생성 흐름 wiring은 별건 `§pocandidate-creation-flow`, 이 계획 범위 밖)
- [ ] `createPOCandidate` items 길이 검증 + 변환부 empty-items 거부 1줄
**🔵 REFACTOR:** bulk-po 주석-구현 정합 갱신 (주석이 계약 — 구현이 주석을 따라간 형태로)

**✋ Quality Gate:** Phase 1 RED 4건 GREEN, corrupt→RED 재검증 각 1회 + 원복 + `git diff` 오염 잔존 0, 축 1·2·3 및 관련 스위트 회귀 0, no dead path (legacy fallback — candidate 0건 quote는 기존 quote.items 경로 유지)
**Rollback:** route/service revert로 기존 동작 복원 (스키마 독립)

#### Phase 4: Suite / E 승격 마무리 / Rollback 문서화
**Goal:** 잔여 정리 + 게이트 확인.
- Status: [x] Complete (2026-08-04 — E 재기준·회귀 0, §12 실행 기록. 커밋은 승인 게이트 대기)

**🟢 GREEN:**
- [ ] E 파일 재기준: Track 1·2 active GREEN 상태로 헤더 재작성 (승계 원칙 — 보호 의도 보존, 삭제 금지)
- [ ] Track 3 `it.todo` 문구 재기준: "구조 소거(금액 원천 candidate 통일) 후 UBT 첫 표본 시 prod 대조" — 승격은 안 함 (재개 조건 미충족 유지)
- [ ] 회귀 게이트 전체 run 0 RED (full-suite 기존 107파일 실패는 이 계획 범위 밖 — 이 계획으로 인한 **신규** 실패 0 확인)
**🔵 REFACTOR:** 임시 계측 제거, Notes 정리

**✋ Quality Gate:** path-specific 커밋 준비 (관련 파일만, 산출물 스테이징 금지), 커밋·푸시는 호영님 명시적 승인 후
**Rollback:** 전체 revert 순서 = Phase 3 → Phase 2 코드 (스키마 컬럼은 잔존 무해)

---

## 8. Optional Addenda

### A. Workflow / Ontology Addendum (해당)
**Resolver Input:** purchase-conversion 변환 풀 = (quote, 결재 통과, stage) 3중 필터
**Validation:**
- [ ] 승인 대기 candidate가 변환 풀에 안 들어옴
- [ ] candidate 0건 quote는 legacy fallback 유지 (기존 단순 흐름 무손상)

### Migration Addendum (해당)
- additive nullable column만. `migrate deploy` + project-ref echo + 명시 "진행" 게이트.
- `migrate dev` / `db push` / `--force-reset` / `--accept-data-loss` / shadow-database 계열 전면 금지.
- backfill UPDATE는 별도 승인 (비가역 아님이지만 prod 쓰기이므로 게이트 동일 적용).

---

## 9. Risk Assessment

| Risk | Prob | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 기존 candidate 3건 quote 매핑 불가 | Med | Low | NULL 잔존 + 변환 제외 규칙. Phase 0 실측으로 확정 |
| Track 2 재기술이 다시 구문 잠금이 됨 | Med | Med | 결과 기반 관측(변환된 candidate 집합)으로 작성, where 키 assertion 금지 |
| dup-guard 교체가 legacy 재발주 방지 약화 | Low | High | quote-level `q.orders.length > 0` 사전 차단이 상위에 존재(실측 확인됨) — 이중 방어 유지 |
| 승인통과집합 오정의 (enum 값 누락) | Low | High | Phase 0 enum 실측 후 확정, 추측 금지 |
| suite RED 한시 허용 구간(P1→P3)이 길어짐 | Low | Med | Phase 1·3을 같은 batch로 연속 실행 |

---

## 10. Rollback Strategy

- Phase 1 실패: 테스트 파일 revert
- Phase 2 실패: schema revert + migration 미적용 (apply 전이면 파일 삭제만)
- Phase 3 실패: route/service revert (스키마 독립 — 컬럼 잔존 무해)
- Phase 4 실패: E 파일 헤더만 원복
- **Special:** prod migration은 additive-only이므로 down 불요. backfill 되돌림은 backfill 승인 시 UPDATE 역쿼리 함께 제출.

---

## 11. Progress Tracking

- Overall completion: 100% (커밋·푸시만 승인 게이트 대기)
- Current phase: 전 Phase 완료 (2026-08-04)
- Current blocker: 없음
- Next validation step: 호영님 커밋 승인 → 클로드코드 path-specific 커밋·푸시 (§12 커밋 준비 블록)

**Phase Checklist:**
- [x] Phase 0 / [x] Phase 1 / [x] Phase 2 / [x] Phase 3 / [x] Phase 4

---

## 12. Notes & Learnings

**계획 시점 기록 (2026-08-04, 계획 세션):**
- 증상 4(multi-quote 반복 변환)는 인계 문서에 없던 실측 신규 발견 — bulk-po 루프 구조에서 확인.
- empty-items 포함 + 계획서 생성: 호영님 2026-08-04 승인.
- E 승격 순서: Track 1 (P1에서 승격·RED 실증) → Track 2 (의도 기반 재기술 후 승격) → Track 3 (승격 안 함, 재기준만).

**Phase 0 Truth Lock 실측 (2026-08-04, 실행 세션 — 코드 변경 0):**

*측정1 — candidate 생성 caller + quoteId 획득 가능성:*
- `createPOCandidate` ← `src/app/api/po-candidates/route.ts:98` (POST, 유일 prod 경로) + `seedPOCandidates`(po-candidate-server.ts:176).
- **⚠️ seedPOCandidates도 caller 0 (dead), `/api/po-candidates` 로의 클라이언트 fetch 0** (주석 참조만; `po-candidates-for-label`은 별개 엔드포인트). → **라이브 candidate 생성 UI 흐름이 코드에 없음.** prod 3건은 앱 코드 외부 출처(수동 POST / 직접 seed 추정).
- `POCandidateCreateInput`(po-candidate-server.ts:26)에 **quoteId 필드 없음**. POST는 `{...body}` spread하나 type+schema가 quoteId를 drop. `prisma.pOCandidate.create`(:118)도 quoteId 미기입.
- **결론: quoteId는 생성 체인 어디에도 없다. quote-context 생성 caller가 현재 부재.** 근본수정 범위 확대 — (a) candidate 생성 흐름 정의/식별(§5 "AI pipeline/review queue caller"는 현재 미구현), (b) quoteId end-to-end(schema+type+route), (c) 변환 필터 quoteId+승인통과집합.

*측정2 — POCandidateApprovalStatus 승인 통과 집합:*
- enum 8값(schema:2416): not_required · external_approval_required · external_approval_pending · externally_approved · externally_rejected · in_app_approval_pending · in_app_approved · in_app_rejected.
- **승인 통과 집합 = {`not_required`, `externally_approved`, `in_app_approved`}** (3값). 변환 필터: `approvalStatus IN (not_required, externally_approved, in_app_approved)`. 제외 5값(required/pending/rejected). ← §5 계약 문장 확정.

*측정3 — Order.poCandidateId 제약:*
- `poCandidateId String?` nullable, `onDelete: SetNull`, **`@@index([poCandidateId])` — @@unique 아님.** "1:1 매핑" 주석은 aspirational, DB 강제 0 → 같은 candidate 다중 Order 미차단(재변환 collapse 구조 확인).
- §5 "dup-guard를 poCandidateId 기반으로" 실행하려면 **Phase 1에 `@@unique([poCandidateId])` 추가 필요**(nullable이라 legacy NULL-vendor Order 다건은 Postgres NULL-distinct로 유지 허용). ← 스키마 변경 항목 확정.

*측정4 — prod 읽기전용 SELECT (호영님 2026-08-04 승인, 실행 완료):*
- Q0: Quote(id/userId/organizationId/status/createdAt)·POCandidateItem(candidateId) 컬럼 전부 확인.
- **Q-A: 3 candidate 전부 owner=user-bioinsight-researcher, org NULL, `user_org_quote_count=0`.** Q-A2: 그 유저 quote 전무(`[]`).
- **Q-B: item_count Sigma 1·Thermo 3·VWR 3 — empty-items candidate 0건**(구조 도달 가능하나 prod 미발현).
- **backfill 판정: 매핑 대상 quote 자체가 없음(ambiguous 아니라 부재) → NULL 잔존 + 변환 제외 확정. UPDATE 불필요.** 3건은 quote 없이 태어난 orphan/seed(측정1 생성 흐름 부재 재확인).

*측정 종합 — 이 수정의 정확한 즉시 효과(넓혀 쓰지 말 것):*
- 라이브 생성 흐름 부재 동안 **vendor-aware 변환 경로는 휴면**(candidate 보유 유저에 quote 없음 → 변환 미발화), **legacy fallback(quote.items → 1 NULL Order)이 라이브 경로.**
- 따라서 이 수정의 즉시 효과 = **"프로덕션 무영향"이 아니라 "장전된 prod 위험 3갈래(null-vendor·approval-filter·amount-divergence) 봉쇄"**. 생성 흐름이 붙는 순간 발화할 구조를 미리 막는 것.

*Track 2(approval-filter) 위험 기술 정확화 (넓힘·좁힘 금지):*
- Q-A2=[] → 승인대기 candidate는 **현재 도달 불가**(소유 유저 quote 0 → 변환 미발화). 발현 조건 = 그 유저의 **첫 quote 생성 시 candidate 전량이 변환 풀 진입.** '즉시 발현 가능' 아니라 **'구조 장전·트리거 1단계 대기'**.

*Phase 2 migrate status drift 발견 (2026-08-04):*
- pending 2건 — `20260804110916_pocandidate_quote_binding`(내 신규) + **`20260731120000_receiving_document`(기존 미적용, 커밋 87e6bfae)**. 나중 0801은 applied = 순서 역전.
- receiving SQL 전문 = CREATE TABLE+INDEX+FK만(파괴 0). prod에 `ReceivingDocument` 테이블 **부재**.
- **⚠️ prod 잠복 runtime gap 실재**: 라이브 `api/receiving/documents/[id]/route.ts`가 `db.receivingDocument.*` 실사용(참조 8파일)인데 prod 테이블 없음 → 그 라우트 실행 시 runtime 실패. **apply가 위험을 늘리는 게 아니라 줄인다.**
- 호영님 판정: 옵션 1(전량 deploy, receiving 포함). 순서 역전 경위는 기록만·비차단, 재발 방지 별도 트랙.

*Phase 2 prod deploy 실행 기록 (2026-08-04, migration ts 20260804110916 UTC):*
- 대상: prod project-ref `xhidynwpkqeaojuudhsw`. 명령: `DATABASE_URL=<DIRECT_URL 5432 override> npx prisma migrate deploy`(pgbouncer 6543 hang 회피, 선검증 :5432 통과).
- 적용 2건: `20260731120000_receiving_document`(gap 해소) + `20260804110916_pocandidate_quote_binding`. "All migrations successfully applied."
- 검증 4/4: _prisma_migrations 52행·unfinished 0·rolled_back 0 / POCandidate.quoteId(text,nullable) 존재 / Order_poCandidateId_key unique index 존재 / ReceivingDocument 테이블 존재.
- 커밋 보류(Phase 3 GREEN 후 일괄). 순서 역전 재발 방지 별도 트랙.

*Phase 3 실행 기록 (2026-08-04, 실행 세션 — 로직 3파일, 최소 diff):*
- 격리 검증 환경: 사본 /tmp vitest (공유 node_modules 무접촉, DEV_RUNBOOK §9.9 준수). baseline 이 Phase 1 종료 상태 정확 재현(RED 4 · GREEN 28 · todo 1) 확인 후 착수.
- **bulk-po route**: 변환 풀 3중 필터 — `where: { userId, organizationId, quoteId: q.id, approvalStatus: { in: APPROVAL_PASSED_STATUSES }, stage: "po_conversion_candidate" }`. 승인통과집합 3값 모듈 상수화. 주석-구현 정합 갱신(주석=계약).
- **convert-pocandidate-to-orders**: dup-guard 2단 교체 — 1차 `poCandidateId` 기반(reason `already_converted`, DB `@@unique([poCandidateId])` 정합) + 2차 composite `(quoteId, vendorId)` 는 **vendorId non-NULL 한정** 유지(reason `duplicate`, DB `@@unique([quoteId, vendorId])` tx-throw 선방어 — 전면 교체 시 동일 vendor 2-candidate 가 DB unique 로 tx 전체 실패 + 축1 C3 회귀라 2단 구성이 게이트 충족 유일해). NULL 제외가 null-vendor collapse 원천 해소. skipped reason 구분값 `"already_converted" | "duplicate" | "empty_items"` 도입. 변환부 empty-items 거부 추가.
- **po-candidate-server**: `POCandidateCreateInput.quoteId?` 입력 계약 + create data `quoteId` 기입(생성 흐름 wiring 은 별건 §pocandidate-creation-flow 유지). `createPOCandidate` items 0건 throw 입구 가드.
- Quality gate 통과: Phase 1 RED 4건 전부 GREEN / corrupt→RED 재검증 4갈래 각 1회(각 corruption 이 해당 테스트만 정확히 RED) + 원복 diff 잔존 0 / 회귀 13파일 78 passed · 0 failed (축1·축2 orders-budget-deduction·축3, bulk-po route, bulk-po-vendor-aware, handoff-gate-352, schema sentinel 3종).
- 커밋 여전히 보류 — Phase 4(E 재기준) 후 일괄, 호영님 승인 게이트.

*호영님 결정 기록 (2026-08-04):*
- prod SELECT 실행 승인(Q-A2 보완 포함).
- Phase 1 범위 (a) 현 범위 유지 — 생성 흐름 정의는 별건 `§pocandidate-creation-flow`로 분리, 이 계획은 quoteId 입력 계약까지.
- 문서 커밋 + Phase 1 진입 승인.
- Phase 3 진입 "진행" / Phase 4 진입 "진행" (2026-08-04).

*Phase 4 실행 기록 (2026-08-04, 실행 세션):*
- E 파일 재기준: Track 1·2 헤더/제목 "[P1 승격 — RED 실증]" → "[GREEN 회귀 가드 — Phase 3 해소]". 계약 문장·prod 실측 근거·구 결함 구조는 "이력 (보호 의도 보존)" 블록으로 유지(삭제 0). Track 3 `describe.skip` 유지 + `it.todo` 문구 재기준("구조 소거 후 UBT 첫 표본 시 prod 대조").
- phase1 테스트 파일도 동일 재기준 (stale "[P1 RED]"·"현재 통과 → RED" 문구 정리 — 주석=계약 원칙).
- 회귀 게이트: 참조 스위트 13파일 78 passed · 0 failed · 1 todo. 검증 경계: 격리 /tmp 환경에서 변경 3파일을 참조하는 전 스위트 + schema sentinel 3종 — full-suite 전체 run(기존 실패 107파일 포함)은 클로드코드 환경 몫, 이 계획 산출 파일로 인한 실패 0 은 참조 스위트 기준 확인.
- 임시 계측 0 (제거할 것 없음 — corrupt 는 전부 원복 diff-clean).

*커밋 준비 (path-specific, 승인 후 클로드코드에서 실행):*
- 대상 9 (+order-vendor-grouping sentinel 승계): `apps/web/prisma/schema.prisma` / `apps/web/prisma/migrations/20260804110916_pocandidate_quote_binding/migration.sql` / bulk-po `route.ts` / `convert-pocandidate-to-orders.ts` / `po-candidate-server.ts` / `pocandidate-root-fix-phase1.test.ts` / `pocandidate-reachability-tracks.test.ts` / `__tests__/schema/order-vendor-grouping.test.ts` / `docs/plans/PLAN_pocandidate-root-fix.md`
- 산출물·부산물 스테이징 금지 (`_to_delete/*.tar.gz` 등). 메시지 초안은 인계 지시문 참조. 커밋·푸시 = 호영님 명시 승인 후.
- **커밋 완료: `3eb80f12` (2026-08-04, 9 files, push `9b80b2db..3eb80f12`).** 푸시 전 게이트가 schema sentinel 회귀(order-vendor-grouping `@@index([poCandidateId])`) 포착 → A/승계로 9번째 파일 추가(sandbox vitest 미실행 공백 보정). Phase 0–4 전 Phase 종료.
