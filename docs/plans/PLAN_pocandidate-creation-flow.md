# Implementation Plan: §pocandidate-creation-flow — POCandidate 생성 흐름 (결재 통과 시 자동)

- **Status:** ✅ Complete — 전 Phase (0–4) 종료, prod 배포 GREEN (커밋 `fce9f597`·`3e591b29`, push 완료)
- **Started:** 2026-08-04
- **Last Updated:** 2026-08-05
- **Estimated Completion:** 2026-08-05 (완료)

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
⛔ **`prisma migrate dev` / `db push` 절대 금지** (DEV_RUNBOOK §9.9)

---

## 0. Truth Reconciliation

**Latest Truth Source (2026-08-04 실측, 계획 세션):**
- **결재 라이브 truth = `PurchaseRequest`** (quote 단위): `work-queue/purchase-conversion/[quoteId]/request-approval` POST — approvalPolicy 해석(§11.209c), approver 매핑(금액 임계치 §11.209d), email/in-app/push 알림, audit까지 완결 배선. PENDING/APPROVED/REJECTED/CANCELLED.
- **POCandidate 생성 흐름 = 0** (§pocandidate-root-fix Phase 0 실측): POST `/api/po-candidates` 클라이언트 0, `seedPOCandidates` dead. `POCandidateApprovalStatus` enum을 채우는 흐름 부재.
- **vendor 원천**: `QuoteItem`에 vendor 필드 없음. `QuoteReply.vendorName`(nullable, 이메일 추출)이 유일, `Quote.selectedReplyId` 단수 → **현 구조상 quote당 1 vendor**. vendor별 N-candidate 분할은 AI 소싱 확정 데이터 필요(부재) — 별건 C 트랙.
- **변환 측 준비 완료** (§pocandidate-root-fix 2026-08-04, 커밋 2a341a3a): bulk-po 3중 필터(quoteId + 승인통과집합 + stage), `POCandidateCreateInput.quoteId?` 입력 계약, 2단 dup-guard, empty-items 이중 가드, `Order @@unique([poCandidateId])`. **생성만 이으면 vendor-aware 경로 활성.**

**Secondary References:**
- `PLAN_pocandidate-root-fix.md` (Phase 0 실측·Out of Scope 분리 근거) / `PLAN_11.209d-*` 결재 계열 / purchase-conversion queue route (ready_for_po 판정·stats).

**Conflicts Found:**
- POCandidate.approvalStatus(enum 8값) vs PurchaseRequest.status — 결재 상태의 이중 표현. **해소 규칙(계약)**: PurchaseRequest = 결재 truth, `candidate.approvalStatus` = **생성 시점 projection**(변환 필터 입력값). 생성은 결재 확정 후에만 → projection이 stale해질 수 있는 유일 경로는 PR 사후 취소 — 처리 규칙은 Phase 0 실측 후 확정.

**Chosen Source of Truth:**
- 결재: PurchaseRequest(DB). 발주: Order(DB). POCandidate = 변환 전 후보(derived, 결재 결과의 projection 포함).

**Environment Reality Check:**
- [ ] PR APPROVED 전이 지점(approve mutation/route) 전수 실측
- [ ] 결재 불요(approvalPolicy none) 플랜의 ready_for_po 판정 지점 실측
- [ ] 격리 /tmp vitest 환경 (기존 패턴 승계)
- [ ] prod 접근 불요 (이번 트랙 DB 스키마 무변경 전제 — P0에서 멱등 가드 방식 확정 시 재검토)

---

## 1. Priority Fit

- [ ] P1 immediate / [ ] Release blocker
- [x] Post-release (기능 완성 — 휴면 경로 활성화). **호영님 지정, A안 확정 (2026-08-04)**
- [ ] P2 / Deferred

**Why This Priority:**
§pocandidate-root-fix가 봉쇄한 vendor-aware 변환 경로는 생성 흐름이 없어 휴면. 이 트랙이 그 경로를 실사용으로 전환한다. 현재 P1 충돌 없음.

---

## 2. Work Type

