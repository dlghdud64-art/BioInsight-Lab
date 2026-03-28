/**
 * Approval Snapshot Validator — 공용 snapshot 검증 모듈
 *
 * Fire / Stock Release / Exception Recovery 등 모든 approval workbench에서
 * snapshot consume 전 동일한 검증 로직을 사용.
 * 개별 resolution에 복붙하면 drift 발생 → 이 모듈이 single authority.
 *
 * 역할 분리:
 * - gate = fast-fail (진입 가능 여부 / stale 징후 감지)
 * - resolution = final authority (이 validator 호출 → single write)
 *
 * 8-check consume guard:
 * 1. single_use — consumed=false
 * 2. expiry — validUntil > now
 * 3. action_key_match — snapshot.actionKey vs target (exact or approval variant)
 * 4. case_id_match — snapshot.caseId vs target
 * 5. entity_version_match — approval-time vs current
 * 6. payload_content_hash_match — approval-time vs current
 * 7. policy_evaluation_hash_match — approval-time vs current
 * 8. scope_match — approval-time vs current (line scope / location / qty)
 */

import type { ApprovalSnapshotV2 } from "./dispatch-v2-approval-workbench-engine";
import type { StageActionKey } from "./dispatch-v2-permission-policy-engine";

// ── Generic Payload Hash Interface ──
// Fire와 Stock Release 등 각 domain이 이 interface를 구현하면 됨
export interface ApprovalPayloadHash {
  /** entity/object version at hash time */
  entityVersion: string;
  /** content-addressable hash of the payload body */
  contentHash: string;
  /** hash of policy evaluation results at approval time */
  policyHash: string;
  /** scope identifier (line set, qty set, location set 등) */
  scopeHash: string;
}

// ── Consume Guard Check ──
export interface ConsumeGuardCheck {
  checkKey: string;
  passed: boolean;
  expected: string;
  actual: string;
  reason: string;
}

// ── Consume Guard Result ──
export interface ConsumeGuardResult {
  guardPassed: boolean;
  checks: ConsumeGuardCheck[];
  failedChecks: string[];
  consumeAllowed: boolean;
  consumeBlockedReason: string;
}

// ── Allowed Action Key Variants ──
// 각 approval target에 대해 허용되는 actionKey variants
const ACTION_KEY_VARIANTS: Record<string, string[]> = {
  actual_send_fire_execute: ["actual_send_fire_execute", "approve_fire_execution"],
  stock_release_execute: ["stock_release_execute", "approve_stock_release"],
  exception_resolve: ["exception_resolve", "approve_exception_override"],
  exception_return_to_stage: ["exception_return_to_stage", "approve_recovery_return"],
};

/**
 * runConsumeGuard — 공용 snapshot consume 검증
 *
 * @param snapshot - 소비 대상 ApprovalSnapshotV2
 * @param targetCaseId - consume하려는 case ID
 * @param targetActionKey - consume하려는 action key
 * @param hashAtApproval - 승인 시점 payload hash
 * @param hashCurrent - 현재 시점 payload hash
 * @returns ConsumeGuardResult
 */
