# Implementation Plan: §quote-item-vendor-selection

- **Status:** 🔄 In Progress
- **Started:** 2026-08-07
- **Last Updated:** 2026-08-07
- **Estimated Completion:** TBD (P1 착수 후 산정)

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
- §pocandidate-vendor-split 계획서(6e42ae33) — C안(선택 스키마 정공법)을 본 트랙으로 분리, A안(유일-응답 파생)은 폴백 계층으로 기배포(1e3dc4d3).
- Phase 0 실측(2026-08-07, 사본 + HEAD 대조):
  - 비교 표면 실체: `app/_workbench/_components/quote-compare-review-workbench.tsx` (비라우팅 컴포넌트) — compare-matrix-best-highlight-10 sentinel 이 "품목별 최적 하이라이트" 기잠금. quotes page 가 응답 있는 vendorRequest ≥2 시 비교 검토 게이팅·라인 조립(L1837·1854).
  - 데이터 관계 완비: `QuoteListItem.vendorResponses` · `QuoteVendorRequest.responseItems` (QuoteVendorResponseItem — vendorRequestId × quoteItemId `@@unique`).
  - **부재 = 선택 저장 필드 하나**: per-item vendor 확정 컬럼 없음.

**Secondary References:**
- §reorder-quote-handoff CSRF 사고(e0518824) — 신규 mutation 은 csrfFetch + enforceAction 필수.
- §migration-order-drift-guard(fce9f597) — migration 은 manifest 게이트 + push 전 검증.

**Conflicts Found:**
- 없음. best-highlight(추천)와 선택(truth)의 경계만 정직 표기 필요.

**Chosen Source of Truth:**
- 선택 truth = `QuoteListItem.selectedVendorRequestId` (DB, 신설). 하이라이트는 추천 projection — truth 아님(캡션 표기). approve 소비 계층: **선택 > 유일-응답 파생 > 잔여 ""**.

**Environment Reality Check:**
- [x] 격리 /tmp vitest → operator 독립 vitest 권위
- [x] P0 잔여 정독 완료 — **교정 2건**:
  ① P3 표면 재판정: quote-compare-review-workbench 는 AI 정규화 견적(workqueue·NormalizedQuoteObject) 표면 — QuoteVendorResponseItem 무관, 본 트랙 무접촉 (best-highlight sentinel 승계 항목 소멸). **정확한 anchor = `app/quotes/[id]` 견적 상세의 품목×vendor 매트릭스 테이블** (라이브 실측: thead 품목/응답 vendor 열 + tbody 품목 행별 unitPrice 렌더 — 기존재 라우트, 신규 surface 0).
  ② 부수 발견: `app/_workbench/_components/vendor-responses-panel.tsx` importer 0 — dead 후보 3호(§inventory-dead-file-cleanup 계보 백로그, 본 트랙 무접촉).
- [ ] migration: prod 반영은 실행 세션 dry-run→보고→"진행" 게이트 (CLAUDE.md)

## 1. Priority Fit

- [ ] P1 immediate / [ ] Release blocker / [x] Post-release / [ ] P2 → 착수 승인 2026-08-07 "생성"

**Why This Priority:**
다중 응답 품목의 vendor 확정 수단 부재 — 현재는 유일-응답만 자동 분리되고 다중 응답 품목은 잔여 "" 로 남아 발주 시 수동 처리. 비교 검토의 자연 완결(비교→확정)이며 Track B 의 설계상 후속.

## 2. Work Type

- [x] Feature / [x] Workflow / Ontology Wiring / [x] Migration / Rollout — 그 외 해당 없음.

## 3. Overview

**Feature Description:**
견적 상세(quotes/[id]) 품목×vendor 매트릭스에서 품목별로 응답 vendor 를 확정(탭)하면 DB 에 저장되고, 결재 통과 시 그 선택이 candidate 분리의 1순위 근거가 된다.

**Success Criteria:**
- [ ] QuoteListItem.selectedVendorRequestId 신설 (additive nullable — rollback 단순)
- [ ] 선택 저장/해제 mutation — csrfFetch + enforceAction, 응답 실존 검증(가짜 선택 금지)
- [ ] 견적 상세 매트릭스 셀 선택 배선 — 저장 성공 시만 확정 표시(placeholder success 금지), 해제 가능
- [ ] approve 소비: 선택 > 유일-응답 파생 > 잔여 "" 계층 — Track B 회귀 0
- [ ] 최저가 표시(파생)와 선택 truth 경계 정직 표기 (자동 선택 아님을 캡션으로)
- [ ] migration 게이트: manifest 정합 + prod dry-run→보고→"진행"

