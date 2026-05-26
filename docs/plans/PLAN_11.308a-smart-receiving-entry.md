# Implementation Plan: §11.308a 스마트 입고 진입점 (P1)

- **Status:** 🔄 In Progress
- **Started:** 2026-05-26
- **Last Updated:** 2026-05-26
- **Owner:** Claude (sandbox) → 호영님 (push)

⛔ DO NOT skip quality gates
⛔ DO NOT introduce dead button (placeholder 모달 = 수동 입고 보조 링크 필수)
⛔ DO NOT change §11.297c ActionMenu 패턴

---

## 0. Truth Reconciliation

**호영님 결정 (2026-05-26):**

- Q8 = A: placeholder 모달 + 수동 입고 (`/dashboard/receiving`) 보조 링크
- Q9 = A: 대시보드 + 재고 탭 양쪽
- Q10 = C: 하단 탭바는 후속 batch (지금 안 함)
- Q13 = A: §11.308a 먼저, P2 (§11.308b/c/d) 후속

**대상:**

| 파일 | 변경 |
|---|---|
| `components/inventory/SmartReceivingPlaceholderModal.tsx` (NEW) | placeholder Dialog + 수동 입고 CTA |
| `app/dashboard/page.tsx` | 헤더 우측 (line 576~585) AIInsightDialog 옆 ScanLine button + state wiring |
| `app/dashboard/inventory/inventory-main.tsx` | mobile view (line 991~1015) + desktop view (line 1069~1105) "재고 등록" 옆 ScanLine button + state wiring (mobile/desktop 동일 컴포넌트 공유) |

**기존 스캔 컴포넌트 분석:**

- `LabelScannerModal.tsx` (라벨 스캔) / `QuoteScannerModal.tsx` (견적서 스캔) — 거래명세서 OCR 흐름과 다름
- `barcode-scan-fab.tsx` (FAB) / `GlobalQRScannerModal.tsx` (QR) — 별도 흐름
- "스마트 입고" = 거래명세서 OCR + 품목/수량/LOT/공급사 + PO 매칭 → backend 미구현. placeholder만.

**기존 receiving 페이지:**

- `/dashboard/receiving` (ModuleLandingItem 패턴 + priority queue) — 수동 입고 처리 큐 ✅
- placeholder 모달에서 "수동으로 입고 처리하기" CTA → `/dashboard/receiving` 으로 router.push

---

## 1. Priority Fit

- [x] **P1 immediate** — 호영님 Q13 = A

---

## 2. Work Type

- [x] Web (반응형 Tailwind + 모달 신규)
- [x] Mobile (호영님 spec — 모바일 우선)
- [x] UX Copy (placeholder 안내문)
- [x] Feature (UI 진입점 + 모달)

---

## 3. Overview

**Scope:**
- placeholder 모달 컴포넌트 신규 (`SmartReceivingPlaceholderModal`)
  - 헤더: "스마트 입고 (곧 제공 예정)"
  - 본문: Phase 1 OCR / Phase 2 LLM / Phase 3 PO 매칭 안내
  - CTA: [수동으로 입고 처리하기] → `/dashboard/receiving` + [닫기]
- 대시보드 헤더 우측에 ScanLine button + state wiring
- 재고 페이지 mobile + desktop 헤더 액션 row에 ScanLine button + state wiring

**Success Criteria:**

- [ ] 대시보드 헤더 우측 (AIInsightDialog 옆 또는 위/아래) ScanLine button 노출
- [ ] 재고 페이지 mobile view (md 미만) "재고 등록" 옆 ScanLine button 노출
- [ ] 재고 페이지 desktop view (md+) "재고 등록" 옆 ScanLine button 노출
- [ ] button 탭 → placeholder 모달 열림 (open state)
- [ ] 모달 안 [수동으로 입고 처리하기] 탭 → `/dashboard/receiving` 으로 router.push
- [ ] 모달 안 [닫기] 또는 모달 외부 클릭 → close
- [ ] 터치 영역 ≥ 44px (모바일 a11y)
- [ ] 호영님 spec "곧 제공 예정" 안내 + Phase 1/2/3 단계 명시 (dead button 0)

**Out of Scope (defer):**

- 빠른 액션 영역 신규 (§11.308d, P2)
- 영문 라벨 제거 (§11.308b, P2)
- 온보딩 위젯 변경 (§11.308c, 호영님 Q12 = A 현재 동작 유지)
- 하단 탭바 "스캔" 전용 탭 (호영님 Q10 = C 후속)
- 실제 OCR / LLM / PO 매칭 backend 구현
- aiParseModalOpen / AiQuoteParseModal 재사용 (이건 견적서용)

