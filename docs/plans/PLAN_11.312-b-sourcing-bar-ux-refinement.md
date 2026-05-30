# Implementation Plan: §11.312-b — 소싱 하단 비교/견적 bar UX 보강

- **Status:** ✅ Complete (Phase 0~3 sandbox 완료, Phase 2/3 호영님 push 대기)
- **Spec received:** 2026-05-30 (호영님 spec §11.306 = §11.312 production smoke 후 보강)
- **Started:** 2026-05-30 (§11.325b 종결 후 진입)
- **Completed:** 2026-05-30 (3 phase / ~1h, scope 대폭 축소 — Phase 0 audit 결과 §11.312 1차 wiring 대부분 완료)
- **Scope:** 3 phases / small (실제 잔여 = 데스크탑 "전체 해제" 위치 보강 only)

---

## 🔄 Phase 0 Truth audit 결과 (2026-05-30 sandbox)

### 호영님 §11.312-b spec vs 실제 sandbox 상태

| spec 이슈 | 호영님 spec | sandbox 실제 상태 | 잔여 작업 |
|---|---|---|---|
| A 개별 삭제 | 바텀시트 ✕ 개별 삭제 | ✅ SourcingCandidatesSheet 안 onRemoveCompare/onRemoveQuoteItem wiring 완료 | 0 |
| B "검토 N" dead button | 필터링 바텀시트 + 재고 확인/유지 액션 | ✅ setCandidatesSheetMode("review") wiring + onClearReviewFlag (line 1607-1614 toggleCompare 호출) | 0 |
| C bar 정보 강화 | 첫 항목명 미리보기 | ✅ 비교 bar (line 1467) + 견적 bar (line 1502) `truncate max-w-[140px]` | 0 |
| C 색상 정합 amber→yellow | bg-yellow-100 text-yellow-700 | ✅ line 1535 정합 | 0 |
| **데스크탑 "전체 해제" 별도 줄 | bar 본체 🗑 통합 + 확인 다이얼로그** | ❌ line 1565-1575 별도 줄 잔존 | **§11.312-b 진입** |

### 핵심 잔여 = 데스크탑 보강 only (호영님 spec 5번)

**현재 sandbox (line 1565-1575):**
```jsx
{/* §11.252f + §11.268c — 전체 해제 (2행 하단 우측 텍스트 링크) */}
<div className="px-4 py-1 flex justify-end border-t border-white/15">
  <Button size="sm" variant="ghost"
    className="h-7 px-2 text-[11px] text-slate-500 hover:text-red-500"
    onClick={() => { clearCompare(); quoteItems.forEach((item: any) => removeQuoteItem(item.id)); }}
  >
    전체 해제
  </Button>
</div>
```

**호영님 spec 5번 보강:**
- 별도 줄 제거
- 견적 bar 본체(line 1545 `<div className="ml-auto flex items-center gap-2 shrink-0">`)에 🗑 button 통합
- 위치: `<span>₩{totalAmount}</span>`(line 1546) 뒤, primary CTA(line 1547-1559) 앞
- 🗑 onClick → AlertDialog 확인 다이얼로그 "견적 후보 N건을 모두 해제할까요?"
- 🗑 outline(border-slate-200/40 또는 text-slate-300) vs CTA filled(bg-emerald-600) 시각 대비

### Import 확인
- `AlertDialog` + family: line 97-101 ✅ 이미 import
- `Trash2`: line 11 ✅ 이미 import
- 신규 import 0 필요

