# Implementation Plan: §pocandidate-vendor-split

- **Status:** ⏳ Pending
- **Started:** 2026-08-06
- **Last Updated:** 2026-08-06
- **Estimated Completion:** TBD (Phase 0 설계 분기 후 확정)

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

---

## 0. Truth Reconciliation

**Latest Truth Source:**
- §pocandidate-creation-flow 계획서(729ce24a) — C 트랙("AI 소싱/비교 기반 vendor-split")을 본 백로그로 분리, 호영님 A안 확정 시점 기록.
- 계획 세션 사전 실측(2026-08-06):
  - 하류 완비: `convertPOCandidatesToOrders` = "candidate = vendor 별 1개씩" 전제, N Order 생성, `@@unique(quoteId, vendorId)` 2차 가드(NULL 제외 — §pocandidate-null-vendor-collapse 방어), vendor name→Vendor master 매핑 실패 시 vendorId NULL legacy 동등.
  - 예산 계약: vendor-split 로 Order N개여도 차감 1회·장부 1회 (orders-budget-deduction M2b — 잠금 기존재).
  - 상류 미달: `createPOCandidateFromQuote` = 단일 vendorName(selectedReply) 로 전 items 1 candidate 합침.
  - **QuoteItem 스키마에 vendorId 부재** — per-item vendor truth 가 DB 에 없음. 분리 키는 비교 검토(QuoteReply 계열)·소싱 데이터에서 파생 필요 (Phase 0 실측 대상).

**Secondary References:**
- §pocandidate-root-fix(변환 3중 필터·가드), approve route 훅(§pocandidate-creation-flow) — 멱등은 caller 3중 필터 책임.

**Conflicts Found:**
- 창설 훅의 멱등 설계("기존 candidate 0건일 때만 호출")가 N-candidate 생성과 양립하는지 — Phase 1 계약에서 해소 필요.

**Chosen Source of Truth:**
- 결재 truth = PurchaseRequest, candidate.approvalStatus = projection (역류 금지 — 기존 계약 유지). vendor 선택 truth = Phase 0 실측으로 확정 (추정 금지).

**Environment Reality Check:**
- [ ] QuoteReply / 비교 검토 / 소싱 스키마 실측 (per-item vendor 선택 데이터 실존 여부)
- [ ] bulk-po 경로의 candidate 생성·vendor 부여 방식 실측 (approve 훅과 이원 여부)
- [ ] prod 표본: 다중 vendor quote 실존 빈도 (필요 시 읽기 전용 SELECT — 승인 후)

## 1. Priority Fit

- [ ] P1 immediate / [ ] Release blocker / [x] Post-release / [ ] P2 → 착수 승인됨(2026-08-06 "1,2 가자")

**Why This Priority:**
다중 vendor quote 에서 발주 후보가 단일 vendor 로 합쳐지면 하류 vendor-split 이 무력화되고 오귀속 발주 위험. 단, 현행은 selectedReply 단일 선택 흐름이라 실사용 빈도는 Phase 0 표본으로 확정 — 기능 확장 트랙.

## 2. Work Type

- [x] Feature / [x] Workflow / Ontology Wiring — 그 외 해당 없음 (스키마 변경 여부는 Phase 0 분기).

## 3. Overview

**Feature Description:**
quote 로부터 발주 후보 생성 시, per-item vendor 선택 근거가 있으면 vendor 별로 candidate 를 분리 생성(N개)하여 기존 vendor-aware 변환(1 candidate = 1 vendor = 1 Order)과 정합시킨다.

**Success Criteria:**
- [ ] vendor 선택 truth 위치 확정 (Phase 0 — 실측, 추정 금지)
- [ ] 다중 vendor quote → candidate N개 (vendor 별), vendor 미상 잔여 items → vendor "" 1개 (기존 NULL-vendor 경로 보존)
- [ ] 멱등: 재전이·재요청 시 중복 candidate 0 (3중 필터가 N-candidate 와 양립)
- [ ] 예산 차감 1회 불변 (M2b 계약 무손상)
- [ ] 단일 vendor quote 동작 완전 동일 (회귀 0)
- [ ] 라이브 표면 실행 검증 게이트 (P4 — prod Chrome 실측)

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] AI 추천/비교 UI 신설 (기존 비교·소싱 표면 데이터 소비만)
- [ ] PurchaseRequest 결재 흐름 변경
- [ ] convertPOCandidatesToOrders 변경 (하류 완비 — 무접촉 원칙, 계약 위반 발견 시만 별도 승인)
- [ ] Track 3 amount-divergence (별건 감시 유지)

