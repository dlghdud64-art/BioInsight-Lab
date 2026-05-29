# Implementation Plan: §11.322 — 재고 상세 우측 레일 2차 고도화 (잘림·중복·위계)

- **Status:** ⏳ Pending (호영님 spec 진행 승인, plan 작성)
- **Started:** 2026-05-29
- **Last Updated:** 2026-05-29
- **Estimated Completion:** 2026-05-29~30 (3~4h working)
- **Scope:** 5 phases / medium (§11.320 후속 incremental)
- **호영님 모델 권장:** Opus 4.7로 충분 (시각 정리 + 중복 제거 + 위계 재배치, 신규 로직 0)
- **번호 매핑:** 호영님 §11.317 (spec 번호) → §11.322 (이미 §11.317-b = ai-pipeline @ts-nocheck batch 사용 중, 번호 충돌 회피)
- **Prerequisite:** §11.320 Phase 5까지 완료 (호영님 push 후 진입)

---

## 🔒 통제 구조 (호영님 원칙)
| 구분 | 담당 |
|---|---|
| Evidence 수집 | Claude sandbox 직접 |
| Scope 결정 | 호영님 |
| Production push | 호영님 (claude-code 환경) |

⛔ sandbox commit 금지, Phase 별 푸시 회신 후 다음 phase.

---

## 0. Truth Reconciliation ✅ COMPLETE (sandbox audit 2026-05-29)

**Target file:** `apps/web/src/components/inventory/inventory-context-panel.tsx` (§11.320 Phase 5 완료 후 상태)

**호영님 §11.315 (=§11.320) 반영 확인 (production smoke 결과):**
- ✅ 상태 배너 "🔴 재고 소진 → 재주문 권장" 최상단 통합
- ✅ 액션 button (재주문/정보 수정) 상단 이동
- ✅ 상단 탭 제거, 섹션 접기 적용
- ✅ KPI 3 + 운영 브리핑 1줄 배너

**잔여 5 문제 정확 line 매핑 (sandbox audit):**

| # | 문제 | 심각도 | 현재 위치 | 수정 방향 |
|---|---|---|---|---|
| A | "재고 현황" 카드 잘림 ("0 bot...") | **높음** | line 686 `grid grid-cols-3 gap-3 mt-3` + MetricCell × 3 | 인라인 라벨-값 row 4 (현재/안전재고/만료 임박/최단 LOT) |
| B | 빨간 카드 테두리 잔존 (qtyTone="danger" 카드만) | 중간 | MetricCell tone={qtyTone} (line 691) | 카드 자체 제거 → 값 텍스트만 `text-red-600` |
| C | 상태 배너 ↔ 재고 현황 정보 중복 ("현재 0 / 안전재고 8") | 중간 | line 527-532 toneSub `현재 ${qty} ${unit} / 안전재고 ${safetyStock}` | 결론+액션만, 정량 숫자 제거 |
| D | 리스크 "안전재고 미만" ↔ 상태 배너 중복 | 중간 | line 792-816 risks.map (안전재고 미달/재고 소진 포함) | risks 필터링 (안전재고 미달/재고 소진 type 제외), length 0 시 섹션 생략 |
| E | 정보 위계 평면 — 권장 액션 항상 펼침 | 중간 | line 925-958 "권장 액션 + 추천 이유" section (toggle 없음) | useState 접기 default false 추가 (다른 3차 섹션과 통일) |

**호출부 (2곳, props 시그니처 변경 0):**
- `app/dashboard/inventory/inventory-content.tsx:2725` `<InventoryContextPanel ...>`
- `app/dashboard/inventory/inventory-main.tsx:~1958` `<InventoryContextPanel ...>`

