# §11.290 Phase 4b Commit Message Draft

## Commit message (호영님 클로드코드 환경에서 push)

```
feat(ocr): §11.290 Phase 4b LabelScannerModal review step ProviderBadge + CacheHitIndicator + ocrMetadata 응답 노출 (multi-provider fallback 결과 시각화)

호영님 P1 spec (2026-05-23):
Phase 4a (route swap) 완료 후 Phase 4b 진입. LabelScannerModal review
step 에 multi-provider fallback 결과 (providerUsed) + cache lookup 적중
(cached) 표시.

Fix (3 변경, minimum-diff):
- /api/inventory/scan-label/route.ts:
  · pipelineResult metadata outer scope retain (let ocrMetadata)
  · response JSON 에 ocrMetadata 필드 추가
    (null = regex fallback path)
  · §11.290 Phase 4b trace marker

- LabelScannerModal.tsx:
  · ScanApiResponse.ocrMetadata? optional field 추가
  · ProviderBadge 컴포넌트 NEW — 3 provider 분기
    (GEMINI=Gemini, CLOUD_VISION_CLAUDE=Vision+Claude, REGEX=정규식)
    data-testid="ocr-provider-badge"
  · CacheHitIndicator 컴포넌트 NEW — RotateCcw + "캐시 적중"
    data-testid="ocr-cache-hit"
  · Review step 강화 (ConfidenceBadge 옆 조건부 렌더)
  · flex-wrap 추가 (3+ badge 모바일 줄바꿈)

- __tests__/regression/label-scanner-metadata-290-p4b.test.ts (NEW, 12 it):
  · scan-label route 응답 (4 it — trace + retain + field + sub-field)
  · LabelScannerModal (8 it — 2 component + 2 testid + type + provider
    label + ConfidenceBadge 보존)

canonical truth 보존:
- ConfidenceBadge (이미 land) 보존 — 회귀 0
- ScanApiResponse 모든 기존 필드 (parsed/matchedProduct/matchedInventory/
  suggestions) 보존
- Review step 의 다른 UI element 변경 0
- STORAGE_PROVIDER 미설정 시 ocrMetadata default { providerUsed:
  "GEMINI", cached: false } → ProviderBadge "Gemini" 표시,
  CacheHitIndicator 미표시 (조건부)

Changes (4 files):
- apps/web/src/app/api/inventory/scan-label/route.ts
- apps/web/src/components/inventory/LabelScannerModal.tsx
- apps/web/src/__tests__/regression/label-scanner-metadata-290-p4b.test.ts (NEW)
- docs/decisions/ADR-002-pilot-tenant-seed.md (§11.290 Phase 4b entry)

Verification:
- vitest §11.290 p4b: 12/12 GREEN
- cluster (§11.290 p1 + p2 + p3 + p4a + p4b): 44/44 GREEN

호영님 production effect:
1. LabelScannerModal review step "Gemini" badge 표시 (현재 production)
2. Phase 5 후 STORAGE_PROVIDER 설정 + cache hit 시 "캐시 적중" 자동 표시
3. ConfidenceBadge + ProviderBadge + CacheHitIndicator 3 metadata 정합

Out of Scope (Phase 4c+):
- QuoteScannerModal NEW + receiving page trigger (Phase 4c)
- 2 신규 route (/api/ocr/retry + /api/ocr/correct) (Phase 4d)
- Cloud Vision/Claude SDK install + Vercel env (Phase 5)

Dependency chain:
- Phase 0~4a ✅ → Phase 4b ✅ (current)
- Phase 4c (QuoteScannerModal) → Phase 4d (2 신규 route) → Phase 5

Rollback path: git revert <SHA>
- 3 file revert + 1 test 삭제
- review step indicator 제거 → ConfidenceBadge 만 남음 → 회귀 0
```

## Files to stage

```
apps/web/src/app/api/inventory/scan-label/route.ts
apps/web/src/components/inventory/LabelScannerModal.tsx
apps/web/src/__tests__/regression/label-scanner-metadata-290-p4b.test.ts
docs/decisions/ADR-002-pilot-tenant-seed.md
docs/commit-drafts/COMMIT_11.290-p4b-label-scanner-metadata.md
```

## Push 절차 (호영님)

```bash
cd ~/ai-biocompare && git pull --ff-only

git add apps/web/src/app/api/inventory/scan-label/route.ts \
        apps/web/src/components/inventory/LabelScannerModal.tsx \
        apps/web/src/__tests__/regression/label-scanner-metadata-290-p4b.test.ts \
        docs/decisions/ADR-002-pilot-tenant-seed.md \
        docs/commit-drafts/COMMIT_11.290-p4b-label-scanner-metadata.md

git commit -F - <<'EOF'
... (위 commit message)
EOF

git push origin main
```

## Production smoke (Vercel READY 후)

1. iOS Safari / 데스크탑 → /dashboard/inventory → 시약 라벨 스캔
2. Review step 진입 → AI 분석 완료 옆 3 badge 확인:
   - "높은/보통/낮은 신뢰도" (ConfidenceBadge)
   - "Gemini" (ProviderBadge, 회색 outline)
   - "캐시 적중" (CacheHitIndicator) — Phase 5 후만 표시
3. 모바일에서 3 badge 줄바꿈 정상 (flex-wrap)
4. 기존 review step form (제품명/카탈로그번호/Lot 등) 정상 작동

## 다음 단계 (Phase 4c)

Phase 4c = QuoteScannerModal NEW + receiving page trigger
- LabelScannerModal 패턴 복제 (QuoteScannerModal.tsx NEW)
- 거래명세서 image / PDF 둘 다 trigger 가능
- receiving/[receivingId]/page.tsx 에 QuoteScannerModal trigger button 추가
- parse-image / parse-pdf route ocrMetadata 응답 추가 (Phase 4b 패턴 복제)
