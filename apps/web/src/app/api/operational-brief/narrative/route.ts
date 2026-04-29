/**
 * §11.148 #operational-brief-narrative-integration
 *
 * 5 surface 가 동일한 endpoint 로 narrative 요청 — cache hit/miss 처리 단일화.
 * AI 호출 자체는 lib/ai/anthropic 의 generic wrapper 재사용 (§11.26).
 * facts 는 caller 가 보냄 (resolver-derived, canonical) — endpoint 는 narrative 만 압축.
 *
 * Request body: { sourceTrace: BriefSourceTrace, facts: { status, blocker?, nextAction?, ... } }
 * Response: { narrative: string, cached: boolean }
 */

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { incrementCacheStat } from "@/lib/ai/operational-brief-cache-metrics";
import {
  getCachedBriefNarrative,
  setCachedBriefNarrative,
  invalidateCachedBriefNarrative,
  type BriefSourceTrace,
} from "@/lib/ai/operational-brief-cache";
import { generateBriefNarrative } from "@/lib/ai/operational-brief-narrative";

export const dynamic = "force-dynamic";

/**
 * §11.156 cache-bust on mutation — DELETE endpoint.
 * caller (selectReplyMutation, executeOpsAction, onReorder 등) onSuccess 후 호출.
 */
export async function DELETE(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const body = (await request.json()) as { sourceTrace?: BriefSourceTrace };
  if (!body?.sourceTrace?.module) {
    return NextResponse.json({ error: "sourceTrace.module required" }, { status: 400 });
  }
  invalidateCachedBriefNarrative(body.sourceTrace);
  incrementCacheStat("invalidate");
  return NextResponse.json({ invalidated: true });
}

interface NarrativeRequest {
  sourceTrace: BriefSourceTrace;
  facts: Record<string, string | number | null | undefined>;
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = (await request.json()) as NarrativeRequest;
  if (!body?.sourceTrace?.module || !body.sourceTrace.sourceUpdatedAt) {
    return NextResponse.json({ error: "sourceTrace.module + sourceUpdatedAt required" }, { status: 400 });
  }

  // Cache hit?
  const hit = getCachedBriefNarrative(body.sourceTrace);
  if (hit) {
    incrementCacheStat("hit");
    return NextResponse.json({ narrative: hit, cached: true });
  }

  incrementCacheStat("miss");

  // §11.153: LLM (Anthropic) 또는 deterministic fallback — env 분기.
  const narrative = await generateBriefNarrative(body.facts);

  setCachedBriefNarrative(body.sourceTrace, narrative);
  incrementCacheStat("set");

  return NextResponse.json({ narrative, cached: false });
}
