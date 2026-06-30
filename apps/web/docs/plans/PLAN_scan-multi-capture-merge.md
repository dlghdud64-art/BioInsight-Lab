# Implementation Plan: 다장 캡처 필드 병합 (catalogNo 누적 보완, fill-empty)

- **Status:** ⏳ Pending
- **Started:** 2026-06-30
- **Last Updated:** 2026-06-30

**CRITICAL INSTRUCTIONS**: phase 완료 후 ① 체크박스 ② quality gate ③ 통과 ④ Last Updated ⑤ Notes ⑥ 다음.
⛔ gate 실패·source 충돌·dead button/no-op/fake success 진행 금지.

---

## 0. Truth Reconciliation
- **Latest Truth:** `LabelScannerModal.runScan`(388)은 매 스캔 `setFormData(mapScanToForm(data))`로 **formData 전체 교체**(406). "다시 스캔"=`resetState`(전체 리셋). 곡면 병 catalogNo가 **한 각도에서만 읽히는** 케이스 미보완.
- **Conflicts:** 없음. §scan-reverse-match-v2(catalogNo 미매칭 시 name 후보)·§scan-manual-path(미매칭 calm)와 직교 — 이건 **catalogNo를 더 자주 읽히게** 하는 캡처 단계 보완.
- **Chosen Source of Truth:** formData=draft(비영속). 입고 완료 시 `/api/inventory` find-or-create가 canonical. 병합은 클라 draft 누적.
- **Priority Fit:** Post-release(호영님 directed, catalogNo 캡처 = 매칭 root cause). P1 blocker 아님.

## 1. Work Type
- [x] Web UI/UX (LabelScannerModal) + 순수 병합 헬퍼. 서버·OCR·verdict 무변경.

## 2. Overview
**Description:** 같은 병을 여러 각도로 추가 촬영하면 각 스캔 결과를 **빈 필드만 채워 누적 병합**한다(교체 아님). 특히 catalogNo가 비었을 때 다음 각도가 채우면 catalogNo 매칭이 바로 동작. 채워진/사용자 수정(dirty) 값은 보존.

**Success Criteria:**
- [ ] "다른 각도 재촬영"(병합) → 새 스캔이 **빈 필드만** 채움(catalogNo 메움), 채워진/dirty 값 보존.
- [ ] 단일 촬영(첫 스캔)은 기존과 동일(전체 채움, 회귀 0).
- [ ] catalogNo 빈칸일 때만 재촬영 calm 유도(dead button 0). 채워지면 유도 사라짐.
- [ ] scanResult 채택: 새 샷이 matchedProduct면 채택(배너 갱신), 아니면 기존 유지(찾은 매칭 보존).
- [ ] canonical 무접촉(formData=draft), 자동확정 0. "다시 스캔"(리셋)은 그대로.

**Out of Scope (⚠️ 금지):**
- [ ] 서버 multi-OCR(각 샷 기존 단일 scan-label 재사용 — 비용·latency↑ 회피)
- [ ] 채워진 필드 덮어쓰기(fill-empty only — 좋은 값 보존)
- [ ] 자동 best-of 픽셀 선택, ML
- [ ] mobile 스캔(웹 모달 먼저, 별 트랙)
- [ ] verdict/촬영 품질 로직 변경(§11.375 무관)

**User-Facing Outcome:** Cat#가 한 번에 안 읽혀도 각도 바꿔 한 번 더 찍으면 폼에 채워지고, 기존에 읽힌 값은 안 사라짐.

## 3. Product Constraints
**Must Preserve:** same-canvas(모달 내), canonical(find-or-create), 사용자 수정값(dirty), "다시 스캔" 리셋, §11.375 verdict.
**Must Not Introduce:** page-per-feature, 채워진 값 덮기, dead button, fake success.
**Canonical Boundary:** SoT=db.product(입고 완료 find-or-create) / Draft=formData(클라 누적) / Persist=입고 완료.

## 4. Architecture
| Decision | Rationale | Trade-off |
| :--- | :--- | :--- |
| 순수 `mergeFormData(prev, incoming)`(신규 lib) | fill-empty 규칙 단위테스트 용이 | 헬퍼 1 |
| runScan(merge) functional setState | useCallback([]) 유지·stale 0 | 분기 1 |
| `mergeNextRef`로 재촬영 의도 전달 | 카메라/파일 공통, closure 무영향 | ref 1 |
| scanResult 채택 규칙(new.matchedProduct 우선) | 찾은 매칭 보존 | 조건 1 |

