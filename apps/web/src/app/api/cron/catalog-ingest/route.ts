import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
// #cron-monitoring — Vercel cron 실행 history wrapper (admin/cron 시각화 정합).
import { logCronExecution } from "@/lib/cron/execution-logger";
// §catalog-A Phase 4 — 조달청 ingest 실행 레이어(Phase 2) + 코드 해석(Phase 4).
import { runIngest, type IngestDeps } from "@/lib/catalog/procurement-ingest";
import {
  CATALOG_INGEST_SEGMENTS,
  buildUnit8RangeUrl,
  parseUnit8Codes,
} from "@/lib/catalog/procurement-codes";

/**
 * GET /api/cron/catalog-ingest — 조달청 공공데이터 식별 계층 nightly ingest.
 *
 * flag(CATALOG_PUBLIC_INGEST) + serviceKey(PROCUREMENT_API_KEY) 둘 다 있을 때만 실행.
 * 부재 시 no-op 보고(fake success·throw 0) — rollback = env 제거로 즉시 비활성.
 *
 * canonical 보호: upsert 대상은 procurementCatalogRef만. db.product write 0.
 * 일일 예산: runIngest의 maxRequests + remainingCodes cursor로 다음 run 이어받음.
 * 분류 코드: Phase 0은 카운트만 — 8자리 실코드는 런타임 Unit8 range로 해석(날조 0).
 *
 * Vercel cron (apps/web/vercel.json): { "path": "/api/cron/catalog-ingest", "schedule": "0 3 * * *" }
 */
export async function GET(request: NextRequest) {
  try {
    const cronSecret = process.env.CRON_SECRET;
    if (cronSecret) {
      const authHeader = request.headers.get("authorization");
      const cronHeader = request.headers.get("x-vercel-cron-signature");
      const isAuthorized =
        authHeader === `Bearer ${cronSecret}` || cronHeader != null;
      if (!isAuthorized) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
    }

    const result = await logCronExecution("/api/cron/catalog-ingest", () => runCatalogIngest());

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("[Cron] Catalog ingest failed:", error);
    return NextResponse.json(
      { error: "Catalog ingest failed", details: String(error) },
      { status: 500 }
    );
  }
}

// 한 run의 요청 예산(일일 트래픽 1000/operation 내 보수적 배분).
const MAX_REQUESTS_PER_RUN = 400;
const NUM_OF_ROWS = 500;
const UNIT8_PAGE_ROWS = 1000;

async function runCatalogIngest() {
  const flagOn = process.env.CATALOG_PUBLIC_INGEST === "1";
  const serviceKey = process.env.PROCUREMENT_API_KEY ?? "";

  // no-op 보고 — fake success 아님(skipped 명시), throw 아님(cron red 방지).
  if (!flagOn || !serviceKey) {
    return {
      skipped: true,
      reason: !flagOn ? "flag_disabled" : "missing_api_key",
      upserted: 0,
    };
  }

  const fetchJson = async (url: string) => {
    const res = await fetch(url, { cache: "no-store" });
    return res.json();
  };

  // 1) 세그먼트별 8자리 코드 런타임 해석(Unit8 range).
  const codes: string[] = [];
  let codeResolveRequests = 0;
  for (const segment of CATALOG_INGEST_SEGMENTS) {
    let pageNo = 1;
    let total = Infinity;
    while ((pageNo - 1) * UNIT8_PAGE_ROWS < total) {
      const url = buildUnit8RangeUrl({ serviceKey, segment, pageNo, numOfRows: UNIT8_PAGE_ROWS });
      const parsed = parseUnit8Codes(await fetchJson(url), segment);
      codeResolveRequests += 1;
      total = parsed.totalCount;
      if (parsed.codes.length === 0) break;
      codes.push(...parsed.codes);
      pageNo += 1;
    }
  }

  // 2) cursor — day-rotation. 저장소 의존 0(결정적). 예산 < 전체 코드일 때
  //    매일 시작 오프셋을 이동해 전 코드를 시간차로 커버(tail starvation 방지).
  //    한 run이 1회전을 끝내면 remainingCodes=[]가 됨.
  const startIndex = codes.length > 0 ? dayRotationOffset(codes.length) : 0;
  const orderedCodes = [...codes.slice(startIndex), ...codes.slice(0, startIndex)];

  // 3) 품목 ingest(Phase 2 runIngest) — db.procurementCatalogRef.upsert 바인딩.
  const deps: IngestDeps = {
    serviceKey,
    fetchJson,
    upsertRef: async (args) => {
      await db.procurementCatalogRef.upsert(args);
    },
  };
  const ingest = await runIngest(
    { codes: orderedCodes, maxRequests: MAX_REQUESTS_PER_RUN, numOfRows: NUM_OF_ROWS },
    deps,
  );

  return {
    skipped: false,
    resolvedCodes: codes.length,
    codeResolveRequests,
    startIndex,
    processedCodes: ingest.processedCodes.length,
    remainingCodes: ingest.remainingCodes.length,
    upserted: ingest.upserted,
    fetched: ingest.fetched,
    refSkipped: ingest.skipped,
  };
}

/** day-of-year 기반 시작 오프셋 — 매일 예산만큼 윈도우를 굴려 전 코드 커버. */
function dayRotationOffset(len: number): number {
  const now = new Date();
  const start = Date.UTC(now.getUTCFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start) / 86_400_000);
  return ((dayOfYear * MAX_REQUESTS_PER_RUN) % len + len) % len;
}

export const maxDuration = 60;
