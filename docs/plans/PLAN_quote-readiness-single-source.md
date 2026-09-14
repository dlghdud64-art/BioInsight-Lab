# Implementation Plan: §quote-readiness-single-source · 견적 준비 판정 단일 출처

- **Status:** 🔄 In Progress (Phase 0~3 완료 · Phase 4 prod 확인 대기)
- **Started:** 2026-09-14
- **Last Updated:** 2026-09-14
- **Estimated Completion:** 2026-09-15

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

## 🛑 결함은 두 축이다 · 하나만 고치면 재발한다

```
축 ①  판정 로직 3벌        같은 견적의 "비교·발주 가능" 을 서로 다른 식으로 계산한다
축 ②  회신 수 카운트 2벌    그 식에 넣는 "회신 N건" 을 서로 다른 테이블에서 센다
```

- 축 ①만 합치면: 한 함수가 **다른 두 숫자**를 받아 여전히 화면마다 다른 답을 낸다.
- 축 ②만 합치면: 같은 숫자를 **다른 문턱**(2건 vs 1건)에 넣어 여전히 「차단」 vs 「가능」 이 된다.
- 그래서 단일 출처는 **입력(카운트)과 판정(문턱) 둘 다**를 한 함수가 가진다.

### 축 ① 판정 로직 3벌

| # | 위치 | 식 | 회신 1건일 때 |
|---|---|---|---|
| ①-a | `apps/web/src/app/dashboard/quotes/page.tsx:178` `deriveRailState` | `rc >= 2 ? compare_review_required : compare_not_ready` · `compare_not_ready ∈ BLOCKED_STATES`(:923) | 「차단 · 유효 견적 수 부족」 · poReady 「불가 · 선택안 없음」 |
| ①-b | `apps/web/src/app/quotes/[id]/page.tsx:707` `canConvert` | `respondedCount >= 1 && status ∉ {CANCELLED, COMPLETED}` | 「구매 전환: 가능」 |
| ①-c | `apps/web/src/lib/quote-case-contract.ts:116` `deriveUiState` | ①-a 복사본 | (렌더 도달 0 · 프로덕션 importer 0 · 테스트가 파일 문자열만 읽음) |

부수 사용처(같은 카운트로 단계를 따로 파생): dashboard `:154` OP_STATUS · `:171` · `:406` readinessStage · `:636` 카드 회신 표기.

### 축 ② 회신 수 카운트 2벌

| # | 위치 | 세는 것 |
|---|---|---|
| ②-a | 대시보드 · `apps/web/src/app/api/quotes/route.ts:631` `projectTokenReplies` → `responses[]` | `QuoteResponse`(공급사 대시보드 포털 회신) + `QuoteVendorRequest` 중 **responseItems 가 있는 것**(토큰 폼 회신 투영 · vendorName 으로 중복 제거) |
| ②-b | 상세 · `apps/web/src/app/quotes/[id]/page.tsx:325` `respondedVendors` | `QuoteVendorRequest.status === "RESPONDED"` |

회신을 쓰는 경로 3개(Phase 0 실측):

| 쓰기 경로 | 남는 행 | ②-a 가 셈 | ②-b 가 셈 |
|---|---|---|---|
| 공급사 포털 `/api/vendor/quotes/[quoteId]/response` → `createQuoteResponse` | `QuoteResponse` | ✅ | ❌ (vendorRequest 없음) |
| 토큰 폼 `/api/vendor-requests/[token]/response` | vendorRequest RESPONDED + responseItems | ✅ | ✅ |
| 요청자 수동 입력 `/api/quotes/[id]/vendor-replies` | vendorRequest RESPONDED (+items) | items 있으면 ✅ | ✅ |

→ 포털 회신 1건이면 대시보드 1건 · 상세 0건. 상세의 구매 전환은 `vendorRequestId` 를 요구하므로(`:336`) 포털 회신은 **발주로 이어질 경로가 없다**.

---

## 0. Truth Reconciliation

**Latest Truth Source:** 2026-09-13 릴레이 시뮬레이션(검색→요청→발송→토큰 회신 ₩70,000 → 대시보드 「차단」 vs 상세 「가능」) + 코드 실측(위 표) + prod 실측(Phase 0).

**Secondary References:** `quote-followup-send-wiring-363.test.ts`(compare_not_ready → followup_send 핀) · §11.226 v2 brief 표 · `lib/operations/state-machine.ts`(전이 규칙).

**Conflicts Found:**
1. 비교 문턱(2건)이 발주 가능 판정에 쓰였다 · 「비교 불가」 를 「차단」 으로 표기.
2. 카운트 출처 2벌(위 축 ②).
3. 서버 전이 규칙은 회신 수 조건이 없다(`SENT → COMPLETED` 허용) · 게이트는 화면뿐.

