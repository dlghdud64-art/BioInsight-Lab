# Implementation Plan: §11.307 견적 관리 모바일 헤더 3건

- **Status:** 🔄 In Progress (Phase 1)
- **Started:** 2026-05-26
- **Last Updated:** 2026-05-26
- **Owner:** Claude (sandbox) → 호영님 (push)

⛔ DO NOT skip quality gates
⛔ DO NOT change §11.298d plain dropdown wiring
⛔ DO NOT change `aiParseModalOpen` state name (내부 변수, 사용자 미노출)

---

## 0. Truth Reconciliation

**대상:** `apps/web/src/app/dashboard/quotes/page.tsx` (line 1940~2046 + line 25 import + line 4250 toast)

**현재 코드 (sandbox audit):**

| 위치 | 현재 |
|---|---|
| line 25 import | `... Upload, ChevronDown ...` from lucide-react |
| line 1949 액션 컨테이너 | `flex items-center gap-1.5 sm:gap-2 flex-shrink-0 flex-wrap lg:flex-nowrap` (justify-end 없음) |
| line 1950-1957 | 1번째: 📤 Upload + "견적서 파싱"/"파싱" |
| line 1987-2027 | 2번째: ⋯ 더보기 (md:hidden, `absolute right-0 top-full mt-1 w-52`) |
| line 2028-2046 | 3번째: [+ 새 견적 요청] + [∨ BOM dropdown] |
| line 4243 / 4250 | "AI 견적서 파싱 모달" 주석 + "AI 견적서 파싱 완료" toast |
| line 986 | `aiParseModalOpen` state (보존) |

**짤림 진짜 root cause (sandbox 진단):**

- 모바일 (375px) line 1940 부모 `flex-col` → 액션 그룹이 별도 row
- 액션 그룹 `flex-wrap` + `justify-end` 없음 → **좌측 정렬**
- ⋯ button 위치 ≈ x 122~142px (좌측 가까움)
- 드롭다운 `right-0 w-52(208px)` → 좌측 끝 ≈ -66px (viewport 밖)
- 결과: "견" 글자 짤림 (호영님 IMG_5672 정합)

**Fix 전략 (호영님 spec 동시 해결):**

호영님 (3) 버튼 순서 [+ 새 요청] [📷 스캔] [⋯] = ⋯ 우측 끝 이동 → `right-0` viewport 안 → (2) 짤림 자동 해결. (3)이 (2) fix를 포함.

---

## 1. Priority Fit

- [x] **P1 immediate** (호영님 명시, 모바일 사용성 직접 영향)
- §11.306b/c (P2) 보다 우선 진입 (호영님 Q7 = A)

---

## 2. Work Type

- [x] Web (반응형 Tailwind + JSX reorder)
- [x] Mobile (UX 정합 + viewport collision fix)
- [x] UX Copy ("파싱" → "스캔")
- [x] Icon swap (Upload → ScanLine)

---

## 3. Overview

**3 sub-task (단일 commit, 같은 컴포넌트):**

| sub | scope |
|---|---|
| (1) 명칭 | "견적서 파싱"/"파싱" → "견적서 스캔"/"스캔" (사용자 노출 텍스트 3곳: 헤더 + AI 모달 toast + 주석) |
| (2) 아이콘 | `Upload` → `ScanLine` (사용자 spec — "문서를 읽어들이는" 동작에 정합) |
| (3) 순서 + 짤림 | JSX 순서 재배치: [+ 새 견적 요청] (line 2028~2046) → [📷 스캔] (line 1950~1957) → [⋯ 더보기] (line 1987~2027). ⋯이 우측 끝으로 이동 → `right-0` viewport 안 → 짤림 자동 해결 |

**Success Criteria:**

- [ ] "파싱" literal 0 occurrence (헤더 + AI 모달 + toast), "스캔" 등장
- [ ] `Upload` icon import 제거, `ScanLine` icon import 추가, line 1955 swap
- [ ] 헤더 액션 순서 = [+ 새 견적 요청] → [📷 스캔] → [⋯ 더보기] (DOM 순서)
- [ ] 모바일 (375px) ⋯ 드롭다운 viewport 안 (글자 짤림 0)
- [ ] 데스크탑 (md+) "견적서 비교" / "견적 요청 초안 만들기" hidden md:flex 보존
- [ ] §11.298d plain dropdown wiring 변경 0 (useState / role="menu" / aria-expanded 보존)
- [ ] `aiParseModalOpen` state name 보존 (내부 변수)

**Out of Scope:**

- AI 모달 내부 텍스트 변경 (외부 헤더 + toast만)
- "견적서 비교" / "견적 요청 초안 만들기" 라벨 변경
- BOM dropdown (∨) 변경
- §11.298d plain button + useState 패턴 변경

---

## 4. Product Constraints

**Must Preserve:**

