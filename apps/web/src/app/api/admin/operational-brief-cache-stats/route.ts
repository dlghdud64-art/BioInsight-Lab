/**
 * §11.151 #operational-brief-cache-metric — admin observability endpoint
 *
 * GET /api/admin/operational-brief-cache-stats
 *   → { hit, miss, set, evict, invalidate, hitRate, startedAt, cacheSize }
 *
 * 운영자 admin/audit 페이지 또는 dev tool 에서 cache 효율 가시화.
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import {
  getBriefCacheStats,
  computeBriefCacheHitRate,
  computeBriefFitnessPassRate,
  getTopInjectionPatterns,
} from "@/lib/ai/operational-brief-cache-metrics";
import { getBriefCacheSize } from "@/lib/ai/operational-brief-cache";

export const dynamic = "force-dynamic";

export async function GET() {
  const session = await auth();
  if (!session?.user || session.user.role !== "ADMIN") {
    return NextResponse.json({ error: "admin only" }, { status: 403 });
  }

  const stats = getBriefCacheStats();
  return NextResponse.json({
    ...stats,
    hitRate: computeBriefCacheHitRate(),
    fitnessPassRate: computeBriefFitnessPassRate(),
    cacheSize: getBriefCacheSize(),
    // §11.173 — top 5 injection pattern breakdown (count desc)
    topInjectionPatterns: getTopInjectionPatterns(5),
  });
}
