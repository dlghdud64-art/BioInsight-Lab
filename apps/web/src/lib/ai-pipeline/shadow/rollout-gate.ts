/**
 * Go/No-Go Gate + Active Rollout 후보 선정 로직
 *
 * Hard Block 조건이 1건이라도 존재하면 전체 Active 전환 불가.
 * 문서 타입 단위로 좁게 시작하는 점진적 승격 판정.
 */

import { db } from "@/lib/db";
import type { RolloutGateResult } from "./types";

interface GateQuery {
  orgId?: string;
  from?: Date;
  to?: Date;
}

export async function evaluateRolloutGate(query: GateQuery = {}): Promise<RolloutGateResult> {
  const from = query.from ?? new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const to = query.to ?? new Date();

  const whereClause = query.orgId
    ? `WHERE "createdAt" >= $1 AND "createdAt" <= $2 AND "orgId" = $3`
    : `WHERE "createdAt" >= $1 AND "createdAt" <= $2`;
  const params: unknown[] = query.orgId ? [from, to, query.orgId] : [from, to];

  // ── Hard Block 검사 ──
  const hardBlockRows = (await db.$queryRawUnsafe(
    `SELECT
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'AUTO_VERIFY_RISK')::bigint AS auto_verify_risk,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'ORG_SCOPE_BLOCKED')::bigint AS org_scope_blocked,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'TASK_MAPPING_DIFF'
        AND "documentTypeByAi" = 'UNKNOWN'
        AND "verificationByAi" = 'AUTO_VERIFIED')::bigint AS unknown_auto_verify,
      COUNT(*) FILTER (WHERE "mismatchCategory" = 'TASK_MAPPING_DIFF')::bigint AS task_mapping_diff
    FROM "ShadowComparisonLog"
    ${whereClause}`,
    ...params,
  )) as { auto_verify_risk: bigint; org_scope_blocked: bigint; task_mapping_diff: bigint; unknown_auto_verify: bigint }[];

  const hb = hardBlockRows[0];
  const hardBlocks: string[] = [];

  if (Number(hb.auto_verify_risk) > 0)
    hardBlocks.push(`AUTO_VERIFY_RISK: ${hb.auto_verify_risk}건 — UNKNOWN 문서 Auto-verify 위험`);
  if (Number(hb.org_scope_blocked) > 0)
    hardBlocks.push(`ORG_SCOPE_BLOCKED: ${hb.org_scope_blocked}건 — 타 조직 데이터 접근 위험`);
  if (Number(hb.unknown_auto_verify) > 0)
    hardBlocks.push(`UNKNOWN_AUTO_VERIFY: ${hb.unknown_auto_verify}건 — Unknown 문서 자동 승인`);
  if (Number(hb.task_mapping_diff) > 0)
    hardBlocks.push(`TASK_MAPPING_DIFF: ${hb.task_mapping_diff}건 — Task 생성 규칙 불일치`);

  // ── 문서 타입별 통계 ──
  const docTypeStats = (await db.$queryRawUnsafe(
    `SELECT
      "documentTypeByRules" AS doc_type,
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (WHERE "mismatchCategory" != 'NO_DIFF')::bigint AS mismatch_count,
      COUNT(*) FILTER (WHERE "fallbackReason" IS NOT NULL)::bigint AS fallback_count,
      COUNT(*) FILTER (WHERE "mismatchCategory" IN ('AUTO_VERIFY_RISK', 'ORG_SCOPE_BLOCKED', 'UNKNOWN_CLASSIFICATION'))::bigint AS unknown_risk
    FROM "ShadowComparisonLog"
    ${whereClause} AND "documentTypeByRules" IS NOT NULL
    GROUP BY "documentTypeByRules"
    ORDER BY total DESC`,
    ...params,
  )) as { doc_type: string; total: bigint; mismatch_count: bigint; fallback_count: bigint; unknown_risk: bigint }[];

  const candidates = docTypeStats.map((row: { doc_type: string; total: bigint; mismatch_count: bigint; fallback_count: bigint; unknown_risk: bigint }) => {
    const total = Number(row.total);
    const mismatchRate = total > 0 ? Number(row.mismatch_count) / total : 0;
    const fallbackRate = total > 0 ? Number(row.fallback_count) / total : 0;
    const unknownRiskCount = Number(row.unknown_risk);

    const isReady =
      total >= 10 &&
      mismatchRate <= 0.05 &&
      fallbackRate <= 0.10 &&
      unknownRiskCount === 0;

    let reason: string;
    if (total < 10) reason = `샘플 부족 (${total}건 < 10건)`;
    else if (unknownRiskCount > 0) reason = `Unknown risk ${unknownRiskCount}건 존재`;
    else if (mismatchRate > 0.05) reason = `Mismatch rate ${(mismatchRate * 100).toFixed(1)}% > 5%`;
    else if (fallbackRate > 0.10) reason = `Fallback rate ${(fallbackRate * 100).toFixed(1)}% > 10%`;
    else reason = `조건 충족 — Active 전환 가능`;

    return {
      docType: row.doc_type,
      totalCount: total,
      mismatchRate,
      fallbackRate,
      unknownRiskCount,
      recommendation: (isReady ? "READY" : "NOT_READY") as "READY" | "NOT_READY",
      reason,
    };
  });

  return {
    decision: hardBlocks.length > 0 ? "NO_GO" : "GO",
    hardBlocks,
    candidateDocTypes: candidates,
  };
}
