# Implementation Plan: 스캔 보조 매칭 (catalogNo 미매칭 시 name+brand fuzzy 후보, 승인형)

- **Status:** ✅ Complete (Phase 0–4, 라이브 smoke GREEN)
- **Started:** 2026-06-30
- **Last Updated:** 2026-06-30
- **Estimated Completion:** 2026-06-30

**CRITICAL INSTRUCTIONS**: 각 phase 완료 후 ① 체크박스 ② quality gate 실행 ③ 전 항목 통과 ④ Last Updated ⑤ Notes ⑥ 다음 phase.
⛔ quality gate 실패·source-of-truth 충돌·dead button/no-op/fake success 진행 금지.

---

## 0. Truth Reconciliation
- **Latest Truth Source:** 코드 추적(2026-06-30) — `scan-label/route.ts`는 `catalogNo`만 `db.product.findFirst`(insensitive)로 매칭.
  `lib/inventory/product-matcher.ts`(§11.309b)에 **Tier3 fuzzy_name(name/brand substring, take 5)** 이 이미 구현·유닛테스트됨(미연동).
- **Secondary References:** PLAN_pubchem-enrich-layer(완료, substance 보강 — 별 레이어), §scan-manual-path(미매칭 calm), §scan-casnumber-500-fix.
- **Conflicts Found:** 없음. promotion-on-use(catalogNumber)는 이미 동작(`/api/inventory` isManual find-or-create가 catalogNumber로 Product create).
  본 작업은 **catalogNo OCR 실패 시** name+brand로 기존 품목을 후보 제시하는 별개 경로.
