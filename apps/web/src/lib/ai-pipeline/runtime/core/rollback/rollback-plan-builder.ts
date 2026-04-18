/**
 * S2 — Rollback Plan Builder
 *
 * idempotent rollback plan 생성.
 * scope별 ordered steps + precondition/postcondition.
 */

import { randomUUID } from "crypto";
import type { RollbackPlan, RollbackStep, RollbackScope } from "../../types/stabilization";
import { getSnapshotFromRepo } from "../baseline/snapshot-manager";

const ROLLBACK_SCOPE_ORDER: readonly RollbackScope[] = [
  "ACTIVE_RUNTIME_STATE",
  "QUEUE_TOPOLOGY",
  "ROUTING",
  "AUTHORITY",
  "POLICY",
  "FLAGS",
  "CONFIG",
] as const;

export async function buildRollbackPlan(
  baselineId: string,
  snapshotId: string,
  reasonCode: string
): Promise<RollbackPlan> {
  const snap = await getSnapshotFromRepo(snapshotId);
  const snapshotScopes = snap ? snap.scopes.map((s) => s.scope as RollbackScope) : [];

  const affectedScopes: RollbackScope[] = ROLLBACK_SCOPE_ORDER.filter(
    (scope) => scope === "ACTIVE_RUNTIME_STATE" || snapshotScopes.includes(scope)
  );

  const orderedSteps: RollbackStep[] = affectedScopes.map(
    (scope: RollbackScope, idx: number) => ({
      scope,
      order: idx,
      precondition: `${scope} mutation frozen + previous step complete`,
      postcondition: `${scope} restored to snapshot state`,
      status: "PENDING" as const,
      restoreVerified: false,
    })
  );

  return {
    planId: `rplan-${randomUUID().slice(0, 8)}`,
    baselineId,
    snapshotId,
    affectedScopes,
    orderedSteps,
    reasonCode,
    createdAt: new Date(),
  };
}
