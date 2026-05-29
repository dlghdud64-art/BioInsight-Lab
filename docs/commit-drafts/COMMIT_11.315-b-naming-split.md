refactor(ui): §11.315-b #smart-receiving-naming-split — 라벨 OCR 모달 명칭 '스마트 입고' → '스마트 재고 등록' 분리 (호영님 P1 옵션 B, spec Part C, 2026-05-28)

호영님 P1 옵션 B (spec Part C — 명칭 분리, §11.315-a 후속).

배경 (§11.315 spec Part B/C 조사 결과):
- 재고 관리/소싱/global-modal 등에서 노출되던 "스마트 입고 (AI 스캔)"은
  사실 LabelScannerModal — reagent **라벨 OCR → 재고 직접 등록**(PO 없음).
- 대시보드 헤더 + 308e 본문 카드 + inventory-main "스마트 입고"는
  SmartReceivingScannerModal(§11.309d) — **거래명세서 → PO 매칭 → 입고 처리**.
- 두 컴포넌트가 진짜 다른 용도인데 라벨이 같아 운영자 혼동 + 같은 화면에 두 입구
  공존(스크린샷 IMG_5699/5700).

해결 (옵션 B 경량, 컴포넌트 동작/라우팅/wiring 변경 0 — UX 라벨/제목만 swap):
- LabelScannerModal 계열 = "스마트 재고 등록 (AI 라벨 스캔)"
- SmartReceivingScannerModal 계열 = "스마트 입고" 유지

Fix (3 source swap + 1 cosmetic + 1 sentinel, 총 5 file):

- apps/web/src/components/inventory/LabelScannerModal.tsx:
  · onDirectReceive prop comment "스마트 입고:" → "§11.315-b — 스마트 재고 등록: ... 라벨 OCR → 재고 직접 추가, PO 없음"
  · <h3> 제목 (line 405) "스마트 입고 (AI 스캔)" → "스마트 재고 등록 (AI 라벨 스캔)"
  · <SheetTitle> (mobile, line 839) 동일 swap
  · <DialogTitle> 인접 텍스트 (desktop, line 853) 동일 swap

- apps/web/src/app/dashboard/inventory/inventory-content.tsx:
  · ActionMenu items label "스마트 입고" → "스마트 재고 등록" (line 1362)
  · Primary CTA 주석 "스마트 입고" → "스마트 재고 등록" + §11.315-b 분리 설명 (line 1505)
  · Primary CTA Button text "스마트 입고" → "스마트 재고 등록" (line 1512)

- apps/web/src/components/global-modal.tsx:
  · MODAL_REGISTRY label_scanner.defaultTitle "스마트 입고 (AI 스캔)" → "스마트 재고 등록 (AI 라벨 스캔)"
  · defaultSubtitle "재고에 등록" → "재고에 직접 등록" (의미 강화)

- apps/web/src/__tests__/inventory/scan-conflict-banner-253.test.ts (cosmetic):
  · docblock 라벨 정합 (test 동작 영향 0)

- apps/web/src/__tests__/regression/
  smart-receiving-naming-split-315b.test.ts (NEW, ~10 it):
  · LabelScannerModal 3곳 새 라벨 + 옛 라벨 0 + onDirectReceive 의미 정합
  · inventory-content ActionMenu label + Primary CTA Button text swap
  · global-modal defaultTitle swap + "스마트 입고" defaultTitle 0
  · 회귀 가드: SmartReceivingScannerModal/Header/308e/inventory-main
    의 "스마트 입고" 보존 (PO 입고 surface 유지)

canonical truth 보존 (회귀 0):
- onScanComplete/onDirectReceive callback wiring 변경 0
- setIsSmartReceiveOpen state 변수명 보존 (display 노출 없음, internal)
- LabelScannerModal/SmartReceivingScannerModal 라우팅·API call 변경 0
- 헤더/308e/inventory-main 의 "스마트 입고" button + aria-label 보존 (회귀 가드 sentinel)
- /api/inventory/scan-label / /api/quotes/parse-image / /api/inventory/smart-receiving 영향 0

호영님 production effect:
1. 재고 관리 ActionMenu "스마트 재고 등록", Primary CTA "스마트 재고 등록" Button.
2. 라벨 OCR 모달 제목 = "스마트 재고 등록 (AI 라벨 스캔)" (의미 정확).
3. 대시보드 헤더 ScanLine button "스마트 입고" 그대로 (거래명세서/PO).
4. 308e 본문 카드 "스마트 입고" 그대로 (헤더 awareness).
5. inventory-main 의 SmartReceivingScannerModal trigger "스마트 입고" 그대로.
→ 두 기능이 명칭으로 명확히 분리 — 운영자 혼동 0.

Out of Scope (⚠️ 본 batch 미포함):
- spec Part B "입고 1-flow Step 1 통합" — 두 컴포넌트가 다른 용도이므로 통합은
  의미 충돌(canonical truth 위반). 명칭 분리만 진행 (호영님 옵션 B 확정).
- state 변수명 setIsSmartReceiveOpen → setIsRegisterOpen 같은 internal rename
  (display 노출 없음, scope 최소화 — small batch 유지).

검증 (sandbox 정적):
- "스마트 입고 (AI 스캔)" application-wide grep 0
- LabelScannerModal 내 "스마트 입고" 0 (전부 swap)
- "스마트 입고" 잔존 = SmartReceivingScannerModal/Header/308e/inventory-main 컨텍스트만 (legit)
- "스마트 재고 등록" 새 라벨 7곳 노출 (LabelScannerModal 3 + inventory-content 3 + global-modal 1)
- 컴포넌트 동작/wiring 변경 0 — 라벨/제목/주석만

Rollback path: git revert <SHA>
- 옛 "스마트 입고 (AI 스캔)" 라벨 복원 + sentinel 삭제 (라벨만 되돌림, 동작 무영향)

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
git add apps/web/src/components/inventory/LabelScannerModal.tsx `
  apps/web/src/app/dashboard/inventory/inventory-content.tsx `
  apps/web/src/components/global-modal.tsx `
  apps/web/src/__tests__/inventory/scan-conflict-banner-253.test.ts `
  apps/web/src/__tests__/regression/smart-receiving-naming-split-315b.test.ts `
  docs/commit-drafts/COMMIT_11.315-b-naming-split.md
git status
git commit -F docs/commit-drafts/COMMIT_11.315-b-naming-split.md
git push origin main
```

## Production smoke

1. Vercel READY 확인
2. /dashboard/inventory → 더보기/우측 액션 메뉴 → "스마트 재고 등록" label 노출 (옛 "스마트 입고" 0)
3. /dashboard/inventory → Primary CTA "스마트 재고 등록" Button → 모달 제목 "스마트 재고 등록 (AI 라벨 스캔)"
4. /dashboard → 헤더 ScanLine button (스마트 입고) → SmartReceivingScannerModal 정상(보존)
5. /dashboard → 본문 308e 카드 "스마트 입고" 그대로(보존)
6. /dashboard/inventory → mobile/desktop view 의 inventory-main "스마트 입고" button 보존