**Chosen Source of Truth:** 릴레이 판정(2026-09-14) · **비교(≥2)와 발주(≥1)는 다른 축**. 필수 센티널 문자열 「회신 1건 → 발주 가능 · 비교 불가」.

## 1. Priority Fit
- [x] P1 immediate · 핵심 동작(구매)이 단일 공급사 품목 고객에게서 끊긴다. 로그인 벽(퍼널 누수)보다 먼저(릴레이 판정).

## 2. Work Type
- [x] Bugfix · [x] Workflow / Ontology Wiring · [x] Web

## 3. Overview

**Success Criteria:**
- [ ] 회신 1건 견적에서 대시보드 브리핑과 상세가 **둘 다 「발주 가능 · 비교 불가」**
- [ ] 회신 수는 한 함수가 센다 · 판정도 한 함수가 한다 · 복사본 0(전역 센티널)
- [ ] `compare_not_ready ∉ BLOCKED_STATES`
- [ ] 상세 received 탭에서 수신 회신이 입력 폼보다 먼저 보이고 폼은 「새 회신 직접 입력」 계열 라벨

**Out of Scope (⚠️ 구현하지 말 것):**
- 서버 전이 규칙에 회신 수 조건 추가(별건 검토)
- 비교 문턱 2건 자체 변경
- 포털 회신(QuoteResponse)을 발주 경로로 잇기(카운트 표기는 통일하되 전환 경로 신설은 별건 · 아래 Notes)
- 로그인 벽 hero 문구(별건 · 호영님 문구 확정 대기)

**User-Facing Outcome:** 단일 견적 고객이 대시보드 첫 화면에서 「발주 가능」 을 본다.

## 4. Product Constraints
- Must Preserve: 대시보드 rail/브리핑 구조 · 상세 same-canvas · request_send 발송 단일점(363 잠금)
- Must Not Introduce: 새 페이지 · 죽은 버튼 · 화면별 개별 계산
- **Canonical Truth Boundary:**
  - Source of Truth: `Quote.status` · `QuoteVendorRequest(status, responseItems)` · `QuoteResponse`
  - Derived Projection: `resolveQuoteReadiness()` 결과(`respondedCount` · `compare` · `po` · `uiState`) · 저장 0
- UI Surface: Existing route section(대시보드 rail · 상세 KPI 스트립·received 탭)

## 5. Architecture

| Decision | Rationale | Trade-offs |
|---|---|---|
| 순수 함수 `lib/quotes/readiness.ts` · 입력은 **정규화된 회신 목록** | 클라이언트 두 화면·테스트가 같은 함수를 import · DB 없음 | 호출부가 입력 모양을 맞춰야 한다 |
| 카운트는 "회신한 공급사 수"(vendorRequest RESPONDED ∪ QuoteResponse, 공급사 기준 중복 제거) | 쓰기 경로 3개를 모두 센다 | 포털 회신은 세지만 발주 전환 대상은 vendorRequest 만(po 판정에 `convertibleCount` 분리) |
| `quote-case-contract.ts` 의 `deriveUiState` 는 새 함수로 **위임**(삭제 대신) | 테스트가 이 파일의 union 정의를 핀하고 있음 · 삭제는 `git rm` 아님이지만 도달성 0 이라 위임이 최소 diff | 파일 하나가 남는다 |

## 6. Test Strategy
- 단위: `resolveQuoteReadiness` 행렬(0/1/2건 × SENT/RESPONDED/COMPLETED/CANCELLED × 포털/토큰/수동)
- 센티널: 필수 문자열 핀 · 복사본 0(전역 `>= 2 ? "compare_review_required"` 류 · `respondedCount >= 1 &&` 인라인 판정) · `BLOCKED_STATES` 에 compare_not_ready 부재 · 두 화면이 함수 import
- 주입 프로브: 각 단언 적용 확인 → RED → 바이트 복원
- 스모크: prod 테스트 견적(Phase 4)

## 7. Implementation Phases

### Phase 0: Context & Truth Lock
- Status: [x] Complete (2026-09-14)
- [x] 판정 3벌·카운트 2벌·쓰기 경로 3개 특정(위 표)
- [x] prod 실측(`xhidynwpkqeaojuudhsw` · 읽기 전용 · 2026-09-14T00:15Z · 로컬 operator-shell): Quote 8 · QuoteResponse **0** · vendorRequest 5(SENT 3 · RESPONDED 1 · EXPIRED 1) · **두 출처 값이 다른 견적 0건** → 축 ②는 오늘 데이터로는 잠복(포털 회신 0)
- [x] 서버 전이 규칙에 회신 조건 없음 확인
- [x] §sentinel-inversion: `quote-followup-send-wiring-363.test.ts` · 명제 "compare_not_ready 의 다음 조치 = 추가 회신 확보(발송 단일점)" 는 비교 축에서 여전히 참 → **무변경 GREEN**(actionKey followup_send 유지) · `inbound-rfq-autocapture-p3:64` 「벤더 견적 입력」 → 「새 회신 직접 입력」 승계(명제: 수동 입력 폼 보존)

