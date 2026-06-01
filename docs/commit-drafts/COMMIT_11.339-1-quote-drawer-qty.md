feat(sourcing): §11.339-1 #quote-drawer-qty — 견적 후보 드로어 수량 조절 + 가격 정합 (호영님 P2, 2026-06-01)

호영님 P2 §11.339 1단계(즉시 정정 3종, GREEN) — 견적 후보 드로어에 수량 조절 추가.
우측 rail 통합 재설계(2단계)는 §11.337 Part C 와 묶어 별도.

배경 / 현상 (스크린샷 1780298551817 등):
- (1) 열기 트리거가 초록 동그라미 숫자만 클릭 가능.
- (2) 드로어 후보 전체 노란 하이라이트(눈 피로 + §11.302 위반).
- (3) 수량 조절 부재(견적 = 품목×수량 핵심인데).

Truth Reconciliation (진단):
- (1) 트리거: search/page.tsx:1533 button 이 FileText+"견적"+배지+미리보기 전체 클릭 가능 = 이미 충족.
  호영님 화면 = 이전 배포본(§11.312 이후 land).
- (2) 노랑: SourcingCandidatesSheet:234 q.reviewReason 있을 때만 yellow-50, 나머지 white = 이미 §11.302 정합.
  전 항목 노랑은 §11.337-v2 배포 전 전부 reviewReason 가졌던 것(정정됨).
- (3) 수량: CandidateQuoteItem 에 quantity/unit 부재, UI 없음 = 실제 신규 작업. updateQuoteItem(context) 존재.

Fix (file 별):

- src/components/sourcing/SourcingCandidatesSheet.tsx:
  · CandidateQuoteItem 에 quantity?/unit? 필드 추가.
  · onQuantityChange?(itemId, quantity) prop.
  · 각 후보 행에 수량 조절 UI(− / number input / +). 기본 1, min 1, 단위(q.unit) 표시. data-testid="candidate-qty".
  · §11.338 정합: 후보 가격 표시 미견적 시 "견적 후 확정"(price>0 일 때만 금액).

- src/app/_workbench/search/page.tsx:
  · quoteItems 매핑에 quantity: q.quantity ?? 1, unit: q.unit ?? product.unit ?? null 추가.
  · onQuantityChange={(id, quantity) => updateQuoteItem(id, { quantity })} 연결.
    (updateQuoteItem 이 lineTotal = quantity × unitPrice 재계산 → §11.338 하단 바 합산 자동 정합.)
  · §11.338 정합: price 매핑 lineTotal fallback 제거(미견적 = null → "견적 후 확정").

canonical truth / 제약:
- 수량 = quoteItems 상태(updateQuoteItem) 단일 소스. 견적 요청서(§11.331)에 품목별 수량 전달.
- §11.302 색상(노랑=실제 주의 항목만) 보존. §11.338 가격(견적 후 확정) 정합.
- dead button 0(수량 버튼 real wiring). same-canvas(기존 드로어 구조 유지).

production effect:
- 견적 후보 드로어에서 각 품목 수량 −/+/직접입력. 수량 변경 시 하단 바 합계 자동 갱신(확정가 항목).
- 미견적 항목 가격 "견적 후 확정"(₩0/모순 제거).

검증 (sandbox):
- sentinel quote-drawer-qty-339.test.ts: quantity/unit 타입 + onQuantityChange + 수량 UI(−/+/aria) +
  호출부 매핑/wiring + §11.302 노랑 보존 + §11.338 가격. 전체 PASS.
- 2파일 brace/paren 무결. truncation 0(Sheet +35 / page +4 = 추가분 일치).
- 빌드 = 호영님 env.

Out of Scope (2단계 = 별도):
- §11.339 우측 rail 통합 재설계(견적 후보 상시 표시) — §11.337 Part C 와 묶어 Opus 4.8 별도 batch.
- 트리거/노랑은 이미 충족 → 코드 변경 없음(배포 후 호영님 화면 재확인).

Rollback path: git revert <SHA>
- CandidateQuoteItem quantity/unit + 수량 UI + onQuantityChange 제거, price 매핑 원복.

## Push
```powershell
cd C:\Users\young\ai-biocompare
git pull origin main
cd apps\web; npx next build
cd ..\..
git add apps/web/src/components/sourcing/SourcingCandidatesSheet.tsx `
  apps/web/src/app/_workbench/search/page.tsx `
  apps/web/src/__tests__/regression/quote-drawer-qty-339.test.ts `
  docs/commit-drafts/COMMIT_11.339-1-quote-drawer-qty.md
git commit -F docs/commit-drafts/COMMIT_11.339-1-quote-drawer-qty.md
git push origin main
```

## Production smoke (호영님 env)
1. 견적 후보 3개 담기 → 하단 "견적 N" 라벨 영역(글자+배지) 클릭 → 드로어 열림.
2. 각 후보 행에 수량 −/입력/+ 노출. 수량 변경 → 하단 바 합계(확정가 항목) 갱신.
3. 후보 중 reviewReason 없는 항목 = 흰 배경(전 항목 노랑 아님).
4. 미견적 항목 가격 "견적 후 확정" 표시.
5. 견적 요청 → 품목별 수량 전달 확인.

## Next
- 2단계 우측 rail 통합(§11.339 옵션 A + §11.337 Part C) — 검색/가격 P1 안정 후 Opus 4.8.
