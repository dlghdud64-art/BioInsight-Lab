/**
 * P0-3: Restricted Auto-Verify
 * AI 결과 자동 검증 — 극도로 보수적, 기본 OFF.
 *
 * 원칙:
 * - Global default OFF, docType opt-in only
 * - 모든 체크 통과 시에만 auto-verify 허용
 * - 하나라도 실패 → block (false-safe)
 */

import { db } from "@/lib/db";

// ── 결과 타입 ──

export interface AutoVerifyDecision {
  /** 최종 auto-verify 허용 여부 */
  canAutoVerify: boolean;
  /** 차단 사유 목록 (비어있으면 허용) */
  blockReasons: string[];
  /** 개별 체크 결과 */
  killSwitchCheck: boolean;
  docTypeOptInCheck: boolean;
  confidenceCheck: boolean;
  criticalFieldCheck: boolean;
  falseSafeCheck: boolean;
  exclusionCheck: boolean;
}

// ── 중요 필드 정의 ──

const CRITICAL_FIELDS = [
  "totalAmount",
  "currency",
  "vendorName",
  "subtotalAmount",
  "taxAmount",
] as const;

// ── Exclusion 패턴 ──

export interface ExclusionConfig {
  vendors: string[];
  templates: string[];
}

const DEFAULT_EXCLUSIONS: ExclusionConfig = {
  vendors: [],
  templates: [],
};

// ── Global Kill Switch ──

function isGlobalAutoVerifyDisabled(): boolean {
  return process.env.DISABLE_AUTO_VERIFY === "true";
}

// ── 중요 필드 충돌 검사 ──

export interface CriticalFieldConflict {
  hasConflict: boolean;
  conflicts: string[];
}

/** AI 결과와 기존 데이터 간 중요 필드 충돌 검사 */
export function checkCriticalFieldConflict(
  aiResult: unknown,
  existingData: unknown
): CriticalFieldConflict {
  if (!aiResult || !existingData) {
    return { hasConflict: false, conflicts: [] };
  }

  const ai = aiResult as Record<string, unknown>;
  const existing = existingData as Record<string, unknown>;
  const conflicts: string[] = [];

  for (const field of CRITICAL_FIELDS) {
    const aiVal = ai[field];
    const existVal = existing[field];

    if (aiVal === undefined || existVal === undefined) continue;

    // 숫자 비교: 5% 이상 차이 시 conflict
    if (typeof aiVal === "number" && typeof existVal === "number") {
      if (existVal !== 0 && Math.abs(aiVal - existVal) / Math.abs(existVal) > 0.05) {
        conflicts.push(`${field}: AI=${aiVal} vs Existing=${existVal}`);
      }
    }
    // 문자열 비교: 정확 일치
    else if (typeof aiVal === "string" && typeof existVal === "string") {
      if (aiVal.toLowerCase().trim() !== existVal.toLowerCase().trim()) {
        conflicts.push(`${field}: AI="${aiVal}" vs Existing="${existVal}"`);
      }
    }
  }

  return { hasConflict: conflicts.length > 0, conflicts };
}

// ── False-safe 감지 ──

export interface FalseSafeResult {
  isSafe: boolean;
  risks: string[];
}

/** 위험 패턴 감지 — 하나라도 해당 시 auto-verify 차단 */
export function detectFalseSafe(aiResult: unknown): FalseSafeResult {
  if (!aiResult) return { isSafe: false, risks: ["No AI result"] };

  const result = aiResult as Record<string, unknown>;
  const risks: string[] = [];

  // 빈 라인아이템
  const lineItems = result.lineItems as unknown[] | undefined;
  if (!lineItems || (Array.isArray(lineItems) && lineItems.length === 0)) {
    risks.push("Empty line items — cannot auto-verify without items");
  }

  // 총액 0인데 아이템이 있음
  const totalAmount = result.totalAmount as
    | { value: number | null }
    | number
    | null;
  const total =
    typeof totalAmount === "number"
      ? totalAmount
      : totalAmount && typeof totalAmount === "object"
        ? totalAmount.value
        : null;

  if (total === 0 && lineItems && Array.isArray(lineItems) && lineItems.length > 0) {
    risks.push("Zero total amount with non-empty items — suspicious");
  }

  // 극단적 고액 (1억 이상)
  if (total !== null && total !== undefined && total > 100_000_000) {
    risks.push(`Extremely high total (${total}) — requires human review`);
  }

  // 전체 신뢰도 낮음
  const overallConfidence = result.overallConfidence as number | undefined;
  if (overallConfidence !== undefined && overallConfidence < 0.5) {
    risks.push(`Very low confidence (${overallConfidence}) — unsafe for auto-verify`);
  }

  return { isSafe: risks.length === 0, risks };
}

