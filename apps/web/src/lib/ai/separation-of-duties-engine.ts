/**
 * Separation of Duties (SoD) Engine — prepare/modify/approve/execute actor 분리
 *
 * 4-phase actor separation:
 * 1. preparer — payload/object를 최초 생성한 actor
 * 2. modifier — payload/object를 수정한 actor (최종 수정자)
 * 3. approver — approval snapshot을 발급한 actor
 * 4. executor — snapshot을 consume하고 실제 실행한 actor
 *
 * Rules:
 * - Tier 3 (irreversible): approver ≠ preparer/modifier AND approver ≠ executor
 * - Tier 2 (org impact): approver ≠ preparer (modifier = executor 허용)
 * - Tier 1 (routine): 제한 없음
 *
 * 추가 규칙:
 * - 단일 actor가 prepare + approve + execute 3단계 모두 불가 (Tier 2/3)
 * - delegation은 원래 actor와 같은 제한 적용
 */

import type { ActionRiskTier, StageActionKey, ProcurementRole, ActorContext } from "./dispatch-v2-permission-policy-engine";

// ── Actor Chain Record ──
export interface ActorChainRecord {
  caseId: string;
  actionKey: StageActionKey;
  riskTier: ActionRiskTier;
  preparerId: string | null;
  preparerRole: ProcurementRole | null;
  preparedAt: string | null;
  modifierId: string | null;
  modifierRole: ProcurementRole | null;
  modifiedAt: string | null;
  approverId: string | null;
  approverRole: ProcurementRole | null;
  approvedAt: string | null;
  executorId: string | null;
  executorRole: ProcurementRole | null;
  executedAt: string | null;
}

// ── SoD Check Result ──
export interface SoDCheckResult {
  allowed: boolean;
  violations: SoDViolation[];
  warnings: SoDWarning[];
  explanation: string;
}

export interface SoDViolation {
  ruleKey: string;
  phase1: string;
  phase1Actor: string;
  phase2: string;
  phase2Actor: string;
  reason: string;
}

export interface SoDWarning {
  ruleKey: string;
  detail: string;
}

// ── SoD Check Functions ──

/**
 * checkSoDForApproval — approver 지정 시 SoD 검증
 * approver가 preparer/modifier와 동일인이면 Tier 3에서 차단.
 */
export function checkSoDForApproval(
  chain: ActorChainRecord,
  candidateApprover: ActorContext,
): SoDCheckResult {
  const violations: SoDViolation[] = [];
  const warnings: SoDWarning[] = [];

  if (chain.riskTier === "tier3_irreversible") {
    // Tier 3: approver ≠ preparer
    if (chain.preparerId && chain.preparerId === candidateApprover.actorId) {
      violations.push({
        ruleKey: "tier3_approver_neq_preparer",
        phase1: "preparer", phase1Actor: chain.preparerId,
        phase2: "approver", phase2Actor: candidateApprover.actorId,
        reason: "Tier 3: 준비자와 승인자가 동일인 — 분리 필수",
      });
    }
    // Tier 3: approver ≠ modifier (if different from preparer)
    if (chain.modifierId && chain.modifierId === candidateApprover.actorId) {
      violations.push({
        ruleKey: "tier3_approver_neq_modifier",
        phase1: "modifier", phase1Actor: chain.modifierId,
        phase2: "approver", phase2Actor: candidateApprover.actorId,
        reason: "Tier 3: 수정자와 승인자가 동일인 — 분리 필수",
      });
    }
  } else if (chain.riskTier === "tier2_org_impact") {
    // Tier 2: approver ≠ preparer (warning level for modifier)
    if (chain.preparerId && chain.preparerId === candidateApprover.actorId) {
      violations.push({
        ruleKey: "tier2_approver_neq_preparer",
        phase1: "preparer", phase1Actor: chain.preparerId,
        phase2: "approver", phase2Actor: candidateApprover.actorId,
        reason: "Tier 2: 준비자와 승인자가 동일인 — 분리 권장",
      });
    }
    if (chain.modifierId && chain.modifierId === candidateApprover.actorId) {
      warnings.push({
        ruleKey: "tier2_approver_eq_modifier_warning",
        detail: "Tier 2: 수정자와 승인자가 동일인 — 주의 필요",
      });
    }
  }
  // Tier 1: no restrictions

  return {
    allowed: violations.length === 0,
    violations, warnings,
    explanation: violations.length > 0
      ? `SoD 위반: ${violations.map(v => v.reason).join("; ")}`
      : warnings.length > 0
        ? `SoD 주의: ${warnings.map(w => w.detail).join("; ")}`
        : "SoD 검증 통과",
  };
}

/**
 * checkSoDForExecution — executor 지정 시 SoD 검증
 * Tier 3: executor ≠ approver (dual control)
 */
