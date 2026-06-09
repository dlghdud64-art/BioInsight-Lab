# Implementation Plan: 라벨 저신뢰 처리 일원화 (저신뢰 commit 게이트)

- **Status:** ✅ Complete (코드 — 클로드코드 vitest/tsc PASS + push 대기)
- **Started:** 2026-06-08
- **Last Updated:** 2026-06-08 (Phase 4 완료)
- **Estimated Completion:** TBD

**CRITICAL INSTRUCTIONS** (각 phase 완료 후):
1. ✅ 체크박스 갱신
2. 🧪 quality gate 검증 명령 실행 (sandbox 실행 불가 항목은 "실행 불가" 표기, 클로드코드 실행)
3. ⚠️ quality gate 전 항목 PASS 확인
4. 📅 Last Updated 갱신
5. 📝 Notes 기록
6. ➡️ 그 뒤에만 다음 phase

⛔ quality gate 실패 / source-of-truth 충돌 미해소 / dead button·no-op·fake success 도입 시 진행 금지.

---

## 0. Truth Reconciliation

**Latest Truth Source (코드 실측 2026-06-08):**
- `apps/web/src/components/inventory/SmartReceivingScannerModal.tsx` L339-341 — §11.375/378 입고 게이트 = **저신뢰(`confidence==='low'`) + 미보정(`!productNameDirty`) → 제출(commit) 차단**. 폼 필드는 채워짐. 제품명 수동수정 시 해제. = **이미 save-차단(ⓑ) 형태**, fill-차단/blank 아님.
- `apps/mobile/app/scan.tsx` — 동일 §11.378 게이트 + Lot/EXP 출처추적(`lotScanFilled/expiryScanFilled/lotDirty/expiryDirty` §11.340) + **GS1 datamatrix auto-fill(L239-255, 결정적 디코드 → verified 성격)** 이미 landed(ac20dbd8).
- `apps/web/src/lib/ocr/label-parser.ts` — `LabelParseResult`에 `quantity` 존재, `storageCondition`은 입고 폼(L372)에 존재. `confidence`=matchedFields(≥4 high / ≥2 medium / else low).
- `apps/web/src/components/inventory/LabelScannerModal.tsx` — 라벨 검색측 모달(별도 게이트).
- 공통 confidence lib: `apps/web/src/lib/ocr/capture-quality.ts` + `apps/mobile/lib/ocr/capture-quality.ts`(`mapOcrConfidence`).

**Secondary References:**
- `HANDOFF_sourcing-scan-product-2026-06-08.md` §1-0 (지시 출처)
- 호영님 lock(2026-06-08): ⓑ + commit 게이트 5규칙
- 기존 가드: `ocr-confidence-gate-378(.native).test.ts`, `smart-receiving-ocr-gate-375.test.ts`, `ocr-quality-alignment-gate-375.test.ts`, `gs1-receive-wiring.test.ts`, `label-lock-380.test.ts`

**Conflicts Found:**
- 핸드오프 §1-0 "blank→초안+경고 vs §11.380-p1 차단 = 정반대" → **코드 실측상 현 게이트는 이미 채움+save차단+보정해제(ⓑ)**. "공란"은 blank-규칙이 아니라 추출 실패(저신뢰 시 null 필드). 충돌은 일부 오판.
- 핸드오프 §1-0 "스키마 갭(규격/용량/보관온도 누락)" → `quantity`·`storageCondition` 이미 존재. 부분 supersede.

**Chosen Source of Truth:** 코드 실측 우선. 핸드오프 §1-0 메모(미진전 가정)는 supersede.

**Environment Reality Check:**
- [ ] repo: `C:\Users\young\ai-biocompare`, web=`apps/web` / mobile=`apps/mobile`
- [ ] runnable: web vitest = sandbox rollup-native 불일치로 **실행 불가**(정규식 직접검증 잠정, 클로드코드 실행 필수). 모바일 RN 동일.
- [ ] execution blocker: sandbox 커밋·push 금지(클로드코드 전용)

---

## 1. Priority Fit

- [x] **P1 immediate (P0 — 호영님 지정)**
- [ ] Release blocker
- [ ] Post-release
- [ ] P2 / Deferred

**Why:** 라벨 추출은 입고·검색·BOM이 얹히는 substrate. #2(§1-3 AI 게이트)가 이 게이트 패턴을 재사용 → 같은 원칙 두 번 발명 방지. 정책 이미 lock, datamatrix 재고등록 landed = 가장 ready·contained. 호영님 실제 pain("라벨 공란") 해소.

