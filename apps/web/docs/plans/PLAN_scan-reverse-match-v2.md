# Implementation Plan: 스캔 역매칭 v2 (양방향·정규화·토큰가드·신뢰도 전파)

- **Status:** ⏳ Pending
- **Started:** 2026-06-30
- **Last Updated:** 2026-06-30

**CRITICAL INSTRUCTIONS**: phase 완료 후 ① 체크박스 ② quality gate ③ 전 항목 통과 ④ Last Updated ⑤ Notes ⑥ 다음 phase.
⛔ gate 실패·source 충돌·dead button/no-op/fake success 진행 금지.

---

## 0. Truth Reconciliation
- **Latest Truth:** §scan-secondary-match(완료, e9d07b53)의 fuzzy는 `matchProduct` 재사용 — 한계 3:
  ① confidence가 **result-level 단일값(0.4/0.6)**, per-candidate 아님 ② scan-label가 `fuzzy.confidence` **버림**(미전파) ③ `findMany take 5` **orderBy 없음**(관련도순 X). 게다가 `name contains` **단방향**(기존⊇스캔)이라 OCR 표기≠등록 표기 시 후보 0.
- **Conflicts:** 없음. 본 작업은 §scan-secondary-match의 fuzzy 경로를 **신규 `rankReverseCandidates`로 교체**(matchProduct는 무변경 — §11.309b 유닛 보존).
- **Chosen Source of Truth:** `db.product`=canonical. 후보=suggestion(자동확정 X).
- **Priority Fit:** Post-release(호영님 directed — §scan-secondary-match의 핵심 결함 보정). P1 blocker 아님.

## 1. Work Type
- [x] Feature(매칭 알고리즘) + Workflow wiring

## 2. Overview
**Description:** catalogNo 미매칭 시 name/brand로 기존 품목 후보를 **양방향 정규화 contains + 토큰(≥2 가드)** 으로 점수화,
**per-candidate 신뢰도 전파 + 신뢰도순 정렬 + cap 3** 로 리뷰 카드에 승인형 노출. 사용자 선택 → 폼 채움 → 기존 find-or-create 연결.

**Success Criteria:**
- [ ] 양방향: `기존.name ⊇ 스캔.name` **및** `스캔.name ⊇ 기존.name` 모두 후보(약어 등록·부분 인식 구제).
- [ ] 정규화: 대소문자·공백·하이픈/언더스코어/슬래시 차이 흡수.
- [ ] 토큰 가드: 단일 토큰 매칭 금지(≥2 공유 필수). brand는 **보조 신호만**(단독 매칭 금지).
- [ ] per-candidate 신뢰도(0..1) + 등급(높음/보통/낮음) 전파 → 후보 행에 배지 노출 + 신뢰도순 정렬 + cap 3.
- [ ] 자동확정 0(matchedProduct 무세팅), 승인형·"확인 필요"·canonical 무접촉 유지.
- [ ] catalogNo insensitive 매칭 회귀 0.

**Out of Scope (⚠️ 금지):**
- [ ] fuzzy 자동확정 / matchedProduct 세팅
- [ ] 단일 토큰 매칭, brand 단독 매칭 키
- [ ] `matchProduct`(§11.309b) 기존 계약 변경
- [ ] **약어↔풀네임 비-부분문자열 매칭**(예 "BCP"↔"Bromocresol Purple", 공유토큰·부분문자열 0) — synonym map 필요, **본 v2 범위 밖**(별 트랙: PubChem synonym 보조). ⚠️ 이건 v2로도 안 풀림 — 정직히 명시.

**User-Facing Outcome:** OCR이 부분/변형 인식해도(부분문자열·≥2토큰 공유 범위 내) 후보가 신뢰도순으로 뜨고, 사용자가 등급 보고 거름.

## 3. Product Constraints
**Must Preserve:** same-canvas, canonical truth, §scan-manual-path calm, catalogNo insensitive 매칭, 승인형.
**Must Not Introduce:** page-per-feature, chatbot, dead button, 자동확정, preview가 truth 덮기, FP creep(토큰).
**Canonical Boundary:** SoT=db.product(무변경) / Projection=scored 후보(비영속) / Preview=후보행+[선택]=폼채움 / Persist=입고완료 find-or-create.

