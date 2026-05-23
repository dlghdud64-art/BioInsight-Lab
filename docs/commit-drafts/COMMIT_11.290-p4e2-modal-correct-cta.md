# §11.290 Phase 4e-2 Commit Message Draft

## Commit message (호영님 클로드코드 환경에서 push)

```
feat(ocr): §11.290 Phase 4e-2 LabelScannerModal "보정 저장" CTA wiring + Phase 4d test 파일 truncate 복구 (Phase 4d correct route 의 첫 caller)

호영님 P1 spec (2026-05-23):
Phase 4e (retry CTA wiring) 완료 후 Phase 4e-2 진입. LabelScannerModal
의 formData (SmartReceiveFormData) 활용 — 사용자가 form input 편집한
결과를 correctedFields body 로 POST /api/ocr/correct/[jobId] 호출.

Lock:
- jobId null 시 disabled
- 503 graceful alert ("Phase 5 후 활성")
- dead button 0 (disabled + title 안내)

Fix (1 modal review step button + 1 sentinel test + 1 test 복구):
- LabelScannerModal.tsx review step badge row 옆 correct button (~45 line):
  · type="button" / disabled={!scanResult?.ocrMetadata?.jobId}
  · data-testid="ocr-correct-button"
  · Edit icon + "보정 저장" label / blue tone
    (retry gray 와 시각 구분)
  · onClick: formData → correctedFields 매핑 (productName/catalogNo/lotNo/
    expirationDate/brand/casNumber/quantity) → csrfFetch POST
    /api/ocr/correct/${jobId}
  · 503 graceful alert / !ok alert / ok "보정 저장 완료 (Phase 5 wiring 후
    결과 자동 반영)"
  · title attribute (jobId 존재시 "사용자 보정 결과 저장 (Phase 5 후 OcrResult
    INSERT)" / 미존재시 "수동 보정 저장은 Phase 5 활성 후 가능")

- modal-correct-cta-290-p4e2.test.ts (NEW, 6 it):
  · trace + testid + path + correctedFields body + jobId guard +
    Phase 4e retry button 보존 검증

- ocr-retry-correct-routes-290-p4d.test.ts 복구:
  · 호영님 push 과정에서 truncate 발생 (line 115 incomplete it block)
  · describe close + last 2 it (jobId path + organizationId 격리) 복구

canonical truth 보존:
- Phase 4e retry button 보존 (회귀 0)
- formData / setFormData / updateField / mapScanToForm 보존
- ScanApiResponse type / SmartReceiveFormData interface 변경 0
- review step 다른 UI element 변경 0
- Edit icon 재활용 (이미 import)
- csrfFetch + JSON.stringify 패턴 정합
- Phase 4d correct route 의 correctedFields body shape 정합

Changes (4 files):
- apps/web/src/components/inventory/LabelScannerModal.tsx
- apps/web/src/__tests__/regression/modal-correct-cta-290-p4e2.test.ts (NEW, 6 it)
- apps/web/src/__tests__/regression/ocr-retry-correct-routes-290-p4d.test.ts (truncate 복구, +12 line)
- docs/decisions/ADR-002-pilot-tenant-seed.md (§11.290 Phase 4e-2 entry)

Verification:
- vitest §11.290 p4e-2: 6/6 GREEN
- §11.290 p4d (복구 후): 14/14 GREEN
- cluster (§11.290 p4 family): 29/29 GREEN

호영님 production effect:
1. LabelScannerModal review step "재처리" + "보정 저장" 2 button 표시
   (gray + blue tone 시각 구분)
2. Phase 5 후 STORAGE_PROVIDER 설정 → enabled → 사용자가 form input
   편집 후 클릭 → OcrResult INSERT (provider=MANUAL, confidence=1.0)
   + status SUCCESS 전환
3. QuoteScannerModal correct CTA 는 풀스펙 form 필요로 별도 batch

Out of Scope (Phase 4e-3 / 4c-3 / 5):
- QuoteScannerModal correct CTA (풀스펙 form 필요)
- Phase 5 SDK install + Vercel env
- correct 성공 시 결과 자동 반영 (현재 alert만)
- Phase 4c-3 PO 매칭 + 입고 자동 prefill

Dependency chain:
- Phase 0~4e ✅ → Phase 4e-2 ✅ (current)
- Phase 4e-3 (Quote correct) or Phase 5 (env + smoke)

Rollback path: git revert <SHA>
- LabelScannerModal button block 제거 + test 삭제
- Phase 4d test 다시 truncate 됨 → 별도 fix 필요 (Phase 4e-2 와 같은 batch 유지)
- 회귀 0 (Phase 4e retry button 보존)
```

## Files to stage

```
apps/web/src/components/inventory/LabelScannerModal.tsx
apps/web/src/__tests__/regression/modal-correct-cta-290-p4e2.test.ts
apps/web/src/__tests__/regression/ocr-retry-correct-routes-290-p4d.test.ts
docs/decisions/ADR-002-pilot-tenant-seed.md
docs/commit-drafts/COMMIT_11.290-p4e2-modal-correct-cta.md
```

## Push 절차 (호영님)

```bash
cd ~/ai-biocompare && git pull --ff-only

git add apps/web/src/components/inventory/LabelScannerModal.tsx \
        apps/web/src/__tests__/regression/modal-correct-cta-290-p4e2.test.ts \
        apps/web/src/__tests__/regression/ocr-retry-correct-routes-290-p4d.test.ts \
        docs/decisions/ADR-002-pilot-tenant-seed.md \
        docs/commit-drafts/COMMIT_11.290-p4e2-modal-correct-cta.md

git commit -F - <<'EOF'
... (위 commit message)
EOF

git push origin main
```

## 다음 단계 (Phase 5 권장)

호영님 push 후:
- **Phase 5 (호영님 dashboard 작업 필수):**
  1. `pnpm add @google-cloud/vision @anthropic-ai/sdk`
  2. Vercel env 4종:
     - STORAGE_PROVIDER=vercel-blob
     - BLOB_READ_WRITE_TOKEN (Vercel Blob 자동 생성)
     - GOOGLE_VISION_API_KEY (Google Cloud Console)
     - ANTHROPIC_API_KEY (Anthropic Console)
  3. Vercel preview deploy → production smoke
  4. cost monitoring (per-provider per-call USD)
  5. ADR §11.290 family final close + Plan document close
- **Phase 4e-3:** QuoteScannerModal correct CTA + 풀스펙 form
- **Phase 4c-3:** receiving page PO 매칭 + 입고 자동 prefill
```