- [x] Feature (생성 서비스 + 훅)
- [x] Workflow / Ontology Wiring (결재 → 발주 후보 핸드오프)

---

## 3. Overview

**Feature Description:**
결재 게이트 통과 시점(PR APPROVED 전이 + 결재 불요 플랜의 ready_for_po 판정)에 서버가 quote로부터 POCandidate를 자동 생성한다. quoteId 결속·vendor=selectedReply.vendorName·items 충실 매핑·approvalStatus projection. 당분간 quote당 1건 (multi-vendor 분할 = C 트랙 별건).

**Success Criteria:**
- [x] PR APPROVED 전이 → candidate 정확히 1건 자동 생성 (quoteId·vendor·items·approvalStatus projection)
- [x] 재전이·재요청 멱등 — 같은 quote에 중복 candidate 0 (W3)
- [x] ~~결재 불요 플랜~~ → P0 측정2로 스코프 제외 확정 (단일 게이트 지점 부재)
- [x] items 매핑 충실도: 수량·단가·lineTotal 무손실 + items 0 quote 생성 skip·legacy 보존 (S1·S3·W4)
- [x] 생성 candidate의 vendor-aware 변환 실행 (W2) + [차단 보완] approve 3중 필터 (W1) + legacy fallback 무손상
- [x] 회귀 게이트 신규 실패 0 (실행 세션 독립 27파일 188 passed — 권위 실측)

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] AI 소싱/비교 기반 vendor-split (C 트랙 별건 — `§pocandidate-vendor-split` 백로그)
- [ ] PurchaseRequest 결재 흐름 자체 변경 (truth 무접촉 — 훅만 추가)
- [ ] UI surface 신설 (queue 표시는 기존 stats가 자연 반영)
- [ ] Track 3(amount-divergence) 동적 검증 (UBT 표본 후 별건)
- [ ] DB 스키마 변경 (멱등은 앱 레벨 존재 검사 우선 — P0에서 불충분 판정 시에만 별도 승인)

**User-Facing Outcome:**
결재 승인 즉시 발주 후보가 자동으로 변환 풀에 장전 — 운영자는 bulk-po 실행만 하면 vendor 매핑·후보 단위 가드가 적용된 발주 생성. 수동 후보 입력 단계 소멸.

---

## 4. Product Constraints

**Must Preserve:**
- [x] canonical truth: PurchaseRequest(결재)·Order(발주). candidate는 projection 포함 파생
- [x] workbench/queue/rail/dock — UI 무접촉
- [x] 기존 결재 흐름(§11.209d 계열) 동작 불변 — 훅은 best-effort 아님·명시 실패 (silent 실패 금지)

**Must Not Introduce:**
- [x] placeholder success — 생성 실패 시 결재 응답에 실패 사실 노출 방식 P0 확정 (승인은 성공했는데 candidate 누락을 조용히 삼키지 않는다)
- [x] 이중 truth 승격 — candidate.approvalStatus를 결재 판단에 재사용하는 역류 금지 (변환 필터 전용)

**Canonical Truth Boundary:**
- Source of Truth: PurchaseRequest / Order / Quote(+selectedReply)
- Derived: POCandidate (생성 시점 projection: approvalStatus·vendor·items 스냅샷)
- Persistence Path: 기존 `createPOCandidate` 경유 (입구 가드 재사용)

**UI Surface Plan:**
- [x] 없음 (서버 훅 + 서비스만)

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 생성 훅 = 결재 확정 지점 서버 사이드 (A안, 호영님 확정) | 결재 truth와 원자적 인접, 클릭 0, UI 무접촉 | multi-vendor는 못 다룸 → C 트랙 |
| `createPOCandidateFromQuote(quote, prOutcome)` 서비스 신설 — 내부에서 기존 `createPOCandidate` 재사용 | 입구 가드(empty-items)·quoteId 계약 재사용, 매핑 로직 단일화 | — |
| 멱등 = 앱 레벨 존재 검사 (`quoteId` 기준 findFirst) 우선 | 스키마 무변경. bulk-po의 quote-level `orders.length>0` + poCandidateId unique가 하위 방어 | 동시성 틈은 낮음(결재 전이는 단일 지점) — P0에서 결재 mutation의 tx 경계 실측 후 확정 |
| approvalStatus projection 매핑: APPROVED→`in_app_approved`, 결재 불요→`not_required` | 승인통과집합과 정합 — 변환 풀 즉시 진입 | externally_approved 계열은 외부 결재 도입 시 확장 |

