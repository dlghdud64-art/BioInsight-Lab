"use client";

/**
 * §11.148 client hook — 5 surface 가 동일하게 사용
 *
 * 사용 예:
 *   const { narrative, isLoading } = useOperationalBriefNarrative({
 *     sourceTrace: { quoteId, module: "purchase_conversion", sourceUpdatedAt: quote.updatedAt },
 *     facts: { status, blocker, nextAction },
 *   });
 */

import { useEffect, useState } from "react";
import { csrfFetch } from "@/lib/api-client";
import type { BriefSourceTrace } from "@/lib/ai/operational-brief-cache";

interface UseBriefArgs {
  sourceTrace: BriefSourceTrace;
  facts: Record<string, string | number | null | undefined>;
  /** false 시 호출 skip — selection 부재 surface */
  enabled?: boolean;
}

interface UseBriefResult {
  narrative: string | null;
  isLoading: boolean;
  cached: boolean;
}

export function useOperationalBriefNarrative({ sourceTrace, facts, enabled = true }: UseBriefArgs): UseBriefResult {
  const [narrative, setNarrative] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [cached, setCached] = useState(false);

  // sourceTrace fingerprint — 변경 시만 재요청
  const fingerprint = JSON.stringify({
    m: sourceTrace.module,
    q: sourceTrace.quoteId ?? null,
    o: sourceTrace.orderId ?? null,
    w: sourceTrace.workQueueTaskId ?? null,
    i: sourceTrace.inventoryId ?? null,
    a: sourceTrace.aiActionItemId ?? null,
    u: sourceTrace.sourceUpdatedAt,
    f: facts,
  });

  useEffect(() => {
    if (!enabled) {
      setNarrative(null);
      return;
    }
    let cancelled = false;
    setIsLoading(true);

    csrfFetch("/api/operational-brief/narrative", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sourceTrace, facts }),
    })
      .then((res) => res.ok ? res.json() : null)
      .then((data) => {
        if (cancelled || !data) return;
        setNarrative(data.narrative ?? null);
        setCached(Boolean(data.cached));
      })
      .catch(() => {
        if (cancelled) return;
        setNarrative(null);
      })
      .finally(() => {
        if (cancelled) return;
        setIsLoading(false);
      });

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, fingerprint]);

  return { narrative, isLoading, cached };
}
