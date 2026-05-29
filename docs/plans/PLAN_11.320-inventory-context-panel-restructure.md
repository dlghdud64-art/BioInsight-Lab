# Implementation Plan: §11.320 — 재고 상세 우측 패널 정보 구조 + 시각 정리

- **Status:** ✅ Complete (Phase 0~5 sandbox 작업 완료, Phase 5 호영님 push 대기)
- **Started:** 2026-05-29
- **Last Updated:** 2026-05-29 (Phase 5 closeout)
- **Estimated Completion:** 2026-05-29 (1일 내 완주)
- **Scope:** 5 phases / medium-large
- **Approval:** 호영님 spec(§11.315 → 번호 충돌로 §11.320 매핑) + §11.317 패턴 따라 5 phase 진행 결정
- **호영님 모델 권장:** Opus 4.7로 충분 (명확한 구조 정리 + 색상 통일 + 섹션 재배치, 신규 로직 0)

---

## 🔒 통제 구조 (호영님 원칙)
| 구분 | 담당 |
|---|---|
| Evidence 수집 | Claude sandbox 직접 |
| Scope 결정 | 호영님 |
| Production push | 호영님 (claude-code 환경) |

⛔ sandbox commit 금지, Phase 별 푸시 회신 후 다음 phase.

---

## 0. Truth Reconciliation ✅ COMPLETE

**Target file:** `components/inventory/inventory-context-panel.tsx` (1020 lines)

**9 섹션 정확 line 매핑:**
| 섹션 | 현재 line | spec 처리 |
|---|---|---|
| Header (운영 브리핑 + 선택한 재고) | 447-450 | 유지 (제목/메타만 압축) |
| 탭 4 (상태 요약/보유량/리스크/재발주) | 456-459 | **제거** (어차피 다 펼침) |
| § 1. 상황 요약 (resolver-derived 1줄 + LLM narrative) | 573-588 | **상태 배너로 통합** |
| § 2. 핵심 근거 (Basic Info — 현재/안전재고/만료/최단LOT) | 590~ | "재고 현황" 라벨 변경 + 4 KPI → 3 (최단 LOT 제거) |
| 리스크 — 운영 리스크 | 714 | 상태 배너 통합 (중복 제거) |
| 연결된 흐름 | 739 | **접힌 상태 시작** |
| 권장 액션 + 추천 이유 | 834 | 상태 배너 한 줄 흡수 |
| 최근 수정 이력 | 893 | **접힌 상태 시작** |
| § 4. 다음 조치 (sticky footer 액션) | 911-955 | **상단 상태 배너 하단으로 이동** |

**호출부 (2곳, props 시그니처 변경 0):**
- `app/dashboard/inventory/inventory-content.tsx:2720` `<InventoryContextPanel ...>`
- `app/dashboard/inventory/inventory-main.tsx:1954` `<InventoryContextPanel ...>`

**외부 의존 (cross-cutting reference, 변경 0):**
- `app/_workbench/_components/sourcing-context-rail.tsx`: 본 패턴 이식 — 의존성 보존

**상태별 분기 source (이미 컴포넌트 안 존재):**
- 위험: `item.currentQuantity === 0` 또는 `currentQuantity <= safetyStock`
- 만료 임박: `expiryDate` 30일 이내
- 정상: 위 조건 모두 false

**모바일 패턴 (이미 풀스크린 모달):** 변경 0 — fixed 상단 + 스크롤 패턴 유지

---

## 1. Priority Fit
- [x] **P1 immediate** (UX 정보 우선순위 역전 + 정보 밀도 과다)

## 2. Work Type
- [x] UX 구조 정리 + 시각 디자인
- [x] Web

## 3. Overview

**Feature Description:**
재고 상세 우측 패널이 9 섹션 세로 나열로 스크롤 필수 + 정보 우선순위 부재 + 색상 체계 혼재 → 상태 배너 통합 + 액션 상단 이동 + 섹션 접기 + 색상 통일.