**Out of Scope (⚠️ 절대 구현하지 말 것):**
- [ ] 자동 선택(최저가 채택 등 — B안 기각 유지)
- [ ] 신규 라우트/페이지 (기존 quotes/[id] 매트릭스 배선만 — workbench 무접촉, P0 교정)
- [ ] 발송/회신 흐름 변경 (선택은 비교 검토 단계 한정)
- [ ] Quote.selectedReplyId(quote 단위 선택) 폐기·변경 (공존 — per-item 이 우선 계층일 뿐)

**User-Facing Outcome:**
비교 검토에서 품목별 "이 공급사로 확정" → 결재 통과 시 확정대로 vendor 별 발주 후보 분리.

## 4. Product Constraints

**Must Preserve:**
- [x] 기존 라우트 구조 (quotes/[id] 매트릭스 내 배선 — workbench 무접촉, P0 교정)
- [x] same-canvas — 신규 surface 0
- [x] canonical truth — 선택 = DB 컬럼, UI state 대체 금지
- [x] invalidation — 선택 변경 시 비교·quote 조회 무효화

**Must Not Introduce:**
- [x] dead button / no-op / placeholder success (저장 실패 시 확정 표시 금지)
- [x] preview(하이라이트 추천)가 truth(선택)를 덮는 구조

**Canonical Truth Boundary:**
- Source of Truth: QuoteListItem.selectedVendorRequestId (신설) · QuoteVendorResponseItem(응답)
- Derived Projection: best-highlight 추천 · candidate 분리 결과
- Persistence Path: 선택 PATCH → DB → approve tx 소비

**UI Surface Plan:**
- [x] Existing route section — quotes/[id] 매트릭스 셀 (신규 페이지 0, P0 교정)

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| FK = vendorRequestId (vendorName 문자열 아님) | 응답 실존과 결속·이름 변경 안전 | approve 소비 시 vendorName 역참조 1 join |
| additive nullable 컬럼 | rollback = 컬럼 drop, 기존 행 무영향 | 없음 |
| 선택 > 파생 > 잔여 계층 | Track B 자산 보존(폐기 0) | 계층 우선순위 테스트 필수 |

**Dependencies:**
- Required Before Starting: 없음 (Track B 기배포)
- Touched: schema.prisma + migration · 선택 API route(신설 1) · app/quotes/[id]/page.tsx(매트릭스 셀 선택 배선) · po-candidate-server(split 입력 확장) · approve route(조립 확장)

**Integration Points:** quotes/[id] 매트릭스 셀 CTA · PATCH API · approve tx · migration manifest.

## 6. Global Test Strategy

- P1: 스키마 sentinel + API 계약(RED) — 검증 규칙(응답 실존·권한) 포함.
- P2: route unit (성공/실존 위반/권한/CSRF).
- P3: quotes/[id] 매트릭스 정적 sentinel(선택 배선·해제·정직 캡션) 신설 — workbench 무접촉(P0 교정).
- P4: split 계층 unit(선택 우선) + approve 통합 W6 + Track B 전 스위트 회귀.
- P5: migration drift 게이트 + 배포 후 prod 실측(선택 저장/해제 — 결재 없이 가능한 범위) + 분할 소비는 이연-관측 조건 병합.

## 7. Implementation Phases

#### Phase 0: Context & Truth Lock
- Status: [x] Complete — 교정 2건 포함 (§0 Environment Reality Check)
**✋ Quality Gate:** 배선 지점·sentinel 정합 확정 / **Rollback:** 계획 전용

#### Phase 1: 스키마 + 계약 RED
**🔴 RED:** 스키마 sentinel·API 계약 failing tests / **🟢 GREEN:** migration 파일 생성(manifest 게이트) / **🔵 REFACTOR:** 명명 확정
**✋ Quality Gate:** RED 실재·manifest 정합·기존 스위트 무손상 / **Rollback:** migration 파일 revert

