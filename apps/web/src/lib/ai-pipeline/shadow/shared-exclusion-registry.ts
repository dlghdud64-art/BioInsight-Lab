/**
 * Shared Exclusion Registry — 공통 배제 자산화
 *
 * 특정 문서 타입에서 발견된 Anomaly(특정 Vendor의 양식 에러, Critical Conflict 패턴 등)를
 * 레지스트리에 등록하여, 신규 문서 타입 Launch 시 자동으로 방어/배제되도록 합니다.
 */

// ── Types ──

export type ExclusionSource = "FALSE_SAFE" | "CRITICAL_CONFLICT" | "VENDOR_ANOMALY" | "TEMPLATE_ERROR" | "MANUAL";
export type ExclusionScope = "GLOBAL" | "DOCTYPE_SPECIFIC";

export interface ExclusionEntry {
  id: string;
  pattern: string;            // vendor name, template fingerprint, or pattern description
  patternType: "VENDOR" | "TEMPLATE" | "CONFIDENCE_BAND" | "ORG";
  source: ExclusionSource;
  scope: ExclusionScope;
  sourceDocumentType: string;  // where the anomaly was first detected
  reason: string;
  registeredAt: Date;
  registeredBy: string;
  active: boolean;
  incidentCount: number;       // how many times this pattern caused issues
  lastIncidentAt: Date | null;
  appliedToDocTypes: string[]; // which doc types are currently using this exclusion
}

export interface ExclusionMatchResult {
  matched: boolean;
  entries: ExclusionEntry[];
  autoBlocked: boolean;
  reason: string | null;
}

// ── In-memory store (production: DB-backed) ──

const registry: ExclusionEntry[] = [];

/**
 * 배제 패턴 등록
 */
export function registerExclusion(params: {
  pattern: string;
  patternType: ExclusionEntry["patternType"];
  source: ExclusionSource;
  scope: ExclusionScope;
  sourceDocumentType: string;
  reason: string;
  registeredBy: string;
}): ExclusionEntry {
  // Check for duplicate
  const existing = registry.find(
    (e) => e.pattern === params.pattern && e.patternType === params.patternType && e.active,
  );
  if (existing) {
    existing.incidentCount++;
    existing.lastIncidentAt = new Date();
    return existing;
  }

  const entry: ExclusionEntry = {
    id: `EX-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    pattern: params.pattern,
    patternType: params.patternType,
    source: params.source,
    scope: params.scope,
    sourceDocumentType: params.sourceDocumentType,
    reason: params.reason,
    registeredAt: new Date(),
    registeredBy: params.registeredBy,
    active: true,
    incidentCount: 1,
    lastIncidentAt: new Date(),
    appliedToDocTypes: [params.sourceDocumentType],
  };

  registry.push(entry);
  return entry;
}

/**
 * 신규 DocType 런칭 시 적용해야 할 배제 목록 조회
 */
export function getExclusionsForNewDocType(documentType: string): ExclusionEntry[] {
  return registry.filter(
    (e) => e.active && (e.scope === "GLOBAL" || e.appliedToDocTypes.includes(documentType)),
  );
}

/**
 * 특정 패턴이 배제 대상인지 확인
 */
export function checkExclusion(params: {
  vendor?: string;
  templateFingerprint?: string;
  confidenceBand?: string;
  orgId?: string;
}): ExclusionMatchResult {
  const matched: ExclusionEntry[] = [];

  for (const entry of registry.filter((e) => e.active)) {
    if (entry.patternType === "VENDOR" && params.vendor && entry.pattern === params.vendor) {
      matched.push(entry);
    }
    if (entry.patternType === "TEMPLATE" && params.templateFingerprint && entry.pattern === params.templateFingerprint) {
      matched.push(entry);
    }
    if (entry.patternType === "CONFIDENCE_BAND" && params.confidenceBand && entry.pattern === params.confidenceBand) {
      matched.push(entry);
    }
    if (entry.patternType === "ORG" && params.orgId && entry.pattern === params.orgId) {
      matched.push(entry);
    }
  }

  return {
    matched: matched.length > 0,
    entries: matched,
    autoBlocked: matched.some((e) => e.source === "FALSE_SAFE" || e.source === "CRITICAL_CONFLICT"),
    reason: matched.length > 0
      ? `배제 패턴 ${matched.length}건 매칭: ${matched.map((e) => e.pattern).join(", ")}`
      : null,
  };
}

/**
 * 배제 패턴을 새 DocType에 적용
 */
export function applyExclusionsToDocType(documentType: string): string[] {
  const applied: string[] = [];
  for (const entry of registry.filter((e) => e.active && e.scope === "GLOBAL")) {
    if (!entry.appliedToDocTypes.includes(documentType)) {
      entry.appliedToDocTypes.push(documentType);
      applied.push(entry.pattern);
    }
  }
  return applied;
}

/**
 * 배제 패턴 비활성화
 */
export function deactivateExclusion(id: string): boolean {
  const entry = registry.find((e) => e.id === id);
  if (!entry) return false;
  entry.active = false;
  return true;
}

/**
 * 레지스트리 조회
 */
export function getExclusionRegistry(params?: {
  active?: boolean;
  source?: ExclusionSource;
  patternType?: ExclusionEntry["patternType"];
}): ExclusionEntry[] {
  let items = [...registry];
  if (params?.active !== undefined) items = items.filter((e) => e.active === params.active);
  if (params?.source) items = items.filter((e) => e.source === params.source);
  if (params?.patternType) items = items.filter((e) => e.patternType === params.patternType);
  return items;
}

/**
 * 레지스트리 통계
 */
export function getExclusionStats(): {
  total: number;
  active: number;
  bySource: Record<string, number>;
  byType: Record<string, number>;
} {
  const active = registry.filter((e) => e.active);
  const bySource: Record<string, number> = {};
  const byType: Record<string, number> = {};

  for (const e of active) {
    bySource[e.source] = (bySource[e.source] ?? 0) + 1;
    byType[e.patternType] = (byType[e.patternType] ?? 0) + 1;
  }

  return { total: registry.length, active: active.length, bySource, byType };
}