### 비교 bar (compareIds.length > 0) 처리
- 현재 line 1571 onClick = clearCompare + quoteItems forEach → **양쪽 clear**
- 호영님 spec 5번 = "견적 bar" 만 언급
- 결정: 견적 bar 안 🗑 = 양쪽 clear (sandbox 현재 동작 보존). 비교 bar 별도 🗑 추가 X (호영님 spec 명시 안 됨, scope 최소화).
- **호영님 모델 권장:** Opus 4.7로 충분 (UI 재배치 + 확인 다이얼로그 추가, 신규 로직 0)
- **Prerequisite:** §11.312 1차 작업 완료 (task #76 completed, `PLAN_11.312-sourcing-bar-ux.md` 참조)

---

## 🔖 번호 매핑 이력 (호영님 "보강이야" 정정)

- 호영님 spec 번호: **§11.306** (호영님이 직접 명명, 첫 spec line)
- 호영님 메시지: **"보강이야"** — 별도 batch 가 아니라 §11.312 production smoke 후 보강
- 1차 작업: **§11.312** "소싱 sticky bar UX (개별삭제 + dead button + 정보)" (task #76 completed)
  · 1차 plan = `PLAN_11.312-sourcing-bar-ux.md`
  · 이슈 라벨 (개별삭제 / dead button / 정보) 이 본 spec 이슈 A/B/C 와 정확히 일치 → 보강 정합
- 본 plan 매핑: **§11.312-b** (§11.312 의 2차 보강)
- 초기 매핑 §11.323 = 무효 (별도 batch 아니라 보강이므로 letter-sub 패턴 정합)

호영님 패턴 (1차 → 보강) 사례:
- §11.320 (재고 상세 우측 패널 재구성) → §11.322 (2차 고도화) — 다른 번호로 재매핑
- §11.312 (소싱 sticky bar UX) → §11.312-b (본 plan) — letter-sub 패턴 (§11.306a/b/c, §11.317-b/c 와 동일)

---

## 🎯 Spec Mirror (호영님 원본 spec verbatim)

### 1. 현상 — 소싱 검색 결과 하단 sticky bar 2단 (비교 bar + 견적 bar)

### 2. 이슈 3건

| # | 유형 | 내용 |
|---|------|------|
| A | UX 결함 | 🗑 휴지통 = 일괄 삭제만. **개별 항목 삭제 수단 없음.** |
| B | Dead button | ⚠ "검토 2" 배지 탭 → 아무 반응 없음 (검토 이유 확인 불가) |
| C | 정보 부족 | bar "2"만 표시, 담긴 항목 미리보기 0 |

### 3. 수정 — A: 개별 삭제 (바텀시트)

- 비교 bar "비교 N" 탭 → 후보 목록 바텀시트 (각 항목 ✕ 개별 삭제 + 전체 삭제 + 비교 검토 CTA)
- 견적 bar "견적 N" 탭 → 후보 목록 바텀시트 (각 항목 ✕ + ⚠ 검토 표시 + 전체 삭제 + 견적 요청 CTA)
- bar 🗑 휴지통: 유지 + 확인 다이얼로그 / **또는 제거 후 바텀시트 내 "전체 삭제"로 통합 (권장)**

### 4. 수정 — B: "검토 N" 배지 dead button 해소

- `⚠ 검토 N` 탭 → 검토 필요 항목만 필터링 바텀시트
- 각 항목: 사유 표시 + "재고 확인" / "그래도 견적에 유지" 액션
- "재고 확인" → `/dashboard/inventory` 해당 품목 검색 이동
- "그래도 유지" → ⚠ 배지 해제, 정상 견적 항목 전환
- 배지 색상: `bg-yellow-100 text-yellow-700` (§11.302 정합)

### 5. 수정 — C: bar 정보 강화

- bar 첫 항목명 미리보기 표시 (공간 허용 시 풀네임, 2개 이상 시 truncate + 숫자 배지)
- 375px overflow 0

### 6. 수정 — 데스크톱 "전체 해제" 위치 정리 (보강)

- "전체 해제" 별도 줄 제거 → bar 본체 내 🗑 통합
- 🗑 탭 → 확인 다이얼로그 "견적 후보 N건을 모두 해제할까요?"
- 🗑(전체 삭제)와 primary CTA(견적 요청서 만들기) 시각·물리적 분리 (`gap-3` + 🗑 outline / CTA filled)
- 개별 삭제 = 바텀시트 안 ✕
- 데스크톱/모바일 파괴적 액션 처리 원칙 통일

---

## 7. 진입 시 작업 계획 (호영님 §11.322 종결 후)

### Pre-진입 audit 필요 항목

- 소싱 검색 결과 화면 sticky bar 정확 file path 식별
  · 후보: `apps/web/src/app/_workbench/_components/sourcing-context-rail.tsx`
  · 또는 `apps/web/src/app/_workbench/sourcing/` 하위
  · 또는 `apps/web/src/components/sourcing/` 하위
- 현재 비교 bar / 견적 bar 컴포넌트 분리 여부
- 비교 후보 / 견적 후보 state 관리 위치 (context / store / props)
- ⚠ 검토 배지 현재 분기 로직 (재고 중복 / 만료 등)
- 데스크톱 sticky bar vs 모바일 sticky bar 분기

### 예상 5 phase 구조

- **Phase 0**: Truth Lock — sticky bar file 식별 + state 관리 + 검토 배지 분기 logic
- **Phase 1**: RED sentinel — 6 완료 기준 단언 + 회귀 0
- **Phase 2**: A — 바텀시트 컴포넌트(개별 ✕ + 전체 삭제 + CTA) + bar 탭 wiring
- **Phase 3**: B — "검토 N" 배지 필터링 바텀시트 + 재고 확인/유지 액션 + 배지 색상
- **Phase 4**: C + 데스크톱 보강 — 첫 항목명 미리보기 + "전체 해제" bar 본체 통합 + 확인 다이얼로그
- **Phase 5**: 모바일 final + 회귀 + closeout

### Estimated effort
- Phase 0~1: 0.5h
- Phase 2 (바텀시트 신규): 1.5h
- Phase 3 (검토 필터 + 액션): 0.5h
- Phase 4 (정보 강화 + 데스크톱): 0.5h
- Phase 5: 0.5h
- **합계: ~3.5h**

---

## 8. Product Constraints (호영님 원칙 정합)

- ✅ workbench/queue/rail/dock = sticky bar = dock 의 일종, 보존
- ✅ same-canvas = 새 page 0, 바텀시트 inline
- ✅ canonical truth = 비교/견적 후보 state 단일 출처 보존
- ❌ dead button = "검토 N" 배지 dead button 해소가 본 plan 핵심
- ❌ no-op / placeholder success = 개별 ✕ / 재고 확인 / 그래도 유지 모두 real wiring
- ✅ 파괴적 액션 = 확인 다이얼로그 + primary CTA 와 분리

---

## 9. Risk Assessment

| Risk | 확률 | Impact | Mitigation |
|---|---|---|---|
| sticky bar file 다중(데스크톱/모바일 분기) | Med | Med | Phase 0 audit |
| 비교 후보 / 견적 후보 state 관리 분산 | Med | Med | Phase 0 store/context grep |
| 바텀시트 컴포넌트 신규 → 다른 surface 영향 | Low | Low | inline 컴포넌트 우선 (별도 file 분리 X) |
| 검토 배지 사유 데이터 (재고 중복 등) 백엔드 의존 | Med | Med | Phase 0 분기 logic 확인, mock fallback 가능 |

---

## 10. Pending — 호영님 결정 대기 항목

- 🗑 휴지통 처리: (a) 유지 + 확인 다이얼로그 vs (b) 제거 후 바텀시트 내 "전체 삭제" 통합 (호영님 spec "권장"안 = b)
- 모바일 sticky bar 위치/높이 변경 여부 (현재 보존 가정)
- 검토 배지 사유 데이터 출처 (재고 중복 분기 logic / backend 의존 여부)

---

## 11. Notes

- 호영님 message 명시: "지시문만 전달 다른 작업중" — backlog 보관, 즉시 진입 X
- 호영님 후속 message: "보강이야" — §11.323 별도 batch 가 아니라 §11.312 의 2차 보강
- 다른 작업 = §11.322 Phase 4~5 + §11.319 시약 라벨 스캔 (Opus 4.8 별도 채팅) + 호영님 push gate
- 본 plan = §11.322 종결 후 호영님 진입 결정 시 활성화

## 12. §11.312 1차 작업 cross-reference

- 1차 plan: `PLAN_11.312-sourcing-bar-ux.md`
- 1차 task: #76 [completed] "§11.312 소싱 sticky bar UX (개별삭제 + dead button + 정보)"
- 본 §11.312-b 진입 시 1차 plan 의 작업 file path / state 관리 / 검토 배지 분기 logic 우선 참조 (Phase 0 audit 시간 단축)
