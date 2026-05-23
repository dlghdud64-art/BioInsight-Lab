# §11.290 Phase 4e Commit Message Draft

## Commit message (호영님 클로드코드 환경에서 push)

```
feat(ocr): §11.290 Phase 4e LabelScannerModal + QuoteScannerModal retry CTA wiring (Phase 4d retry route 의 첫 caller)

호영님 P1 spec (2026-05-23):
Phase 4d (retry + correct route NEW skeleton) 완료 후 Phase 4e 진입.
2 modal 의 review step 에서 사용자가 confidence 낮은 결과 받았을 때
provider swap 재처리 trigger 가능.

Lock:
- jobId (ocrMetadata.jobId) null 시 disabled
  (현재 production STORAGE_PROVIDER 미설정 default)
- 503 graceful alert ("Phase 5 후 활성")
- dead button 0 (disabled + title 안내 명확)

Fix (2 modal review step 강화 + 1 sentinel test):
- LabelScannerModal.tsx review step badge row 옆에 retry button:
  · type="button" / disabled={!scanResult?.ocrMetadata?.jobId}
  · data-testid="ocr-retry-button"
  · RotateCcw icon + "재처리" label
  · title attribute (jobId 존재시 "다른 OCR provider로 재처리"
    / 미존재시 "재처리는 Phase 5 활성 후 가능")
  · onClick: csrfFetch POST /api/ocr/retry/${jobId}
    → 503 alert / !ok alert / ok "재처리 완료 (Phase 5 wiring 후 결과 자동 반영)"

- QuoteScannerModal.tsx review step 동일 패턴 복제

canonical truth 보존:
- 기존 ConfidenceBadge / ProviderBadge / CacheHitIndicator 보존
- review step 다른 UI element 변경 0
- ScanApiResponse / QuoteScanApiResponse type 변경 0
- csrfFetch 호출 패턴 정합 (기존 scan 요청과 동일)
- RotateCcw icon 재활용 (이미 import)

Changes (4 files):
- apps/web/src/components/inventory/LabelScannerModal.tsx (review step badge row 안 button block, ~35 line)
- apps/web/src/components/inventory/QuoteScannerModal.tsx (review step badge row 안 동일 button block, ~35 line)
- apps/web/src/__tests__/regression/modal-retry-cta-290-p4e.test.ts (NEW, 8 it × 2 describes)
- docs/decisions/ADR-002-pilot-tenant-seed.md (§11.290 Phase 4e entry)

Verification:
- vitest §11.290 p4e: 8/8 GREEN
- cluster (§11.290 Phase 4 family): 55/55 GREEN

호영님 production effect:
1. LabelScannerModal review step "재처리" button 표시 (현재 disabled, jobId null)
2. QuoteScannerModal review step 동일
3. Phase 5 STORAGE_PROVIDER 설정 후 자동 enabled
   → 사용자 클릭 시 Cloud Vision+Claude provider swap 재처리

Out of Scope (Phase 4e-2 / 5):
- correct (수동 보정) CTA wiring — modal form submit 시
  POST /api/ocr/correct/[jobId] 호출 wiring (별도 batch)
- Phase 5 SDK install + Vercel env
- retry 성공 시 결과 자동 반영 (현재 alert만 — Phase 5 후
  setScanResult swap)

Dependency chain:
- Phase 0~4d ✅ → Phase 4e ✅ (current)
- Phase 4e-2 (correct CTA wiring) or Phase 5 (env + smoke)

Rollback path:
$ git revert <SHA>
- 2 modal review step button block 제거 + 1 test 삭제
- 재처리 button 미존재, 회귀 0
```

## Files to stage

```
apps/web/src/components/inventory/LabelScannerModal.tsx
apps/web/src/components/inventory/QuoteScannerModal.tsx
apps/web/src/__tests__/regression/modal-retry-cta-290-p4e.test.ts
docs/decisions/ADR-002-pilot-tenant-seed.md
docs/commit-drafts/COMMIT_11.290-p4e-modal-retry-cta.md
```

## Push 절차 (호영님)

```bash
cd ~/ai-biocompare && git pull --ff-only

git add apps/web/src/components/inventory/LabelScannerModal.tsx \
        apps/web/src/components/inventory/QuoteScannerModal.tsx \
        apps/web/src/__tests__/regression/modal-retry-cta-290-p4e.test.ts \
        docs/decisions/ADR-002-pilot-tenant-seed.md \
        docs/commit-drafts/COMMIT_11.290-p4e-modal-retry-cta.md

git commit -F - <<'EOF'
... (위 commit message)
EOF

git push origin main
```

## Production smoke (Vercel READY 후)

1. iOS Safari / 데스크탑 → 라벨/거래명세서 scan → review step 진입
2. AI 분석 완료 옆 metadata badges 중 "재처리" button 표시
3. 현재 disabled state (Phase 5 이전, jobId null) — title attribute
   에서 "재처리는 Phase 5 활성 후 가능" 안내
4. (수동 테스트) button click 시 disabled → no-op (사용자에게 dead-end
   회피)
5. Phase 5 후: button enabled → click → 새 provider swap result 반영

## 다음 단계 결정

호영님 push 후 결정:
- **Phase 4e-2:** correct (수동 보정) CTA wiring — modal form 강화
  + POST /api/ocr/correct/[jobId] 호출
- **Phase 4c-3:** receiving page onScanComplete handler 의 PO 매칭 +
  입고 자동 prefill
- **Phase 5:** Cloud Vision/Claude SDK install + Vercel env
  (STORAGE_PROVIDER, BLOB_READ_WRITE_TOKEN, GOOGLE_VISION_API_KEY,
  ANTHROPIC_API_KEY) + production smoke
- **Phase 4e-2 + 5 통합:** correct CTA + Vercel env 동시 land
