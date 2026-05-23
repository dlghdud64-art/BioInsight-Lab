# §11.290 Phase 6 Commit Message Draft + §11.290 family final-final close v2

## Commit message (호영님 클로드코드 환경에서 push)

```
feat(admin): §11.290 Phase 6 OCR 사용량 monitoring admin dashboard (per-provider + per-day chart + cache 활용도 + status breakdown). §11.290 family final-final close v2.

호영님 P1 spec (2026-05-23):
Phase 5.5 + 5.5.b 의 OcrResult.costUsd / OcrJob.imageHash 데이터 source
위에 admin dashboard 시각화. operator 가 OCR API 비용 + cache 활용도 +
provider 분배 + status 분포 한눈에. §11.290 family cost monitoring 마무리.

Lock (admin/cron 패턴 정합):
- admin gate 2 layer (auth() + isAdmin(userId))
- period 7d/30d query + Number(intervalDays) cast
- $queryRawUnsafe SQL aggregation + BigInt → Number 안전 직렬화
- recharts dynamic import (next/dynamic + ssr:false + 260px skeleton)
- "use client" + export const dynamic = "force-dynamic"

Fix (5 file):
- apps/web/src/app/api/admin/ocr-monitoring/route.ts (NEW, ~155 line):
  · GET handler + 2-layer admin gate (Unauthorized 401 / Forbidden 403)
  · period 7d/30d 분기 + intervalSql string
  · per-provider SQL (OcrResult INNER JOIN OcrJob, count + sum costUsd
    + avg latencyMs)
  · per-day SQL (DATE AT TIME ZONE 'Asia/Seoul', count distinct j.id
    + coalesce sum r.costUsd)
  · status breakdown (OcrJob groupBy status)
  · totals (count + count distinct imageHash + 총 costUsd)
  · cacheReuseRatio = (totalJobs - uniqueHashes) / totalJobs * 100
    (cache eligible proxy, 정확 cache hit 는 Phase 6.b 백로그)
  · BigInt → Number + costUsd 4 decimal round

- apps/web/src/components/admin/ocr-cost-chart.tsx (NEW, ~95 line):
  · "use client" + named recharts import (8 component)
  · dual axis (count left blue, costUsd right emerald) + gradient fill
  · 한국어 tooltip ("OCR 호출" / "비용 (USD)") + Legend
  · default export → caller dynamic import 가능

- apps/web/src/app/admin/ocr-monitoring/page.tsx (NEW, ~245 line):
  · "use client" + force-dynamic + useSession admin gate
  · nextDynamic OcrCostChart lazy load (ssr:false + 260px skeleton)
  · period selector 2 button (7d / 30d)
  · 4 KPI card (총 스캔 / 총 비용 USD / 고유 이미지 / 재스캔 비율)
  · per-provider summary table (PROVIDER_LABEL 한국어 매핑)
  · per-day chart section
  · status breakdown chip row (STATUS_LABEL 한국어)
  · loading / error / empty 모두 처리
  · data-testid (ocr-provider-summary / ocr-per-day-chart /
    ocr-cache-hit-ratio)

- apps/web/src/app/admin/_components/admin-sidebar.tsx (2 spot edit):
  · ScanLine icon import 추가
  · ADMIN_MENU_ITEMS 에 OCR 사용량 entry (Activity Logs / Settings 사이)

- apps/web/src/__tests__/regression/ocr-monitoring-admin-290-p6.test.ts
  (NEW, 12 it × 3 nested describe):
  · API 6 it (trace + GET + auth + provider + per-day + cache hit ratio
    + period + Number cast)
  · UI 5 it (page trace + chart 존재 + dynamic import + data-testid 3종)
  · Sidebar 1 it (entry + href)

- docs/decisions/ADR-002-pilot-tenant-seed.md (§11.290 Phase 6 entry +
  family final-final close v2 명시)

canonical truth 보존:
- OcrJob/OcrResult Prisma schema 변경 0 (Phase 1 reuse, migration 0)
- Phase 5.5 + 5.5.b run-ocr-pipeline / run-quote-ocr-pipeline 변경 0
  (DB read only)
- admin/cron route 변경 0 (패턴 reuse)
- admin-sidebar 기존 7 entry 변경 0 (1 entry 추가)
- spend-trend-area-chart 변경 0 (recharts 패턴 reuse)

Verification (sandbox grep simulation):
- 3 NEW file 존재 + Phase 6 trace ×3 + sidebar entry
- API: auth/isAdmin/provider/costUsd/imageHash/period/Number 모두 land
- UI: ssr:false + data-testid 3종 + recharts named import + default export
- Sidebar: OCR 사용량 + /admin/ocr-monitoring entry
- 호영님 환경 vitest 검증 위임

호영님 production effect (Phase 6):
1. /admin/ocr-monitoring 진입 → 4 KPI card + per-provider 표 +
   per-day chart + status 분포
2. 7d / 30d period toggle 로 trend 비교
3. Gemini vs Vision+Claude vs Regex 호출 분배 + per-provider 평균 비용 →
   cost-effective provider 결정
4. 재스캔 비율 (cache eligible proxy) → cache 활용도 확인
5. status SUCCESS / NEEDS_REVIEW / FAILED 분포 → OCR 정확도 모니터링
6. recharts dynamic import + 260px skeleton → bundle 분리 + first paint 빠름

§11.290 family final-final close v2:
Phase 0 → 1 → 2 → 3 → 4a/4b/4c/4c-2/4c-3/4d/4e/4e-2 → 5 → 5.5 → 5.5.b
→ 6 ✅ (final)

Out of Scope (Phase 6.b / Phase 7):
- 정확 cache hit count 추적 (별도 OcrCacheHit audit table 추가)
- per-day cost forecast (trend → prediction)
- per-organization breakdown (multi-tenant 운영 시)
- email alert (per-day USD threshold 초과)
- Phase 7 NEEDS_REVIEW queue (사용자 보정 대기 일괄 review UI)

Rollback path: git revert <SHA>
- 3 NEW file 삭제 + sidebar 2 spot revert
- /admin/ocr-monitoring 진입 시 404
- dashboard / public surface 영향 0
- schema 0 + migration 0 + Phase 5.5/5.5.b read-only → DB rollback 0
```

