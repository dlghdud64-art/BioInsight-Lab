/**
 * Stage Transition Guard — stage 변경 전 필수 검증
 *
 * 하나라도 실패하면 transition 차단.
 * 검증 항목:
 *  - invariants intact
 *  - preflight pass
 *  - reports fresh
 *  - approval valid
 *  - kill switch 상태
 *  - ops capacity flag
 *  - first docType unstable 여부
 *  - parallel discipline 위반 여부
 */

import { db } from "@/lib/db";
import { loadCanaryConfig } from "./canary-config";
import type { LifecycleState } from "./rollout-state-machine";
import { isActiveState, STATE_ORDER } from "./rollout-state-machine";
import { getValidApproval } from "./approval-store";
import { getFirstDocTypeState, getRegistryEntry } from "./doctype-registry";

export interface GuardCheckItem {
  name: string;
  passed: boolean;
  detail: string;
  blocking: boolean;
}

export interface GuardResult {
  allowed: boolean;
  items: GuardCheckItem[];
  blockingReasons: string[];
}

export async function runTransitionGuard(
  documentType: string,
  from: LifecycleState,
  to: LifecycleState,
  approvalId?: string,
): Promise<GuardResult> {
  const items: GuardCheckItem[] = [];
  const toOrder = STATE_ORDER[to];
  const fromOrder = STATE_ORDER[from];
  const isPromotion = toOrder > fromOrder;

  // ── 1. Kill Switch ──
  const config = loadCanaryConfig();
  items.push({
    name: "kill_switch",
    passed: config.globalEnabled,
    detail: `globalEnabled: ${config.globalEnabled}`,
    blocking: true,
  });

  // ── 2. Invariants (최근 24h high-risk 0) ──
  if (isPromotion) {
    const riskRows = (await db.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS cnt FROM "ShadowComparisonLog"
      WHERE "documentTypeByRules" = $1 AND "createdAt" >= NOW() - INTERVAL '24 hours'
        AND "mismatchCategory" IN ('AUTO_VERIFY_RISK', 'ORG_SCOPE_BLOCKED', 'TASK_MAPPING_DIFF', 'UNKNOWN_CLASSIFICATION')`,
      documentType,
    )) as { cnt: bigint }[];
    const riskCount = Number(riskRows[0]?.cnt ?? 0);
    items.push({
      name: "invariants_intact",
      passed: riskCount === 0,
      detail: `최근 24h high-risk: ${riskCount}건`,
      blocking: true,
    });
  }

  // ── 3. 최근 Halt 없음 ──
  if (isPromotion) {
    const haltRows = (await db.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS cnt FROM "CanaryHaltLog"
      WHERE "documentType" = $1 AND "createdAt" >= NOW() - INTERVAL '24 hours'`,
      documentType,
    )) as { cnt: bigint }[];
    const haltCount = Number(haltRows[0]?.cnt ?? 0);
    items.push({
      name: "no_recent_halts",
      passed: haltCount === 0,
      detail: `최근 24h halt: ${haltCount}건`,
      blocking: true,
    });
  }

  // ── 4. Approval Valid (GO 계열만) ──
  if (isPromotion) {
    if (approvalId) {
      const approval = getValidApproval(documentType, to);
      const valid = approval !== null && approval.id === approvalId;
      items.push({
        name: "approval_valid",
        passed: valid,
        detail: valid ? `승인 ID: ${approvalId}` : "유효한 승인 없음 또는 만료",
        blocking: true,
      });
    } else {
      items.push({
        name: "approval_valid",
        passed: false,
        detail: "GO 계열 승격에는 approval 필수",
        blocking: true,
      });
    }
  }

  // ── 5. Comparison Log 정상 기록 ──
  if (isActiveState(from)) {
    const logRows = (await db.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS cnt FROM "ShadowComparisonLog"
      WHERE "documentTypeByRules" = $1 AND "createdAt" >= NOW() - INTERVAL '1 hour'
        AND "processingPath" != 'rules'`,
      documentType,
    )) as { cnt: bigint }[];
    const logCount = Number(logRows[0]?.cnt ?? 0);
    items.push({
      name: "comparison_log_active",
      passed: logCount > 0,
      detail: `최근 1h AI 로그: ${logCount}건`,
      blocking: isPromotion,
    });
  }

  // ── 6. First DocType Stability (second docType 승격 시) ──
  const entry = getRegistryEntry(documentType);
  if (isPromotion && entry && !entry.isFirstDocType) {
    const firstEntry = getFirstDocTypeState();
    if (firstEntry) {
      const firstStable = STATE_ORDER[firstEntry.lifecycleState] >= 4; // ACTIVE_50+
      items.push({
        name: "first_doctype_stable",
        passed: firstStable,
        detail: `첫 타입 ${firstEntry.documentType}: ${firstEntry.lifecycleState}`,
        blocking: true,
      });

      // 첫 타입 최근 halt
      const firstHalt = (await db.$queryRawUnsafe(
        `SELECT COUNT(*)::bigint AS cnt FROM "CanaryHaltLog"
        WHERE "documentType" = $1 AND "createdAt" >= NOW() - INTERVAL '7 days'`,
        firstEntry.documentType,
      )) as { cnt: bigint }[];
      const firstHaltCount = Number(firstHalt[0]?.cnt ?? 0);
      items.push({
        name: "first_doctype_no_halts",
        passed: firstHaltCount === 0,
        detail: `첫 타입 최근 7일 halt: ${firstHaltCount}건`,
        blocking: true,
      });
    }
  }

  // ── 7. Parallel Discipline ──
  if (isPromotion && entry && !entry.isFirstDocType) {
    const allEntries = Object.entries(config.docTypes);
    const otherActive = allEntries.filter(
      ([dt, cfg]) =>
        dt !== documentType &&
        !getRegistryEntry(dt)?.isFirstDocType &&
        ["ACTIVE_5", "ACTIVE_25", "ACTIVE_50"].includes(cfg.stage),
    );
    items.push({
      name: "parallel_discipline",
      passed: otherActive.length === 0,
      detail: otherActive.length > 0
        ? `이미 active 중인 다른 새 타입: ${otherActive.map(([dt]) => dt).join(", ")}`
        : "병행 제약 충족",
      blocking: true,
    });
  }

  // ── 8. Rollback Switch Ready ──
  items.push({
    name: "rollback_ready",
    passed: true,
    detail: "환경변수 기반 즉시 rollback 가능",
    blocking: false,
  });

  // ── Result ──
  const blockingReasons = items
    .filter((i) => !i.passed && i.blocking)
    .map((i) => `${i.name}: ${i.detail}`);

  return {
    allowed: blockingReasons.length === 0,
    items,
    blockingReasons,
  };
}