**✋ Quality Gate:** 모순 0 · 우선순위 기록 · **Rollback:** 계획만

### Phase 1: Contract & Failing Tests
- Status: [x] Complete (2026-09-14)
- [x] 🔴 `__tests__/quotes/quote-readiness-single-source.test.ts` · 필수 핀 「회신 1건 → 발주 가능 · 비교 불가」 · 행렬 · 복사본 0 · BLOCKED_STATES
- [x] 🔴 RED 확인(`Failed to resolve import "@/lib/quotes/readiness"`) · 363 핀 판정 기록
- [x] RED 는 로컬에서 확인만 한다 · RED 테스트를 단독 커밋하지 않는다(원장 증가 = exit 1) · Phase 2 와 한 커밋

**✋ Quality Gate:** RED 가 실제 · 기존 GREEN 불변 · tsc 불변 · **Rollback:** 테스트 파일 revert

### Phase 2: Core Logic
- Status: [x] Complete (2026-09-14)
- [x] 🟢 `resolveQuoteReadiness({ status, vendorRequests, portalResponses })` → `{ respondedCount, convertibleCount, compare: {ready, label}, po: {ready, label}, uiState }`
- [x] 🔵 `deriveUiState`(contract) 위임 · 문턱 상수 `COMPARE_MIN_RESPONSES = 2` · `PO_MIN_RESPONSES = 1` 한 곳
- [x] 단위 GREEN · 주입 프로브 · `BLOCKING_UI_STATES` 도 이 모듈로(tsc TS2367 이 무효 비교를 잡음)

**✋ Quality Gate:** 단위 GREEN · 전역 복사본 0 · **Rollback:** 함수 파일 revert

### Phase 3: UI Wiring
- Status: [x] Complete (2026-09-14)
- [x] 대시보드 `deriveRailState`·`:154/:171/:406/:636` 카운트 → 함수 사용 · `BLOCKED_STATES` 에서 compare_not_ready 제외 · compare_not_ready 브리핑 문구: 비교 「불가 · 회신 1건」 · 발주 「가능 · 단일 견적」 · blocker 「차단 없음(비교만 불가)」 계열
- [x] 상세 `canConvert` → 함수 `po.ready` · KPI 「구매 전환」 라벨 동일 출처
- [x] 상세 received 탭: 수신 회신 섹션을 입력 폼 **위로** · 폼 제목 「새 회신 직접 입력」 · 기본값 「대기」 는 폼 안 설명으로만
- [x] 문구는 em dash 금지(·) · 기존 핀 옛 값 sweep

**✋ Quality Gate:** 두 화면 같은 판정 · 죽은 버튼 0 · vitest 전량 신규 RED 0 · tsc 불변 · build · **Rollback:** 화면 연결 커밋만 revert(함수·테스트 유지)

### Phase 3b: 대시보드 목록 행 badge·CTA 통일 (2026-09-14 · 릴레이 Phase 4 측정으로 추가)
- Status: [x] Complete (2026-09-14)
- [x] 측정: 목록 행은 `signals.badge`(:3375)·`shortenActionLabel(ctaLabel)`(:3487) 을 그린다 · 3a 는 `status` 만 바꿔 행은 「단일 회신 / 추가 회신」(더 받아라), 상세는 「구매 진행 처리」(발주해라) → **미배선**
- [x] compare_not_ready badge 「발주 가능 · 비교 불가」 · 주 동작 `PO_DETAIL_CTA`「구매 진행」 → `/quotes/[id]` (행 CTA · 레일 CTA 2곳) · 전환할 회신이 없으면 badge·CTA 도 판정 결과로(추가 회신)
- [x] 3a 전역 센티널이 놓친 복사본 2곳 이관: 비교 패널 `sqResponseCount`(:3882/:4142) · 작업창 라벨·추가발송 경로(:4697/:4710) · 전역 검사를 **형태**(responses.length·*ResponseCount 직접 문턱 비교)로 확장 + 자기 한계 명시
- [x] §sentinel-inversion: `quote-followup-send-wiring-363` 2단언이 복사 형태(`responses?.length … < 2` · `>= 2 ? "선택안 확정"`)를 핀 → 판정 함수 형태로 승계
- [x] ⚠️ `quote-centerworkwindow-demote-363b.test.ts` 는 **타 세션 미커밋(untracked) 파일** · 같은 복사 형태를 :45 에서 핀 → 이 파일은 수정하지 않았다(소유권) · 해당 단언 1건 RED 전환 · 같은 파일 「선택안 확정 삼항 제거」 단언 GREEN 전환 · 소유 세션 처방: :45 를 `quoteReadiness\(selectedQuote\)\.respondedCount < COMPARE_MIN_RESPONSES` 로
- [x] 프로브 8/8 RED · 게이트 신규 RED 파일 0 · 실패 175 = 원장 · tsc 25 불변