**User-Facing Outcome:**
- 다중 vendor 견적 결재 통과 시 발주 후보가 vendor 별로 분리되어 변환 풀에 진입 — 발주 관리에서 vendor 별 Order 로 자연 연결.

## 4. Product Constraints

**Must Preserve:**
- [x] canonical truth — PurchaseRequest=결재 truth, candidate=projection (역류 금지)
- [x] workbench / queue — 기존 stats 자연 반영 (UI 신설 0)
- [x] invalidation discipline — approve tx 내 생성 (기존 훅 위치 유지)

**Must Not Introduce:**
- [x] dead button / no-op / placeholder success
- [x] preview 가 truth 를 덮는 구조 (비교 데이터는 파생 근거로만)

**Canonical Truth Boundary:**
- Source of Truth: PurchaseRequest(결재) · Quote+선택 데이터(품목/vendor) · Order(발주)
- Derived Projection: POCandidate (vendor 별 분리 생성물)
- Persistence Path: approve tx → createPOCandidatesFromQuote(복수형) → 변환 풀

**UI Surface Plan:**
- [x] Existing route section (신규 surface 0 — 기존 발주 후보 큐 자연 반영)

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 상류(생성) 분리, 하류 무접촉 | 하류는 "vendor 별 1 candidate" 전제 완비 — 전제를 충족시키는 쪽이 최소 diff | 하류 결함 발견 시 별도 승인 필요 |
| 복수형 함수 신설(단수형 보존) | 기존 caller·테스트 무손상, 점진 전환 | 함수 2개 병존 기간 |
| vendor 미상 → "" 1건 | NULL-vendor 경로·legacy 동등성 보존 | 분리 불완전 케이스 존재 (정직 기록) |

**Dependencies:**
- Required Before Starting: §inventory-dead-file-cleanup 종료 (게이트 소음 제거)
- Touched: po-candidate-server.ts · approve route · (Phase 0 결과에 따라) 비교/소싱 조회부

**Integration Points:** approve tx 훅 · po-candidate-from-quote 테스트 계보 · 3중 필터.

## 6. Global Test Strategy

- 단위: split 그룹핑(다중/단일/미상 혼재/전부 미상/items 0) — Red-Green-Refactor.
- 통합: approve 훅 — N candidate 생성·멱등·예산 1회 (orders-budget M2b 스위트 무손상 확인).
- 회귀: po-candidate-from-quote 기존 스위트 + 3중 필터 + convert 계약 무접촉 검증.
- P4: 라이브 표면 실행 검증 게이트 (prod 결재 통과 표본 — 사전 고지 후).

## 7. Implementation Phases

#### Phase 0: Context & Truth Lock (설계 분기 게이트)
**Goal:** per-item vendor 선택 truth 실측 → 분리 키 설계 확정.
- Status: [ ] Pending
**🔴 RED:** "비교/소싱에 per-item vendor 선택 데이터 실존" 가설 검증 (QuoteReply·비교 스키마·bulk-po 경로 전수) / **🟢 GREEN:** 분리 키 확정 — (a) 기존 데이터 파생 / (b) 스키마 추가 필요 / (c) 데이터 부재 → 스코프 재판정 / **🔵 REFACTOR:** 선택지별 diff 규모 산정
**✋ Quality Gate:** 분리 키 판정에 추정 0 · **호영님 설계 분기 승인 1회** / **Rollback:** 계획 전용

#### Phase 1: Contract & Failing Tests
**Goal:** split 계약·멱등 계약 RED.
- Status: [ ] Pending
**✋ Quality Gate:** failing test 실재, 기존 스위트 무손상 / **Rollback:** 테스트 스캐폴드 revert

