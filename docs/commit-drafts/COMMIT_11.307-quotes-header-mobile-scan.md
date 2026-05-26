# §11.307 Commit Message Draft (견적 관리 모바일 헤더 3건)

```
feat(quotes): §11.307 #quotes-header-mobile-scan — 견적 관리 헤더 모바일 3건 (호영님 P1)

호영님 P1 spec (2026-05-26):
(1) "견적서 파싱" → "견적서 스캔" 명칭 정합 (사용자 용어)
(2) Upload icon (📤) → ScanLine icon (문서 읽어들이는 동작에 정합)
(3) 모바일 버튼 순서 [+ 새 견적 요청] → [📷 스캔] → [⋯ 더보기]
    + ⋯ 드롭다운 글자 짤림 fix (호영님 IMG_5672 "견" 짤림)

진짜 root cause (sandbox 진단 2026-05-26):
- 모바일 (375px) line 1940 부모 flex-col → 액션 그룹 별도 row
- line 1949 액션 컨테이너 flex-wrap + justify-end 없음 → 좌측 정렬
- ⋯ button 위치 x ≈ 122~142px (좌측 가까움)
- 드롭다운 right-0 w-52(208px) → 좌측 -66px (viewport 밖) → "견" 짤림
- Fix: JSX 순서 변경 ⋯ → 컨테이너 우측 끝 이동 → right-0 viewport 안

Fix (1 file 5 changes + 1 NEW sentinel):

- apps/web/src/app/dashboard/quotes/page.tsx (5 swap):
  · line 25 import: lucide-react `Upload` 제거 + `ScanLine` 추가
  · line 1955 헤더 icon: `<Upload>` → `<ScanLine>` (className 동일)
  · line 1956 헤더 라벨: "견적서 파싱"/"파싱" → "견적서 스캔"/"스캔"
  · line 4243 AI 모달 주석: "AI 견적서 파싱 모달" → "AI 견적서 스캔 모달"
  · line 4250 toast title: "AI 견적서 파싱 완료" → "AI 견적서 스캔 완료"
  · 헤더 액션 컨테이너 JSX reorder (line 1949 ~ 2066 안):
    - 새 순서: [+ 새 견적 요청 + ∨ BOM dropdown] (PermissionGate)
      → [견적서 비교] (hidden md:inline-flex)
      → [견적 요청 초안 만들기] (hidden md:flex)
      → [📷 스캔]
      → [⋯ 더보기] (md:hidden)
    - 모바일 (md 미만) 노출: [+ 새 요청 ∨] [📷 스캔] [⋯]
    - 데스크탑 (md+) 노출: [+ 새 요청 ∨] [견적서 비교] [초안 만들기] [📷 스캔]
    - ⋯이 컨테이너 마지막 → 우측 끝 → absolute right-0 viewport 안

- apps/web/src/__tests__/regression/
  quotes-header-mobile-scan-rename-307.test.ts (NEW, 14 it):
  · (1) "스캔" 등장 + "파싱" 0 occurrence (헤더 + AI 모달 toast)
  · (2) ScanLine import + JSX 사용 + Upload 0 occurrence
  · (3) DOM 순서 정합 (새 견적 요청 < 스캔 < 더보기 button) +
        ⋯ 드롭다운 right-0 보존
  · §11.298d 보존 (isMobileMoreOpen useState + aria-expanded +
    role=menu + role=menuitem + Radix import 0)
  · §11.248b 반응형 보존 (flex-wrap lg:flex-nowrap +
    견적서 비교 hidden md:inline-flex + 초안 hidden md:flex)
  · aiParseModalOpen state name 보존 (내부 변수, 사용자 미노출)

canonical truth 보존 (회귀 0):
- aiParseModalOpen state name 보존 (호영님 spec — 내부 변수)
- AiQuoteParseModal 컴포넌트 wiring 변경 0 (props 동일)
- runAiQuoteCompare / openQuoteDraftWorkbench 변경 0
- §11.248b 반응형 분기 (flex-wrap lg:flex-nowrap) 보존
- §11.298d plain dropdown (useState + role=menu) 보존
- BOM dropdown (∨) 변경 0 (line 2036~2063)
- PermissionGate permission="quotes.create" 보존

호영님 production effect:
1. 모바일 (375px) labaxis.co.kr/dashboard/quotes 헤더:
   - 이전 순서: [📤 파싱] [⋯ 더보기] [+ 새 요청 ∨]
   - 변경 순서: [+ 새 요청 ∨] [📷 스캔] [⋯ 더보기]
   - ⋯ 우측 끝 → 드롭다운 "견적서 비교" / "견적 요청 초안 만들기" 글자 짤림 0
2. 데스크탑 (md+) 헤더:
   - 순서: [+ 새 요청 ∨] [견적서 비교] [초안 만들기] [📷 스캔]
   - 데스크탑 시각 변화 — 비교/초안이 새 요청 옆에 직접 노출 (이전과 유사)
3. AI 모달 진입 시 toast: "AI 견적서 스캔 완료" (이전 "파싱 완료")
4. "파싱" 텍스트 0 occurrence (헤더 + AI 모달 toast, 사용자 노출 텍스트)

Out of Scope (defer):
- aiParseModalOpen state 이름 변경 (내부 변수, 호영님 spec 보존)
- AiQuoteParseModal 컴포넌트 내부 텍스트 (외부 헤더 + toast만)
- 견적서 비교 / 초안 만들기 라벨 변경
- BOM dropdown ∨ 라벨 변경
- §11.298d plain button + useState 패턴 변경
- 견적서 비교를 ⋯ 안으로 흡수 (현재 md+ 직접 노출 보존, 호영님 spec 선택)

Rollback path: git revert <SHA>
- 1 file (quotes/page.tsx) + 1 sentinel revert
- 헤더 텍스트 / 아이콘 / 순서 + AI 모달 toast 회귀

§11.307 후속 sub-batch (필요 시):
- 견적서 비교를 ⋯ 안으로 흡수 (모바일 vertical space 추가 확보)
- aiParseModalOpen → aiScanModalOpen rename (대규모 state name swap)
- AI 모달 내부 텍스트 ("파싱" → "스캔") swap
```

## Push

```powershell
git add `
  apps/web/src/app/dashboard/quotes/page.tsx `
  apps/web/src/__tests__/regression/quotes-header-mobile-scan-rename-307.test.ts `
  docs/plans/PLAN_11.307-quotes-header-mobile.md `
  docs/commit-drafts/COMMIT_11.307-quotes-header-mobile-scan.md

git commit -F docs/commit-drafts/COMMIT_11.307-quotes-header-mobile-scan.md
git push origin main
```

## Production smoke

1. Vercel deployment SUCCESS 확인
2. 모바일 (375px) labaxis.co.kr/dashboard/quotes:
   - 헤더 우측 [+ 새 견적 요청 ∨] [📷 스캔] [⋯] 순서
   - ⋯ 탭 → 드롭다운 "견적서 비교" / "견적 요청 초안 만들기" 글자 짤림 0
   - "파싱" 텍스트 0 (헤더)
3. 데스크탑 (md+):
   - [+ 새 견적 요청 ∨] [견적서 비교] [초안 만들기] [📷 스캔]
   - 견적서 비교 / 초안 만들기 disabled 분기 보존
4. AI 모달 진입 → toast "AI 견적서 스캔 완료"
5. BOM dropdown ∨ 동작 변화 0
