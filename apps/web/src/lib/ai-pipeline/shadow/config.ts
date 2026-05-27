/**
 * Shadow Runtime Config — 환경변수 기반 Feature Flag
 *
 * AI Off 시 기존 Rules Path와 Byte-level 일치 보장.
 * 환경변수 변경만으로 즉시 무중단 Rollback 가능.
 */

import type { ShadowRuntimeConfig } from "./types";

export function loadShadowConfig(): ShadowRuntimeConfig {
  return {
    enabled: process.env.AI_RUNTIME_ENABLED === "true",
    shadowMode: process.env.AI_SHADOW_MODE === "true",
    asyncShadow: process.env.AI_ASYNC_SHADOW !== "false",
    provider: process.env.AI_PROVIDER ?? "openai",
    model: process.env.AI_MODEL ?? "gpt-4o-mini",
    timeoutMs: parseInt(process.env.AI_TIMEOUT_MS ?? "15000", 10),
    maxRetries: parseInt(process.env.AI_MAX_RETRIES ?? "1", 10),
    minConfidence: parseFloat(process.env.AI_MIN_CONFIDENCE ?? "0.6"),
    fallbackToRules: process.env.AI_FALLBACK_TO_RULES !== "false",
    rolloutPercent: parseInt(process.env.AI_ROLLOUT_PERCENT ?? "0", 10),
    dailyCostLimitUsd: parseFloat(process.env.AI_DAILY_COST_LIMIT_USD ?? "10"),
  };
}

/** 특정 요청이 AI rollout 대상인지 판정 (deterministic hash) */
export function isInRollout(requestId: string, rolloutPercent: number): boolean {
  if (rolloutPercent >= 100) return true;
  if (rolloutPercent <= 0) return false;

  let hash = 0;
  for (let i = 0; i < requestId.length; i++) {
    hash = ((hash << 5) - hash + requestId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash % 100) < rolloutPercent;
}