#### Phase 2: 선택 저장 API
**✋ Quality Gate:** 성공/위반/권한/CSRF 4분기 GREEN·가짜 선택 차단 실증 / **Rollback:** route revert

#### Phase 3: 견적 상세 매트릭스 선택 배선 (P0 교정 반영)
**✋ Quality Gate:** dead button 0·저장 실패 시 확정 표시 0·매트릭스 기존 렌더 회귀 0 / **Rollback:** UI revert

#### Phase 4: approve 소비 계층
**✋ Quality Gate:** 선택 우선 W6 GREEN·Track B 스위트(27) 무손상·M2b 불변 / **Rollback:** route/서비스 revert (P3 유지)

#### Phase 5: Migration Rollout + Smoke
**✋ Quality Gate:** 실행 세션 prod dry-run→보고→호영님 "진행"→적용·health clean·배포 후 선택 저장 prod 실측 / **Rollback:** 컬럼 drop migration + 코드 revert (계층 폴백이 안전망 — 선택 0 이면 기존 A안 동작)

## 8. Optional Addenda

#### A. Workflow / Ontology Addendum (해당)
**Resolver Input:** 비교 검토 quote + 품목별 선택 상태 / **Expected Output:** 품목 행 CTA(확정/해제) · approve 분리 반영
**Validation:** [ ] 행 CTA 정확 / [ ] 선택 상태 표시 정직 / [ ] queue(비교 검토→발주 전환) 전이 자연

## 9. Risk Assessment

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| migration prod 반영 사고 | Low | High | additive nullable + dry-run 게이트 + drift-guard 기존 규율 |
| 추천↔선택 경계 혼동 | Med | Med | 캡션 정직 표기 + sentinel 잠금 |
| 계층 충돌(선택 vs 파생) | Low | High | P4 계층 우선순위 계약 테스트 |
| quotes/[id] 기존 매트릭스 렌더 회귀 | Med | Low | P3 sentinel 로 기존 렌더 + 신규 배선 동시 잠금 |

## 10. Rollback Strategy

- P1: migration 파일 revert / P2: route revert / P3: UI revert / P4: 소비 계층 revert(선택 무시 = A안 폴백) / P5: 컬럼 drop + 코드 revert. 전 단계에서 선택 0 상태 = 기존 Track B 동작과 동일(안전망 내장).

## 11. Progress Tracking

- Overall completion: 60% — P3 완료(매트릭스 선택 배선, 격리 GREEN)
- Current phase: Phase 4 대기 (approve 소비 계층)
- Current blocker: 없음 — **push 보류 중**(호영님 B 확정: P5 일괄 push. vercel.json buildCommand 에 prisma migrate deploy → push = prod DDL)
- Next validation step: 실행 세션 P3 커밋(로컬 누적) → P4 approve 소비 계층

**Phase Checklist:**
- [x] Phase 0 / [x] Phase 1 / [x] Phase 2 / [x] Phase 3 / [ ] Phase 4 / [ ] Phase 5

**P1 실행 기록 (2026-08-07):**
- RED 실재: sentinel 7/7 fail 캡처(스키마 필드·관계·인덱스·migration·manifest 전부 부재 상태) → 적용 후 GREEN.
- 스키마: QuoteListItem.selectedVendorRequestId String? + @relation("QuoteItemSelectedVendor", SetNull) + @@index / QuoteVendorRequest.selectedForItems 역관계. prisma validate 통과.
- migration: 20260807130000_quote_item_vendor_selection — ADD COLUMN(nullable)+INDEX+FK(SET NULL)만, 파괴 구문 0(sentinel 이 DROP/NOT NULL 부재 잠금). manifest 53건 재생성(등재 확인).
- 게이트: 스키마 스위트 전체 17파일 129 passed·0 failed (기존 schema sentinel 충돌 0).
- 스코프 조정 기록: API 계약 RED 는 P2 선두로 이동 — "커밋은 항상 GREEN" 규율과 TDD 양립(각 phase 에서 RED 캡처 후 GREEN 으로 changeset 구성). 명명 확정: POST /api/quotes/[id]/select-item-vendor (기존 select-reply 의 per-item 형제 — 관례 승계).

