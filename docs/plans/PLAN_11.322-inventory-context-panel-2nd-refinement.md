# Implementation Plan: §11.322 — 재고 상세 우측 레일 2차 고도화 (잘림·중복·위계)

- **Status:** ✅ Complete (Phase 0~5 sandbox 작업 완료, Phase 5 호영님 push 대기)
- **Started:** 2026-05-29
- **Last Updated:** 2026-05-30 (Phase 5 closeout)
- **Estimated Completion:** 2026-05-30 (2일 내 완주)
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

### Phase 1: Failing sentinel (RED) ✅ COMPLETE
- Status: [x] Complete
- 8 완료 기준 단언 + canonical 보존 11 it
- §11.322 commit: COMMIT_11.322-phase0-1.md

### Phase 2: A + B (재고 현황 인라인 row + 위험 텍스트 색상) ✅ COMPLETE
- Status: [x] Complete
- KPI grid-cols-3 → 인라인 라벨-값 row 4 (현재/안전재고/만료 임박/최단 LOT)
- MetricCell 미사용, `<div className="flex justify-between">` 패턴
- 위험 값 `text-red-600 font-semibold` (qtyTone/expiryTone)
- 최단 LOT 재도입 (shortestLotLabel IIFE)
- §11.320 sentinel KPI 단언 동시 갱신 (3 → 4 정합)
- §11.322 commit: COMMIT_11.322-phase2-inline-row.md

### Phase 3: C + D (상태 배너 숫자 제거 + 리스크 필터링) ✅ COMPLETE
- Status: [x] Complete
- toneSub 결론 only: "즉시 재주문 필요" / "안전재고 보충 권장" / "만료 임박 — 우선 소진 권장" / "정상 운영 중"
- toneAction 변수 + display 함께 제거 (의미 중복)
- visibleRisks 필터 (type !== "below_safety")
- 3 곳 risks → visibleRisks swap (length/count/map)
- inventorySummary narrative 입력 보존
- §11.322 commit: COMMIT_11.322-phase3-banner-risks.md

### Phase 4: E (권장 액션 접힘) + 모바일 ✅ COMPLETE
- Status: [x] Complete
- isActionsSectionExpanded useState (default false)
- 권장 액션 SectionHeader + 토글 button + body wrap (다른 3 섹션 패턴 통일)
- 모바일 hit area min-h-[32px] (§11.320 Phase 5 패턴 정합)
- §11.322 commit: COMMIT_11.322-phase4-actions-collapse.md

### Phase 5: 회귀 + closeout ✅ COMPLETE (sandbox)
- Status: [x] Complete (호영님 push 대기)
- §11.320 sentinel KPI 단언 = Phase 2 동시 swap 완료 (3 → 4 정합 ✓)
- sourcing-context-rail 회귀 0 = §11.320 Phase 5 sentinel 자연 보존 ✓
- §11.322 Phase 1 sentinel mobile min-h-[44px] 단언 = §11.320 Phase 5 패턴 보존 ✓
- §11.322 Phase 1 sentinel "접기 button >= 3" 단언 = Phase 4 신규 추가로 4 매칭 (자연 GREEN)
- 추가 sandbox 작업 0 (Phase 2~4 작업이 sentinel 모든 단언 자연 정합)
- PLAN closeout (체크박스 + Notes 갱신)

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
- Overall: 100% (Phase 5 sandbox closeout 완료, 호영님 Phase 5 push 대기)
- Current phase: Phase 5 closeout
- Next: 호영님 Phase 5 push → §11.322 완전 종결, 다음 트랙 진입

**Phase Checklist:**
- [x] Phase 0 complete (Truth Lock)
- [x] Phase 1 complete (Failing sentinel)
- [x] Phase 2 complete (재고 현황 인라인 row + 위험 텍스트 색상)
- [x] Phase 3 complete (상태 배너 숫자 제거 + 리스크 필터링)
- [x] Phase 4 complete (권장 액션 접힘 + 모바일)
- [x] Phase 5 complete (회귀 + closeout, 호영님 push 대기)

## 12. Notes & Learnings

**Implementation Notes:**
- §11.317 5-phase 패턴 재사용 (호영님 phase 별 push 패턴 성공)
- §11.320 위에 incremental refinement — caller props 변경 0 (inventory-content:2725 / inventory-main:1958 영향 0)
- 최단 LOT 재도입 = §11.320 phase 3 결정 번복 (호영님 production smoke 결과 우선)
- 호영님 spec text 그대로 follow

**Blockers Encountered:**
- [2026-05-29] §11.320 sentinel KPI 3 단언 = Phase 2 swap 필요 → 동시 처리 (의도 갱신 + grid-cols-3 패턴 0 swap)
- [2026-05-29] toneAction 의미 중복 → 변수 + display 모두 제거 결정 (sandbox 단순화)
- [2026-05-30] Phase 5 = §11.320 Phase 5 자연 보존으로 추가 sandbox 작업 0 (sentinel 모든 단언 Phase 2~4 작업으로 GREEN)

**Phase별 commit/draft:**
- Phase 0+1: COMMIT_11.322-phase0-1.md ✅ pushed
- Phase 2: COMMIT_11.322-phase2-inline-row.md ✅ pushed
- Phase 3: COMMIT_11.322-phase3-banner-risks.md ✅ pushed
- Phase 4: COMMIT_11.322-phase4-actions-collapse.md ✅ pushed
- Phase 5: COMMIT_11.322-phase5-closeout.md ⏳ 호영님 push 대기

**Production effect (5 phase 합산):**
- A: KPI grid-cols-3 카드 → 인라인 row 4 (현재/안전재고/만료 임박/최단 LOT) — 잘림 0, 단위 풀표기
- B: 위험 카드 빨간 테두리 사라짐 — text-red-600 텍스트 색상만 (§11.302 정합)
- C: 상태 배너 정량 숫자 제거 — 결론 only ("즉시 재주문 필요" 등), 재고 현황 섹션이 유일한 숫자 출처
- D: 안전재고 미달 리스크 = 상태 배너 흡수, expiring 리스크만 잔존 (없으면 섹션 자체 생략)
- E: 정보 위계 3 단계 통일 — 권장 액션 접힘 추가 (LOT/Flow/History/Actions 4 섹션 모두 접힘 시작)
- 모바일 first fold = 상태 배너 + 액션 button + 재고 현황 인라인 row 4 도달

**§11.320 → §11.322 cross-reference:**
- §11.320 Phase 3 "최단 LOT 제거" 결정 → §11.322 Phase 2 재도입 (호영님 production smoke 우선)
- §11.320 Phase 5 모바일 패턴(min-h-[44px] 액션 + min-h-[32px] 접기) 보존
- §11.320 sentinel KPI 3 단언 → §11.322 Phase 2 KPI 4 인라인 row 정합 갱신
- 권장 액션 섹션 접힘 = §11.320 Phase 3 (LOT/Flow/History) 패턴 통일
