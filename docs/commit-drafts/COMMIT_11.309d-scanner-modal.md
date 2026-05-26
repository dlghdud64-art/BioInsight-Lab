# §11.309d Commit Message Draft (Scanner Modal + 진입점 swap)

```
feat(receiving): §11.309d #smart-receiving-scanner-modal — 스마트 입고 카메라 ScannerModal + Header/inventory 진입점 placeholder → 실제 swap (호영님 P0 backend MVP Phase D, 2026-05-26)

호영님 P0 spec (2026-05-26) backend MVP Phase D 종료:
스마트 입고 backend Phase A/B/C 완성 → Phase D UI swap. §11.308a-v2
placeholder modal 을 실제 카메라/갤러리 → OCR → 사용자 확인 form →
입고 등록 흐름으로 swap. MVP 신규 등록 분기 우선 (기존 매칭 분기는
§11.309d-2 후속 — catalog typeahead + fuzzy 후보 표시).

§11.309d 실행 전제 (확인됨):
- §11.309a-hotfix Vercel READY (sha 780b7358) — InventoryRestock 새 컬럼
- §11.309b Vercel READY (sha f6135322) — product-matcher lib (caller 별도)
- §11.309c Vercel READY (sha 호영님 push 후 확인) — /api/inventory/smart-receiving
- §11.308a-v2 Vercel READY (sha 2165827f) — Header 글로벌 진입점

Fix (3 file 수정/신규 + 1 NEW sentinel):

- apps/web/src/components/inventory/SmartReceivingScannerModal.tsx
  (NEW, ~470 line):
  · Dialog 기반 6-step state machine (upload / scanning / review /
    submitting / success / error)
  · upload step: <input type=file accept=image/* capture=environment>
    (모바일 카메라 직접 호출 + 갤러리 fallback) + [사진 선택/촬영] CTA
  · scanning step: POST /api/quotes/parse-image (§11.290 OCR pipeline 재사용)
    → ParsedQuoteDocument + ocrMetadata (jobId/providerUsed/cached)
  · review step: 사용자 form 9 필드 (productName / brand / catalogNumber /
    lotNumber / expirationDate / quantity / unit / storageCondition / notes)
    - extractInitialForm helper — OCR 결과 first item 으로 초기값 채움
    - 모든 필드 사용자 수정 가능 (LLM 인식 오류 흡수)
    - ConfidenceBadge + ProviderBadge + CacheHitIndicator (§11.290 패턴)
  · submitting step: POST /api/inventory/smart-receiving (§11.309c API)
    - ocrJobId + confirmedData payload
    - MVP: inventoryId 안 보냄 → server 가 신규 분기 처리 (Product create)
  · success step: CheckCircle2 + toast.success + [닫기]
  · error step: AlertTriangle + errorMessage + [다시 시도] / [닫기]
  · 입력 validation (productName 필수 + quantity > 0)
  · 모든 CTA 터치 영역 ≥ 44px (모바일 a11y)
  · dead button 0 — 모든 CTA real handler wiring

- apps/web/src/components/dashboard/Header.tsx:
  · SmartReceivingPlaceholderModal import → SmartReceivingScannerModal swap
  · <SmartReceivingScannerModal> 렌더 with onReceivingRegistered callback
    (헤더는 org context 없으므로 callback 안 invalidation, 사용자 재고
    페이지 이동 시 자동 fetch)
  · §11.308a-v2 헤더 button + isSmartReceivingOpen state 보존
  · Bell / Search / BarcodeScanFab / CommandPalette 변경 0

- apps/web/src/app/dashboard/inventory/inventory-main.tsx:
  · SmartReceivingPlaceholderModal import → SmartReceivingScannerModal swap
  · <SmartReceivingScannerModal> 렌더 with onReceivingRegistered callback:
    - queryClient.invalidateQueries(["inventories"])
    - queryClient.invalidateQueries(["team-inventory"])
    → 입고 등록 즉시 재고 list 갱신
  · §11.308a mobile + desktop entry button 보존

- apps/web/src/__tests__/regression/
  smart-receiving-scanner-modal-309d.test.ts (NEW, 21 it):
  · ScannerModal 14 it (file 존재 / export / Props / step state /
    OCR API call / smart-receiving API call / form 9 필드 / CTA testid +
    dead button 0 / 44px / Badge 3종 / ScanLine / toast / validation /
    camera capture)
  · Header swap 3 it (import swap / 렌더 swap / §11.308a-v2 button 보존)
  · inventory-main swap 3 it (import swap / 렌더 + invalidation /
    §11.308a entry button 보존)
  · PlaceholderModal 파일 보존 1 it (delete 0)

canonical truth 보존 (회귀 0):
- SmartReceivingPlaceholderModal 컴포넌트 파일 보존 (delete 0)
  → 다른 future placeholder 재사용 가능 (예: §11.310 dashboard 빠른 액션)
- §11.290 /api/quotes/parse-image route 변경 0 (caller 만 추가)
- §11.309c /api/inventory/smart-receiving route 변경 0
- §11.309b product-matcher lib 변경 0 (MVP 신규 등록 분기는 매칭 미사용,
  §11.309d-2 매칭 분기에서 호출 예정)
- §11.308a-v2 Header isSmartReceivingOpen state + button 변경 0
- §11.308a inventory-main entry button (mobile + desktop) 변경 0
- Bell / Search / BarcodeScanFab / Help / Profile / Menu 변경 0
- §11.243 OnboardingHero / AIInsightDialog 변경 0
- ProductCategory / InventoryRestock / OcrJob Prisma schema 변경 0

호영님 production effect:
1. labaxis.co.kr 모든 페이지 헤더 [📷] 탭 → 실제 ScannerModal:
   - 모바일: 카메라 바로 호출 (capture=environment) 또는 갤러리 선택
   - 데스크탑: 갤러리 파일 선택
   - 스캔 → AI 추출 → 사용자 확인 form → [입고 등록]
2. /dashboard/inventory mobile + desktop 진입점 [📷 스마트 입고] 동일 동작
3. 입고 등록 성공 시:
   - 신규 Product + ProductInventory 생성 (§11.309c 분기 B)
   - InventoryRestock create with ocrJobId + extractedData (감사 추적)
   - DataAuditLog INVENTORY_RESTOCK CREATE + source=smart_receiving
   - 재고 페이지에서 React Query invalidate → 즉시 노출
4. 호영님 현장 시나리오:
   - 물건 도착 → 헤더 📷 탭 → 거래명세서 촬영 → 추출 확인 → 입고 등록
   - 1탭으로 시작 → ~30초 내 완료

MVP 한계 (호영님 spec 정합 — 후속 batch 분리):
- 기존 매칭 분기 미사용 (모든 스캔 → 신규 Product 등록)
  → §11.309d-2 에서 catalog typeahead + fuzzy 후보 표시 + 매칭 선택 UI
- 거래명세서 다수 품목 일괄 입고 미지원 (현 first item 만 등록)
  → §11.309e 에서 items[] 반복 입력 + 일괄 등록
- PO 자동 매칭 미사용 (§11.290 Phase 4c-3 기능 — §11.309f 후속)

§11.309 시리즈 완료:
- §11.309a ✅ schema + Claude invoice 프롬프트
- §11.309a-hotfix ✅ ParsedQuoteVendor shape
- §11.309b ✅ 품목 매칭 lib (caller 별도)
- §11.309c ✅ /api/inventory/smart-receiving route
- §11.309d ✅ 본 batch — Scanner Modal + 진입점 swap (MVP 종료)

호영님 production smoke 권장 시나리오:
1. labaxis.co.kr 헤더 📷 탭 → modal 열림
2. [사진 선택/촬영] 탭 → 거래명세서 사진 선택 (예: 코람바이오 명세서)
3. ~3~5초 AI 분석 → review form 표시
4. productName 등 확인 + 수정 → [입고 등록]
5. ~1~2초 → "신규 품목 입고 등록 완료" toast
6. /dashboard/inventory → 신규 품목 노출 확인
7. /dashboard/audit → INVENTORY_RESTOCK CREATE + source=smart_receiving 확인

Rollback path: git revert <SHA>
- 4 file 복원 (ScannerModal NEW + Header swap + inventory-main swap + sentinel)
- 진입점은 PlaceholderModal 로 자동 회귀 (파일 보존되어 있음)
- API route / DB schema / OCR pipeline 영향 0
```