**§11.320 결정 번복 (호영님 spec 정합):**
- §11.320 Phase 3 "최단 LOT 제거 (LOT 섹션 중복)" → 호영님 §11.322 spec 3 에서 인라인 row 4 (현재/안전재고/만료 임박/**최단 LOT**) 으로 재도입
- 이유: LOT 섹션 접힘 상태 시작 → 최단 LOT 가 재고 현황 인라인 row 에 있어도 above the fold 인지 부담 적음
- 호영님 production smoke 결과 기반 결정 = 우선

**외부 의존 (cross-cutting reference, 변경 0):**
- `app/_workbench/_components/sourcing-context-rail.tsx`: 본 패턴 미이식 — 의존성 0 (§11.320 Phase 5 audit 결과 동일)

---

## 1. Priority Fit
- [x] **P1 immediate** (§11.320 production smoke 직후 호영님 잔여 문제 발견)

## 2. Work Type
- [x] UX 시각 정리 + 중복 제거 + 위계 재배치 (Web)
- [x] §11.320 후속 incremental refinement

## 3. Overview

**Feature Description:**
§11.320 Phase 5까지 적용 후 호영님 production smoke 에서 잔여 5 문제 발견:
재고 현황 카드 잘림 / 빨간 테두리 불균형 / 상태 배너↔재고현황 숫자 중복 / 리스크↔상태 배너 중복 / 정보 위계 평면.
§11.320 변경 위에 incremental refinement 로 inline row 전환 + 색상 정리 + 중복 제거 + 권장 액션 접힘 추가.

**Success Criteria (호영님 spec 8 완료 기준):**
- [ ] 재고 현황 3 카드 → 인라인 라벨-값 row (잘림 0, 단위 풀표기)
- [ ] 카드 테두리 색상 강조 제거, 위험 값 `text-red-600` 만
- [ ] 상태 배너 정량 숫자 제거 (결론+액션만)
- [ ] 재고 현황 섹션이 유일한 숫자 출처
- [ ] 상태 배너 흡수 리스크는 리스크 섹션에서 제외 (안전재고 미달/재고 소진)
- [ ] 부가 리스크 없으면 리스크 섹션 자체 생략
- [ ] 1차(상태 배너/재고 현황) 항상 펼침
- [ ] 3차(LOT/연결된 흐름/권장 액션/최근 수정) 접힘 시작 — 권장 액션 신규 접힘
- [ ] above the fold (상태+액션+재고 현황) 노출
- [ ] 데스크탑 레일 + 모바일 풀스크린 모두 정합

**Out of Scope:**
- 운영 브리핑 popup 자체 UX (§11.320 결정 유지)
- backend / data hook 변경 (status banner "권장 발주 수량 30 ea" 같은 backend 데이터 의존 표시 = 본 plan 미포함)
- sourcing-context-rail 영향 (audit 결과 의존 0)
- §11.320 결정 (탭 제거 / KPI 3 / 접기 등) 회귀 — 최단 LOT 재도입 외

## 4. Product Constraints
- ✅ workbench/queue/rail/dock = rail 보존
- ✅ same-canvas = 새 file 0
- ✅ canonical truth = item props 변경 0
- ❌ dead button / no-op = 재주문/정보수정/접기 모두 real wiring 보존
- ❌ chatbot 재해석
- ✅ §11.302 신호등 정합 = 위험 = `text-red-600` (값 텍스트) / `bg-red-50` (상태 배너) 유지

## 5. Architecture & Dependencies

| Decision | Rationale |
|---|---|
| inline 라벨-값 row (MetricCell 미사용) | 폭 400px/360px 안정 + 잘림 0 + 단위 풀표기 |
| 카드 테두리 강조 제거 | 텍스트 색상으로 위험 표현 = §11.302 정합 |
| 상태 배너 toneSub 결론 중심 | "재고 소진 — 즉시 재주문 필요" 단순화, 숫자는 재고 현황 |
| risks 필터 안전재고/재고 소진 타입 제외 | 상태 배너 중복 제거, 단일 정보 출처 |
| 권장 액션 useState 접기 추가 | 다른 3차 섹션 패턴 통일 (LOT/Flow/History 와 동일) |

## 6. Global Test Strategy
- Phase 1: failing sentinel (8 완료 기준 단언 + 회귀 0)
- Phase 2~4: GREEN 전환
- Phase 5: 모바일 + 회귀 통합 + closeout

## 7. Implementation Phases

### Phase 0: Truth Lock ✅ COMPLETE
- Status: [x] Complete (§0 evidence + line 매핑 + 호출부 + §11.320 결정 번복 명시)

### Phase 1: Failing sentinel (RED)
- Status: [ ] Pending
- 8 완료 기준 단언: 인라인 row testid / 카드 테두리 0 / 상태 배너 숫자 0 / 리스크 필터 / 권장 액션 접기
- Canonical 보존: caller 호출 시그니처 / item props / §11.320 결정 유지

### Phase 2: A + B (재고 현황 인라인 row + 위험 텍스트 색상)
- Status: [ ] Pending
- KPI grid-cols-3 → 인라인 라벨-값 row 4 (현재/안전재고/만료 임박/최단 LOT)
- MetricCell 미사용, `<div className="flex justify-between">` 패턴
- 위험 값 (currentQuantity = 0 등) `text-red-600 font-semibold` 만
- "0 bottle" 단위 풀표기 (잘림 0)

### Phase 3: C + D (상태 배너 숫자 제거 + 리스크 필터링)
- Status: [ ] Pending
- toneSub: "현재 ${qty} ${unit} / 안전재고 ${safety}" → 결론만 ("즉시 재주문 필요" / "우선 소진 권장" / "특이사항 없음")
- risks 필터: risk.type 또는 risk.label 기반 "안전재고 미달" / "재고 소진" 제외
- 필터 후 length 0 시 섹션 자체 생략 (이미 length > 0 조건 있음, 필터만 추가)

### Phase 4: E (권장 액션 접힘) + 모바일
- Status: [ ] Pending
- `useState isActionsSectionExpanded` 추가 (default false)
- 권장 액션 + 추천 이유 섹션 SectionHeader 옆 접기/펼치기 button + 본문 `{isActionsSectionExpanded && (...)}` wrap
- 다른 3차 섹션과 동일 패턴
- 모바일 375px above the fold (상태 배너 + 액션 button + 재고 현황 인라인 row) 도달 검증

### Phase 5: 회귀 + closeout
- Status: [ ] Pending
- §11.320 sentinel 영향 audit (testid / 라벨 / KPI 3 → 4 변경 시 sentinel 갱신)
- sourcing-context-rail 회귀 0 (이미 의존 0 확인, 재확인)
- PLAN closeout (체크박스 + notes)

## 9. Risk Assessment
| Risk | 확률 | Mitigation |
|---|---|---|
| §11.320 sentinel (KPI 3 단언) 깨짐 (최단 LOT 추가 = 4) | High | Phase 1 sentinel 갱신 + Phase 5 audit |
| MetricCell 제거 후 다른 caller 영향 | Low | grep MetricCell usage (예상: 본 패널 외 미사용) |
| 권장 액션 접힘 시 above the fold 너무 짧음 | Low | Phase 4 모바일 검증 |
| risks 필터 type/label mismatch (mock 생성 함수 정의 확인) | Med | Phase 0 generateMockRisks 구조 확인 → Phase 3 정확 필터 |

## 10. Rollback
- Phase 1 fail: sentinel 삭제
- Phase 2~4 fail: inventory-context-panel.tsx revert (단일 file)
- Phase 5 fail: sentinel 갱신만 revert

## 11. Progress Tracking
- Overall: 10% → Phase 0 ✅ + Phase 1 RED 작성 중
- Current phase: Phase 0 → 1
- Next: Phase 1 RED sentinel 작성 → 호영님 승인 → Phase 2 진입

**Phase Checklist:**
- [x] Phase 0 complete (Truth Lock)
- [ ] Phase 1 complete (Failing sentinel)
- [ ] Phase 2 complete (재고 현황 인라인 row + 위험 텍스트 색상)
- [ ] Phase 3 complete (상태 배너 숫자 제거 + 리스크 필터링)
- [ ] Phase 4 complete (권장 액션 접힘 + 모바일)
- [ ] Phase 5 complete (회귀 + closeout)

## 12. Notes & Learnings

**Implementation Notes:**
- §11.317 5-phase 패턴 재사용 (호영님 phase 별 push 가능)
- §11.320 위에 incremental refinement — caller props 변경 0
- 최단 LOT 재도입 = §11.320 phase 3 결정 번복 (호영님 production smoke 결과 우선)
- 호영님 spec text 그대로 follow

**§11.320 sentinel 영향 예상:**
- `inventory-context-kpi-current` / `kpi-safety-stock` / `kpi-expiring-soon` testid 보존 (Phase 2 인라인 row 에서도 동일 testid 유지)
- 새 testid 추가: `inventory-context-kpi-shortest-lot` (최단 LOT)
- "grid grid-cols-3" 단언 → "flex justify-between" 패턴으로 swap 가능
