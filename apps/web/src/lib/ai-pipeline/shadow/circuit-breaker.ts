/**
 * Circuit Breaker — 카나리 자동 중단 (Auto-Halt)
 *
 * 고위험 이벤트 1건 발생 시 해당 문서 타입 즉시 SHADOW_ONLY로 강등.
 * CanaryHaltLog에 발동 기록 저장.
 *
 * 트리거 조건:
 * 1. Unknown Auto Verify 시도
 * 2. Org Scope 위반 시도
 * 3. Dedup Invariant 붕괴
 * 4. High-risk Task Mapping Mismatch
 * 5. Provider Error / Timeout Spike (5분 내 3건+)
 */

import { db } from "@/lib/db";
import { randomUUID } from "crypto";
import type { MismatchCategory, CanaryStage, CanaryHaltEvent, ProcessingPath } from "./types";

// 5분 내 provider error 카운트 (in-memory, process restart로 리셋)
const errorWindow: Map<string, number[]> = new Map();
const ERROR_WINDOW_MS = 5 * 60 * 1000;
const ERROR_SPIKE_THRESHOLD = 3;

/** 즉시 Halt 대상인 고위험 카테고리 */
const INSTANT_HALT_CATEGORIES: MismatchCategory[] = [
  "AUTO_VERIFY_RISK",
  "ORG_SCOPE_BLOCKED",
  "TASK_MAPPING_DIFF",
];

interface CircuitBreakerInput {
  documentType: string;
  currentStage: CanaryStage;
  mismatchCategory: MismatchCategory;
  processingPath: ProcessingPath;
  requestId: string;
}

interface CircuitBreakerResult {
  halted: boolean;
  haltEvent?: CanaryHaltEvent;
}

export async function checkCircuitBreaker(
  input: CircuitBreakerInput,
): Promise<CircuitBreakerResult> {
  // Rules 경로 또는 Shadow 경로에서는 서킷 브레이커 불필요
  if (input.processingPath === "rules" || input.processingPath === "ai_shadow") {
    return { halted: false };
  }

  // 이미 OFF/SHADOW_ONLY면 강등할 곳 없음
  if (input.currentStage === "OFF" || input.currentStage === "SHADOW_ONLY") {
    return { halted: false };
  }

  // ── 즉시 Halt 검사 ──
  if (INSTANT_HALT_CATEGORIES.includes(input.mismatchCategory)) {
    const reason = getHaltReason(input.mismatchCategory);
    const event = await recordHalt({
      documentType: input.documentType,
      previousStage: input.currentStage,
      haltedToStage: "SHADOW_ONLY",
      reason,
      triggerCategory: input.mismatchCategory,
      triggerRequestId: input.requestId,
    });
    return { halted: true, haltEvent: event };
  }

  // ── Provider Error / Timeout Spike 검사 ──
  if (
    input.mismatchCategory === "PROVIDER_ERROR_FALLBACK" ||
    input.mismatchCategory === "TIMEOUT_FALLBACK"
  ) {
    const key = `${input.documentType}`;
    const now = Date.now();
    const timestamps = errorWindow.get(key) ?? [];

    // 윈도우 밖 제거
    const filtered = timestamps.filter((t) => now - t < ERROR_WINDOW_MS);
    filtered.push(now);
    errorWindow.set(key, filtered);

    if (filtered.length >= ERROR_SPIKE_THRESHOLD) {
      // Spike → Halt
      errorWindow.delete(key);
      const event = await recordHalt({
        documentType: input.documentType,
        previousStage: input.currentStage,
        haltedToStage: "SHADOW_ONLY",
        reason: `Provider error/timeout spike: ${filtered.length}건 / 5분 (threshold: ${ERROR_SPIKE_THRESHOLD})`,
        triggerCategory: input.mismatchCategory,
        triggerRequestId: input.requestId,
      });
      return { halted: true, haltEvent: event };
    }
  }

  return { halted: false };
}

function getHaltReason(category: MismatchCategory): string {
  switch (category) {
    case "AUTO_VERIFY_RISK":
      return "Unknown 문서 Auto-verify 시도 감지 — 즉시 강등";
    case "ORG_SCOPE_BLOCKED":
      return "Org Scope 위반 시도 감지 — 즉시 강등";
    case "TASK_MAPPING_DIFF":
      return "High-risk Task Mapping Mismatch — 즉시 강등";
    default:
      return `고위험 이벤트 감지: ${category}`;
  }
}

async function recordHalt(event: CanaryHaltEvent): Promise<CanaryHaltEvent> {
  try {
    await db.$executeRawUnsafe(
      `INSERT INTO "CanaryHaltLog" (
        "id", "documentType", "previousStage", "haltedToStage",
        "reason", "triggerCategory", "triggerRequestId", "createdAt"
      ) VALUES (
        $1, $2, $3::"CanaryStage", $4::"CanaryStage",
        $5, $6::"ShadowMismatchCategory", $7, NOW()
      )`,
      randomUUID(),
      event.documentType,
      event.previousStage,
      event.haltedToStage,
      event.reason,
      event.triggerCategory,
      event.triggerRequestId,
    );

    console.error(
      `[CircuitBreaker] HALT: ${event.documentType} ${event.previousStage} → ${event.haltedToStage} | ${event.reason}`,
    );
  } catch (err) {
    console.error("[CircuitBreaker] Halt 기록 실패:", err);
  }

  return event;
}
