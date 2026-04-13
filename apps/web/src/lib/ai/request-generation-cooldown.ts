/**
 * Request Draft Generation Cooldown — recently_generated / recently_resolved 시간축 억제
 *
 * 고정 규칙:
 * 1. cooldown은 eligibility 위의 별도 시간축 억제층. eligible이어도 cooldown이면 suppress.
 * 2. recently_generated(중복 생성 방지) ≠ recently_resolved(재등장 억제). 분리.
 * 3. supplier-local only. 다른 supplier cooldown이 현재 supplier를 막으면 안 됨.
 * 4. resolution source별 cooldown 강도 차등: noop > dismissed > edited > accepted > generated.
 * 5. cooldown은 영구 금지가 아닌 temporary suppress. 시간 + meaningful change → eventually 열림.
 * 6. 동일 now 기준으로 모든 time-based 판단 수행.
 */

import type { RequestSuggestionState } from "./request-suggestion-store";

// ── Cooldown model ──

export interface RequestDraftGenerationCooldown {
  recentlyGenerated: boolean;
  recentlyResolved: boolean;
  latestGeneratedAt: string | null;
  latestResolvedAt: string | null;
  latestResolvedSource: "accepted" | "dismissed" | "edited" | "noop" | null;
}

// ── Cooldown thresholds (ms) ──

const GENERATED_COOLDOWN_MS = 10_000; // 10초 — 중복 생성 방지

// resolution source별 차등
const RESOLVED_COOLDOWN_MS: Record<string, number> = {
  noop: 60_000,       // 60초 — 가장 보수적
  dismissed: 45_000,  // 45초
  edited: 30_000,     // 30초
  accepted: 20_000,   // 20초
};
const RESOLVED_COOLDOWN_DEFAULT_MS = 15_000;

// ── Generated cooldown ──

export function isWithinGeneratedCooldown(input: {
  latestGeneratedAt: string | null;
  now: string;
}): boolean {
  if (!input.latestGeneratedAt) return false;
  const elapsed = new Date(input.now).getTime() - new Date(input.latestGeneratedAt).getTime();
  return elapsed < GENERATED_COOLDOWN_MS;
}

// ── Resolved cooldown (source별 차등) ──

export function isWithinResolvedCooldown(input: {
  latestResolvedAt: string | null;
  latestResolvedSource: "accepted" | "dismissed" | "edited" | "noop" | null;
  now: string;
}): boolean {
  if (!input.latestResolvedAt) return false;
  const elapsed = new Date(input.now).getTime() - new Date(input.latestResolvedAt).getTime();
  const threshold = input.latestResolvedSource
    ? (RESOLVED_COOLDOWN_MS[input.latestResolvedSource] ?? RESOLVED_COOLDOWN_DEFAULT_MS)
    : RESOLVED_COOLDOWN_DEFAULT_MS;
  return elapsed < threshold;
}

// ── Latest generated meta query ──

export interface LatestGeneratedMeta {
  suggestionId: string;
  generatedAt: string;
}

export function selectLatestGeneratedMeta(
  suggestions: RequestSuggestionState["suggestions"],
  requestAssemblyId: string,
  supplierId: string
): LatestGeneratedMeta | null {
  if (!suggestions) return null;

  let latest: LatestGeneratedMeta | null = null;

  for (const s of Object.values(suggestions)) {
    const item = s as any;
    if (!item) continue;
    if (item.sourceContext?.requestAssemblyId !== requestAssemblyId) continue;
    if (item.sourceContext?.supplierId !== supplierId) continue;

    if (!latest || item.generatedAt > latest.generatedAt) {
      latest = { suggestionId: item.id, generatedAt: item.generatedAt };
    }
  }

  return latest;
}

// ── Latest resolved query ──

export interface LatestResolvedMeta {
  resolvedAt: string;
  status: "accepted" | "dismissed" | "edited" | "noop";
}

export function selectLatestResolvedMeta(
  resolvedHistory: RequestSuggestionState["resolvedHistory"],
  requestAssemblyId: string,
  supplierId: string
): LatestResolvedMeta | null {
  let latest: LatestResolvedMeta | null = null;

  for (const h of resolvedHistory) {
    if (h.requestAssemblyId !== requestAssemblyId) continue;
    if (h.supplierId !== supplierId) continue;

    if (!latest || h.resolvedAt > latest.resolvedAt) {
      latest = { resolvedAt: h.resolvedAt, status: h.status as LatestResolvedMeta["status"] };
    }
  }

  return latest;
}

// ── Per-supplier cooldown computation ──

export function computeSupplierCooldown(input: {
  suggestions: RequestSuggestionState["suggestions"];
  resolvedHistory: RequestSuggestionState["resolvedHistory"];
  requestAssemblyId: string;
  supplierId: string;
  now: string;
}): RequestDraftGenerationCooldown {
  const { suggestions, resolvedHistory, requestAssemblyId, supplierId, now } = input;

  const latestGen = selectLatestGeneratedMeta(suggestions, requestAssemblyId, supplierId);
  const latestRes = selectLatestResolvedMeta(resolvedHistory, requestAssemblyId, supplierId);

  return {
    recentlyGenerated: isWithinGeneratedCooldown({
      latestGeneratedAt: latestGen?.generatedAt ?? null,
      now,
    }),
    recentlyResolved: isWithinResolvedCooldown({
      latestResolvedAt: latestRes?.resolvedAt ?? null,
      latestResolvedSource: latestRes?.status ?? null,
      now,
    }),
    latestGeneratedAt: latestGen?.generatedAt ?? null,
    latestResolvedAt: latestRes?.resolvedAt ?? null,
    latestResolvedSource: latestRes?.status ?? null,
  };
}
