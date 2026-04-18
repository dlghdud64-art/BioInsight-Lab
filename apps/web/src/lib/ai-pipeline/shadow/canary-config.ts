/**
 * Canary Config — 문서 타입별 카나리 롤아웃 설정
 *
 * 환경변수 AI_CANARY_CONFIG (JSON)로 제어.
 * Stable Bucketing: hash(orgId + documentId) % 100으로 일관된 라우팅.
 * 승격 순서: OFF → SHADOW_ONLY → ACTIVE_5 → ACTIVE_25 → ACTIVE_50 → ACTIVE_100
 */

import type { CanaryConfig, CanaryStage, DocTypeCanaryConfig, AutoVerifyPolicy, ProcessingPath } from "./types";
import { CANARY_STAGES } from "./types";

const DEFAULT_DOC_TYPE_CONFIG: DocTypeCanaryConfig = {
  stage: "OFF",
  allowAutoVerify: false,
};

/** 환경변수에서 카나리 설정 로드 */
export function loadCanaryConfig(): CanaryConfig {
  const globalEnabled = process.env.AI_RUNTIME_ENABLED === "true";
  const raw = process.env.AI_CANARY_CONFIG;

  if (!raw) {
    return { globalEnabled, docTypes: {} };
  }

  try {
    const parsed = JSON.parse(raw);
    const docTypes: Record<string, DocTypeCanaryConfig> = {};

    if (parsed.docTypes && typeof parsed.docTypes === "object") {
      for (const [key, val] of Object.entries(parsed.docTypes)) {
        const v = val as Record<string, unknown>;
        const config: DocTypeCanaryConfig = {
          stage: CANARY_STAGES.includes(v.stage as CanaryStage)
            ? (v.stage as CanaryStage)
            : "OFF",
          allowAutoVerify: v.allowAutoVerify === true,
        };

        // Auto-Verify Policy 파싱 (opt-in)
        if (v.autoVerifyPolicy && typeof v.autoVerifyPolicy === "object") {
          const p = v.autoVerifyPolicy as Record<string, unknown>;
          config.autoVerifyPolicy = {
            minConfidence: typeof p.minConfidence === "number" ? p.minConfidence : 0.99,
            onlyIfSchemaValid: p.onlyIfSchemaValid !== false,
            onlyIfNoCriticalFieldConflict: p.onlyIfNoCriticalFieldConflict !== false,
            requireNoClassificationAmbiguity: p.requireNoClassificationAmbiguity !== false,
            requireNoFallbackReason: p.requireNoFallbackReason !== false,
            requireStableTemplateHistory: p.requireStableTemplateHistory !== false,
            maxRecentAnomalyRate: typeof p.maxRecentAnomalyRate === "number" ? p.maxRecentAnomalyRate : 0.05,
            rollbackOnFirstFalseSafe: p.rollbackOnFirstFalseSafe !== false,
            excludedTemplates: Array.isArray(p.excludedTemplates) ? p.excludedTemplates as string[] : [],
            excludedVendors: Array.isArray(p.excludedVendors) ? p.excludedVendors as string[] : [],
          };
        }

        docTypes[key] = config;
      }
    }

    return { globalEnabled, docTypes };
  } catch {
    console.warn("[CanaryConfig] JSON 파싱 실패, 기본값 사용");
    return { globalEnabled, docTypes: {} };
  }
}

/** 문서 타입의 카나리 설정 조회 */
export function getDocTypeConfig(
  config: CanaryConfig,
  documentType: string,
): DocTypeCanaryConfig {
  return config.docTypes[documentType] ?? DEFAULT_DOC_TYPE_CONFIG;
}

/** Stage에서 rollout percent 추출 */
export function stageToPercent(stage: CanaryStage): number {
  switch (stage) {
    case "OFF": return 0;
    case "SHADOW_ONLY": return 0; // shadow만, active 0%
    case "ACTIVE_5": return 5;
    case "ACTIVE_25": return 25;
    case "ACTIVE_50": return 50;
    case "ACTIVE_100": return 100;
  }
}

/**
 * Stable Bucketing — hash(orgId + documentId) % 100
 *
 * 동일 문서 재처리 시 항상 같은 bucket → 일관된 경로 라우팅.
 * 랜덤 함수 사용 금지 — deterministic hash only.
 */
export function stableBucket(orgId: string, documentId: string): number {
  const input = `${orgId}:${documentId}`;
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = ((hash << 5) - hash + input.charCodeAt(i)) | 0;
  }
  return Math.abs(hash % 100);
}

/** Bucket이 rollout percent 안에 포함되는지 판정 */
export function isInCanaryBucket(
  orgId: string,
  documentId: string,
  rolloutPercent: number,
): boolean {
  if (rolloutPercent >= 100) return true;
  if (rolloutPercent <= 0) return false;
  return stableBucket(orgId, documentId) < rolloutPercent;
}

/**
 * 카나리 라우팅 결정
 *
 * 순서: Global Enabled → Doc Type Enabled → Rollout Bucket
 */
export function resolveProcessingPath(
  config: CanaryConfig,
  documentType: string,
  orgId: string,
  documentId: string,
): ProcessingPath {
  // 1. Global 비활성
  if (!config.globalEnabled) return "rules";

  // 2. 문서 타입 설정 조회
  const docConfig = getDocTypeConfig(config, documentType);

  // 3. OFF → rules
  if (docConfig.stage === "OFF") return "rules";

  // 4. SHADOW_ONLY → ai_shadow
  if (docConfig.stage === "SHADOW_ONLY") return "ai_shadow";

  // 5. ACTIVE_* → bucket 기반 라우팅
  const percent = stageToPercent(docConfig.stage);
  if (isInCanaryBucket(orgId, documentId, percent)) {
    return docConfig.stage === "ACTIVE_100" ? "ai_active_full" : "ai_active_canary";
  }

  // Bucket 외 → rules
  return "rules";
}

/**
 * 승격 유효성 검증 — 한 단계씩만 이동 가능
 */
export function validatePromotion(
  current: CanaryStage,
  target: CanaryStage,
): { valid: boolean; reason?: string } {
  const currentIdx = CANARY_STAGES.indexOf(current);
  const targetIdx = CANARY_STAGES.indexOf(target);

  // 강등(rollback)은 어디서든 OFF 또는 SHADOW_ONLY로 허용
  if (targetIdx <= 1) return { valid: true };

  // 승격은 한 단계씩만
  if (targetIdx === currentIdx + 1) return { valid: true };

  if (targetIdx <= currentIdx) {
    return { valid: true }; // 동일 또는 강등은 허용
  }

  return {
    valid: false,
    reason: `${current} → ${target} 불가. 한 단계씩만 승격 가능 (다음: ${CANARY_STAGES[currentIdx + 1]})`,
  };
}