// ── Exclusion 체크 ──

/** 벤더/템플릿 제외 목록 확인 */
export function isExcluded(
  vendorName: string | null,
  templateId: string | null,
  exclusions: ExclusionConfig = DEFAULT_EXCLUSIONS
): boolean {
  if (vendorName && exclusions.vendors.length > 0) {
    const normalized = vendorName.toLowerCase().trim();
    if (exclusions.vendors.some((v) => normalized.includes(v.toLowerCase()))) {
      return true;
    }
  }
  if (templateId && exclusions.templates.length > 0) {
    if (exclusions.templates.includes(templateId)) {
      return true;
    }
  }
  return false;
}

// ── Auto-Verify 토글 ──

/** docType의 auto-verify on/off */
export async function toggleAutoVerify(
  documentType: string,
  enabled: boolean,
  performedBy: string,
  reason: string
): Promise<void> {
  await db.canaryConfig.update({
    where: { documentType },
    data: { autoVerifyEnabled: enabled, updatedBy: performedBy, reason },
  });

  await db.canaryApprovalRecord.create({
    data: {
      documentType,
      action: enabled ? "AUTO_VERIFY_ON" : "AUTO_VERIFY_OFF",
      performedBy,
      reason,
    },
  });
}

// ── 메인 평가 함수 ──

export interface EvaluateAutoVerifyParams {
  documentType: string;
  aiResult: unknown;
  existingData?: unknown;
  confidence: number;
  vendorName?: string | null;
  templateId?: string | null;
  exclusions?: ExclusionConfig;
}

/** Auto-verify 가능 여부 종합 평가 — 모든 체크 통과 시에만 허용 */
export async function evaluateAutoVerify(
  params: EvaluateAutoVerifyParams
): Promise<AutoVerifyDecision> {
  const blockReasons: string[] = [];

  // 1. Global kill switch
  const killSwitchCheck = !isGlobalAutoVerifyDisabled();
  if (!killSwitchCheck) blockReasons.push("Global auto-verify disabled via env");

  // 2. DocType opt-in
  const config = await db.canaryConfig.findUnique({
    where: { documentType: params.documentType },
  });
  const docTypeOptInCheck = config?.autoVerifyEnabled === true;
  if (!docTypeOptInCheck)
    blockReasons.push(`Auto-verify not enabled for ${params.documentType}`);

  // 3. Confidence gate
  const threshold = config?.confidenceThreshold ?? 0.8;
  const confidenceCheck = params.confidence >= threshold;
  if (!confidenceCheck)
    blockReasons.push(
      `Confidence ${params.confidence} below threshold ${threshold}`
    );

  // 4. Critical field conflict
  const conflict = checkCriticalFieldConflict(
    params.aiResult,
    params.existingData
  );
  const criticalFieldCheck = !conflict.hasConflict;
  if (!criticalFieldCheck)
    blockReasons.push(`Critical field conflicts: ${conflict.conflicts.join(", ")}`);

  // 5. False-safe
  const falseSafe = detectFalseSafe(params.aiResult);
  const falseSafeCheck = falseSafe.isSafe;
  if (!falseSafeCheck)
    blockReasons.push(`False-safe risks: ${falseSafe.risks.join(", ")}`);

  // 6. Exclusion
  const exclusionCheck = !isExcluded(
    params.vendorName ?? null,
    params.templateId ?? null,
    params.exclusions
  );
  if (!exclusionCheck) blockReasons.push("Vendor or template excluded");

  return {
    canAutoVerify: blockReasons.length === 0,
    blockReasons,
    killSwitchCheck,
    docTypeOptInCheck,
    confidenceCheck,
    criticalFieldCheck,
    falseSafeCheck,
    exclusionCheck,
  };
}
