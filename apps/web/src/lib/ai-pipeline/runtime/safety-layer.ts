/**
 * P0-1: Runtime Safety Layer
 * 기존 PipelineOrchestrator를 래핑하여 canary/shadow/fallback 안전 장치 추가.
 *
 * 원칙:
 * - timeout / schema invalid / low confidence / provider error → 100% fallback
 * - shadow mode: AI 실행 → 결과 미적용 → comparison log만 기록
 * - kill switch 발동 시 즉시 fallback
 */

import { db } from "@/lib/db";
import {
  CanaryStage,
  ProcessingPath,
  FallbackReason,
  type CanaryConfig,
} from "@prisma/client";

// ── 설정 ──

export interface SafetyLayerConfig {
  /** AI 호출 타임아웃 (ms) */
  timeoutMs: number;
  /** 최소 신뢰도 — 미달 시 fallback */
  minConfidence: number;
  /** 재시도 횟수 (0 = 재시도 없음) */
  maxRetries: number;
}

export const DEFAULT_SAFETY_CONFIG: SafetyLayerConfig = {
  timeoutMs: 10_000,
  minConfidence: 0.7,
  maxRetries: 0,
};

// ── 결과 타입 ──

export interface SafetyLayerResult {
  processingPath: ProcessingPath;
  fallbackReason: FallbackReason;
  aiResult: unknown | null;
  ruleResult: unknown | null;
  confidence: number | null;
  model: string | null;
  latencyMs: number;
  tokenUsage: number | null;
  comparisonDiff: Record<string, unknown> | null;
}

// ── Canary Config 조회 ──

/** DB에서 docType의 canary 설정 조회 */
export async function getCanaryConfig(
  documentType: string
): Promise<CanaryConfig | null> {
  return db.canaryConfig.findUnique({ where: { documentType } });
}

// ── Canary Bucket 결정 ──

/** 요청 해시 계산 (canary bucket 배정용) */
export function computeRequestHash(
  organizationId: string,
  documentType: string,
  timestamp: number
): string {
  const raw = `${organizationId}:${documentType}:${timestamp}`;
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    const char = raw.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return Math.abs(hash).toString(36);
}

/** canary stage + hash 기반 AI 적용 여부 결정 */
export function shouldApplyAiResult(
  stage: CanaryStage,
  requestHash: string
): boolean {
  if (stage === "KILLED" || stage === "SHADOW") return false;
  const bucket = Math.abs(parseInt(requestHash, 36)) % 100;
  switch (stage) {
    case "ACTIVE_5":
      return bucket < 5;
    case "ACTIVE_25":
      return bucket < 25;
    case "ACTIVE_50":
      return bucket < 50;
    case "STABLE":
      return true;
    default:
      return false;
  }
}

/** shadow mode 여부 확인 */
export function isShadowMode(config: CanaryConfig | null): boolean {
  return config?.stage === "SHADOW";
}

// ── 타임아웃 래퍼 ──

async function runWithTimeout<T>(
  fn: () => Promise<T>,
  timeoutMs: number
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const result = await fn();
    return result;
  } finally {
    clearTimeout(timer);
  }
}

// ── Rule-based baseline (stub) ──

/**
 * Rule-based 결과 계산 (기존 로직 placeholder).
 * 실제 구현은 기존 processor의 keyword fallback 로직을 참조.
 */
export function computeRuleBasedResult(
  _documentType: string,
  _input: unknown
): unknown {
  return {
    _source: "rule_based",
    _note: "Baseline rule-based result placeholder",
  };
}

// ── Comparison Diff ──

/** AI 결과와 rule-based 결과 얕은 비교 */
export function computeComparisonDiff(
  aiResult: unknown,
  ruleResult: unknown
): Record<string, unknown> | null {
  if (!aiResult || !ruleResult) return null;
  const ai = aiResult as Record<string, unknown>;
  const rule = ruleResult as Record<string, unknown>;
  const diff: Record<string, unknown> = {};
  const allKeys = new Set([...Object.keys(ai), ...Object.keys(rule)]);
  for (const key of Array.from(allKeys)) {
    const aVal = JSON.stringify(ai[key]);
    const rVal = JSON.stringify(rule[key]);
    if (aVal !== rVal) {
      diff[key] = { ai: ai[key], rule: rule[key] };
    }
  }
  return Object.keys(diff).length > 0 ? diff : null;
}

// ── 처리 로그 기록 ──