**Success Criteria:**
- [ ] 상태 배너 1개 (현재 상태 + 권장 액션 통합) — 상황요약+리스크+권장액션+추천이유 흡수
- [ ] 액션 button 상단 이동 (sticky footer → 배너 하단)
- [ ] 탭 4개(상태 요약/보유량/리스크/재발주) 제거
- [ ] "핵심 근거" → "재고 현황" 라벨 + 4 KPI → 3 (현재/안전재고/만료 임박)
- [ ] LOT/연결된 흐름/최근 수정 접힘 시작
- [ ] 색상 §11.302 정합 (보라색/빨간 테두리/회색 글씨 강조 제거)
- [ ] 카테고리/보관/위치 1줄 메타 통합
- [ ] 상태별 분기: 정상 emerald / 만료 임박 yellow / 위험 red
- [ ] 재주문 → §11.303 재발주안 바텀시트 / 상태 배너 클릭 → 풀 패널 진입
- [ ] above the fold: 상태 + 액션 + 재고 현황까지 노출
- [ ] 모바일 375px 정합

**Out of Scope:**
- 사이드 패널이 아닌 풀 패널(운영 브리핑 popup) 자체 UX
- backend / data hook 변경
- sourcing-context-rail 동시 정합 (별도 batch)

## 4. Product Constraints
- ✅ workbench/queue/rail/dock (rail 보존)
- ✅ same-canvas (새 file 0)
- ✅ canonical truth (item props 변경 0)
- ❌ dead button / no-op (재주문/정보수정/접기 모두 real wiring)
- ❌ chatbot 재해석
- ✅ 폐기 검토 탭 = 작업 surface, 패널 = 알림/요약

## 5. Architecture & Dependencies
| Decision | Rationale |
|---|---|
| inline 재구성 (1 file) | spec medium scope + caller 2곳 props 변경 0 |
| 상태 배너 = 단일 컴포넌트 inline | 재사용 가치 낮음, 별도 file 분리 X |
| 접기 패턴 = useState 단순 | <details>/Disclosure 도입 X (의존성 ↓) |

## 6. Global Test Strategy
- Phase 1: failing sentinel (새 구조 단언)
- Phase 2~4: GREEN 전환
- Phase 5: 모바일 + 회귀 + 기존 sentinel 영향 검증

## 7. Implementation Phases

### Phase 0: Truth Lock ✅ COMPLETE
- Status: [x] Complete (§0 evidence 9 섹션 매핑 + 호출부 + 외부 의존 확정)

### Phase 1: Failing sentinel (RED) ✅ COMPLETE
- Status: [x] Complete
- 새 구조 단언: 상태 배너 testid / 액션 상단 / 탭 0 / KPI 3 / 접기 패턴 / "재고 현황" 라벨 / 색상 §11.302
- Canonical 보존: caller 호출 시그니처 / item props / 폐기 검토 분리

### Phase 2: Header + 상태 배너 + 액션 상단 ✅ COMPLETE
- Status: [x] Complete
- 탭 4 제거 + 상태 배너(상태별 분기 3 case) + 액션 button 상단 이동
- 상황요약+리스크+권장액션+추천이유 → 상태 배너 통합

### Phase 3: 재고 현황 KPI 3 + 섹션 접기 ✅ COMPLETE
- Status: [x] Complete
- "핵심 근거" → "재고 현황" 라벨, 4 KPI → 3 (최단 LOT 제거)
- LOT/연결된 흐름/최근 수정 useState 접기 시작
- 카테고리/보관/위치 1줄 메타 통합

### Phase 4: 색상 통일 + 인터랙션 wiring ✅ COMPLETE
- Status: [x] Complete
- 보라색/빨간 테두리/회색 글씨 강조 제거 → §11.302 신호등 정합
- 재주문 → §11.303 재발주안 바텀시트 wiring (real action)
- 상태 배너 클릭 → 운영 브리핑 풀 패널(operationalBriefPopup.open)