---

## 2. Work Type

- [x] Bugfix (게이트 정합) + Design Consistency (3 surface 통합)
- [x] Workflow / Ontology Wiring (저신뢰 commit 게이트)
- [x] Mobile + Web (공통 엔진)

---

## 3. Overview

**Feature Description:** 라벨 OCR 저신뢰 처리를 3 surface(웹 입고 모달·웹 라벨검색 모달·모바일 scan)에서 단일 commit 게이트 원칙으로 통합한다. 저신뢰 필드도 초안으로 채우되 "확인 필요" 표시 + 검수 전 저장 비활성. critical 필드(Lot·유효기간)는 신뢰도 무관 명시 확인 후에만 commit. datamatrix 디코드 값은 verified로 게이트 우회.

**Success Criteria:**
- [ ] 저신뢰 OCR도 필드 공란 대신 초안 채움 + "확인 필요" 마크 (blank 금지)
- [ ] Lot·유효기간은 신뢰도/제품명 보정과 무관하게 **명시 확인 전 commit 불가**
- [ ] datamatrix 디코드 Lot·EXP는 verified → 저신뢰 게이트에서 제외(자동 통과)
- [ ] 3 surface가 공통 helper 1개 사용(중복 로직 제거)
- [ ] 기존 §11.375/378/380 동작 회귀 0(또는 의도적 supersede 명시)

