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
  type BriefSourceTrace,
} from "@/lib/ai/operational-brief-cache";

export const dynamic = "force-dynamic";

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

  // Compose narrative deterministically from facts.
  // §11.142 lock: AI 는 facts 를 "문장 압축만" — status 판단은 resolver.
  // 외부 AI 호출 비용/지연 회피: 단순 facts → 한국어 1문장 어셈블리.
  // 향후 `#operational-brief-anthropic-narrative` 트랙에서 LLM 호출로 swap.
  const status = body.facts.status ?? "—";
  const blocker = body.facts.blocker ?? null;
  const nextAction = body.facts.nextAction ?? null;

  const parts: string[] = [`현재 상태: ${status}`];
  if (blocker && blocker !== "차단 없음") parts.push(`차단 — ${blocker}`);
  if (nextAction) parts.push(`다음 조치 — ${nextAction}`);
  const narrative = parts.join(" · ");

  setCachedBriefNarrative(body.sourceTrace, narrative);
  incrementCacheStat("set");

  return NextResponse.json({ narrative, cached: false });
}