#### Phase 2: Split 로직 (createPOCandidatesFromQuote)
**Goal:** 그룹핑→N candidate 생성 최소 구현.
- Status: [ ] Pending
**✋ Quality Gate:** 단위 GREEN·truth 경계 위반 0·N+1 없음(단일 tx 배치) / **Rollback:** 서비스 계층 revert

#### Phase 3: Approve 훅 배선
**Goal:** 단수 호출부 교체, legacy fallback·예산 1회 불변.
- Status: [ ] Pending
**✋ Quality Gate:** 통합 GREEN·M2b 무손상·3중 필터 양립 실증 / **Rollback:** route revert (Phase 2 유지)

#### Phase 4: Rollout / Smoke / 실행 검증
**Goal:** prod 검증 + 마감.
- Status: [ ] Pending
**✋ Quality Gate:** 독립 vitest·tsc·build GREEN + prod 실측(생성 표본 사전 고지·정리 계획 포함) / **Rollback:** git revert — 스키마 변경 채택 시 migration rollback 경로 별도 기록

## 8. Optional Addenda

#### A. Workflow / Ontology Addendum (해당)
**Resolver Input:** 결재 통과 quote + vendor 선택 데이터 / **Expected Output:** candidate N (vendor 별) → 변환 풀 stage 진입
**Validation:** [ ] 변환 풀 queue 반영 정확 / [ ] vendor 미상 candidate 의 blocker 표기 정직

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| per-item vendor 데이터 부재 (c 분기) | Med | High(스코프 재판정) | Phase 0 게이트에서 정지·승인 후 진행 |
| 멱등 필터와 N-candidate 충돌 | Med | High(중복 발주 후보) | Phase 1 계약에서 (quoteId, vendor) 단위 멱등 재정의 |
| 예산 이중 차감 | Low | High | M2b 스위트 게이트 필수 통과 |
| 창설-변환 사이 계약 드리프트 | Low | Med | convert 무접촉 + 계약 대조 테스트 |

## 10. Rollback Strategy

- Phase 1: 테스트 revert / Phase 2: 서비스 revert / Phase 3: route revert / Phase 4: git revert + (스키마 시) migration rollback 문서화.

## 11. Progress Tracking

- Overall completion: 100% — 트랙 종료 (구현·커밋·배포 완료, P4 = 이연-관측형)
- Current phase: 완료 (커밋 1e3dc4d3 · 배포 2026-08-07T11:19 전환 확인)
- Next validation step: 관측 조건 — 첫 vendor 응답 제출 + 결재 통과 발생 시 실행 세션이 candidate 분리 형태·Order 분리·예산 1회 실측 보고 (Track 3 UBT 표본과 동일 감시 패턴)

**Phase Checklist:**
- [ ] Phase 0 / [ ] Phase 1 / [ ] Phase 2 / [ ] Phase 3 / [ ] Phase 4

## 12. Notes & Learnings

**계획 시점 기록 (2026-08-06):**
- 착수 승인: 호영님 "1,2 가자" — A(§inventory-dead-file-cleanup) 선행, 본 트랙 후행.
- 원 백로그: §pocandidate-creation-flow C 트랙 ("AI 소싱/비교 기반 vendor-split") — 창설 시점 분리로 재정의 (하류 vendor-aware 변환 완비 실측이 근거).
- 사전 실측 핵심: QuoteItem.vendorId 부재 — 분리 키는 Phase 0 실측으로만 확정 (추정 설계 금지).

**Phase 0 실측·설계 분기 확정 (2026-08-07):**
- per-item vendor **응답** truth 실존: `QuoteVendorResponseItem` (vendorRequestId × quoteItemId `@@unique`, 품목 단위 unitPrice·leadTimeDays·moq) — "AI 소싱/비교" 데이터의 실체. 보조: `ProductVendor` 마스터(품목별 vendor 후보·가격).
- per-item vendor **선택** truth 부재: QuoteListItem 포함 스키마 전체에 품목 단위 vendor 확정 필드 0. 선택은 Quote 단위(selectedReply — reply 는 quote 레벨 단일 vendorName, per-item 구조 없음).
- QuoteReply 는 이메일 회신 원문 모델(품목 구조 없음) — 분리 키 소스 아님.
- **호영님 설계 분기: A안 확정 — 유일-응답 파생.** 품목별 응답 vendor 유일 → 그 vendor 로 그룹핑, 다중 응답·응답 0 품목 → vendor "" 잔여 묶음(정직, NULL-vendor 경로 보존). 자동 가격 판단 0 = 구매 의사결정 대행 없음. 스키마 무변경·최소 diff. B(최저가 자동)·C(선택 스키마 신설 — §quote-item-vendor-selection 후속 후보) 기각/이연.
- prod 표본(다중 vendor quote 빈도)은 A안 채택으로 설계 비의존 — 생략(우선순위 참고 필요 시 후속 SELECT).

