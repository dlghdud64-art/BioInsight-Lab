# Implementation Plan: 스캔 가이드 비차단 정합 힌트 (Vivino식 시각 큐, §11.375 보존)

- **Status:** ⏳ Pending
- **Started:** 2026-06-30
- **Last Updated:** 2026-06-30

**CRITICAL INSTRUCTIONS**: phase 완료 후 ① 체크박스 ② quality gate ③ 통과 ④ Last Updated ⑤ Notes ⑥ 다음.
⛔ gate 실패·source 충돌·dead button/no-op 진행 금지.

---

## 0. Truth Reconciliation
- **Latest Truth (충돌 해소):** `capture-quality.ts`에 `alignmentScore`(중앙 60% ROI 엣지 집중도)가 **이미 구현**돼 `quality.alignment`로 반환됨. 단 **§11.375가 정합을 verdict(overall)에서 의도적으로 폐기** — "촬영 전 엣지 휴리스틱은 FN(선명한 라벨 거부)/FP(잡동사니 통과) → 신뢰 파괴. overall은 blur+lighting만. 정합은 촬영 후 OCR confidence(§11.378) 단일 판정."
- **Conflict:** 처음 제안한 "edge-density로 green 게이팅"은 §11.375가 폐기한 접근 → **번복 금지**.
- **Chosen Source of Truth:** §11.375 유지 — overall/자동촬영 게이트는 blur+lighting **무변경**. alignment는 **비차단 advisory 시각 큐로만** 노출(호영님 2026-06-30 "1번").
- **Priority Fit:** Post-release(호영님 directed, 캡처 UX 체감). P1 blocker 아님.

## 1. Work Type
- [x] Web UI (ScanGuideFrame / LabelScannerModal) — 시각 큐만. 로직/verdict 무변경.

## 2. Overview
**Description:** 카메라 프리뷰에서 `quality.alignment.ok`(중앙 콘텐츠 채움)일 때 가이드 박스에 **비차단 emerald glow**를 띄워 "프레임 가운데 잘 채워짐" 체감을 준다(Vivino식 반응). **green verdict·자동촬영 게이트는 blur/lighting 그대로**(§11.375 보존). 정합은 advisory일 뿐 truth 아님 — 라벨 정합/인식 판정은 여전히 OCR(§11.378).

**Success Criteria:**
- [ ] alignment.ok 시 가이드 박스에 advisory glow 노출(비차단).
- [ ] overall(good/warn/poor)·자동촬영은 blur/lighting만으로 판정 — **회귀 0**(§11.375 보존).
- [ ] 과대주장 0: "라벨 정합/인식" 단정 카피 금지 — 시각 큐(또는 "중앙 채움" 류 서술) 만.
- [ ] alignment 미충족/품질 불량 시 glow 미노출(dead UI 0).

**Out of Scope (⚠️ 금지):**
- [ ] alignment로 overall/자동촬영 게이팅(§11.375 번복)
- [ ] `assessFrameQuality` 로직 변경(alignment 이미 계산 — 소비만)
- [ ] "라벨 정합됨/인식됨" 단정 카피(FP 오해)
- [ ] ML 검출, 서버 변경, 파일 업로드 경로, mobile(별 트랙)

**User-Facing Outcome:** 라벨을 프레임 가운데 맞추면 박스가 반응(glow)해 "잘 맞췄다"가 직관적으로 보임. 단 촬영 허용은 흔들림/조명 기준 그대로.

## 3. Product Constraints
**Must Preserve:** §11.375(verdict=blur+lighting), 자동촬영 게이트, same-canvas, canonical 무관(데이터 mutation 0).
**Must Not Introduce:** alignment 게이팅, 과대주장 카피, dead UI, page-per-feature.