**Dependencies:**
- Required Before Starting: Phase 0 실측 4건
- External Packages: 없음
- Touched: `po-candidate-server.ts`(서비스 확장) / PR approve mutation(P0 확정 지점) / 결재 불요 경로(P0 확정 지점) / 테스트

**Integration Points:**
- PR approve mutation (APPROVED 전이 — P0에서 파일 확정)
- purchase-conversion queue ready_for_po 판정 (결재 불요 경로 후보)
- bulk-po 변환 풀 (3중 필터 소비자 — 무변경, 통합 검증만)

---

## 6. Global Test Strategy

Red-Green-Refactor 강제, 기존 규율 승계 (corrupt→RED·격리 /tmp·구문 아닌 계약·관계식 잠금).
- 생성 계약 → 서비스 unit (mock tx 관측)
- 훅 → 결재 mutation 통합 테스트 (mock db, 기존 결재 테스트 회귀 0)
- 핸드오프 → 생성 candidate로 bulk-po 변환 통합 (§pocandidate-root-fix 테스트 자산 재사용)
- 실발주 smoke 는 표본 발생 시 (Track 3 재개 조건과 동일 시점) — 한계 명시

---

## 7. Implementation Phases

#### Phase 0: Context & Truth Lock (코드 변경 0)
**Goal:** 훅 지점·멱등 경계·실패 노출 방식 확정.
- Status: [x] Complete (2026-08-04 — 4/4 실측 + 차단급 발견 1건, §12)

**🔴 RED (확인 항목):**
- [ ] PR APPROVED 전이 지점 전수 (approve mutation route/서비스, tx 경계 포함)
- [ ] 결재 불요 플랜의 ready_for_po 판정 지점 (훅 삽입 가능 위치)
- [ ] PR 사후 취소(CANCELLED) 존재 여부·시점 → 생성된 candidate 처리 규칙 확정
- [ ] 생성 실패 시 노출 방식 확정 (결재 응답 필드 vs audit + queue 표시)
**🟢 GREEN:** 4건 §12 기록, 계약 문장 확정
**🔵 REFACTOR:** 멱등 방식 최종 확정 (앱 레벨 vs 스키마 — 후자면 별도 승인)

**✋ Quality Gate:** 미확인 0건
**Rollback:** planning-only

#### Phase 1: Contract & Failing Tests
**Goal:** 생성·멱등·매핑·실패 노출 계약 RED.
- Status: [x] Complete (2026-08-04 — RED 6 + 보존 계약 GREEN 2, §12)

**🔴 RED:**
- [ ] **[차단 보완] approve 라우트 candidate fetch 3중 필터** — 승인 안 된/타 quote candidate가 approve 변환에 안 들어온다 (root-fix Track 2·증상4 계약의 approve 경로 판) → RED
- [ ] APPROVED 전이 + candidates 0건 → candidate 1건 생성 후 vendor-aware 변환 (quoteId·vendor=selectedReply.vendorName·items 수량/금액 무손실·approvalStatus=`in_app_approved` projection)
- [ ] 재승인/재전이 멱등 — 중복 candidate 0 (tx 내 존재 검사)
- [ ] items 0 quote → 생성 skip + legacy 경로 유지 (silent 실패 아님 — 기존 동작 보존)
- ~~결재 불요 경로~~ (P0 측정2로 스코프 제외 — 단일 지점 부재)
**🟢 GREEN:** 스캐폴딩만
**🔵 REFACTOR:** 헤더 커버리지 경계

