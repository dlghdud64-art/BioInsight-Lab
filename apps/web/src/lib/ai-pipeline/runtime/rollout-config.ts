/**
 * P0-7: Rollout Execution Config
 * 문서 타입별 롤아웃 순서 및 제약 조건.
 *
 * 첫 번째 docType: QUOTE (volume 충분, 기존 AI parser 존재, template 안정)
 * 두 번째 docType: INVOICE (QUOTE가 STABLE 확인 후에만 시작)
 */

import { type CanaryConfig, CanaryStage } from "@prisma/client";

// ── Rollout Plan ──

export interface RolloutStep {
  documentType: string;
  targetStage: CanaryStage;
  /** 선행 조건: 다른 docType이 특정 stage 이상이어야 함 */
  prerequisite: { documentType: string; minStage: CanaryStage } | null;
}

export interface RolloutConstraint {
  rule: string;
  description: string;
}

export interface RolloutPlan {
  order: RolloutStep[];
  constraints: RolloutConstraint[];
}

// ── Stage 순서값 (비교용) ──

const STAGE_ORDER: Record<CanaryStage, number> = {
  KILLED: -1,
  SHADOW: 0,
  ACTIVE_5: 1,
  ACTIVE_25: 2,
  ACTIVE_50: 3,
  STABLE: 4,
};

function isStageAtLeast(current: CanaryStage, minimum: CanaryStage): boolean {
  return STAGE_ORDER[current] >= STAGE_ORDER[minimum];
}

// ── 기본 Rollout Plan ──

/** 기본 롤아웃 계획 */
export function getRolloutPlan(): RolloutPlan {
  return {
    order: [
      // Phase 1: QUOTE shadow → active
      { documentType: "QUOTE", targetStage: "SHADOW", prerequisite: null },
      { documentType: "QUOTE", targetStage: "ACTIVE_5", prerequisite: null },
      { documentType: "QUOTE", targetStage: "ACTIVE_25", prerequisite: null },
      { documentType: "QUOTE", targetStage: "ACTIVE_50", prerequisite: null },
      { documentType: "QUOTE", targetStage: "STABLE", prerequisite: null },
      // Phase 2: INVOICE (QUOTE STABLE 이후에만)
      {
        documentType: "INVOICE",
        targetStage: "SHADOW",
        prerequisite: { documentType: "QUOTE", minStage: "STABLE" },
      },
      {
        documentType: "INVOICE",
        targetStage: "ACTIVE_5",
        prerequisite: { documentType: "QUOTE", minStage: "STABLE" },
      },
    ],
    constraints: [
      {
        rule: "NO_SKIP",
        description: "단계를 건너뛸 수 없다. SHADOW→ACTIVE_5→ACTIVE_25 순서를 반드시 따라야 한다.",
      },
      {
        rule: "SECOND_AFTER_FIRST_STABLE",
        description: "두 번째 docType은 첫 번째 docType이 STABLE에 도달한 후에만 SHADOW를 시작할 수 있다.",
      },
      {
        rule: "AUTO_VERIFY_RESTRICTED",
        description: "Auto-verify는 QUOTE에서만 opt-in 가능하며 기본 OFF.",
      },
      {
        rule: "ACTIVE_5_MINIMUM_SHADOW_DATA",
        description: "ACTIVE_5로 승격하려면 최소 50건의 shadow 비교 데이터가 필요하다.",
      },
      {
        rule: "KILL_SWITCH_ALWAYS_AVAILABLE",
        description: "Kill switch는 어떤 단계에서든 즉시 발동 가능하다.",
      },
    ],
  };
}

// ── 다음 단계 결정 ──

/** 현재 설정 기준 다음 실행할 rollout step 반환 */
export function getNextStep(
  currentConfigs: CanaryConfig[]
): RolloutStep | null {
  const plan = getRolloutPlan();
  const configMap = new Map<string, CanaryConfig>();
  for (const c of currentConfigs) {
    configMap.set(c.documentType, c);
  }

  for (const step of plan.order) {
    const current = configMap.get(step.documentType);
    const currentStage = current?.stage ?? "KILLED";

    // 이미 target stage 이상이면 skip
    if (isStageAtLeast(currentStage, step.targetStage)) continue;

    // prerequisite 확인
    if (step.prerequisite) {
      const prereqConfig = configMap.get(step.prerequisite.documentType);
      const prereqStage = prereqConfig?.stage ?? "KILLED";
      if (!isStageAtLeast(prereqStage, step.prerequisite.minStage)) {
        return null; // prerequisite 미충족 → 아직 진행 불가
      }
    }

    return step;
  }

  return null; // 모든 step 완료
}

// ── 승격 가능 여부 확인 ──

export interface PromoteCheck {
  allowed: boolean;
  reason: string;
}

/** 특정 docType의 승격 가능 여부 확인 */
export function canPromote(
  documentType: string,
  currentConfigs: CanaryConfig[]
): PromoteCheck {
  const config = currentConfigs.find((c) => c.documentType === documentType);

  if (!config) {
    return {
      allowed: true,
      reason: "No config yet — will be created as SHADOW",
    };
  }

  if (config.killSwitchActive || config.stage === "KILLED") {
    return {
      allowed: false,
      reason: "Kill switch active — deactivate first, then start from SHADOW",
    };
  }

  if (config.stage === "STABLE") {
    return { allowed: false, reason: "Already at STABLE — cannot promote further" };
  }

  // prerequisite 확인
  const plan = getRolloutPlan();
  const relevantSteps = plan.order.filter(
    (s) => s.documentType === documentType
  );
  for (const step of relevantSteps) {
    if (step.prerequisite) {
      const prereqConfig = currentConfigs.find(
        (c) => c.documentType === step.prerequisite!.documentType
      );
      const prereqStage = prereqConfig?.stage ?? "KILLED";
      if (!isStageAtLeast(prereqStage, step.prerequisite.minStage)) {
        return {
          allowed: false,
          reason: `Prerequisite not met: ${step.prerequisite.documentType} must be at least ${step.prerequisite.minStage}`,
        };
      }
    }
  }

  return { allowed: true, reason: "Promotion allowed" };
}

// ── 제약 검증 ──

export interface ConstraintValidation {
  valid: boolean;
  violations: string[];
}

/** 현재 상태가 모든 제약을 만족하는지 확인 */
export function validateConstraints(
  currentConfigs: CanaryConfig[]
): ConstraintValidation {
  const violations: string[] = [];

  // SECOND_AFTER_FIRST_STABLE check
  const invoiceConfig = currentConfigs.find(
    (c) => c.documentType === "INVOICE"
  );
  const quoteConfig = currentConfigs.find((c) => c.documentType === "QUOTE");

  if (invoiceConfig && invoiceConfig.stage !== "KILLED") {
    if (!quoteConfig || !isStageAtLeast(quoteConfig.stage, "STABLE")) {
      violations.push(
        "INVOICE는 QUOTE가 STABLE에 도달하기 전에 활성화할 수 없습니다."
      );
    }
  }

  // AUTO_VERIFY_RESTRICTED check
  for (const config of currentConfigs) {
    if (config.autoVerifyEnabled && config.documentType !== "QUOTE") {
      violations.push(
        `Auto-verify는 현재 QUOTE에서만 허용됩니다. ${config.documentType}에서 활성화되어 있습니다.`
      );
    }
  }

  return {
    valid: violations.length === 0,
    violations,
  };
}