**P2 실행 기록 (2026-08-07):**
- RED 실재: route 부재로 스위트 로드 실패(Tests: no tests) → 구현 후 GREEN.
- 신설: `POST /api/quotes/[id]/select-item-vendor` — select-reply(quote 단위)의 per-item 형제. 관례 승계: auth 401 · 소유권(owner OR org member, 그 외 **404 존재 leak 차단**) · enforceAction(action `quote_status_change`, 가역 선택이라 high-risk 미설정) · 전 early-return `fail()`(ADR §11.21 lock leak→409 사고 관례).
- **핵심 계약 S4 응답 실존 검증**: vendorRequestId 확정 시 `QuoteVendorResponseItem(vendorRequestId, quoteItemId)` 실존 필수 — 응답 없는 vendor 확정 = 가짜 선택 400 `NO_RESPONSE_FOR_ITEM`. "비교한 것 중 고르기" 원칙의 서버측 강제.
- 해제(null)는 응답 검증 skip — 되돌리기는 항상 허용.
- CSRF: 라우트 내부 처리 0 — middleware csrf-route-registry 기본값 required 적용(select-reply 와 동일, 명시 등재 불요 실측). 클라이언트는 P3 에서 csrfFetch 사용.
- 테스트 10건(인증·권한 3 / 소속·응답 검증 4 / 해제 1 / 입력 방어 2). 게이트: 신규 10 + select-reply 형제 2파일 = **3파일 25 passed·0 failed**, tsc 신규 에러 0.

**P3 실행 기록 (2026-08-07):**
- RED 7/8 캡처(회귀 단언 1건만 기존 GREEN) → 구현 후 8/8. **공허 단언 1건 발각·교정**: U3 의 `invalidateQueries(["quote", quoteId])` 전역 매칭이 기존 3개 호출(L433·465·500)로 이미 통과 → 핸들러 본문 슬라이스 + `res.ok` 이후 순서 검사로 강화. (RED 캡처가 없었으면 공허한 채 통과할 뻔 — 캡처 규율의 실효 사례.)
- corrupt→RED 실증: csrfFetch→fetch 오염 시 U1 단독 RED → 원복 후 8/8·byte 동일.
- 배선: `handleSelectItemVendor(itemId, vendorRequestId|null)` — csrfFetch POST, **res.ok 이후에만** quote 무효화(실패 시 표시 변화 0·toast 만), pending state 는 표시 전용(확정 truth 는 DB `item.selectedVendorRequestId`), 동시 저장 가드.
- 셀 CTA: 응답 있는 셀(price !== null) 분기 안에만 렌더 → 무응답 "—" 셀은 CTA 자체가 없음(dead button 0). isAdmin 게이팅(기존 새로고침 CTA 관례 승계). 확정 시 ring-2 + "✓ 확정됨 · 해제" 토글.
- 정직 캡션: 헤더 "최저가는 추천일 뿐이며 확정은 직접 선택합니다" — 추천(파생)과 확정(truth) 경계 표기.
- 신규 import 0(csrfFetch·useState·cn·useToast·queryClient 전부 기존) — imports-smoke 영향 0 예상.
- 게이트: 매트릭스 8 + P2 API 10 + select-reply 형제 8 + P1 schema 7 + quotes 스위트 = **86 passed·0 failed**, tsc 접촉 파일 신규 0. (sandbox 사본에 `__tests__/helpers/page-imports-smoke.ts` 부재로 imports-smoke 1파일 로드 실패 — 사본 부분 동기화 탓, 실행 세션에서 반드시 실행 요망.)

## 12. Notes & Learnings

**계획 시점 기록 (2026-08-07):**
- 착수: 호영님 "다음 순 가자" → 계획 승인 "생성". Track B C안 정공법 — A안(유일-응답 파생)은 폴백 계층으로 보존(폐기 0).
- Phase 0 핵심 실측: per-item 비교 UI 는 기존재(quotes/[id] 매트릭스 — workbench 는 무관 표면으로 교정) — 본 트랙은 "선택 저장 1컬럼 + 배선 + 소비 계층"의 최소 정공법. 자동 선택(B안) 기각 유지 — 확정은 항상 사용자 탭.
- 선행 사고 교훈 선반영: 신규 mutation = csrfFetch + enforceAction(§support-csrf-fix 계보), migration = drift-guard 게이트, UI 배선 = 라이브 표면 실행 검증 게이트(P5).
