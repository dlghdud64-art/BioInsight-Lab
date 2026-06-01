fix(search): §11.338 #quote-price-consistency — 견적 전 가격 모순 + 하단 바 잔존 정정 (호영님 P1, 2026-06-01)

호영님 P1 §11.338 (GREEN) — "견적 후 확정"이라면서 하단 견적 바에 확정 금액(₩18,000)
노출되던 모순 + 이전 시드 cart 잔존(다른 제품 PBS 1X) 정정.

배경 / 현상 (스크린샷 1780298358323):
- PBS-3 담기 시 우측 패널 "가격 문의 필요"/"견적 시 안내" + 토스트 "견적 후 확정"인데
  하단 바는 ₩18,000(확정 금액) = 한 화면 상반된 진실.
- 하단 바 품목명도 담은 PBS-3 아닌 "PBS 1X 1L"(이전 시드).

Truth Reconciliation (진단):
- 원인 1: 하단 바(search/page.tsx:1562) ₩{totalAmount} 무조건 표시. totalAmount = Σ lineTotal.
  · add-product-to-quote.ts:126 unitPrice = priceInKRW || 0 → import(price null) 제품은 unitPrice=0
    (vendor-pending, 정상). 그러나 합산/표시가 미견적 0원도 금액으로 노출 → 정책 위반.
- 원인 2: test-flow-provider localStorage("quote-cart-storage") cart 복원 → 이전 테스트의
  시드 제품(PBS 1X, prisma/seed.ts ₩18,000)이 잔존, 하단 바에 표시.
- 우측 패널(product-detail-summary:138/142)은 미견적 시 "가격 문의 필요"/"견적 시 안내" 정상 →
  하단 바만 정책 위반.

호영님 결정 (둘 다 권장안):
- 하단 바: 확정가(unitPrice>0)만 합산 + "N건 가격 미정" 표기(compare 페이지 기존 패턴 정합).
- cart 잔존: DB 검증보다 근본적인 STORAGE_KEY 버전 무효화.

Fix (file 별):

- src/app/_workbench/search/page.tsx:
  · totalAmount = unitPrice>0 항목의 lineTotal 만 합산(미견적 제외).
  · priceUnknownCount(미견적 건수) + hasConfirmedPrice 계산.
  · 하단 바: hasConfirmedPrice 면 ₩합계, 아니면 "견적 후 확정". priceUnknownCount>0 시
    "· N건 가격 미정" 부기. data-testid="quote-bar-total".

- src/app/_workbench/_components/test-flow-provider.tsx:
  · STORAGE_KEY "quote-cart-storage" → "quote-cart-storage-v2"(가격 정책 변경 정합).
  · LEGACY_STORAGE_KEYS 복원 시 removeItem → 이전 시드(PBS 1X ₩18,000) cart 1회 무효화.
  · 향후 cart 구조 변경 시 버전 ++.

canonical truth / 제약 (§11.335/§11.318):
- 가격 = 견적 회신으로 확정된 값만 표시. 시스템 추측/시드 가격 노출 금지(환각 방지).
- 한 화면 가격 진실 1개(패널/토스트/하단 바 = "견적 후 확정" 일관).
- 우측 패널 기존 정상 동작 보존.

production effect:
- 미견적 제품(import) 담기 → 하단 바 "견적 후 확정 · N건 가격 미정"(₩금액 모순 사라짐).
- 확정가 있는 제품(견적 회신 후) → ₩합계 정상 표시.
- 새로고침 시 이전 시드 cart(PBS 1X ₩18,000) 자동 제거.

검증 (sandbox):
- sentinel quote-price-consistency-338.test.ts 12/12 PASS(확정가 합산/미견정 카운트/표시 분기/
  STORAGE_KEY v2/legacy 제거/패널 보존).
- 2파일 brace/paren 무결. truncation 0(search delta=추가분 일치).
- 빌드 = 호영님 env.

E2E (호영님 env — 배포 후):
- PBS-3(미견적) 담기 → 하단 바 "견적 후 확정 · 1건 가격 미정"(₩18,000 안 뜸).
- 새로고침 → 이전 PBS 1X 잔존 사라짐.
- 확정가 제품 담기 → ₩합계 정상.

Out of Scope:
- 시드 제품(prisma/seed.ts PBS 1X) 자체 정리 — 데모/테스트용, 별도 판단.
- DB 실시간 가격 검증(복원 시) — STORAGE_KEY 버전으로 대체(더 단순/근본적).

Rollback path: git revert <SHA>
- totalAmount 단순 합산 복원, STORAGE_KEY v1 복원.

## Push
```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
cd apps\web; npx next build
cd ..\..
git add apps/web/src/app/_workbench/search/page.tsx `
  apps/web/src/app/_workbench/_components/test-flow-provider.tsx `
  apps/web/src/__tests__/regression/quote-price-consistency-338.test.ts `
  docs/commit-drafts/COMMIT_11.338-quote-price-consistency.md
git commit -F docs/commit-drafts/COMMIT_11.338-quote-price-consistency.md
git push origin main
```

## Next
- 배포 후 §11.337-v2 + §11.338 함께 E2E(검색 정밀도 + 배지 + 가격 정합) → Cat.No 동선 종결.