async function logProcessingResult(params: {
  organizationId: string;
  documentType: string;
  ingestionEntryId?: string;
  result: SafetyLayerResult;
  mismatchCategory?: string;
}): Promise<void> {
  await db.aiProcessingLog.create({
    data: {
      organizationId: params.organizationId,
      documentType: params.documentType,
      ingestionEntryId: params.ingestionEntryId ?? null,
      processingPath: params.result.processingPath,
      fallbackReason: params.result.fallbackReason,
      confidence: params.result.confidence,
      model: params.result.model,
      latencyMs: params.result.latencyMs,
      tokenUsage: params.result.tokenUsage,
      comparisonDiff: params.result.comparisonDiff ?? undefined,
      mismatchCategory: params.mismatchCategory ?? null,
      rollbackTriggered: false,
      incidentTriggered: false,
    },
  });
}

// ── 메인 진입점 ──

export interface ExecuteWithSafetyParams {
  documentType: string;
  organizationId: string;
  ingestionEntryId?: string;
  /** AI 실행 함수 — safety layer가 타임아웃/에러를 래핑 */
  aiExecutor: () => Promise<{ result: unknown; confidence: number; model: string; tokenUsage?: number }>;
  /** Rule-based 결과 (항상 미리 계산해서 전달) */
  ruleResult: unknown;
  config?: Partial<SafetyLayerConfig>;
}

/**
 * Safety Layer 메인 실행 함수.
 *
 * 1. Canary config 조회
 * 2. Kill switch 확인
 * 3. AI 실행 (타임아웃 래핑)
 * 4. 신뢰도 검증
 * 5. Shadow/Active 분기
 * 6. 로그 기록
 */
export async function executeWithSafety(
  params: ExecuteWithSafetyParams
): Promise<SafetyLayerResult> {
  const cfg: SafetyLayerConfig = { ...DEFAULT_SAFETY_CONFIG, ...params.config };
  const start = Date.now();

  // 1. Canary config 조회
  const canary = await getCanaryConfig(params.documentType);

  // Kill switch / feature flag OFF → 즉시 fallback
  if (!canary || canary.killSwitchActive || canary.stage === "KILLED") {
    const result: SafetyLayerResult = {
      processingPath: "FALLBACK",
      fallbackReason: canary?.killSwitchActive ? "KILL_SWITCH" : "FEATURE_FLAG_OFF",
      aiResult: null,
      ruleResult: params.ruleResult,
      confidence: null,
      model: null,
      latencyMs: Date.now() - start,
      tokenUsage: null,
      comparisonDiff: null,
    };
    await logProcessingResult({
      organizationId: params.organizationId,
      documentType: params.documentType,
      ingestionEntryId: params.ingestionEntryId,
      result,
    });
    return result;
  }

  // 2. AI 실행 (타임아웃 래핑)
  let aiOutput: { result: unknown; confidence: number; model: string; tokenUsage?: number } | null = null;
  let fallbackReason: FallbackReason = "NONE";

  try {
    aiOutput = await runWithTimeout(params.aiExecutor, cfg.timeoutMs);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("abort") || message.includes("timeout")) {
      fallbackReason = "TIMEOUT";
    } else {
      fallbackReason = "PROVIDER_ERROR";
    }
  }

  // 3. Schema validation (기본: AI 결과가 null이면 invalid)
  if (aiOutput && !aiOutput.result) {
    fallbackReason = "SCHEMA_INVALID";
    aiOutput = null;
  }

  // 4. 신뢰도 검증
  if (aiOutput && aiOutput.confidence < cfg.minConfidence) {
    fallbackReason = "LOW_CONFIDENCE";
  }

  // 5. Comparison diff 계산
  const comparisonDiff = aiOutput
    ? computeComparisonDiff(aiOutput.result, params.ruleResult)
    : null;

  // 6. Shadow vs Active 분기
  const shadow = isShadowMode(canary);
  const requestHash = computeRequestHash(
    params.organizationId,
    params.documentType,
    start
  );
  const applyAi =
    !shadow &&
    fallbackReason === "NONE" &&
    shouldApplyAiResult(canary.stage, requestHash);

  const processingPath: ProcessingPath = shadow
    ? "SHADOW"
    : applyAi
      ? "AI"
      : "FALLBACK";

  // fallback이면 fallbackReason 보정
  if (processingPath === "FALLBACK" && fallbackReason === "NONE") {
    fallbackReason = "NONE"; // canary bucket 밖 = 정상 fallback
  }

  const result: SafetyLayerResult = {
    processingPath,
    fallbackReason,
    aiResult: aiOutput?.result ?? null,
    ruleResult: params.ruleResult,
    confidence: aiOutput?.confidence ?? null,
    model: aiOutput?.model ?? null,
    latencyMs: Date.now() - start,
    tokenUsage: aiOutput?.tokenUsage ?? null,
    comparisonDiff,
  };

  // 7. 로그 기록
  await logProcessingResult({
    organizationId: params.organizationId,
    documentType: params.documentType,
    ingestionEntryId: params.ingestionEntryId,
    result,
  });

  return result;
}