**✋ Quality Gate:** 전건 처음부터 RED, 기존 결재·변환 스위트 회귀 0
**Rollback:** 테스트 revert

#### Phase 2: Core — createPOCandidateFromQuote
**Goal:** P1 RED → GREEN (서비스만).
- Status: [x] Complete (2026-08-04)

**✋ Quality Gate:** unit GREEN, corrupt→RED 각 1회+원복, 회귀 0
**Rollback:** 서비스 revert

#### Phase 3: Wiring — 결재 전이 훅 + 핸드오프 통합
**Goal:** 훅 연결 + vendor-aware 경로 활성 실증.
- Status: [x] Complete (2026-08-04 — 차단 보완 + 생성 훅 GREEN·corrupt→RED 4종·회귀 신규 실패 0, §12)

**✋ Quality Gate:** 훅 통합 GREEN, 기존 결재 흐름 회귀 0, legacy fallback 무손상, no silent 실패
**Rollback:** 훅 revert (서비스 독립)

#### Phase 4: Rollout / Smoke
**Goal:** 회귀 전체 + 배포 + 마감.
- Status: [x] Complete (2026-08-05 — 커밋 3e591b29·배포 READY·health clean 유지. 전달 오염 사고 1건 게이트 포착·복구, §12)

**✋ Quality Gate:** push 전 게이트(실행 세션 독립 검증 — 두 트랙 선례), full-suite 신규 실패 0, 커밋·푸시 승인 게이트. 실발주 smoke는 표본 시점으로 명시 이연.
**Rollback:** Phase 3 → 2 revert (DB 무접촉 전제 유지 시)

---

## 8. Optional Addenda

### A. Workflow / Ontology Addendum (해당)
**Resolver Input:** 결재 확정 이벤트 → 변환 풀 장전
**Validation:**
- [ ] ready_for_po stats에 candidate 보유 quote 자연 반영 (기존 판정 무변경 확인)
- [ ] 승인 안 된 quote는 여전히 변환 풀 진입 불가 (root-fix 필터 회귀 0)

---

## 9. Risk Assessment

| Risk | Prob | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| projection stale (PR 사후 취소) | Med | Med | P0에서 취소 경로 실측 → 규칙 확정 (기본 후보: 취소 시 candidate stage 이탈) |
| 훅 실패 silent 삼킴 | Med | High | 계약으로 명시 노출 강제 (P1 RED 항목) |
| 결재 mutation 회귀 (훅 삽입 부작용) | Low | High | 기존 §11.209d 스위트 회귀 0 게이트 |
| 멱등 동시성 틈 | Low | Med | 결재 전이 단일 지점 + 하위 방어 2중 (orders.length·poCandidateId unique) |

---

## 10. Rollback Strategy

- Phase 1: 테스트 revert / Phase 2: 서비스 revert / Phase 3: 훅 revert / Phase 4: 전체 revert
- **Special:** DB 무접촉 전제 — 스키마 필요 판정 시 그 시점에 migrate 게이트(§9.10 절차) 별도.

---

## 11. Progress Tracking

- Overall completion: 100% — 트랙 종료 (2026-08-05)
- Current phase: 없음 (전 Phase 완료)
- Current blocker: 없음
- Next validation step: 없음 — 첫 실발주(PR 승인) 발생 시 Track 3(§budget-quote-candidate-amount-divergence) 재개 조건 도래 주시

**Phase Checklist:**
- [x] Phase 0 / [x] Phase 1 / [x] Phase 2 / [x] Phase 3 / [x] Phase 4

---

## 12. Notes & Learnings

**Phase 0 Truth Lock 실측 (2026-08-04, 계획 세션 — repo 읽기만):**

*측정1 — PR APPROVED 전이 지점:* `app/api/request/[id]/approve/route.ts` 단일. SERIALIZABLE tx 안에서 status→APPROVED + **변환까지 즉시 실행** (`convertPOCandidatesToOrders` 호출, Phase 1.3-wiring-D — candidates>0이면 vendor-aware N Order, 0이면 legacy 1 NULL-vendor Order). **"결재 통과 시 자동"의 훅 지점 = 바로 이 tx.**

