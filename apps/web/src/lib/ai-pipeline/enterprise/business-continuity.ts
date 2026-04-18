/**
 * Business Continuity — 외부 시스템 다운 타임 대응
 *
 * Event Replay, Manual Recovery, Dead-letter Queue를 통해
 * 메인 AI 런타임을 보호하는 서킷 브레이커를 설계합니다.
 *
 * 원칙: 하위 시스템 장애가 AI Safety Path를 멈추지 않음
 */

import { getSystem, updateSystemStatus } from "./system-registry";
import type { SystemStatus } from "./system-registry";

// ── Circuit Breaker ──

export type CircuitState = "CLOSED" | "OPEN" | "HALF_OPEN";

export interface SystemCircuitBreaker {
  systemId: string;
  state: CircuitState;
  failureCount: number;
  threshold: number;
  lastFailureAt: Date | null;
  openedAt: Date | null;
  halfOpenAt: Date | null;
  cooldownMs: number;
}

// In-memory breakers
const breakers: Map<string, SystemCircuitBreaker> = new Map();

/**
 * 시스템별 서킷 브레이커 초기화
 */
export function initCircuitBreaker(systemId: string, threshold?: number, cooldownMs?: number): SystemCircuitBreaker {
  const breaker: SystemCircuitBreaker = {
    systemId,
    state: "CLOSED",
    failureCount: 0,
    threshold: threshold ?? 5,
    lastFailureAt: null,
    openedAt: null,
    halfOpenAt: null,
    cooldownMs: cooldownMs ?? 60_000,
  };
  breakers.set(systemId, breaker);
  return breaker;
}

/**
 * 실패 기록
 */
export function recordFailure(systemId: string): {
  circuitOpened: boolean;
  degradedMode: boolean;
} {
  let breaker = breakers.get(systemId);
  if (!breaker) breaker = initCircuitBreaker(systemId);

  breaker.failureCount++;
  breaker.lastFailureAt = new Date();

  if (breaker.failureCount >= breaker.threshold && breaker.state === "CLOSED") {
    breaker.state = "OPEN";
    breaker.openedAt = new Date();
    updateSystemStatus(systemId, "DOWN");
    return { circuitOpened: true, degradedMode: true };
  }

  if (breaker.failureCount >= Math.floor(breaker.threshold / 2)) {
    updateSystemStatus(systemId, "DEGRADED");
  }

  return { circuitOpened: false, degradedMode: breaker.state === "OPEN" };
}

/**
 * 성공 기록
 */
export function recordSuccess(systemId: string): void {
  const breaker = breakers.get(systemId);
  if (!breaker) return;

  if (breaker.state === "HALF_OPEN") {
    breaker.state = "CLOSED";
    breaker.failureCount = 0;
    breaker.openedAt = null;
    breaker.halfOpenAt = null;
    updateSystemStatus(systemId, "HEALTHY");
  } else if (breaker.state === "CLOSED") {
    breaker.failureCount = Math.max(0, breaker.failureCount - 1);
  }
}

/**
 * Half-open 전환 시도 (cooldown 후)
 */
export function tryHalfOpen(systemId: string): boolean {
  const breaker = breakers.get(systemId);
  if (!breaker || breaker.state !== "OPEN") return false;

  const now = Date.now();
  if (breaker.openedAt && now - breaker.openedAt.getTime() >= breaker.cooldownMs) {
    breaker.state = "HALF_OPEN";
    breaker.halfOpenAt = new Date();
    return true;
  }
  return false;
}

/**
 * 요청 허용 여부
 */
export function canRequest(systemId: string): boolean {
  const breaker = breakers.get(systemId);
  if (!breaker) return true;
  if (breaker.state === "CLOSED") return true;
  if (breaker.state === "HALF_OPEN") return true; // allow one probe
  return false; // OPEN
}

export function getCircuitBreakerState(systemId: string): SystemCircuitBreaker | undefined {
  return breakers.get(systemId);
}

// ── Degraded Mode ──

export type DegradedModeAction = "QUEUE_FOR_REPLAY" | "SKIP_OPTIONAL" | "FALLBACK_TO_CACHE" | "MANUAL_INTERVENTION";

export interface DegradedModeConfig {
  systemId: string;
  action: DegradedModeAction;
  description: string;
}

const DEGRADED_MODE_CONFIGS: DegradedModeConfig[] = [
  { systemId: "ERP", action: "QUEUE_FOR_REPLAY", description: "ERP 다운 시 이벤트를 큐에 저장하고 복구 후 재전송" },
  { systemId: "WMS", action: "QUEUE_FOR_REPLAY", description: "WMS 다운 시 재고 확인 이벤트를 큐에 저장" },
  { systemId: "IAM", action: "FALLBACK_TO_CACHE", description: "IAM 다운 시 캐시된 역할 정보 사용" },
  { systemId: "TICKETING", action: "QUEUE_FOR_REPLAY", description: "티켓팅 다운 시 티켓 생성 요청을 큐에 저장" },
  { systemId: "FINANCE", action: "SKIP_OPTIONAL", description: "재무 시스템 다운 시 예산 확인 건너뛰기 (수동 검토 필요)" },
  { systemId: "DWH", action: "SKIP_OPTIONAL", description: "DWH 다운 시 분석 쿼리 건너뛰기" },
];

export function getDegradedModeAction(systemId: string): DegradedModeAction {
  const config = DEGRADED_MODE_CONFIGS.find((c) => c.systemId === systemId);
  return config?.action ?? "MANUAL_INTERVENTION";
}

// ── Event Replay Queue ──

interface ReplayQueueItem {
  id: string;
  systemId: string;
  eventPayload: unknown;
  queuedAt: Date;
  retryCount: number;
  maxRetries: number;
}

const replayQueue: ReplayQueueItem[] = [];

export function queueForReplay(systemId: string, eventPayload: unknown): string {
  const item: ReplayQueueItem = {
    id: `RPL-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    systemId,
    eventPayload,
    queuedAt: new Date(),
    retryCount: 0,
    maxRetries: 5,
  };
  replayQueue.push(item);
  return item.id;
}

export function getReplayQueueSize(systemId?: string): number {
  if (systemId) return replayQueue.filter((r) => r.systemId === systemId).length;
  return replayQueue.length;
}

export function drainReplayQueue(systemId: string): ReplayQueueItem[] {
  const items = replayQueue.filter((r) => r.systemId === systemId);
  for (const item of items) {
    const idx = replayQueue.indexOf(item);
    if (idx >= 0) replayQueue.splice(idx, 1);
  }
  return items;
}

/**
 * 전체 시스템 연속성 상태 요약
 */
export function getContinuityStatus(): {
  systemStates: { systemId: string; circuitState: CircuitState; degradedAction: DegradedModeAction }[];
  replayQueueTotal: number;
  openCircuits: number;
} {
  const systemStates: { systemId: string; circuitState: CircuitState; degradedAction: DegradedModeAction }[] = [];

  for (const [systemId, breaker] of breakers) {
    systemStates.push({
      systemId,
      circuitState: breaker.state,
      degradedAction: getDegradedModeAction(systemId),
    });
  }

  return {
    systemStates,
    replayQueueTotal: replayQueue.length,
    openCircuits: systemStates.filter((s) => s.circuitState === "OPEN").length,
  };
}