## 4. Architecture
| Decision | Rationale | Trade-off |
| :--- | :--- | :--- |
| `assessFrameQuality` 무변경 — `quality.alignment.ok` 소비만 | §11.375 verdict 보존, 로직 리스크 0 | 신규 신호 0 |
| ScanGuideFrame에 `aligned?: boolean` prop → 비차단 glow | 가이드 프레임이 반응(Vivino 체감) | prop 1 |
| corner 색=status(blur/lighting) 유지, glow=alignment(별 레이어) | 두 신호 시각 분리(혼동 0) | 레이어 1 |

**Integration:** LabelScannerModal `<ScanGuideFrame aligned={!!quality?.alignment?.ok} status={blur/lighting 매핑 그대로} />`. glow는 `pointer-events-none`(캡처 무간섭).

## 5. Test Strategy
- ScanGuideFrame: sentinel — `aligned` prop 분기 glow 렌더(data attr) + 미정합 시 부재.
- LabelScannerModal: sentinel — `aligned={!!quality?.alignment?.ok}` 전달.
- capture-quality 회귀 가드: `overall`이 여전히 alignment 미반영(blur+lighting only) — 기존 §11.375 단언 보존 확인(있으면 그대로, 없으면 추가).
- 실행 권위: operator-shell.

## 6. Phases

### Phase 0: Truth & Contract Lock
- Status: [ ] Pending
**RED:** §11.375 verdict 분리 확인(완료). alignment.ok 소비점·glow 계약 확정.
**GREEN:** 통합점(ScanGuideFrame/Modal) + 로직 무변경 확인. **Gate:** §11.375 충돌 0. **Rollback:** planning-only.

### Phase 1: Failing Tests
- Status: [ ] Pending
**RED:** sentinel RED — ScanGuideFrame aligned glow, Modal aligned 전달, overall alignment 미반영 가드.
**GREEN:** 스캐폴딩. **Gate:** RED 실재, 기존 GREEN 유지. **Rollback:** test revert.

### Phase 2: UI Wiring
- Status: [ ] Pending
**RED:** sentinel. **GREEN:** ScanGuideFrame `aligned` prop + 비차단 emerald glow(pointer-events-none, transition) / Modal `aligned` 전달.
**REFACTOR:** corner status와 glow 시각 분리, 과대주장 카피 0. **Gate:** dead UI 0, verdict 무변경, §11.375 보존. **Rollback:** prop/glow 제거.

### Phase 3: Smoke / Rollback
- Status: [ ] Pending
**RED:** 실패모드(정합 오판·glow 상시노출) + smoke. **GREEN:** 라이브 — 카메라로 ① 라벨 중앙 정합 → glow 노출 + (품질 양호면) 코너 emerald, ② 빈 화면/주변부 → glow 없음, ③ 흔들림/어두움 → 자동촬영 차단 그대로(verdict 무변경).
**Gate:** verdict 회귀 0, glow 비차단, rollback 문서화. **Rollback:** ScanGuideFrame glow + Modal prop 제거(2파일).

## 7. Risk
| Risk | P | I | Mitigation |
| :--- | :--- | :--- | :--- |
| alignment 오판으로 glow 깜빡임/오해 | Med | Low | 비차단(촬영/verdict 무영향), 단정 카피 0, glow=advisory |
| §11.375 번복 회귀 | Low | High | assessFrameQuality 무변경 + overall 가드 sentinel |
| glow가 캡처 간섭 | Low | Med | pointer-events-none |

## 8. Rollback
- P1 test revert / P2 ScanGuideFrame glow + Modal prop 제거. env/flag 불필요.

## 9. Progress
- Overall: 0% / Phase 0 / blocker 없음 / Next: Phase 1.

**Checklist:** [ ] P0 [ ] P1 [ ] P2 [ ] P3

## 10. Notes
- [2026-06-30] §11.375(정합 게이팅 폐기, FN/FP 신뢰 파괴) 보존이 핵심. alignment는 이미 계산만 됨 → 비차단 시각 큐로만 소비. 게이팅·과대주장 금지.