**Out of Scope (⚠️ 구현 금지):**
- [ ] **웹 모달 datamatrix 디코드(rule 3 웹 parity)** — 기본 defer(웹은 파일업로드라 디코드 라이브러리 추가=별 트랙). P3 옵션 표기만, 호영님 확정 시 포함.
- [ ] §1-3 AI 단계게이트 구현 (#2 트랙 — 원칙만 공유)
- [ ] 외부 카탈로그 연동(§catalog A), BOM 추출 고도화
- [ ] Gemini 프롬프트 few-shot 대규모 재작성(별도, 본 게이트와 독립)

**User-Facing Outcome:** 시약 라벨 스캔 시 추출 실패해도 빈 폼이 아니라 "확인 필요" 초안이 뜨고, Lot·유효기간을 사용자가 확인해야 입고/등록이 완료된다. datamatrix 있는 라벨은 Lot·EXP가 자동 확정되어 마찰 없음.

---

## 4. Product Constraints

**Must Preserve:**
- [ ] workbench / queue / rail / dock
- [ ] same-canvas (모달 내 처리, 새 페이지 금지)
- [ ] canonical truth (재고 = 입고 commit 후 확정, 미검수 초안이 truth로 들지 않음)
- [ ] invalidation discipline

**Must Not Introduce:**
- [ ] page-per-feature
- [ ] chatbot/assistant 재해석
- [ ] dead button / no-op / **placeholder success(저신뢰 자동수용=fake success)**
- [ ] preview가 actual truth 덮기(미검수 초안 commit)

**Canonical Truth Boundary:**
- Source of Truth: 입고 commit된 InventoryItem(Lot·EXP·수량 확정값)
- Derived Projection: OCR `LabelParseResult`(초안, 미확정)
- Snapshot / Preview: 스캔 폼 state(검수 전 = preview, truth 아님)
- Persistence Path: SmartReceiving API commit / mobile 입고 mutation

**UI Surface Plan:**
- [x] Existing modal(SmartReceivingScannerModal / LabelScannerModal) inline
- [x] Mobile scan.tsx 기존 폼 inline
- [ ] New page (금지)

---

## 5. Architecture & Dependencies

| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 공통 `evaluateLabelCommitGate()` helper 추출 | 3 surface 로직 중복 제거, 원칙 단일화 | web/mobile 코드공유 불가(별 패키지) → 로직 mirror 2벌 |
| Lot/EXP를 critical-field 별도 게이트로 승격 | rule 2(신뢰도 무관 확인). 재고 오염 핵심 필드 | 입고 마찰 ↑ → datamatrix verified로 완화 |
| datamatrix=verified 상태 플래그 | rule 3, 결정적 인코딩 신뢰 | 웹 parity는 defer(모바일만 즉시) |
| 저신뢰 필드 채움+마크(blank 금지) | rule 1, 추출 실패해도 검수 기반 제공 | "확인 필요" UI 추가 |

**Dependencies:**
- Required Before: 없음(정책 lock 완료)
- External Packages: 없음(웹 datamatrix defer 시). P3 옵션 시 zxing류 — defer.
- Touched: SmartReceivingScannerModal, LabelScannerModal, mobile scan.tsx, lib/ocr(web)+lib/scan(mobile) helper, label-parser(필요 시 마크 필드)

**Integration Points:**
- web: `api/inventory/smart-receiving/route.ts`(commit), 모달 form state
- mobile: 입고 mutation, scan.tsx form state + lotScanFilled/dirty
- 공통: confidence(`capture-quality`), gs1-parser(verified)

---

## 6. Global Test Strategy

- 게이트 로직 = unit(helper) 필수
- 모달 wiring = sentinel(readFileSync+regex, CLAUDE.md 패턴) + 가능 시 통합
- critical-flow(저신뢰 차단/해제, datamatrix 우회) = smoke path 문서화
- **회귀 0 describe 필수** — 기존 §11.375/378/380 보존 항목 명시 매칭, 의도적 supersede는 별도 표기
- 실행: web vitest sandbox **실행 불가**(정규식 잠정) → 클로드코드 실제 실행 PASS 확정. 모바일 동일.

---

## 7. Implementation Phases

### Phase 0: Context & Truth Lock
- Status: [x] Complete
- **🔴 RED:** 3 surface 게이트 + confidence lib + gs1 verified 인벤토리, 기존 가드 매핑(378/375/380)
- **🟢 GREEN:** Chosen Source(코드 실측) 확정, runnable 명령/실행불가 표기
- **🔵 REFACTOR:** 핸드오프 §1-0 stale 가정 제거(이미 본 문서 §0)
- **✋ Quality Gate:** 충돌 미해소 0, 우선순위 기록 완료
- **Rollback:** planning-only

### Phase 1: Contract & Failing Tests
- Status: [x] Complete — `lib/ocr/label-commit-gate.ts`(스캐폴드, 항상 통과) + `__tests__/regression/label-commit-gate.test.ts`(RED). alias `@`→src 확인. sandbox vitest 실행 불가(클로드코드 GREEN 확정 대기).
- **🔴 RED:** 통합 게이트 계약 failing 테스트 — (a) 저신뢰→채움+"확인 필요"(blank 금지), (b) Lot·EXP 미확인 시 commit 불가(신뢰도 무관), (c) datamatrix-verified Lot·EXP는 게이트 skip. helper unit 실패 먼저
- **🟢 GREEN:** `evaluateLabelCommitGate()` 시그니처 스캐폴딩(빈 구현)
- **🔵 REFACTOR:** 네이밍/타입 정리
- **✋ Quality Gate:** failing real, 기존 테스트 PASS, lint/typecheck 표기
- **Rollback:** 계약/테스트 스캐폴딩 revert

### Phase 2: Core Logic
- Status: [x] Complete — web `evaluateLabelCommitGate` 규칙 구현(rule 1~3) + mobile mirror(`apps/mobile/lib/scan/label-commit-gate.ts`) + drift 가드. 9 케이스 + drift 2 논리 PASS(클로드코드 GREEN 확정 대기).
- **🔴 RED:** helper unit(저신뢰/critical confirm/datamatrix verified 조합 매트릭스)
- **🟢 GREEN:** `evaluateLabelCommitGate({confidence, criticalConfirmed:{lot,expiry}, verifiedFields})` → `{canCommit, blockers[], fieldMarks}` 최소 구현. web `lib/ocr` + mobile `lib/scan` mirror
- **🔵 REFACTOR:** DRY, 추측 코드 제거
- **✋ Quality Gate:** helper 테스트 PASS, truth-boundary 위반 0, overfetch/N+1 0
- **Rollback:** helper 모듈 삭제(surface 미적용 상태라 안전)

### Phase 3: API / Route / UI Wiring
- Status: [ ] In Progress — **SmartReceiving(1/3)·LabelScanner(2/3) 완료.**
  - SmartReceiving: helper + lotConfirmed/expiryConfirmed(터치=확인, reset) + handleSubmit Lot/EXP 게이트(additive) + disabled criticalUnconfirmed + "확인 필요" 마크 + 배너. §11.375 lock 보존.
  - LabelScanner: 기존 `lotDirty/expiryDirty`를 criticalConfirmed로 재사용 + handleDirectReceive(commit) 게이트 — **'입고 폼에 적용'(handoff)은 제외**(받는 폼이 게이트) + disabled criticalUnconfirmed + 마크 + 배너. §11.378 lock 전부 보존(onClick·disabled 토큰·배너 무변경, grep 확인).
  - sentinel `label-commit-gate-wiring.test.ts`(SmartReceiving + LabelScanner 블록).
  - **mobile scan.tsx(3/3) 완료**: `lotVerified/expiryVerified` 신규 state — gs1 분기=verified(rule 3), OCR-fill·수기수정=verified false. confirmLabelReceive(commit) 게이트 + receiveBlocked에 criticalUnconfirmed + 마크 + 배너. §11.378-native lock(receiveBlocked·disabled·useCodeScanner·label-review) 전부 보존(Grep 확인). datamatrix Lot/EXP는 verified로 마찰 흡수(rule 3 실증).
  - sentinel 3 surface(Smart/Label/scan) 전부 커버.

### Phase 3 — 완료
- Status: [x] Complete (3 surface wiring + sentinel)
- **🔴 RED:** surface별 sentinel(helper 사용 + "확인 필요" 마크 + Lot/EXP 확인 전 저장 비활성)
- **🟢 GREEN:** SmartReceivingScannerModal·LabelScannerModal·scan.tsx에 helper 적용. 저신뢰 필드 "확인 필요" 마크 표면화. Lot/EXP 확인 토글 전 저장 disabled. datamatrix verified면 해당 필드 마크 면제(모바일)
- **🔵 REFACTOR:** same-canvas 유지, 중복 게이트 코드 제거
- **✋ Quality Gate:** dead button/no-op/front-only success 0, loading/error/empty/disabled 상태 존재, 기존 378/375/380 회귀 0(또는 supersede 명시)
- **Rollback:** surface별 helper 호출 revert(additive)

### Phase 4: Rollout / Smoke / Rollback
- Status: [x] Complete (smoke path·실패모드·검증명령 문서화. 실제 vitest 실행은 클로드코드 — sandbox 실행 불가)

**Smoke Path (surface별):**
1. **SmartReceiving(웹 입고):** 저신뢰 사진 → 필드 채움 + "확인 필요" + 저장 disabled → 제품명 수정 시 저신뢰 해제 → Lot·EXP 터치 시 criticalUnconfirmed 해제 → 저장 enabled → commit. 발주매핑(selectedOrderId)은 게이트 우회(정상 입고).
2. **LabelScanner(웹):** `onDirectReceive`(입고 완료) → Lot·EXP 미확인 시 disabled + 배너 → 터치 후 enabled. `'입고 폼에 적용'`(handoff) → 게이트 없음(받는 폼 담당).
3. **mobile scan:** datamatrix 라벨 → Lot·EXP verified → 제품명만으로 진행(확인 면제, rule 3). OCR 라벨 → Lot·EXP 터치 확인 후 진행. 저신뢰 → 제품명 보정 게이트.

**Rollout 실패모드 & 완화:**
- 웹 마찰 과다(datamatrix 없음 → 모든 입고가 Lot·EXP 터치 요구): 의도된 정책(rule 2), datamatrix는 모바일이 흡수. 과하면 웹 datamatrix(P3) 승격.
- verified state 오설정(datamatrix인데 needs-confirm): gs1 분기 setVerified + OCR/수기 클리어로 가드.
- 기존 §11.375/378/378-native 회귀: 가드 보존 매칭 + 클로드코드 실제 실행.

**검증 명령 (클로드코드 — sandbox 실행 불가):**
```
cd apps/web
npx vitest run src/__tests__/regression/label-commit-gate.test.ts
npx vitest run src/__tests__/regression/label-commit-gate-wiring.test.ts
npx vitest run src/__tests__/regression/smart-receiving-ocr-gate-375.test.ts
npx vitest run src/__tests__/regression/ocr-confidence-gate-378.test.ts
npx vitest run src/__tests__/regression/ocr-confidence-gate-378-native.test.ts
npx tsc --noEmit   # 타입 정합(web)
```
모바일은 RN 빌드 환경에서 tsc 확인.

**Rollback:** surface별 helper 호출 revert(additive) → 기존 §11.378 게이트 복귀. DB 변경 0, feature flag 불필요. helper 파일 2개 삭제로 완전 원복.

---

## 8. Optional Addenda

### A. Workflow / Ontology Addendum (적용)
- **Resolver Input:** confidence + criticalConfirmed(lot/expiry) + verifiedFields(datamatrix)
- **Expected Output:** canCommit / blockers[](Lot 확인 필요·EXP 확인 필요·저신뢰 검수 필요) / fieldMarks
- **Surface Rules:** 모달·scan 폼 inline only, chatbot/AI 금지
- **Validation:** [ ] Lot 미확인 blocker / [ ] EXP 미확인 blocker / [ ] datamatrix verified 우회 / [ ] 저신뢰 "확인 필요" 마크

### D. Mobile Addendum (적용)
- **Must Include:** scan.tsx stack 컨텍스트, 카메라 권한, datamatrix 분기, safe-area, 정확한 commit wiring
- **Validation:** [ ] 저신뢰 미검수 dead-end 없음 / [ ] datamatrix 우회 동작 / [ ] Lot/EXP 확인 토글 wiring

---

## 9. Risk Assessment

| Risk | Prob | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| 기존 378/375/380 테스트가 현 게이트 동작 lock → Lot/EXP 강화가 회귀로 잡힘 | High | Med | 변경 전 해당 테스트 read, 의도적 supersede는 가드 갱신+사유 기록 |
| sandbox vitest 실행 불가 → 가드 미검증 commit 위험 | High | Med | 정규식 잠정, 클로드코드 실제 PASS 전 push 금지(호영님 규칙) |
| critical-field 확인 마찰 ↑ | Med | Med | datamatrix verified로 상용 케이스 흡수 |
| web/mobile mirror 2벌 drift | Med | Low | helper 시그니처·테스트 동일 유지, 한 PR atomic |
| canonical truth — 미검수 초안 commit | Low | High | save-차단 유지, Lot/EXP 명시확인 강제 |

---

## 10. Rollback Strategy

- Phase 1 실패: 계약/테스트 스캐폴딩 revert
- Phase 2 실패: helper 모듈 삭제(surface 미적용)
- Phase 3 실패: surface별 helper 호출 revert → 기존 §11.378 게이트 복귀
- Phase 4 실패: surface별 미적용 복귀
- **Special:** DB 변경 없음. UI disabled fallback = 기존 게이트.

---

## 11. Progress Tracking

- Overall completion: 80% (Phase 0–3 완료)
- Current phase: Phase 4 진입 대기(smoke/rollback)
- Current blocker: 없음 — 단 sandbox vitest 실행 불가, 클로드코드 전체 GREEN 확정 필수
- Next validation step: Phase 4 — surface별 smoke path 문서화 + 클로드코드 vitest 실행 + rollback 확정

**Phase Checklist:**
- [x] Phase 0 complete
- [x] Phase 1 complete
- [x] Phase 2 complete
- [x] Phase 3 complete
- [ ] Phase 4 complete

---

## 12. Notes & Learnings

**Blockers Encountered:**
- (없음)

**Implementation Notes:**
- 2026-06-08 TR 반전: 핸드오프 §1-0 "blank vs 차단 정반대 충돌"은 코드상 이미 save-차단+채움(ⓑ)으로 절반 구현. 실제 갭 = rule 2(Lot/EXP 명시확인) + rule 5(공통 helper) + rule 3(웹 datamatrix, defer) + rule 1(마크 표면화). 범위 축소.
- rule 3 웹 datamatrix parity = 기본 Out of Scope, P3 옵션. 호영님 확정 시 별 트랙.
- #2(§1-3 AI 게이트)가 본 helper 패턴 재사용 예정.

**커밋 대상 파일 (클로드코드 — sandbox 미커밋):**
- (new) `apps/web/src/lib/ocr/label-commit-gate.ts`
- (new) `apps/mobile/lib/scan/label-commit-gate.ts`
- (mod) `apps/web/src/components/inventory/SmartReceivingScannerModal.tsx`
- (mod) `apps/web/src/components/inventory/LabelScannerModal.tsx`
- (mod) `apps/mobile/app/scan.tsx`
- (new) `apps/web/src/__tests__/regression/label-commit-gate.test.ts`
- (new) `apps/web/src/__tests__/regression/label-commit-gate-wiring.test.ts`
- (doc) `docs/plans/PLAN_label-lowconfidence-gate.md`

**완료 후 권고:** #2(§1-3 AI 단계게이트, §1-2⑦ 흡수) feature-planner 트랙 — 본 helper 패턴 재사용. §11.265c lock "왜 박혔나" reconcile부터.