- **Chosen Source of Truth:** `db.product` = canonical. fuzzy 후보 = suggestion(자동확정 X, 사용자 선택 전 truth 무접촉).
- **Priority Fit:** Post-release(호영님 directed #1 역매칭). P1 blocker 아님(스캔 200 정상).

## 1. Priority Fit
- [x] Post-release (호영님 directed — 원형 병 catalogNo OCR 실패 대응 #1)

## 2. Work Type
- [x] Feature (scan-label 매칭 보강) + Workflow wiring (기존 matcher 연동)

## 3. Overview
**Feature Description:** scan-label가 catalogNo로 기존 Product를 못 찾을 때(원형 병 등 곡면 라벨 catalogNo OCR 실패 빈번),
`matchProduct`의 fuzzy_name tier(name+brand substring)로 **유사 기존 품목 후보**를 조회해 리뷰 카드에 **승인형**으로 노출.
사용자가 후보를 선택하면 폼(productName/brand/catalogNumber)이 채워지고, 입고 완료 시 기존 find-or-create가 그 품목에 연결(dupe 0).

**Success Criteria:**
- [x] catalogNo 미매칭 + name 존재 시, 유사 품목 후보가 리뷰 카드에 노출(확인 필요 톤). (라이브: BCP 라벨 → 후보 2건)
- [x] 후보 [이 품목 선택] → 폼 채움 → 입고 완료 시 기존 Product에 연결(신규 dupe 0). (라이브: 카탈로그 B9673·제조사 Sigma 폼 반영)
- [x] 후보 0건 / catalogNo 매칭됨 → 기존 calm 경로 그대로(노출 0). (Bromocresol Purple 라벨=후보 0 → 신규 calm 정상)
- [x] 자동 매칭 금지 — matchedProduct는 fuzzy로 세팅 안 함(canonical 무접촉). (배너 런타임 양보, 자동확정 0)

**Out of Scope (⚠️ 절대 구현 금지):**
- [ ] fuzzy 자동확정(matchedProduct 자동 세팅) — 오매칭=truth 오염
- [ ] catalogNo case-insensitive 매칭 회귀(기존 findFirst 유지, 대체 금지)
- [ ] productId를 receive payload에 새로 스레딩(폼 채움→find-or-create로 충분, payload/route 무변경)
- [ ] AI/chatbot UI

**User-Facing Outcome:** catalogNo가 안 읽힌 시약도 이름으로 "이거 그 품목 아닌가요?" 후보를 받고, 한 번 클릭으로 기존 품목에 연결.

## 4. Product Constraints
**Must Preserve:** same-canvas(리뷰 카드 내), canonical truth(db.product), §scan-manual-path calm, catalogNo insensitive 매칭.
**Must Not Introduce:** page-per-feature, chatbot, dead button/no-op(후보 있을 때만 행), fuzzy 자동확정, preview가 truth 덮기.

**Canonical Truth Boundary:**
- Source of Truth: `db.product` (무변경)
- Derived Projection: fuzzy 후보 리스트(비영속, 제안)
- Snapshot/Preview: 후보 행 + [이 품목 선택]=폼 채움(미리보기)
- Persistence Path: [선택]→formData→입고 완료→기존 `/api/inventory` find-or-create(name+catalog)로 연결

**UI Surface Plan:** [x] Existing route section (LabelScannerModal 리뷰 카드, 신규 품목 배너 근처 후보 행)

## 5. Architecture & Dependencies
| Decision | Rationale | Trade-offs |
| :--- | :--- | :--- |
| 기존 catalogNo findFirst 유지 + 미매칭 시에만 `matchProduct`(catalogNumber 생략→fuzzy tier만) | insensitive catalog 매칭 회귀 0, 최소 diff | matchProduct 한 번 더 호출(미매칭 시만) |
| 후보 선택 = 폼 채움(updateField name/brand/catalog) | payload/route 무변경, 기존 find-or-create가 연결 보장 | productId 직접 링크 아님(name+catalog 동치) |
| fuzzy = 승인형 후보(자동 X) | canonical·honesty 보호 | 1클릭 추가 |

**Dependencies:** 없음(키·env·패키지 0, 네이티브). Existing Touched: `scan-label/route.ts`, `LabelScannerModal.tsx`(타입+렌더), 재사용 `lib/inventory/product-matcher.ts`(무변경).

**Integration Points:**
- scan-label: `!matchedProduct && (productName||brand)` → `matchProduct({productName,brand},{db})` → fuzzy_name → 응답 `productCandidates[]`,`matchType`.
- LabelScannerModal: `ScanApiResponse`에 필드 추가 → 후보 행(승인형 [이 품목 선택]→updateField 3필드).

## 6. Global Test Strategy
- scan-label: sentinel(readFileSync regex) — matchProduct 연동·fuzzy 한정·응답 shape·catalogNo 매칭 보존.
- product-matcher: 기존 유닛(§11.309b) 회귀 0(무변경).
- UI(LabelScannerModal): sentinel — 후보 행(matchType fuzzy & candidates 있을 때만), [이 품목 선택]=updateField, 신규 배너 보존, 자동확정 부재.
- 실행 권위: operator-shell(vitest/tsc/build). sandbox는 static-verify.

## 7. Implementation Phases

### Phase 0: Context & Truth Lock
- Status: [ ] Pending
**🔴 RED:** matcher API·merged 필드(productName/brand)·find-or-create 연결 경로 확정.
**🟢 GREEN:** 통합점(scan-label 미매칭 분기) + canonical 무접촉 확인.
**🔵 REFACTOR:** 스코프 최소화(기존 catalog 매칭 유지, fuzzy만 추가).
**✋ Gate:** 충돌 0, 회귀 위험(catalog insensitive) 식별. **Rollback:** planning-only.

### Phase 1: Contract & Failing Tests
- Status: [ ] Pending
**🔴 RED:** sentinel RED — scan-label matchProduct 연동·productCandidates 응답, UI 후보 행.
**🟢 GREEN:** 최소 스캐폴딩.
**✋ Gate:** RED 실재, 기존 GREEN 유지. **Rollback:** test revert.

### Phase 2: Core Wiring (scan-label → matchProduct fuzzy)
- Status: [ ] Pending
**🔴 RED:** sentinel — 미매칭+name 시 fuzzy 호출·matchType/productCandidates 응답, catalogNo 매칭 보존.
**🟢 GREEN:** `matchProduct({productName,brand},{db cast})` fuzzy 한정 + 응답 필드.
**🔵 REFACTOR:** 중복 0, overfetch 0(미매칭 시만, take 5).
**✋ Gate:** catalog 매칭 회귀 0, canonical 무접촉. **Rollback:** scan-label 분기 제거.

### Phase 3: UI Candidate Rows (LabelScannerModal)
- Status: [ ] Pending
**🔴 RED:** sentinel — 후보 행(fuzzy & candidates), [이 품목 선택]=updateField 3필드, 신규 배너 후보 시 숨김(토큰 보존).
**🟢 GREEN:** `ScanApiResponse` 필드 + 후보 행 + 선택 핸들러(폼 채움).
**🔵 REFACTOR:** same-canvas, PubChem 행과 톤 분리.
**✋ Gate:** dead button 0(후보 없으면 행 0), front-only success 0, 자동확정 0. **Rollback:** UI 블록 제거.

### Phase 4: Rollout / Smoke / Rollback
- Status: [ ] Pending
**🔴 RED:** 실패모드(후보 0·오매칭 우려) + smoke path.
**🟢 GREEN:** 라이브 — 기존 품목(예: BCP/Sigma B9673) 등록 후, catalogNo 안 읽히게 name만 있는 라벨 스캔 → 후보 노출 → 선택 → 입고 연결.
**🔵 REFACTOR:** notes.
**✋ Gate:** rollout 안전(후보 없으면 calm), rollback 문서화. **Rollback:** scan-label fuzzy 분기 + UI 행 제거(2~3파일).

## 8. Risk Assessment
| Risk | Prob | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| fuzzy 오매칭 → 잘못된 품목 연결 | Med | High | 자동확정 금지(승인형), "확인 필요" 라벨, 사용자 선택 |
| catalogNo insensitive 매칭 회귀 | Low | High | 기존 findFirst 유지, matchProduct에 catalogNumber 생략(Tier1 skip) |
| 후보 노이즈(global product) | Med | Low | brand 동반 시 confidence↑, take 5 cap, 확인 톤 |
| matchProduct 실DB 타입 mismatch | Low | Low | `db as unknown as ProductMatcherDb` 캐스팅(런타임 shape 동일) |

## 9. Rollback Strategy
- Phase 1: test revert.
- Phase 2: scan-label fuzzy 분기 제거(catalog 매칭 그대로).
- Phase 3: UI 후보 블록 + 타입 필드 제거.
- Phase 4: 동일(env/flag 불필요).

## 10. Progress Tracking
- Overall: 100%
- Current phase: 완료 (Phase 4 라이브 smoke GREEN, dpl_EBfKDxL READY)
- Current blocker: 없음
- Next: 없음 (directional-match 한계는 별 트랙 — 아래 Notes)

**Phase Checklist:**
- [x] Phase 0
- [x] Phase 1
- [x] Phase 2
- [x] Phase 3
- [x] Phase 4

## 11. Notes & Learnings
- [2026-06-30] promotion-on-use(catalogNumber)는 이미 동작 — 별도 구현 불필요(truth reconciliation). 본 작업은 catalogNo OCR 실패 보완(name+brand fuzzy 후보).
- [2026-06-30] `product-matcher`(§11.309b) fuzzy tier 재사용 — 신규 매칭 로직 0, 연동만.
- [2026-06-30] 커밋 `e9d07b53`(3파일, +131/-1) push·배포(dpl_EBfKDxL READY). tsc clean, vitest 52/52(신규 8) GREEN. modal Edit 트렁케이션 → HEAD 재적용 복원(diff +38/-1 검증).
- [2026-06-30] 라이브 smoke(www.labaxis.co.kr): ① 제품명 "BCP"·브랜드 "Sigma"·catalogNo 없는 라벨 → scan-label 200 → 후보 2건("BCP/Sigma/B9673", "BCP (1-Bromo-3-chloropropane)/B9673") 노출 → [이 품목 선택] → 카탈로그 B9673·제조사 Sigma 폼 반영(연결, canonical 무접촉). ② 신규 품목 배너 런타임 양보 정상.
- [2026-06-30] ⚠️ directional-match 한계(별 트랙): matchProduct fuzzy는 `기존.name CONTAINS 스캔.name`(Prisma contains) 방향. 라벨 OCR이 전체 화학명("Bromocresol Purple")을 읽고 기존 품목이 약어("BCP")로 등록돼 있으면 미매칭(역방향도 동일). 첫 smoke(Bromocresol Purple 라벨)는 후보 0 → 신규 calm로 정상 폴백. 개선안(양방향/토큰 매칭)은 오매칭(false positive) 위험 동반 → 승인형 유지 전제로 별도 평가.