*⚠️ 차단급 발견 — §pocandidate-root-fix 누락 지점:* 같은 라우트 L231의 candidate fetch가 **구식 무필터** `where {userId, organizationId}` — quoteId·approvalStatus·stage 전부 없음. root-fix Phase 3는 bulk-po만 교정, **두 번째 변환 caller를 측정1 sweep이 누락**(당시 grep이 bulk-po 중심). 위험 성격은 root-fix와 동일(승인 우회·multi-quote 반복 변환 클래스) — prod 발화 조건도 동일(orphan candidate 소유 유저의 quote·PR 부재로 휴면, '장전' 상태). **이 트랙 P1·P3에서 3중 필터 보완을 생성 훅과 같은 파일·같은 tx로 함께 교정** (승인통과집합 상수는 공유 모듈로 추출 — bulk-po와 이원화 방지).

*측정2 — 결재 불요 플랜 경로:* `ready_for_po`는 resolver 파생 상태(quote status 기반)일 뿐 mutation 지점이 아님. 결재 불요 플랜은 PR 자체가 생성되지 않고(request-approval이 in_app_approval만 허용) bulk-po가 operator 경로. **"결재 불요 게이트 통과"라는 단일 서버 지점이 존재하지 않음** → 스코프 확정: **자동 생성은 in_app_approval(PR APPROVED) 경로만.** 결재 불요 플랜은 legacy fallback 현행 유지 (§3 Success Criteria 해당 항목 축소).

*측정3 — PR CANCELLED:* enum 선언만 존재, request 계열 CANCELLED mutation 0 (quote status CANCELLED는 별개). projection stale 경로 현재 없음 → 규칙 문서화만: 취소 mutation 도입 시 candidate stage 이탈 처리 필수(백로그 노트).

*측정4 — 실패 노출:* 변환이 approve tx **내부**라 변환 실패 = tx 전체 롤백(승인도 취소) — silent 삼킴 구조적으로 불가. 생성 훅도 같은 tx에 넣으면 동일 원자성 보장. 별도 노출 채널 불요 (500 + audit 기존 패턴).

*설계 재편 (P0 결과):* A안의 실체 = approve tx에서 candidates 0건일 때 **legacy fallback 대신 candidate 생성 → vendor-aware 변환** 경로로 수렴. 모든 승인 발주가 poCandidateId 가드·audit 체계를 타게 됨. 멱등은 tx 내 후보 존재 검사 + 기존 `orders.length`/`@@unique([poCandidateId])` 하위 방어로 충분 — 스키마 무변경 확정.

**Phase 1–3 실행 기록 (2026-08-04, 격리 /tmp vitest — 공유 node_modules 무접촉):**
- **P1**: 신규 계약 8건 — RED 6(W1 차단 보완·W2 생성·S1·S2·S3·S4) + 보존 계약 GREEN 2(W3 멱등·W4 items-0 legacy — 하네스 유효성은 corrupt로 검증). approve 라우트 동적 테스트는 이 라우트 최초 (기존 2파일은 정적 sentinel뿐) — 결재 외곽(권한·예산·알림) 11모듈 factory mock, 변환 블록만 관측, fake tx가 where 실적용(root-fix 패턴 승계).
- **P2**: `createPOCandidateFromQuote(client, input)` — quoteId 결속·vendor(selectedReply.vendorName, NULL→"")·items 무손실 매핑(catalogNumber/leadTime 폴백 — POCandidateItem 스키마 default 정합)·totalAmount 우선순위(PR>quote>Σ)·approvalStatus projection 기본 `in_app_approved`·items 0 → null skip. client 파라미터로 approve tx 재사용(원자성).
- **P3**: ① [차단 보완] approve 변환 fetch 3중 필터 — 승인통과집합 상수를 `lib/orders/approval-passed-statuses.ts`로 추출(단일 소스), bulk-po도 교체. ② candidates 0건 + items>0 → tx 내 자동 생성 후 vendor-aware 변환(legacy fallback은 items-0 edge 전용으로 축소). 멱등 = 3중 필터 fetch가 존재 검사 겸임.
- **Quality gate**: RED 6→GREEN(34/34, 기존 approve 정적 sentinel 2파일 포함) / corrupt→RED 4종(quoteId 필터 제거→W1·생성 블록 무력화→W2·생성 무조건화→W3·서비스 empty 가드 제거→S3) 각 targeted RED + 원복 diff-clean / 회귀 36파일 262 passed·**신규 실패 0** — 유일 실패 1건은 `approval-routes-email-wiring`의 request-approval 라우트 `email: true` 기대 sentinel로, 디바이스 원본에서도 동일 실패(기존 실패군, 이 계획 무접촉 파일). full-suite·build는 push 전 게이트(실행 세션) 몫.

