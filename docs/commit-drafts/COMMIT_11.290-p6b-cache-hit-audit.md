# §11.290 Phase 6.b Commit Message Draft + §11.290 family complete close v3

## Commit message (호영님 클로드코드 환경에서 push)

```
feat(ocr): §11.290 Phase 6.b 정확 cache hit count audit table (OcrCacheHit model + 3 pipeline cache hit branch INSERT + dashboard cacheReuseRatio proxy → cacheHitRatio 정확 metric). §11.290 family complete close v3.

호영님 P1 spec (2026-05-23):
Phase 6 의 cacheReuseRatio = (totalJobs - uniqueHashes) / totalJobs 가
proxy metric (정확한 cache hit count 는 OcrJob INSERT 없으므로 직접 추적
불가). 별도 audit table 추가로 정확 metric 정착 + §11.290 family 마지막
cleanup.

Lock (Phase 5.5 graceful pattern 보존):
- OcrCacheHit model 5 field (cachedJobId / organizationId / userId /
  imageHash / hitAt)
- OcrJob.cacheHits back-relation
- 3 cache hit branch (label image + quote image + quote PDF) 모두 graceful
  INSERT (try/catch + console.warn)
- 실패 시 cache hit 자체는 정상 (audit 만 missing, production 중단 0)
- dashboard cacheReuseRatio (deprecated) + cacheHitRatio (신규) 둘 다
  response shape 보존 (caller drift 0)

Fix (5 file):
- apps/web/prisma/schema.prisma (+~25 line):
  · OcrJob.cacheHits OcrCacheHit[] back-relation
  · model OcrCacheHit (5 field + 2 index: organizationId+hitAt / cachedJobId)

- apps/web/src/lib/ocr/run-ocr-pipeline.ts (+~15 line):
  · label cache hit branch (line ~105) 안에 graceful ocrCacheHit.create

- apps/web/src/lib/ocr/run-quote-ocr-pipeline.ts (+~30 line):
  · PDF cache hit branch (line ~97) + image cache hit branch (line ~232)
    모두 동일 패턴, console.warn 접두 분리 ([OCR-quote-pdf] / [OCR-quote])

- apps/web/src/app/api/admin/ocr-monitoring/route.ts (+~30 line):
  · cacheHitRows SQL (OcrCacheHit count + hitAt INTERVAL)
  · totalRequests = totalJobs + cacheHitCount
  · cacheHitRatio = cacheHitCount / totalRequests * 100 (정확)
  · cacheReuseRatio proxy 보존 (deprecated)
  · response shape 5 신규 field (totals.cacheHits / totalRequests /
    cacheHitCount / cacheHitRatio / cacheReuseRatio)

- apps/web/src/app/admin/ocr-monitoring/page.tsx (~15 line swap):
  · OcrMonitoringResponse interface 확장
  · 4번째 KPI card "고유 이미지 수" → "Cache hit 수" (data.cacheHitCount)
  · 4번째 KPI card "재스캔 비율" → "Cache hit 비율" (data.cacheHitRatio ??
    cacheReuseRatio fallback)

- apps/web/src/__tests__/regression/cache-hit-audit-290-p6b.test.ts
  (NEW, 10 it × 3 nested describe):
  · schema 3 it (trace + model + back-relation)
  · pipeline 4 it (label / quote image / quote PDF + graceful fallback)
  · route 3 it (trace + SQL + 정확 metric)

- docs/decisions/ADR-002-pilot-tenant-seed.md (§11.290 Phase 6.b entry +
  family complete close v3 명시)

canonical truth 보존:
- Phase 5.5 + 5.5.b image-storage / orchestrator / parser 변경 0
- RunOcrPipelineResult / RunQuoteOcrPipelineResult 시그니처 변경 0
- Phase 6 admin route response shape 보존 (신규 field 추가만)
- admin-sidebar / ocr-cost-chart 변경 0

Verification (sandbox grep simulation):
- schema 6 pattern (Phase 6.b ×2 / model OcrCacheHit ×1 / cachedJobId ×1 /
  imageHash ×2 / hitAt ×1 / cacheHits[] ×1)
- pipeline 6 pattern (label Phase 6.b ×1 / quote ×2 / label ocrCacheHit.create
  ×1 / quote ×2 / "cache hit audit" comment label ×2 / quote ×4)
- route 5 pattern (Phase 6.b trace ×7 / OcrCacheHit ×5 / cacheHitCount ×6 /
  cacheHitRatio ×4 / totalRequests ×5)
- 호영님 환경 pnpm prisma generate + migrate dev + vitest 검증 위임

호영님 production effect:
1. 라벨/거래명세서 재스캔 → cache hit → OcrCacheHit row INSERT
2. /admin/ocr-monitoring 4번째 KPI 가 "Cache hit 수" + "Cache hit 비율"
   정확 metric 표시
3. cacheHitRatio = cacheHits / (cache miss=OcrJob + cache hits=OcrCacheHit) *
   100 → 실제 사용 효율 정확 측정
4. cache hit 자체는 audit INSERT 실패해도 production 정상 (graceful fallback)

§11.290 family complete close v3:
Phase 0 → 1 → 2 → 3 → 4 (8 sub-phase) → 5 → 5.5 → 5.5.b → 6 → 6.b ✅
(complete final, 17 sub-phase)

Out of Scope (Phase 6.c / Phase 7):
- per-organization cache hit breakdown
- per-day cache hit chart
- cache hit ratio trend (7d vs 30d)
- Phase 7 NEEDS_REVIEW queue
- email alert

Rollback path: git revert <SHA>
- 6 file 모두 revert
- pnpm prisma migrate resolve --rolled-back add_ocr_cache_hit_audit
- OcrCacheHit table drop → cacheReuseRatio proxy 로 회귀
- data drop 0 (새 table 추가) → 안전
- backward-compatible (Phase 5.5 cache hit 자체 정상)
```