## 4. Architecture
| Decision | Rationale | Trade-off |
| :--- | :--- | :--- |
| 신규 `lib/inventory/reverse-match.ts`(matchProduct 무변경) | §11.309b 유닛 보존, scoring 책임 분리 | 풀 fetch 1회 |
| app-side per-candidate scoring(양방향·토큰) | Prisma `contains`는 단방향뿐 → 역방향·토큰은 앱 계산 | pool fetch 후 메모리 점수화 |
| pool: forward name + token + brand OR, take 50 | 역방향 후보까지 풀에 포함 | bounded(≤50) |
| 신뢰도 전파 + 정렬 + cap 3 | 후보 구분(호영님 #4) | 응답 필드 확장 |

**Scoring(정규화 후):**
- exact name(`===`): brandMatch 0.95 / 단독 0.85 (basis=exact, high)
- 양방향 contains(`⊇`): 0.6 + 0.15·길이비 (+0.05 brandMatch) (basis=contains, ~medium)
- 토큰 ≥2 공유: 0.45 + 0.05·공유수 (≤0.6) (+0.05 brandMatch) (basis=token, low~medium)
- 이름 신호 0(brand만) → **후보 아님**(continue)
- 등급: ≥0.8 high / ≥0.55 medium / else low. 정렬 desc, cap 3.
- 토큰화: 소문자·`[-_/]`→공백·collapse·trim → split. 길이<2·순수 숫자/퍼센트·stopword(solution/grade/ml/g 등) 제외.

**Integration:** scan-label `!matchedProduct && (productName||brand)` → `rankReverseCandidates({productName,brand},{db})` → `productCandidates[]`(confidence/level/basis) + matchType. modal: 후보 행 신뢰도 배지 + 서버 정렬·cap3 그대로 렌더.

## 5. Test Strategy
- reverse-match: 유닛(mock db.findMany) — 정규화, 양방향 contains, **2토큰 가드**(Sodium Chloride vs Sodium Phosphate=1토큰→0), **brand 단독 금지**, 정렬 desc, cap 3, per-candidate confidence/level, exact vs contains 점수 분리(BCP exact=high vs "BCP (…)"=medium).
- scan-label: sentinel — rankReverseCandidates 연동·미매칭 한정·자동확정 부재·catalogNo 보존·confidence 전파.
- UI: sentinel — 후보 행 신뢰도 배지·정렬 노출(서버), [이 품목 선택]=updateField, 신규 배너 토큰 보존.
- §scan-secondary-match.test 진화(matchProduct→rankReverseCandidates 계약 supersede).
- 실행 권위: operator-shell.

## 6. Phases

### Phase 0: Truth & Contract Lock
- Status: [ ] Pending
**RED:** §scan-secondary-match 한계 3 + 단방향 확인(완료분). scoring 계약·정규화·가드·등급 임계 확정.
**GREEN:** 통합점(scan-label 교체점) + canonical 무접촉. **Gate:** 충돌 0. **Rollback:** planning-only.

### Phase 1: Failing Tests
- Status: [ ] Pending
**RED:** reverse-match 유닛 RED(정규화·양방향·2토큰가드·brand단독금지·정렬·cap·confidence) + sentinel RED(route/UI).
**GREEN:** 타입·빈 스캐폴딩. **Gate:** RED 실재, 기존 GREEN 유지. **Rollback:** test revert.

### Phase 2: Core lib (reverse-match.ts)
- Status: [ ] Pending
**RED:** 유닛(mock db). **GREEN:** 정규화 + **양방향 contains 먼저** + 토큰 ≥2 가드 + brand 보조 + per-candidate score + 정렬 + cap 3.
**REFACTOR:** DRY, pool bound. **Gate:** 유닛 GREEN, FP 가드 검증, overfetch 0(take 50). **Rollback:** lib 제거.

### Phase 3: Route + UI Wiring
- Status: [ ] Pending
**RED:** sentinel. **GREEN:** scan-label `matchProduct`→`rankReverseCandidates`(confidence 전파) + modal 후보 행 신뢰도 배지(§11.302 톤: high emerald/medium yellow/low slate) + 정렬·cap3.
**REFACTOR:** same-canvas, PubChem 행과 톤 분리. **Gate:** dead button 0, 자동확정 0, catalog 회귀 0. **Rollback:** wiring revert(scan-secondary-match로 복귀).

### Phase 4: Smoke / Rollback
- Status: [ ] Pending
**RED:** 실패모드(FP·후보0) + smoke. **GREEN:** 라이브 — ① "BCP" 라벨 → 후보 신뢰도순(exact BCP=높음, "BCP(1-Bromo…)"=보통), ② 부분 인식 라벨 → 양방향 후보, ③ Sodium 계열 1토큰 → 미매칭(FP 0), ④ "Bromocresol Purple" 라벨 → **여전히 후보 0**(약어 한계, calm 정상 — 과대주장 금지 검증).
**Gate:** FP 0, 후보없음 calm, rollback 문서화. **Rollback:** scan-label/UI를 §scan-secondary-match로 revert.

## 7. Risk
| Risk | P | I | Mitigation |
| :--- | :--- | :--- | :--- |
| 토큰 FP creep | Med | High | ≥2 토큰 가드, brand 보조-only, 승인형, 신뢰도 노출(사용자 거름) |
| pool overfetch | Low | Med | take 50 bound, token slice 6 |
| matchProduct 계약 깨짐 | Low | Med | 신규 파일 분리(matchProduct 무변경) |
| 약어↔풀네임 미해결 과대주장 | Med | Med | Out-of-scope 명시, smoke ④로 한계 검증 |
| 실DB 타입 캐스팅 | Low | Low | `db as unknown as ReverseMatcherDb` |

## 8. Rollback
- P1 test revert / P2 lib 제거 / P3 wiring을 §scan-secondary-match로 복귀 / P4 동일. env/flag 불필요.

## 9. Progress
- Overall: 0% / Phase 0 / blocker 없음 / Next: Phase 1.

**Checklist:** [ ] P0 [ ] P1 [ ] P2 [ ] P3 [ ] P4

## 10. Notes
- [2026-06-30] §scan-secondary-match 한계(단방향·result-level score·미정렬)를 v2가 보정. 단 약어↔풀네임(비-부분문자열·공유토큰0)은 synonym map 필요 → v2 범위 밖, 별 트랙(PubChem synonym 보조 검토).
