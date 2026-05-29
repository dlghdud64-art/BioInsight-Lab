# Implementation Plan: §11.320 — 재고 상세 우측 패널 정보 구조 + 시각 정리

- **Status:** 🔄 In Progress (Phase 0~1 작업 중)
- **Started:** 2026-05-29
- **Last Updated:** 2026-05-29
- **Estimated Completion:** 2026-05-29~30 (4~6h working)
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

### Phase 1: Failing sentinel (RED)
- Status: [ ] Pending | [ ] In Progress | [ ] Complete
- 새 구조 단언: 상태 배너 testid / 액션 상단 / 탭 0 / KPI 3 / 접기 패턴 / "재고 현황" 라벨 / 색상 §11.302
- Canonical 보존: caller 호출 시그니처 / item props / 폐기 검토 분리

### Phase 2: Header + 상태 배너 + 액션 상단
- Status: [ ] Pending | [ ] In Progress | [ ] Complete
- 탭 4 제거 + 상태 배너(상태별 분기 3 case) + 액션 button 상단 이동
- 상황요약+리스크+권장액션+추천이유 → 상태 배너 통합

### Phase 3: 재고 현황 KPI 3 + 섹션 접기
- Status: [ ] Pending | [ ] In Progress | [ ] Complete
- "핵심 근거" → "재고 현황" 라벨, 4 KPI → 3 (최단 LOT 제거)
- LOT/연결된 흐름/최근 수정 useState 접기 시작
- 카테고리/보관/위치 1줄 메타 통합

### Phase 4: 색상 통일 + 인터랙션 wiring
- Status: [ ] Pending | [ ] In Progress | [ ] Complete
- 보라색/빨간 테두리/회색 글씨 강조 제거 → §11.302 신호등 정합
- 재주문 → §11.303 재발주안 바텀시트 wiring (real action)
- 상태 배너 클릭 → 운영 브리핑 풀 패널(operationalBriefPopup.open)

### Phase 5: 모바일 + 회귀 통합
- Status: [ ] Pending | [ ] In Progress | [ ] Complete
- 모바일 375px above the fold 확인
- sourcing-context-rail 회귀 0 확인
- 기존 sentinel 영향 audit + 정합

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
- Overall: 0% → Phase 0 ✅ 진행 후 20%
- Current phase: Phase 0 → 1
- Next: failing sentinel 작성

**Phase Checklist:**
- [x] Phase 0 complete (Truth Lock)
- [ ] Phase 1 complete (Failing sentinel)
- [ ] Phase 2 complete (Header + 상태 배너 + 액션 상단)
- [ ] Phase 3 complete (KPI 3 + 섹션 접기)
- [ ] Phase 4 complete (색상 + 인터랙션 wiring)
- [ ] Phase 5 complete (모바일 + 회귀)

## 12. Notes & Learnings

**Implementation Notes:**
- §11.317 5-phase 패턴 재사용 (호영님 phase별 push 가능)
- caller 2곳 props 보존 → file 1개 inline 재구성으로 risk 최소화
- sourcing-context-rail 이식 의존성 = Phase 5 회귀 가드 필수