export function runConsumeGuard(
  snapshot: ApprovalSnapshotV2,
  targetCaseId: string,
  targetActionKey: StageActionKey,
  hashAtApproval: ApprovalPayloadHash,
  hashCurrent: ApprovalPayloadHash,
): ConsumeGuardResult {
  const checks: ConsumeGuardCheck[] = [];
  const now = new Date();

  // 1. Single-use enforcement
  checks.push({
    checkKey: "single_use",
    passed: !snapshot.consumed,
    expected: "consumed=false",
    actual: `consumed=${snapshot.consumed}`,
    reason: snapshot.consumed ? "Snapshot 이미 사용됨 — 재사용 불가" : "",
  });

  // 2. Expiry enforcement
  const notExpired = new Date(snapshot.validUntil) > now;
  checks.push({
    checkKey: "expiry",
    passed: notExpired,
    expected: `validUntil > ${now.toISOString()}`,
    actual: `validUntil=${snapshot.validUntil}`,
    reason: notExpired ? "" : "Snapshot 유효기간 만료",
  });

  // 3. Action key match (with variants)
  const allowedKeys = ACTION_KEY_VARIANTS[targetActionKey] || [targetActionKey];
  const actionMatch = allowedKeys.includes(snapshot.actionKey);
  checks.push({
    checkKey: "action_key_match",
    passed: actionMatch,
    expected: allowedKeys.join(" | "),
    actual: snapshot.actionKey,
    reason: actionMatch ? "" : `Action key 불일치: ${snapshot.actionKey} — 허용: ${allowedKeys.join(", ")}`,
  });

  // 4. Case ID match
  const caseMatch = snapshot.caseId === targetCaseId;
  checks.push({
    checkKey: "case_id_match",
    passed: caseMatch,
    expected: targetCaseId,
    actual: snapshot.caseId,
    reason: caseMatch ? "" : `Case ID 불일치: ${snapshot.caseId} vs ${targetCaseId}`,
  });

  // 5. Entity version match
  const entityMatch = hashAtApproval.entityVersion === hashCurrent.entityVersion;
  checks.push({
    checkKey: "entity_version_match",
    passed: entityMatch,
    expected: hashAtApproval.entityVersion,
    actual: hashCurrent.entityVersion,
    reason: entityMatch ? "" : "Entity version 변경됨 — 승인 후 원본 수정. 재승인 필요",
  });

  // 6. Payload content hash match
  const contentMatch = hashAtApproval.contentHash === hashCurrent.contentHash;
  checks.push({
    checkKey: "payload_content_hash_match",
    passed: contentMatch,
    expected: hashAtApproval.contentHash,
    actual: hashCurrent.contentHash,
    reason: contentMatch ? "" : "Payload 내용 변경됨 — 승인 시점과 다른 데이터. 재승인 필요",
  });

  // 7. Policy evaluation hash match
  const policyMatch = hashAtApproval.policyHash === hashCurrent.policyHash;
  checks.push({
    checkKey: "policy_evaluation_hash_match",
    passed: policyMatch,
    expected: hashAtApproval.policyHash,
    actual: hashCurrent.policyHash,
    reason: policyMatch ? "" : "Policy 평가 결과 변경됨 — 정책 변경 후 재평가 필요",
  });

  // 8. Scope match
  const scopeMatch = hashAtApproval.scopeHash === hashCurrent.scopeHash;
  checks.push({
    checkKey: "scope_match",
    passed: scopeMatch,
    expected: hashAtApproval.scopeHash,
    actual: hashCurrent.scopeHash,
    reason: scopeMatch ? "" : "대상 범위 변경됨 — 승인 대상 불일치. 재승인 필요",
  });

  const failedChecks = checks.filter(c => !c.passed).map(c => c.reason);
  const allPassed = failedChecks.length === 0;

  return {
    guardPassed: allPassed,
    checks,
    failedChecks,
    consumeAllowed: allPassed,
    consumeBlockedReason: allPassed ? "" : failedChecks.join("; "),
  };
}

/**
 * runGateFastCheck — gate용 빠른 진입 검증 (resolution 전에 stale 징후 감지)
 * gate는 "이 snapshot으로 진행 가능한가?"만 빠르게 판단.
 * 최종 authority는 resolution의 runConsumeGuard.
 */
export function runGateFastCheck(
  snapshot: ApprovalSnapshotV2 | null,
  targetCaseId: string,
  targetActionKey: StageActionKey,
): { eligible: boolean; reason: string } {
  if (!snapshot) return { eligible: false, reason: "Approval snapshot 없음" };
  if (snapshot.consumed) return { eligible: false, reason: "Snapshot 이미 사용됨" };
  if (new Date(snapshot.validUntil) < new Date()) return { eligible: false, reason: "Snapshot 만료됨" };

  const allowedKeys = ACTION_KEY_VARIANTS[targetActionKey] || [targetActionKey];
  if (!allowedKeys.includes(snapshot.actionKey)) return { eligible: false, reason: `Action key 불일치: ${snapshot.actionKey}` };
  if (snapshot.caseId !== targetCaseId) return { eligible: false, reason: `Case ID 불일치` };

  return { eligible: true, reason: "Snapshot 진입 가능" };
}

/**
 * consumeSnapshot — snapshot을 consumed 상태로 전환
 * runConsumeGuard 통과 후에만 호출해야 함.
 */
export function consumeSnapshot(
  snapshot: ApprovalSnapshotV2,
  consumedByAction: string,
): ApprovalSnapshotV2 {
  if (snapshot.consumed) throw new Error("Snapshot already consumed — cannot consume again");
  if (new Date(snapshot.validUntil) < new Date()) throw new Error("Snapshot expired — cannot consume");
  return {
    ...snapshot,
    consumed: true,
    consumedAt: new Date().toISOString(),
    consumedByAction,
  };
}