**Phase 4 실행 기록 (2026-08-05, 실행 세션 + 계획 세션):**
- **🛑 전달 오염 사고 (게이트 포착, 커밋 전 복구)**: 디스크의 `bulk-po/route.ts`가 approve 라우트 내용으로 byte-for-byte 덮여 있었음 — 실행 세션 독립 vitest가 11 failed로 포착(`{ params }` 구조분해 폭발), 커밋했으면 bulk-po 변환 prod 100% 500. **원인 = 계획 세션(sandbox) 전달 단계**: 산출물 준비 cp에서 동명 `route.ts` 2건 충돌 처리 중 bulk-po 사본 유실 → approve 내용이 bulk-po 슬롯으로 커밋됨. 계획 세션의 사후 검증(상수 grep 카운트·head 1줄)이 두 라우트를 구분 못 하는 **비판별 검사**였던 것이 이중 원인. 복구 = `git checkout HEAD` 후 의도 변경(로컬 상수 삭제 + 공유 import)만 최소 재적용, sandbox 판본 폐기.
- **재발 방지 (실행 세션 메모리 고정 + 계획 세션 규율 추가)**: ① sandbox changeset은 스테이징 전 파일 정체성 확인(diff 증감폭·cmp) ② 계획 세션 전달 규율 — 동명 파일은 준비 단계부터 구분명 사용 + 파일 고유 마커(예: `routePath:` 값)로 판별 검증. 실행 세션 독립 실측이 최종 권위임을 **세 번째로 실증** (schema sentinel → smoke FALSE STOP → 전달 오염).
- 독립 검증 (복구 후, 권위 수치): **27파일 188 passed·0 failed·1 todo** (신규 8 GREEN 포함). production tsc 0·총 27 baseline. §12 P1–P3의 "36파일 262 passed"는 sandbox 환경 수치 — 권위는 본 실측.
- 커밋·push: `fce9f597`(drift-guard 마감 docs) → `3e591b29`(본 트랙 7파일, 오염 0 재확인). 원격 HEAD `3e591b29`, build hook 통과.
- P4 배포 실증: Vercel READY(sha 3e591b29), prebuild manifest 52, `/api/health` `migrations` = clean:true·pending 0·unknown 0, `manifestGeneratedAt` 07:36:26 = 이번 빌드 prebuild 시각(신규 배포 반영 확증). DB 무접촉 기대값 정합.
- 운영 팁(실행 세션): Vercel API state가 READY 후에도 장시간 BUILDING으로 표시될 수 있음 — 배포 반영은 health `manifestGeneratedAt` 교차 확인이 확실.
- **트랙 종료.**

**계획 시점 기록 (2026-08-04):**
- 호영님 A안 확정("결재 통과 시 자동") — B(명시 CTA) 기각, C(AI vendor-split)는 별건 백로그 `§pocandidate-vendor-split`.
- 이중 truth 해소 규칙을 계약으로 고정: PurchaseRequest=결재 truth, candidate.approvalStatus=생성 시점 projection(변환 필터 전용, 역류 금지).
- 선행 트랙 자산 재사용: §pocandidate-root-fix의 변환 필터·가드·테스트, §migration-order-drift-guard의 push 전 게이트 규율.
