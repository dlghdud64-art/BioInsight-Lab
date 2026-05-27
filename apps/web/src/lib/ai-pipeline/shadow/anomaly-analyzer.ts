/**
 * Repeated Anomaly Analyzer — 벤더/템플릿 핫스팟 + Confidence Band 분석
 *
 * 25% 확대 전 패턴 식별:
 * 1. Vendor/Template Hotspot: 특정 벤더 양식에서 Mismatch 집중 여부
 * 2. Confidence Band Mismatch: AI Confidence 구간별 Mismatch 발생 비율
 */

import { db } from "@/lib/db";

// ── Vendor/Template Hotspot ──

export interface VendorHotspot {
  orgId: string;
  totalCount: number;
  mismatchCount: number;
  mismatchRate: number;
  fallbackCount: number;
  fallbackRate: number;
  topCategories: string[];
}

export interface ConfidenceBand {
  band: string;
  lower: number;
  upper: number;
  totalCount: number;
  mismatchCount: number;
  mismatchRate: number;
  noDiffCount: number;
  accuracyRate: number;
}

export interface AnomalyReport {
  documentType: string;
  period: { from: string; to: string };
  vendorHotspots: VendorHotspot[];
  confidenceBands: ConfidenceBand[];
  riskSummary: {
    hotspotOrgCount: number;
    worstConfidenceBand: string | null;
    recommendation: string;
  };
}

export interface AnomalyQuery {
  documentType: string;
  from?: Date;
  to?: Date;
  mismatchRateThreshold?: number; // Hotspot 판정 기준 (기본 0.2)
}

export async function analyzeAnomalies(query: AnomalyQuery): Promise<AnomalyReport> {
  const from = query.from ?? new Date(Date.now() - 24 * 60 * 60 * 1000);
  const to = query.to ?? new Date();
  const hotspotThreshold = query.mismatchRateThreshold ?? 0.2;

  // ── 1. Vendor/Org Hotspot 분석 ──
  const vendorRows = (await db.$queryRawUnsafe(
    `SELECT
      "orgId",
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE "mismatchCategory" != 'NO_DIFF')::bigint AS mismatch_count,
      COUNT(*) FILTER (WHERE "fallbackReason" IS NOT NULL)::bigint AS fallback_count,
      ARRAY_AGG(DISTINCT "mismatchCategory") FILTER (WHERE "mismatchCategory" != 'NO_DIFF') AS categories
    FROM "ShadowComparisonLog"
    WHERE "createdAt" >= $1 AND "createdAt" <= $2
      AND "documentTypeByRules" = $3
      AND "processingPath" IN ('ai_active_canary', 'ai_active_full', 'ai_shadow')
    GROUP BY "orgId"
    HAVING COUNT(*) >= 3
    ORDER BY COUNT(*) FILTER (WHERE "mismatchCategory" != 'NO_DIFF') DESC
    LIMIT 20`,
    from, to, query.documentType,
  )) as {
    orgId: string;
    total: bigint;
    mismatch_count: bigint;
    fallback_count: bigint;
    categories: string[] | null;
  }[];

  const vendorHotspots: VendorHotspot[] = vendorRows
    .map((r: { orgId: string; total: bigint; mismatch_count: bigint; fallback_count: bigint; categories: string[] | null }) => {
      const total = Number(r.total);
      const mismatchCount = Number(r.mismatch_count);
      const fallbackCount = Number(r.fallback_count);
      return {
        orgId: r.orgId,
        totalCount: total,
        mismatchCount,
        mismatchRate: total > 0 ? mismatchCount / total : 0,
        fallbackCount,
        fallbackRate: total > 0 ? fallbackCount / total : 0,
        topCategories: r.categories ?? [],
      };
    })
    .filter((h: VendorHotspot) => h.mismatchRate >= hotspotThreshold);

  // ── 2. Confidence Band 분석 ──
  const BANDS = [
    { band: "0.00–0.50", lower: 0, upper: 0.5 },
    { band: "0.50–0.60", lower: 0.5, upper: 0.6 },
    { band: "0.60–0.70", lower: 0.6, upper: 0.7 },
    { band: "0.70–0.75", lower: 0.7, upper: 0.75 },
    { band: "0.75–0.80", lower: 0.75, upper: 0.8 },
    { band: "0.80–0.85", lower: 0.8, upper: 0.85 },
    { band: "0.85–0.90", lower: 0.85, upper: 0.9 },
    { band: "0.90–0.95", lower: 0.9, upper: 0.95 },
    { band: "0.95–1.00", lower: 0.95, upper: 1.01 },
  ];

  const confidenceRows = (await db.$queryRawUnsafe(
    `SELECT
      "confidence",
      "mismatchCategory"
    FROM "ShadowComparisonLog"
    WHERE "createdAt" >= $1 AND "createdAt" <= $2
      AND "documentTypeByRules" = $3
      AND "confidence" IS NOT NULL
      AND "processingPath" IN ('ai_active_canary', 'ai_active_full', 'ai_shadow')`,
    from, to, query.documentType,
  )) as { confidence: number; mismatchCategory: string }[];

  const confidenceBands: ConfidenceBand[] = BANDS.map((b) => {
    const inBand = confidenceRows.filter(
      (r: { confidence: number; mismatchCategory: string }) => r.confidence >= b.lower && r.confidence < b.upper
    );
    const totalCount = inBand.length;
    const mismatchCount = inBand.filter(
      (r: { confidence: number; mismatchCategory: string }) => r.mismatchCategory !== "NO_DIFF"
    ).length;
    const noDiffCount = totalCount - mismatchCount;

    return {
      band: b.band,
      lower: b.lower,
      upper: b.upper,
      totalCount,
      mismatchCount,
      mismatchRate: totalCount > 0 ? mismatchCount / totalCount : 0,
      noDiffCount,
      accuracyRate: totalCount > 0 ? noDiffCount / totalCount : 0,
    };
  });

  // ── 3. Risk Summary ──
  const worstBand = confidenceBands
    .filter((b) => b.totalCount >= 3)
    .sort((a, b) => b.mismatchRate - a.mismatchRate)[0];

  let recommendation: string;
  if (vendorHotspots.length > 0) {
    recommendation = `${vendorHotspots.length}개 조직에서 Mismatch 집중 — 해당 조직 패턴 분석 후 승격 권고`;
  } else if (worstBand && worstBand.mismatchRate > 0.3) {
    recommendation = `Confidence ${worstBand.band} 구간 Mismatch ${(worstBand.mismatchRate * 100).toFixed(0)}% — minConfidence 조정 검토`;
  } else {
    recommendation = "Hotspot 미감지 — 승격 시 추가 리스크 낮음";
  }

  return {
    documentType: query.documentType,
    period: { from: from.toISOString(), to: to.toISOString() },
    vendorHotspots,
    confidenceBands,
    riskSummary: {
      hotspotOrgCount: vendorHotspots.length,
      worstConfidenceBand: worstBand ? worstBand.band : null,
      recommendation,
    },
  };
}