**Phase 1–3 실행 기록 (2026-08-07, 격리 /tmp vitest):**
- **P1 (RED)**: `po-candidates-vendor-split.test.ts` 신설 — 계약 V1(유일-응답 그룹핑 N개)·V2(다중/0 응답 → 잔여 "")·V3(분할 근거 없음 → 단수형 동등, vendorName 승계)·V4(items 0 → null)·V5(totalAmount 정직성 — N>1 시 후보별 Σ, 전체액 복제 금지)·V6(projection 승계). 함수 부재로 8/8 RED 실증.
- **P2 (GREEN)**: `createPOCandidatesFromQuote` 신설(단수형 무접촉 보존) — `QuoteItemForCandidateSplit.respondedVendors` 입력, 유일-응답만 그룹핑·자동 가격 판단 0. quoteId 는 직렬화 계약 밖(기존 POCandidateRow 유지) — V6 은 create 인자로 검증(계약 무접촉 판단).
- **P3 (배선)**: approve route — `QuoteVendorResponseItem` 조인으로 품목별 응답 vendor 조립(vendorRequest.vendorName distinct) → 복수형 호출 → `candidates.push(...createdList)`. 통합 테스트: fake tx 에 quoteVendorResponseItem 모델 추가(기본 [] = 분할 근거 없음 → W1~W4 기존 계약 그대로 GREEN = 회귀 동등성 실증) + W5 신설(2 vendor 분할·다중 응답 잔여 "") + mock 유니크 id 교정(고정 id 가 W5 poCandidateId 집합 관측과 충돌).
- **게이트**: split unit 8 + 단수형 회귀 4 + approve 통합 6(W5×2 포함) + orders-budget M2b(예산 1회 불변) + approve-vendor-po = **5파일 27 passed·0 failed**. tsc 접촉 파일 신규 0.
- 멱등 유지: 기존 3중 필터(quoteId 단위 0건일 때만 호출)가 N-candidate 와 자연 양립 — 생성은 항상 "0건 → N개" 원자(같은 tx), 부분 생성 후 재호출 경로 없음.

**Phase 4 — 이연-관측형 마감 (2026-08-07, 호영님 A 확정):**
- 커밋 1e3dc4d3 (실행 세션 독립 검증: vitest 5파일 27 GREEN·M2b 예산 behavior 전문 대조로 "예산 차감은 candidate 수와 분리·차감액 출처는 quote 기준 = candidate totalAmount 와 무관" 확정·tsc baseline 불변·pre-push build 통과). 배포 전환 2026-08-07T11:19:35 실측.
- prod 표본 조회(read-only): quote 7건 중 vendor 요청 2건(J5Y7) 실존하나 **응답 제출 0건** — QuoteVendorResponseItem 표본 부재로 분할 경로 prod 실측 불가.
- **P4 판정: 이연-관측형** — 분할 경로는 W5 통합 테스트가 커버, prod 는 결재 조작(예산 실차감) 없이 첫 실사용 이벤트에서 관측: ① 첫 결재 통과 → 잔여-단일(기존 동등) 경로 실측 ② 첫 vendor 응답 제출 + 결재 통과 → 분할 경로 실측(candidate N·vendor 별 Order·예산 1회). 감시 주체 = 실행 세션(Track 3 amount-divergence UBT 표본과 동일 시점·동일 패턴).
- 라이브 표면 실행 검증 규율과의 정합: 본 트랙은 서버 tx 로직(UI 무접촉) — 규율의 '동급' 조항은 W5 실행 통합 + 이연 관측 페어로 충족. 후속 백로그: §quote-item-vendor-selection (per-item 선택 스키마 — C안 정공법, 필요 시).
