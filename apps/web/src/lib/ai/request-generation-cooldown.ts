/**
 * Request Draft Generation Cooldown — recently_generated / recently_resolved 시간축 억제
 *
 * 고정 규칙:
 * 1. cooldown은 eligibility 위의 별도 시간축 억제층. eligible이어도 cooldown이면 suppress.
 * 2. recently_generated(중복 생성 방지) ≠ recently_resolved(재등장 억제). 분리.
 * 3. contextHash-local only. 다른 컨텍스트 cooldown이 현재 컨텍스트를 막으면 안 됨.
 * 4. resolution source별 cooldown 강도 차등: noop > dismissed > edited > accepted > generated.
 * 5. cooldown은 영구 금지가 아닌 temporary suppress. 시간 + meaningful change → eventually 열림.
 * 6. 동일 now 기준으로 모든 time-based 판단 수행.
 *
 * Migration note (Batch 2 후속):
 *   이전에는 RequestSuggestionState.suggestions (Record) + resolvedHistory.{requestAssemblyId,supplierId}
 *   기반이었으나, 현재 store 는 single activeSuggestion + contextHash-only resolvedHistory.
 *   본 모듈도 그에 맞춰 contextHash 기반 lookup 으로 단순화. (suggestion-store.ts 와 lineage 일치)
 */

import type {
  RequestSuggestionState,
  RequestDraftSuggestion,
} from "./request-suggestion-store";

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

/**
 * activeSuggestion 이 있고 그 contextHash 가 일치하면 generated meta 반환.
 * Note: 현재 store 는 contextHash 당 active suggestion 1개만 보유하므로
 *       복수 후보 비교가 불필요하다.
 */
export function selectLatestGeneratedMeta(
  activeSuggestion: RequestDraftSuggestion | null,
  contextHash: string,
): LatestGeneratedMeta | null {
  if (!activeSuggestion) return null;
  if (activeSuggestion.sourceContext.contextHash !== contextHash) return null;
  return {
    suggestionId: activeSuggestion.id,
    generatedAt: activeSuggestion.generatedAt,
  };
}

// ── Latest resolved query ──

export interface LatestResolvedMeta {
  resolvedAt: string;
  status: "accepted" | "dismissed" | "edited" | "noop";
}

export function selectLatestResolvedMeta(
  resolvedHistory: RequestSuggestionState["resolvedHistory"],
  contextHash: string,
): LatestResolvedMeta | null {
  let latest: LatestResolvedMeta | null = null;

  for (const h of resolvedHistory) {
    if (h.contextHash !== contextHash) continue;
    if (!latest || h.resolvedAt > latest.resolvedAt) {
      // resolvedHistory 의 status 는 "accepted"|"dismissed"|"edited" 만 저장됨.
      // "noop" 은 store 가 만들지 않으므로 cast 가 안전.
      latest = {
        resolvedAt: h.resolvedAt,
        status: h.status as LatestResolvedMeta["status"],
      };
    }
  }

  return latest;
}

// ── Cooldown computation (contextHash 단위) ──

export function computeContextCooldown(input: {
  state: RequestSuggestionState;
  contextHash: string;
  now: string;
}): RequestDraftGenerationCooldown {
  const { state, contextHash, now } = input;

  const latestGen = selectLatestGeneratedMeta(state.activeSuggestion, contextHash);
  const latestRes = selectLatestResolvedMeta(state.resolvedHistory, contextHash);

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