### Phase 4: Rollout / Smoke
- Status: [~] 1차 합격(차단 해소 · 릴레이 prod 2026-09-14 · seed RFQ-2609-7895) · 3b 배포 후 대시보드 행 재확인
- [ ] push → deployedCommit 두 번 측정
- [ ] prod 테스트 견적 1건(승인 2026-09-14) · 🛑 **수신 주소는 호영님 본인 메일만** (`sender.ts:66` 은 `vendor-pilot-` 만 차단 · 그 외 실제 발송)
- [ ] 토큰 회신 1건 → **성공 신호: 대시보드 브리핑·상세 둘 다 「발주 가능 · 비교 불가」**
- [ ] 테스트 견적 정리(dry-run → 승인 → 삭제 · 로그 보존) · 발주 생성은 하지 않는다

**✋ Quality Gate:** 성공 신호의 존재로 판정 · **Rollback:** revert push

## 9. Risk Assessment

| Risk | P | I | Mitigation |
|---|---|---|---|
| 카운트 통합으로 기존 견적 표기 변화 | Low | Med | Phase 0: 오늘 prod 두 출처 차이 0건 |
| 대시보드 page.tsx(4천+ 줄) 병렬 세션 겹침 | Med | Med | 커밋 전 `git diff` 겹침 확인 · 경로 지정 stash 금지 |
| 363 핀과 충돌 | Med | Low | 명제 승계(비교 축 유지) |
| 포털 회신이 「발주 가능」 으로 보이는데 전환 경로 없음 | Low(prod 0) | Med | po 판정은 `convertibleCount`(vendorRequest) 기준 · 포털은 respondedCount 에만 |

## 10. Rollback Strategy
- Phase 1: 테스트 revert · Phase 2: 함수 revert · Phase 3: 화면 연결만 revert · Phase 4: revert push(데이터 변경 0 · 테스트 견적은 별도 삭제)

## 11. Progress Tracking
- Overall: 80% · Current: Phase 4 · Blocker: 없음
- [x] Phase 0 · [x] Phase 1 · [x] Phase 2 · [x] Phase 3 · [ ] Phase 4

## 12. Notes & Learnings
- [2026-09-14] 릴레이 지시: 두 축을 분리해 적을 것 · 하나만 고치면 재발.
- [2026-09-14] 포털 회신(`QuoteResponse`)은 prod 0건 · 발주 전환 경로가 vendorRequest 전제라 포털 회신은 발주로 못 간다 → 별건 후보(§quote-portal-reply-convert).
- [2026-09-14] 서버 전이 규칙에 회신 수 조건 없음 → 별건 후보.
- [2026-09-14] Phase 3 에서 계획표 밖 복사본 3개가 더 나왔다 · 대시보드 compare_review 작업창 `validQuotes < 2`·`>= 2`·안내문 삼항(:4729·:4769) · AI 비교 대상 `>= 2`(:1928 · 가격 회신 있는 공급사 수라 문턱 상수만 공유). 전역 센티널이 :4769 를 잡았다 → **판정 3벌이 아니라 최소 6곳**이었다.
- [2026-09-14] Edit 도구가 `quote-case-contract.ts` 워킹카피를 CRLF(222 CR)로 썼다 · 인덱스는 LF · 프로브 앵커 불일치로 드러남 → LF 복원. 쓰기 후 CR 바이트 계수 필수(CLAUDE.md 개행 조항).
- [2026-09-14] 프로브 P9(`vr:` 투영 중복 제거 삭제)가 처음 GREEN · 이름 중복 제거가 대신 걸러 준 대체 매칭(4원칙 ④) → 이름 없는 경우를 테스트에 추가해 RED 확보. 최종 10/10 RED.
- [2026-09-14] 게이트(로컬 operator-shell): vitest 전량 1307 파일 · 신규 RED 0(파일·assertion 단위) · 실패 175 = 원장 · tsc 25 불변.
