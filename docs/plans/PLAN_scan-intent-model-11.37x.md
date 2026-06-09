# PLAN — §11.37x 스캔 intent 모델 (소싱 카메라 재정의)

- **Status:** ✅ Complete (옵션 1 — 정합 확인 + 회귀 가드 종결) / 클로드코드 vitest 확정 + push 대기
- **Started:** 2026-06-09
- **Last Updated:** 2026-06-09 (종결)

> **종결 요지(옵션 1):** Phase 0 TR에서 §1-1 핵심 우려(소싱 카메라 입고 하드와이어 / 자동차감)가 활성 §11.374~380 트랙으로 **이미 정합**임을 확인. 대형 결함수정 불필요 → 정합 상태를 sentinel(`scan-intent-model-11.37x.test.ts`)로 못 박아 회귀 방지하고 종결. 갭 2건(web 소싱 QR확인 진입·mobile 소싱 카메라)은 백로그(결함 아닌 추가 기능).
> **커밋 대상:** `apps/web/src/__tests__/regression/scan-intent-model-11.37x.test.ts`(new) + 본 PLAN. (production 코드 변경 0 — 정합 이미 성립.)

## ⚖️ Quality Gate 규칙 (모든 phase 공통)
- quality gate 통과 후에만 다음 phase. 실패 시 stop, skip 금지.
- TDD Red-Green-Refactor 강제. 실행 불가 검사는 "실행 불가" 명시(추정 통과 금지).
- canonical truth(재고 수량=서버) boundary 침범 금지 / 자동차감 금지 / dead button·no-op·front-only success 금지 / same-canvas 유지 / page-per-feature 회귀 금지 / **평행 스캔 진입 생성 금지**(FAB 교훈).

---

## 0. Truth Reconciliation

**Latest Truth Source:** `HANDOFF_sourcing-scan-product-2026-06-08.md` §1-1.
**현 아키텍처 (코드 실측):**
- `ScanHubModal`(web §11.371-3) + `ScanHubSheet`(mobile §11.379 포팅) = 글로벌 "스캔" 진입. IA = 재고 흐름 2분류 — 입고(label_scanner·smart_receiving) / 사용(qr_scanner). mobile intent = `receive_label | use_qr`.
- `scan.tsx`(mobile) = intent 받아 분기. §11.374~380 = visioncamera·label-lock·OCR 게이트 활성 트랙.

**Conflicts:** 없음(보완 관계). ScanHub = 재고 운영(mutation) 맥락 / handoff §1-1 = 소싱(탐색) 맥락 = 별개.

**Chosen Source of Truth:**
- ScanHubModal/Sheet = canonical 재고 운영 진입 → **유지·재발명 금지**.
- 소싱 카메라 = 소싱 검색 화면 한정, **라벨→제품 검색 + QR 재고 확인(둘 다 read)** 으로 재정의. 입고/차감 mutation 하드와이어 제거 → ScanHub/재고 surface로 일원화.
- 스캔 = 조회 read 기본, 차감 = 스캔 후 명시 확인 단계로만(자동차감 금지, canonical 보호).

**Priority Fit:** P1 (운영 front). §catalog A와 병렬(독립).

**추정(P0 confirm 대기):** 소싱 카메라 현 진입점·무엇을 여는가(스마트입고 하드와이어 여부).

---

## 1. Scope & Work Type
- 작업 유형: Workflow-Ontology Wiring(스캔 intent resolve) + Mobile + Web(소싱 검색 surface).
- Scope: Medium (5 phase). 소싱 카메라 재정의 + scan resolve 액션 분기 한정.
- 범위 밖(defer): 차감 확인 UX 상세(불출 수량·lot 선택, §11.37x 잠근 뒤 후속), ScanHub IA 변경(유지).

---

## 2. Canonical Truth / Surface
- **Source of Truth:** 재고 수량 = 서버. 스캔/카메라 = 라우팅·조회만, truth 직접 변경 금지.
- **No-op / 자동차감 위험:** QR 스캔 resolve가 사용자 확인 없이 차감하면 canonical 위반 → 명시 확인 단계 강제.
- **same-canvas:** 신규 페이지 0. 소싱 검색 surface + 기존 scan route 재사용.
- **평행 진입 금지:** 소싱 카메라 ≠ 새 ScanHub 복제. 맥락 분리(소싱=read / ScanHub=mutation).

**UI Surface Plan:** [x] 기존 소싱 검색 surface + scan route / [ ] New page(불가).

---

## 3. Implementation Phases