## Push

```powershell
cd C:\Users\young\ai-biocompare
git pull origin main

git add apps/web/src/components/inventory/SmartReceivingScannerModal.tsx `
  apps/web/src/components/dashboard/Header.tsx `
  apps/web/src/app/dashboard/inventory/inventory-main.tsx `
  apps/web/src/__tests__/regression/smart-receiving-scanner-modal-309d.test.ts `
  docs/commit-drafts/COMMIT_11.309d-scanner-modal.md

git status   # modified: 2 + untracked: 3
git commit -F docs/commit-drafts/COMMIT_11.309d-scanner-modal.md
git push origin main
```

## Production smoke (호영님 시나리오)

1. Vercel READY 확인
2. labaxis.co.kr 헤더 우측 📷 탭 → SmartReceivingScannerModal 열림
3. [사진 선택/촬영] → 거래명세서/라벨 이미지 선택
4. AI 분석 ~3-5초 → 추출 form 표시 (Confidence + Provider Badge)
5. 모든 필드 확인 + 수정 가능
6. [입고 등록] → POST /api/inventory/smart-receiving → 신규 Product +
   ProductInventory + InventoryRestock 자동 생성
7. toast "신규 품목 입고 등록 완료" + modal close
8. /dashboard/inventory 진입 → 신규 품목 노출 (재고 list invalidate)
9. /dashboard/audit (또는 audit dashboard) → INVENTORY_RESTOCK CREATE
   event 확인 (source: "smart_receiving")
```