## Files to stage

```
apps/web/src/app/api/admin/ocr-monitoring/route.ts
apps/web/src/app/admin/ocr-monitoring/page.tsx
apps/web/src/components/admin/ocr-cost-chart.tsx
apps/web/src/app/admin/_components/admin-sidebar.tsx
apps/web/src/__tests__/regression/ocr-monitoring-admin-290-p6.test.ts
docs/decisions/ADR-002-pilot-tenant-seed.md
docs/commit-drafts/COMMIT_11.290-p6-cost-monitoring.md
```

## Push 절차 (호영님)

```bash
cd ~/ai-biocompare && git pull --ff-only

# Phase 6 검증 (선택, 호영님 환경)
pnpm vitest run apps/web/src/__tests__/regression/ocr-monitoring-admin-290-p6.test.ts

# §11.290 family 통합 회귀 (선택)
pnpm vitest run apps/web/src/__tests__/regression/audit-log-wiring-290-p5-5.test.ts \
                apps/web/src/__tests__/regression/pdf-storage-wiring-290-p5-5b.test.ts \
                apps/web/src/__tests__/regression/ocr-monitoring-admin-290-p6.test.ts

git add apps/web/src/app/api/admin/ocr-monitoring/route.ts \
        apps/web/src/app/admin/ocr-monitoring/page.tsx \
        apps/web/src/components/admin/ocr-cost-chart.tsx \
        apps/web/src/app/admin/_components/admin-sidebar.tsx \
        apps/web/src/__tests__/regression/ocr-monitoring-admin-290-p6.test.ts \
        docs/decisions/ADR-002-pilot-tenant-seed.md \
        docs/commit-drafts/COMMIT_11.290-p6-cost-monitoring.md

git commit -F - <<'EOF'
... (위 commit message)
EOF

git push origin main
```

## Production smoke (Vercel READY 후)

Phase 5.5 + 5.5.b push 가 선행되어 OcrJob/OcrResult 데이터가 누적된 상태
가정. Phase 6 push 후:

1. labaxis.co.kr/admin 로그인 (admin 권한 계정)
2. 좌측 sidebar 의 "OCR 사용량" entry click → /admin/ocr-monitoring 진입
3. **검증 항목 7종:**
   - PageHeader "OCR 사용량 모니터링" 표시
   - period toggle 7d/30d 작동
   - 4 KPI card 값 표시 (jobs / costUsd / uniqueHashes / cacheReuseRatio)
   - per-provider 표 — Gemini / Vision+Claude / 정규식 fallback 분배 확인
   - per-day chart 렌더 (dual axis count + USD)
   - status breakdown chip — 성공 / 검토 필요 / 실패 카운트
   - non-admin 계정으로 접근 시 403 Forbidden (admin gate 정합)

## §11.290 family 완전 종료 보고 (호영님)

| Phase | 결과 |
|---|---|
| Phase 0 Truth Lock | ✅ |
| Phase 1 Schema | ✅ |
| Phase 2 image-storage | ✅ |
| Phase 3 Orchestrator | ✅ |
| Phase 4a~4e-2 + 4c-2~4c-3 UI wiring (8 sub-phase) | ✅ |
| Phase 5 Cloud Vision REST + Claude SDK + env 4종 | ✅ |
| Phase 5.5 Audit log wiring | ✅ |
| Phase 5.5.b PDF storage wiring | ✅ |
| **Phase 6 Cost monitoring dashboard** | ✅ **(final)** |

**호영님 후속 결정 필요 (별도 cluster):**
- **Phase 6.b** (정확 cache hit count audit table 추가, ~3h)
- **Phase 7** (NEEDS_REVIEW queue, 사용자 보정 대기 일괄 review UI, ~5h)
- **다른 P1 백로그** (test-only @ts-nocheck 제거 / enum drift / RFQ
  handoff smoke / MutationAuditEvent migration 등)
- **호영님 새 spec / v3 spec sheet 항목**

평일 시각 검증 + Phase 5.5 / 5.5.b / 6 모두 push 후 §11.290 cluster
완전 종료 보고 가능.