- [x] same-canvas (page 추가 0)
- [x] canonical truth (API / mutation / state 변경 0)
- [x] §11.298d plain dropdown wiring
- [x] §11.248b 반응형 (flex-wrap lg:flex-nowrap) — 데스크탑 분기 보존

**Must Not Introduce:**

- [x] page-per-feature 회귀
- [x] dead button / no-op
- [x] Radix dropdown 부활 (호영님 §11.298d 제거 spec)
- [x] 새로운 라우트

---

## 5. Phases

### Phase 0: Context & Truth Lock — ✅ Complete

### Phase 1: Sentinel Test (RED)

- [ ] `__tests__/regression/quotes-header-mobile-scan-rename-307.test.ts` (NEW)
- [ ] regex assertion:
  - "파싱" literal 0 occurrence in quotes/page.tsx
  - "견적서 스캔" 또는 "스캔" 존재 (line 1956 swap 확인)
  - `import.*ScanLine` import line 25 정합
  - `<ScanLine` JSX 사용 line 1955
  - `<Upload` JSX 0 occurrence
  - DOM 순서: line 2028 "+ 새 견적 요청" Link → line 1950 ScanLine button → line 1987 "더보기" button (정규식 또는 indexOf 순서)
  - 액션 컨테이너에 `justify-end` 또는 ⋯ button container `ml-auto` 추가 (우측 끝 강제)
  - §11.298d 보존: `quote-header-more-actions-mobile` testid + `aria-expanded={isMobileMoreOpen}` + `role="menu"` + `role="menuitem"` 보존
  - AI 모달 toast "AI 견적서 스캔 완료" 정합 (line 4250)

### Phase 2: Minimal Diff Fix (GREEN)

- [ ] line 25: lucide-react import — `Upload` 제거, `ScanLine` 추가
- [ ] line 1955: `<Upload .../>` → `<ScanLine .../>`
- [ ] line 1956: `"견적서 파싱"/"파싱"` → `"견적서 스캔"/"스캔"`
- [ ] JSX 순서 swap (액션 컨테이너 line 1949 ~ 2046 안):
  - **새 순서**: PermissionGate "+ 새 견적 요청" (line 2028~2046) → ScanLine 스캔 button (line 1950~1957) → ⋯ 더보기 (line 1987~2027)
  - 결과: ⋯이 컨테이너 우측 끝 → `right-0` 드롭다운 viewport 안
- [ ] line 4243 주석 "AI 견적서 파싱 모달" → "AI 견적서 스캔 모달"
- [ ] line 4250 toast title "AI 견적서 파싱 완료" → "AI 견적서 스캔 완료"
- [ ] `aiParseModalOpen` state name 보존 (내부 변수, 사용자 미노출)

### Phase 3: Smoke & Commit Draft

- [ ] commit draft 작성
- [ ] present_files 카드 노출
- [ ] 호영님 push + Vercel READY
- [ ] 모바일 (375px) 실기기 또는 DevTools 재현:
  - 헤더 우측 [+ 새 견적 요청] [📷 스캔] [⋯] 순서
  - ⋯ 탭 → 드롭다운 "견적서 비교" / "견적 요청 초안 만들기" 글자 짤림 0
  - "파싱" 텍스트 0 occurrence (헤더 + AI 모달 toast)

---

## 6. Risk

| Risk | Probability | Impact | Mitigation |
| :--- | :--- | :--- | :--- |
| ScanLine 아이콘 lucide-react 미존재 | Low | Med | 타입 정의 grep 완료 (count 5 OK) |
| Upload 다른 곳 사용 → import 제거 시 깨짐 | Verified Low | High | grep `<Upload` line 1955 단 1곳 확인 |
| JSX 순서 swap 시 wrapping div 변경 → 스타일 회귀 | Med | Med | wrapping div / className 변경 0, 자식 element만 reorder |
| ⋯ 우측 끝 이동 후에도 좁은 viewport (320px)에서 짤림 | Low | Low | `right-0` 보존, max-w 추가 가능 (Phase 2 visual check 후 결정) |
| aiParseModalOpen state name 변경 시 다른 caller 깨짐 | N/A | N/A | 명시적 보존 (Out of Scope) |

---

## 7. Rollback

- Phase 2 Fails: `git revert <SHA>` — quotes/page.tsx + sentinel 1 file revert
- 영향 범위: 헤더 텍스트 / 아이콘 / 순서 + AI 모달 toast 텍스트 회귀

---

## 8. Notes

- §11.298d plain dropdown 패턴 (useState + role=menu) 보존 — Radix 부활 0
- §11.248b 반응형 (flex-wrap lg:flex-nowrap) 보존 — 데스크탑 분기 시각 동일
- 호영님 Q4 답변: 코드는 `right-0`인데 짤림 → ⋯ 위치가 화면 좌측 가까워서. JSX 순서 변경(3)이 이 root cause를 자연스럽게 해결.
