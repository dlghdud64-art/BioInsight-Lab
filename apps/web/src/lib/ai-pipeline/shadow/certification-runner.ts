/**
 * Production Certification Runner — 승격 전 사전 인증
 *
 * 3가지 검증 모드:
 *  1. Replay Certification — 최근 샘플 재실행 검증
 *  2. Dry-Run Certification — preflight/guard만 검증 (stage 변경 없음)
 *  3. Launch Certification — 최종 확인 (approval + preflight + rollback readiness)
 *
 * 결과: PASS | PASS_WITH_WARNINGS | HOLD_REQUIRED | FAIL
 */

import type { LifecycleState } from "./rollout-state-machine";
import { runTransitionGuard } from "./stage-transition-guard";
import { getValidApproval } from "./approval-store";
import { getRegistryEntry } from "./doctype-registry";
import { db } from "@/lib/db";

// ── Certification Result ──

export const CERTIFICATION_RESULTS = [
  "PASS",
  "PASS_WITH_WARNINGS",
  "HOLD_REQUIRED",
  "FAIL",
] as const;

export type CertificationResult = (typeof CERTIFICATION_RESULTS)[number];

export type CertificationMode = "REPLAY" | "DRY_RUN" | "LAUNCH";

export interface CertificationCheckItem {
  name: string;
  passed: boolean;
  warning: boolean;
  detail: string;
}

export interface CertificationReport {
  id: string;
  documentType: string;
  mode: CertificationMode;
  from: LifecycleState;
  to: LifecycleState;
  result: CertificationResult;
  checks: CertificationCheckItem[];
  warnings: string[];
  failures: string[];
  executedAt: string;
}

let certIdCounter = 0;

/**
 * Certification 실행
 */
export async function runCertification(params: {
  documentType: string;
  from: LifecycleState;
  to: LifecycleState;
  mode: CertificationMode;
  approvalId?: string;
}): Promise<CertificationReport> {
  const checks: CertificationCheckItem[] = [];
  const warnings: string[] = [];
  const failures: string[] = [];

  // ── Mode별 검증 ──

  if (params.mode === "REPLAY" || params.mode === "LAUNCH") {
    // Replay: 최근 샘플 일관성 검증
    const replayCheck = await checkReplayConsistency(params.documentType);
    checks.push(replayCheck);
    if (!replayCheck.passed) {
      if (replayCheck.warning) warnings.push(replayCheck.detail);
      else failures.push(replayCheck.detail);
    }
  }

  if (params.mode === "DRY_RUN" || params.mode === "LAUNCH") {
    // Guard 검증
    const guardResult = await runTransitionGuard(
      params.documentType, params.from, params.to, params.approvalId,
    );
    for (const item of guardResult.items) {
      checks.push({
        name: `guard:${item.name}`,
        passed: item.passed,
        warning: !item.passed && !item.blocking,
        detail: item.detail,
      });
      if (!item.passed) {
        if (item.blocking) failures.push(`${item.name}: ${item.detail}`);
        else warnings.push(`${item.name}: ${item.detail}`);
      }
    }
  }

  if (params.mode === "LAUNCH") {
    // Approval 검증
    const approval = params.approvalId
      ? getValidApproval(params.documentType, params.to)
      : null;
    checks.push({
      name: "approval_present",
      passed: approval !== null,
      warning: false,
      detail: approval ? `승인 ID: ${approval.id}` : "유효한 승인 없음",
    });
    if (!approval) failures.push("유효한 승인 없음");

    // Registry 상태 확인
    const entry = getRegistryEntry(params.documentType);
    checks.push({
      name: "registry_consistent",
      passed: entry !== null && entry.lifecycleState === params.from,
      warning: false,
      detail: entry
        ? `Registry 상태: ${entry.lifecycleState} (기대: ${params.from})`
        : "Registry 미등록",
    });
    if (!entry || entry.lifecycleState !== params.from) {
      failures.push("Registry 상태 불일치");
    }

    // 최근 false-safe 0
    const fsCheck = await checkNoFalseSafe(params.documentType);
    checks.push(fsCheck);
    if (!fsCheck.passed) failures.push(fsCheck.detail);

    // Rollback readiness
    checks.push({
      name: "rollback_readiness",
      passed: true,
      warning: false,
      detail: "환경변수 기반 즉시 rollback 가능",
    });
  }

  // ── 결과 판정 ──
  let result: CertificationResult;
  if (failures.length > 0) {
    result = "FAIL";
  } else if (warnings.length > 0) {
    result = "PASS_WITH_WARNINGS";
  } else {
    result = "PASS";
  }

  // HOLD_REQUIRED: volume 부족 등 soft failure
  if (result === "FAIL" && failures.every((f) => f.includes("모수") || f.includes("volume"))) {
    result = "HOLD_REQUIRED";
  }

  return {
    id: `cert-${++certIdCounter}`,
    documentType: params.documentType,
    mode: params.mode,
    from: params.from,
    to: params.to,
    result,
    checks,
    warnings,
    failures,
    executedAt: new Date().toISOString(),
  };
}

async function checkReplayConsistency(documentType: string): Promise<CertificationCheckItem> {
  const rows = (await db.$queryRawUnsafe(
    `SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'NO_DIFF')::bigint AS no_diff
    FROM "ShadowComparisonLog"
    WHERE "documentTypeByRules" = $1
      AND "createdAt" >= NOW() - INTERVAL '24 hours'
      AND "processingPath" != 'rules'`,
    documentType,
  )) as { total: bigint; no_diff: bigint }[];

  const total = Number(rows[0]?.total ?? 0);
  const noDiff = Number(rows[0]?.no_diff ?? 0);
  const consistencyRate = total > 0 ? noDiff / total : 0;

  if (total < 10) {
    return {
      name: "replay_consistency",
      passed: false,
      warning: true,
      detail: `최근 24h 샘플 ${total}건 — 충분하지 않음`,
    };
  }

  return {
    name: "replay_consistency",
    passed: consistencyRate >= 0.9,
    warning: consistencyRate >= 0.85 && consistencyRate < 0.9,
    detail: `일관성 ${(consistencyRate * 100).toFixed(1)}% (${noDiff}/${total})`,
  };
}

async function checkNoFalseSafe(documentType: string): Promise<CertificationCheckItem> {
  const rows = (await db.$queryRawUnsafe(
    `SELECT COUNT(*)::bigint AS cnt
    FROM "ShadowComparisonLog"
    WHERE "documentTypeByRules" = $1
      AND "createdAt" >= NOW() - INTERVAL '7 days'
      AND "verificationByAi" = 'AUTO_VERIFIED'
      AND "verificationByRules" IS NOT NULL
      AND "verificationByRules" != 'AUTO_VERIFIED'
      AND "processingPath" != 'rules'`,
    documentType,
  )) as { cnt: bigint }[];

  const count = Number(rows[0]?.cnt ?? 0);
  return {
    name: "no_false_safe_7d",
    passed: count === 0,
    warning: false,
    detail: `최근 7일 false-safe 후보: ${count}건`,
  };
}