### Phase 0: Context & code-confirm
- Status: [x] Complete (2026-06-09) — **TR 반전: §1-1 우려 대부분 이미 정합.**
**code-confirm 결과:**
- ✅ web 소싱 카메라("AI 라벨 스캔", search/page L2799→L2894 `LabelScannerModal`) = `onScanComplete`만 wiring(라벨 catalogNo/productName → 검색 실행). `onDirectReceive` **없음** → 입고 mutation 하드와이어 **0**. handoff 우려 이미 해소.
- ✅ scan.tsx `use_qr` matched → `handleAction`(L446) = 사용자 **명시 액션 선택**(detail 조회 / receive 입고 / dispatch 차감 / label / location → 각 surface router.replace). **자동차감 0** = §1-1 "조회 read 기본, 차감 명시확인" 정합.
- ✅ ScanHubModal(web §11.371-3) / ScanHubSheet(mobile §11.379) = 입고/사용 canonical, 소싱 카메라와 맥락 분리됨.
- ⚠️ **갭(결함 아님, 추가 기능):** (1) web 소싱 카메라에 "QR 재고 확인" 진입 부재 — ScanHub use_qr와 평행 주의. (2) mobile (tabs)/search 카메라 진입 0 = web/mobile 비대칭.
**✋ Gate:** 하드와이어 실체 확정(=없음), 자동차감 0 확인, 맥락 분리 이미 성립. **→ §11.37x 범위 재조정 필요(대형 결함수정 아님).**
**Rollback:** planning-only.

### Phase 1: Contract & Failing Tests
- Status: [ ] Pending
**🔴 RED:** 소싱 카메라=라벨검색+QR확인(read) 계약 / scan resolve→surface 맥락 액션 분기 계약 / 자동차감 금지 가드 — failing.
**🟢 GREEN:** 최소 계약 scaffolding.
**✋ Gate:** failing real, 기존 §11.378/380 무회귀.
**Rollback:** 계약 revert.

### Phase 2: Core — scan intent resolve
- Status: [ ] Pending
**🔴 RED:** resolve 로직 unit(intent×surface→allowedActions, 차감=명시확인 require).
**🟢 GREEN:** scan resolve 모델(조회 기본, 차감 명시확인 단계, surface 맥락 분기).
**✋ Gate:** unit PASS, 자동차감 0, truth-boundary 무침범.
**Rollback:** 로직 revert.

### Phase 3: Wiring
- Status: [ ] Pending
**🔴 RED:** surface별 sentinel(소싱 카메라 read 재정의, mutation 하드와이어 제거, ScanHub 유지).
**🟢 GREEN:** 소싱 카메라 진입 재정의(라벨검색+QR확인) / 스마트입고 하드와이어 제거 / scan resolve 후 surface 액션 분기 / ScanHub 불변.
**✋ Gate:** 평행 진입 0, dead button·자동차감 0, 기존 스캔 트랙 회귀 0.
**Rollback:** wiring revert.

### Phase 4: Smoke / Rollback
- Status: [ ] Pending
**🟢 GREEN:** smoke(소싱 라벨검색→제품 / QR확인→재고 read / 차감=확인 후) + 클로드코드 vitest.
**✋ Gate:** rollout 안전, rollback 문서화.
**Rollback:** 소싱 카메라 진입 기존 복귀(ScanHub 무손상).

---

## 4. Risk Assessment
| Risk | Prob | Impact | Mitigation |
| :-- | :-- | :-- | :-- |
| 평행 스캔 진입 재발(FAB류) | Med | High | ScanHub 재발명 금지, 맥락 분리, 진입점 단일화 점검 |
| 자동차감 canonical 위반 | Med | High | 차감=명시확인 단계 강제, resolve read 기본 |
| 활성 §11.380 스캔 트랙 충돌 | Med | Med | P0 충돌 점검, 기존 게이트 보존 |
| 소싱 카메라 mutation 하드와이어 잔존 | Med | Med | P0 confirm → P3 제거 |

## 5. Rollback Strategy
- Phase별 wiring revert. ScanHub/재고 mutation 경로는 전 과정 불변 → 롤백도 재고 운영 무손상.

## 6. Progress
- Overall: 100% (옵션 1 종결) / Blocker: 없음.
- Checklist: [x] P0(TR 반전 — 이미 정합) / [—] P1~P4 불필요(결함 수정 대상 아님, 회귀 가드로 대체)
- 산출: `scan-intent-model-11.37x.test.ts`(sentinel, 토큰 정합 확인 — 클로드코드 GREEN 확정 대기).
- 백로그(추가 기능): web 소싱 "QR 재고 확인" 진입 / mobile 소싱 검색 라벨 카메라 / 차감 확인 UX 상세(불출 수량·lot).

## 7. Notes
- ScanHub(입고/사용)은 §11.371-3/§11.379 canonical — 유지. 본 플랜은 소싱 카메라(탐색 맥락)만 재정의.
- 차감 확인 UX 상세(불출 수량·lot)는 본 플랜 잠근 뒤 후속.