### Phase 5: 모바일 + 회귀 통합 ✅ COMPLETE (sandbox)
- Status: [x] Complete (호영님 push 대기)
- 액션 button 4개 모바일 min-h-[44px] md:min-h-0 md:h-8 (CLAUDE.md §8 정합)
- 접기 button 3개 min-h-[32px] px-2 -mx-2 inline-flex (LOT/Flow/History hit area 확장)
- sourcing-context-rail 회귀 0 grep evidence (SEVERITY_STYLE / SectionHeader 미공유)
- 기존 sentinel 영향 audit:
  · inventory-app-wide-traffic-light-283c-2: amber/orange 0 유지 ✓
  · inventory-context-panel-disposal-priority: disposal-strip + isExpiredLotWithQty + reorder-after-disposal 보존 ✓
  · operational-brief-* (4 file): caller-side 영향 0, popup-context import 추가만 ✓

## 9. Risk Assessment
| Risk | 확률 | Mitigation |
|---|---|---|
| 9 섹션 → 5 섹션 재배치 시 caller props 의존성 깨짐 | Low | props 시그니처 보존, 내부 render만 변경 |
| 색상 보라/빨간테두리 제거 후 시각 약화 | Low | §11.302 신호등 정합 = 더 강한 시각 위계 |
| sourcing-context-rail 이식본 회귀 | Med | Phase 5에서 별도 grep 회귀 가드 |
| 기존 sentinel 의 "핵심 근거" 라벨/탭 단언 stale | Med | Phase 5에서 식별 + describe.skip 또는 swap |

## 10. Rollback
- Phase 1 fail: sentinel 삭제
- Phase 2~4 fail: inventory-context-panel.tsx revert (단일 file)
- Phase 5 fail: 모바일 grid + sentinel revert

## 11. Progress Tracking
- Overall: 100% (Phase 5 sandbox 작업 완료, 호영님 push 대기)
- Current phase: Phase 5 closeout
- Next: 호영님 Phase 5 push 후 §11.320 종결, 다음 트랙 진입

**Phase Checklist:**
- [x] Phase 0 complete (Truth Lock)
- [x] Phase 1 complete (Failing sentinel)
- [x] Phase 2 complete (Header + 상태 배너 + 액션 상단)
- [x] Phase 3 complete (KPI 3 + 섹션 접기)
- [x] Phase 4 complete (색상 + 인터랙션 wiring)
- [x] Phase 5 complete (모바일 + 회귀, 호영님 push 대기)

## 12. Notes & Learnings

**Implementation Notes:**
- §11.317 5-phase 패턴 재사용 (호영님 phase별 push 성공)
- caller 2곳 props 보존 → file 1개 inline 재구성으로 risk 최소화
- sourcing-context-rail 이식 의존성 = Phase 5 회귀 가드 통과 (SEVERITY_STYLE / SectionHeader 미공유 grep 0)

**Blockers Encountered:**
- [2026-05-29] onReorderReview prop 미존재 → 실제 prop 이름 onReorder. Phase 2 swap + Phase 4 sentinel 정확화
- [2026-05-29] useOperationalBriefPopup 미import → Phase 2 hook + import 추가
- [2026-05-29] useState 미import → Phase 3 react import 추가
- [2026-05-29] Phase 4 sentinel docblock 자체가 false-positive 유발 → "border 강조 제거 + §11.302 신호등 정합" 으로 문구 정리

**Phase별 commit/draft:**
- Phase 0~1: COMMIT_11.320-phase0-1.md ✅ pushed
- Phase 2: COMMIT_11.320-phase2-status-banner.md ✅ pushed
- Phase 3: COMMIT_11.320-phase3-kpi-sections.md ✅ pushed
- Phase 4: COMMIT_11.320-phase4-color-wiring.md ✅ pushed
- Phase 5: COMMIT_11.320-phase5-mobile-closeout.md ⏳ 호영님 push 대기

**Production effect (5 phase 합산):**
- 9 섹션 세로 나열 → 5 섹션 (상태 배너 / 재고 현황 KPI 3 / LOT 접기 / 리스크 / 연결된 흐름 접기 / 최근 수정 접기)
- 상황요약+리스크+권장액션+추천이유 4중 표시 → 상태 배너 1개로 통합
- 액션 button sticky footer 최하단 → 상단 배너 직하 노출
- 모바일 first fold 도달 (상태 배너 + 액션 + KPI 3 + 1줄 메타)
- 색상 §11.302 신호등 정합 (보라/빨간테두리/회색강조 0)
- 터치 영역 ≥ 44px (CLAUDE.md §8 정합)
