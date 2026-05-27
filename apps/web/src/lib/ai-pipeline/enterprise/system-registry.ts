/**
 * Enterprise System Registry — 내/외부 시스템 연동 레지스트리
 *
 * 연결되는 모든 시스템의 목록, 연동 방식, 소유 팀, 복구 모드를 관리합니다.
 */

export type IntegrationMode = "SYNC" | "ASYNC" | "EVENT_DRIVEN" | "BATCH";
export type SystemStatus = "HEALTHY" | "DEGRADED" | "DOWN" | "MAINTENANCE";
export type RecoveryMode = "AUTO_RETRY" | "DEAD_LETTER_QUEUE" | "MANUAL" | "CIRCUIT_BREAKER";

export interface SystemRegistryEntry {
  id: string;
  name: string;
  description: string;
  category: "INTERNAL" | "EXTERNAL";
  type: "ERP" | "WMS" | "IAM" | "DWH" | "TICKETING" | "FINANCE" | "PROCUREMENT" | "PLATFORM" | "OTHER";
  ownerTeam: string;
  integrationMode: IntegrationMode;
  recoveryMode: RecoveryMode;
  status: SystemStatus;
  endpoint: string | null;
  healthCheckUrl: string | null;
  slaUptimePercent: number;
  lastHealthCheckAt: Date | null;
  maxRetries: number;
  retryDelayMs: number;
  circuitBreakerThreshold: number;
  registeredAt: Date;
  metadata: Record<string, unknown>;
}

// In-memory store (production: DB-backed)
const registry: SystemRegistryEntry[] = [];

/**
 * 시스템 등록
 */
export function registerSystem(params: Omit<SystemRegistryEntry, "registeredAt" | "lastHealthCheckAt" | "status">): SystemRegistryEntry {
  const existing = registry.find((s) => s.id === params.id);
  if (existing) {
    Object.assign(existing, params);
    return existing;
  }

  const entry: SystemRegistryEntry = {
    ...params,
    status: "HEALTHY",
    lastHealthCheckAt: null,
    registeredAt: new Date(),
  };
  registry.push(entry);
  return entry;
}

export function getSystem(id: string): SystemRegistryEntry | undefined {
  return registry.find((s) => s.id === id);
}

export function getAllSystems(): SystemRegistryEntry[] {
  return [...registry];
}

export function updateSystemStatus(id: string, status: SystemStatus): boolean {
  const sys = registry.find((s) => s.id === id);
  if (!sys) return false;
  sys.status = status;
  sys.lastHealthCheckAt = new Date();
  return true;
}

export function getSystemsByCategory(category: "INTERNAL" | "EXTERNAL"): SystemRegistryEntry[] {
  return registry.filter((s) => s.category === category);
}

export function getHealthySystems(): SystemRegistryEntry[] {
  return registry.filter((s) => s.status === "HEALTHY");
}

export function getDegradedSystems(): SystemRegistryEntry[] {
  return registry.filter((s) => s.status === "DEGRADED" || s.status === "DOWN");
}

/**
 * 시스템 건강 상태 요약
 */
export function getSystemHealthSummary(): {
  total: number;
  healthy: number;
  degraded: number;
  down: number;
  maintenance: number;
} {
  return {
    total: registry.length,
    healthy: registry.filter((s) => s.status === "HEALTHY").length,
    degraded: registry.filter((s) => s.status === "DEGRADED").length,
    down: registry.filter((s) => s.status === "DOWN").length,
    maintenance: registry.filter((s) => s.status === "MAINTENANCE").length,
  };
}