## Files to stage

```
apps/web/prisma/schema.prisma
apps/web/src/lib/ocr/run-ocr-pipeline.ts
apps/web/src/lib/ocr/run-quote-ocr-pipeline.ts
apps/web/src/app/api/admin/ocr-monitoring/route.ts
apps/web/src/app/admin/ocr-monitoring/page.tsx
apps/web/src/__tests__/regression/cache-hit-audit-290-p6b.test.ts
docs/decisions/ADR-002-pilot-tenant-seed.md
docs/commit-drafts/COMMIT_11.290-p6b-cache-hit-audit.md
```

## Push 절차 (호영님, migration 필수)

```bash
cd ~/ai-biocompare && git pull --ff-only

# 1. Prisma client regenerate + migration generate
pnpm prisma generate
pnpm prisma migrate dev --name add_ocr_cache_hit_audit

# 2. sentinel test 검증 (선택)
pnpm vitest run apps/web/src/__tests__/regression/cache-hit-audit-290-p6b.test.ts

# 3. §11.290 family 통합 회귀 (선택)
pnpm vitest run apps/web/src/__tests__/regression/audit-log-wiring-290-p5-5.test.ts \
                apps/web/src/__tests__/regression/pdf-storage-wiring-290-p5-5b.test.ts \
                apps/web/src/__tests__/regression/ocr-monitoring-admin-290-p6.test.ts \
                apps/web/src/__tests__/regression/cache-hit-audit-290-p6b.test.ts

# 4. commit + push (migration file 도 포함)
git add apps/web/prisma/schema.prisma \
        apps/web/prisma/migrations/ \
        apps/web/src/lib/ocr/run-ocr-pipeline.ts \
        apps/web/src/lib/ocr/run-quote-ocr-pipeline.ts \
        apps/web/src/app/api/admin/ocr-monitoring/route.ts \
        apps/web/src/app/admin/ocr-monitoring/page.tsx \
        apps/web/src/__tests__/regression/cache-hit-audit-290-p6b.test.ts \
        docs/decisions/ADR-002-pilot-tenant-seed.md \
        docs/commit-drafts/COMMIT_11.290-p6b-cache-hit-audit.md

git commit -F - <<'EOF'
... (위 commit message)
EOF

git push origin main
```

## Production smoke (Vercel READY 후)

1. labaxis.co.kr 로그인 → 같은 라벨/PDF 를 2번 스캔
2. 1번째 스캔: cache miss → 새 OcrJob INSERT
3. 2번째 스캔: cache hit → CacheHitIndicator UI + OcrCacheHit INSERT
4. /admin/ocr-monitoring 진입 → "Cache hit 수" KPI 가 ≥1 표시 확인
5. "Cache hit 비율" KPI = 1 / 2 = 50% 정확 표시 확인
6. Vercel function logs 에 OcrCacheHit INSERT 로그 + graceful fallback 0

## §11.290 family 완전 종료 보고

| Phase | 결과 | 호영님 commit |
|---|---|---|
| Phase 0~4 (15 sub-phase, schema/orchestrator/UI wiring) | ✅ | 14 commit |
| Phase 5 (Cloud Vision REST + Claude SDK + env 4종) | ✅ | b2bfd3d (호영님 self-authored) |
| Phase 5.5 (audit log wiring) | ✅ | COMMIT_11.290-p5-5 |
| Phase 5.5.b (PDF storage wiring) | ✅ | COMMIT_11.290-p5-5b |
| Phase 6 (cost monitoring dashboard) | ✅ | COMMIT_11.290-p6 |
| **Phase 6.b (정확 cache hit metric)** | ✅ | **COMMIT_11.290-p6b (current, final)** |

호영님 push 후 §11.290 family **완전 종료** (Phase 0 → 6.b 총 17 sub-phase, ~7 weeks 의 spec 을 single day 에 land).

## 후속 백로그 (호영님 결정 필요, 별도 cluster)

- **Phase 7 NEEDS_REVIEW queue** (사용자 보정 대기 일괄 review UI, ~5h)
- **Phase 6.c per-organization breakdown** (multi-tenant 운영 시, ~2h)
- **다른 P1 백로그** (test-only @ts-nocheck / enum drift / RFQ smoke /
  MutationAuditEvent migration)
- **호영님 새 v3 spec sheet 항목**