export function checkSoDForExecution(
  chain: ActorChainRecord,
  candidateExecutor: ActorContext,
): SoDCheckResult {
  const violations: SoDViolation[] = [];
  const warnings: SoDWarning[] = [];

  if (chain.riskTier === "tier3_irreversible") {
    // Tier 3: executor ≠ approver
    if (chain.approverId && chain.approverId === candidateExecutor.actorId) {
      violations.push({
        ruleKey: "tier3_executor_neq_approver",
        phase1: "approver", phase1Actor: chain.approverId,
        phase2: "executor", phase2Actor: candidateExecutor.actorId,
        reason: "Tier 3: 승인자와 실행자가 동일인 — 분리 필수",
      });
    }

    // Tier 3: 단일 actor가 prepare + approve + execute 3단계 모두 불가
    if (chain.preparerId === candidateExecutor.actorId && chain.approverId === candidateExecutor.actorId) {
      violations.push({
        ruleKey: "tier3_triple_actor_block",
        phase1: "preparer+approver", phase1Actor: candidateExecutor.actorId,
        phase2: "executor", phase2Actor: candidateExecutor.actorId,
        reason: "Tier 3: 동일인이 준비/승인/실행 3단계 모두 수행 — 절대 금지",
      });
    }
  } else if (chain.riskTier === "tier2_org_impact") {
    // Tier 2: 3-phase overlap check (warning)
    if (chain.preparerId === candidateExecutor.actorId && chain.approverId === candidateExecutor.actorId) {
      warnings.push({
        ruleKey: "tier2_triple_actor_warning",
        detail: "Tier 2: 동일인이 준비/승인/실행 3단계 모두 수행 — 주의",
      });
    }
  }

  return {
    allowed: violations.length === 0,
    violations, warnings,
    explanation: violations.length > 0
      ? `SoD 위반: ${violations.map(v => v.reason).join("; ")}`
      : warnings.length > 0
        ? `SoD 주의: ${warnings.map(w => w.detail).join("; ")}`
        : "SoD 검증 통과",
  };
}

/**
 * checkFullSoD — full chain SoD 검증 (prepare → modify → approve → execute)
 */
export function checkFullSoD(chain: ActorChainRecord): SoDCheckResult {
  const violations: SoDViolation[] = [];
  const warnings: SoDWarning[] = [];

  if (chain.riskTier === "tier3_irreversible") {
    // All 4 actors should be checked for separation
    const actors = [
      { phase: "preparer", id: chain.preparerId },
      { phase: "modifier", id: chain.modifierId },
      { phase: "approver", id: chain.approverId },
      { phase: "executor", id: chain.executorId },
    ].filter(a => a.id !== null);

    // Approver must differ from preparer and modifier
    if (chain.approverId) {
      if (chain.preparerId === chain.approverId) {
        violations.push({
          ruleKey: "tier3_approver_neq_preparer",
          phase1: "preparer", phase1Actor: chain.preparerId!,
          phase2: "approver", phase2Actor: chain.approverId,
          reason: "준비자 = 승인자 — Tier 3 분리 위반",
        });
      }
      if (chain.modifierId && chain.modifierId === chain.approverId) {
        violations.push({
          ruleKey: "tier3_approver_neq_modifier",
          phase1: "modifier", phase1Actor: chain.modifierId,
          phase2: "approver", phase2Actor: chain.approverId,
          reason: "수정자 = 승인자 — Tier 3 분리 위반",
        });
      }
    }

    // Executor must differ from approver
    if (chain.executorId && chain.approverId && chain.executorId === chain.approverId) {
      violations.push({
        ruleKey: "tier3_executor_neq_approver",
        phase1: "approver", phase1Actor: chain.approverId,
        phase2: "executor", phase2Actor: chain.executorId,
        reason: "승인자 = 실행자 — Tier 3 분리 위반",
      });
    }

    // Triple overlap
    const uniqueActors = new Set(actors.map(a => a.id));
    if (uniqueActors.size === 1 && actors.length >= 3) {
      violations.push({
        ruleKey: "tier3_single_actor_all_phases",
        phase1: "all_phases", phase1Actor: actors[0].id!,
        phase2: "all_phases", phase2Actor: actors[0].id!,
        reason: "동일인이 모든 단계 수행 — Tier 3 절대 금지",
      });
    }
  }

  return {
    allowed: violations.length === 0,
    violations, warnings,
    explanation: violations.length > 0
      ? `SoD 위반 ${violations.length}건: ${violations.map(v => v.reason).join("; ")}`
      : "SoD 검증 통과 — 모든 단계 actor 분리 확인",
  };
}

// ── Create Chain Record ──
export function createActorChainRecord(caseId: string, actionKey: StageActionKey, riskTier: ActionRiskTier): ActorChainRecord {
  return {
    caseId, actionKey, riskTier,
    preparerId: null, preparerRole: null, preparedAt: null,
    modifierId: null, modifierRole: null, modifiedAt: null,
    approverId: null, approverRole: null, approvedAt: null,
    executorId: null, executorRole: null, executedAt: null,
  };
}

export function recordPreparer(chain: ActorChainRecord, actor: ActorContext): ActorChainRecord {
  return { ...chain, preparerId: actor.actorId, preparerRole: actor.roles[0] || null, preparedAt: new Date().toISOString() };
}

export function recordModifier(chain: ActorChainRecord, actor: ActorContext): ActorChainRecord {
  return { ...chain, modifierId: actor.actorId, modifierRole: actor.roles[0] || null, modifiedAt: new Date().toISOString() };
}

export function recordApprover(chain: ActorChainRecord, actor: ActorContext): ActorChainRecord {
  return { ...chain, approverId: actor.actorId, approverRole: actor.roles[0] || null, approvedAt: new Date().toISOString() };
}

export function recordExecutor(chain: ActorChainRecord, actor: ActorContext): ActorChainRecord {
  return { ...chain, executorId: actor.actorId, executorRole: actor.roles[0] || null, executedAt: new Date().toISOString() };
}

// ── Events ──
export type SoDEventType = "sod_check_passed" | "sod_check_violated" | "sod_check_warning";
export interface SoDEvent { type: SoDEventType; caseId: string; actionKey: StageActionKey; riskTier: ActionRiskTier; actorId: string; checkPhase: string; result: string; reason: string; timestamp: string; }