**Merge rule:** `mergeFormData` — 각 필드 `prev[k].trim()` 비어있으면 incoming[k]로 채움, 아니면 prev 유지(채워진/dirty 보존). received*(기본 "1"/"통")는 비어있지 않아 항상 보존.

**Integration:** runScan(base64, merge) — `setFormData(prev => merge ? mergeFormData(prev, incoming) : incoming)` / `setScanResult(prev => (!merge||data.matchedProduct||!prev) ? data : prev)` / scanCount / lot·expiry scanFilled OR / dirty 리셋은 non-merge만. processFile·capture는 `mergeNextRef.current` 전달 후 리셋. "다른 각도 재촬영" 버튼=`mergeNextRef.current=true; setStep("upload")`. resetState에 scanCount=0·mergeNextRef=false.

## 5. Test Strategy
- scan-form-merge: 유닛 — 빈 필드만 채움, 채워진 값 보존, catalogNo 빈→채움, received* 보존, 단일=incoming 동일(empty prev).
- UI sentinel(LabelScannerModal): runScan merge 분기·mergeFormData 사용·"다른 각도 재촬영"(catalogNo 빈칸 게이트)·resetState scanCount 리셋.
- 실행 권위: operator-shell.

## 6. Phases

### Phase 0: Truth & Contract Lock
- Status: [ ] Pending
**RED:** runScan 교체·resetState·통합점 확인(완료). 병합 규칙·재촬영 분리 확정.
**GREEN:** canonical 무접촉·§11.375 무관 확인. **Gate:** 충돌 0. **Rollback:** planning-only.

### Phase 1: Failing Tests
- Status: [ ] Pending
**RED:** scan-form-merge 유닛 + UI sentinel RED. **GREEN:** 스캐폴딩. **Gate:** RED 실재, 기존 GREEN. **Rollback:** test revert.

### Phase 2: Core merge lib
- Status: [ ] Pending
**RED:** mergeFormData 유닛. **GREEN:** fill-empty 순수 함수.
**Gate:** 유닛 GREEN, 채워진 값 보존. **Rollback:** lib 제거.

### Phase 3: Modal Wiring
- Status: [ ] Pending
**RED:** sentinel. **GREEN:** runScan(merge)·mergeNextRef·scanCount·processFile/capture 전달·resetState 리셋 + "다른 각도 재촬영" calm 유도(catalogNo 빈칸).
**REFACTOR:** same-canvas, "다시 스캔" 보존. **Gate:** dead button 0, 단일샷 회귀 0, canonical 무접촉. **Rollback:** wiring 제거.

### Phase 4: Smoke / Rollback
- Status: [ ] Pending
**RED:** 실패모드(병합이 값 덮음·상시 유도) + smoke. **GREEN:** 라이브 — ① 1샷(catalogNo 없음)→유도→2샷(catalogNo 각도)→병합으로 채워짐+기존/수정 보존→입고 연결, ② 단일샷=기존 동일, ③ 어느 각도도 못 읽으면 유도 유지(정직 한계).
**Gate:** 값 덮기 0, 회귀 0, rollback 문서화. **Rollback:** modal wiring + lib 제거.

## 7. Risk
| Risk | P | I | Mitigation |
| :--- | :--- | :--- | :--- |
| 병합이 좋은 값 덮음 | Med | High | fill-empty only(채워진/dirty 보존) |
| 단일샷 회귀 | Low | High | merge=false면 기존 교체 경로 동일 + 유닛 |
| 재촬영 무한/혼란 | Low | Low | catalogNo 채워지면 유도 사라짐, "다시 스캔" 별도 |
| 어느 각도도 catalogNo 못 읽음 | High | Med | 정직 한계 — 유도 유지·수동 입력 가능(§scan-manual-path) |

## 8. Rollback
- P1 test / P2 lib 제거 / P3 modal wiring 제거(merge 경로·버튼). env/flag 불필요.

## 9. Progress
- Overall: 0% / Phase 0 / blocker 없음 / Next: Phase 1.

**Checklist:** [ ] P0 [ ] P1 [ ] P2 [ ] P3 [ ] P4

## 10. Notes
- [2026-06-30] 서버 multi-OCR 대신 client 누적 병합(단일 scan-label 재사용) — 비용·latency 0. fill-empty로 좋은 값 보존. 약어/매칭과 직교(catalogNo 확보 자체를 늘림).