---

## 4. Product Constraints

**Must Preserve:**

- [x] same-canvas (page 추가 0, modal로 inline)
- [x] canonical truth (resolver / mutation 변경 0)
- [x] §11.297c ActionMenu 패턴 (재고 utility menu 변경 0)
- [x] §11.243 isOnboardingMode / OnboardingHero 분기 보존

**Must Not Introduce:**

- [x] dead button (placeholder 모달에 수동 입고 CTA 필수)
- [x] page-per-feature
- [x] chatbot/assistant reinterpretation
- [x] Radix dropdown 부활
- [x] AI 데이터 noise (실제 OCR 동작 흉내 금지)

**Canonical Truth Boundary:**

- Source of Truth: 없음 (placeholder, backend 호출 0)
- Persistence Path: 없음

---

## 5. Phases

### Phase 0: Truth Lock — ✅ Complete

### Phase 1: Sentinel Test (RED)

- [ ] `__tests__/regression/smart-receiving-entry-308a.test.ts` (NEW)
- [ ] regex:
  - SmartReceivingPlaceholderModal 컴포넌트 file 존재 + export
  - dashboard/page.tsx — ScanLine import + button + setIsSmartReceivingOpen state + Modal 렌더
  - inventory-main.tsx — ScanLine button (mobile + desktop, 2건) + state wiring
  - placeholder 모달 안 `/dashboard/receiving` Link/href + "수동" 텍스트 존재
  - "곧 제공 예정" 또는 동등 한국어 안내 존재
  - dead button 0 (button 자체에 onClick wiring 강제)

### Phase 2: Implementation (GREEN)

- [ ] `components/inventory/SmartReceivingPlaceholderModal.tsx` 신규 작성
  - Dialog (기존 Dialog 패턴 참조)
  - 헤더 + Phase 안내 + CTA
  - "수동으로 입고 처리하기" → `router.push("/dashboard/receiving")` + onClose
- [ ] `dashboard/page.tsx` 수정
  - import: ScanLine + SmartReceivingPlaceholderModal
  - useState: isSmartReceivingOpen
  - 헤더 우측 (line 576~585) ScanLine button + onClick
  - Modal 렌더 (조건부 또는 hidden by open state)
- [ ] `inventory-main.tsx` 수정
  - import: ScanLine + SmartReceivingPlaceholderModal
  - useState: isSmartReceivingOpen
  - mobile view (line 991~) "재고 등록" 옆 ScanLine button
  - desktop view (line 1069~) "재고 등록" 옆 ScanLine button (동일 state 공유)
  - Modal 렌더 1회 (mobile/desktop 공통)

### Phase 3: Smoke & Commit Draft

- [ ] commit draft
- [ ] present_files
- [ ] 호영님 push
- [ ] Vercel READY
- [ ] 모바일 (375px) labaxis.co.kr/dashboard — ScanLine button 노출 + 탭 → 모달 열림
- [ ] /dashboard/inventory — mobile + desktop 모두 ScanLine button 노출
- [ ] 모달 안 "수동으로 입고 처리하기" → `/dashboard/receiving` 이동 확인

---

## 6. Risk

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| Dialog 컴포넌트 import 패턴 불일치 | Low | Med | 기존 Dialog 사용처 (quotes/page.tsx line 27) 패턴 참조 |
| 대시보드 헤더 우측 영역 압축 (AIInsightDialog 옆) | Med | Low | flex-col items-end + gap-2 보존, button size sm |
| 재고 mobile view 액션 row wrap 깨짐 | Low | Low | flex-wrap 보존 + button size sm |
| Vercel build CRLF 재발 | Low | High | `.gitattributes` (§11.303-hotfix-c) 보호 |

---

## 7. Rollback

- Phase 2 Fails: `git revert <SHA>` — 3 file (modal NEW + dashboard + inventory-main) + sentinel revert

---

## 8. Notes

- 호영님 spec "거래명세서 → OCR → PO 매칭"은 backend 미구현 → placeholder
- 진입점 배치만으로 사용자에게 "이 기능이 올 것" 기대감 + dead button 회피 (수동 fallback)
- §11.308 sub-batch 후속: b (영문 라벨) / c (온보딩 — 호영님 Q12 = A 보존 결정) / d (빠른 액션 영역)
