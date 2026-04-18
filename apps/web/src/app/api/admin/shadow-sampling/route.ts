/**
 * GET /api/admin/shadow-sampling
 *
 * High-risk 샘플링: AUTO_VERIFY_RISK, TASK_MAPPING_DIFF, UNKNOWN_CLASSIFICATION
 * 필터링하여 운영자가 검토할 수 있는 엔드포인트.
 *
 * Query params:
 *   - category: MismatchCategory (default: all high-risk)
 *   - reviewOnly: "true" (isReviewCandidate만)
 *   - from, to, orgId, limit, offset
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

const HIGH_RISK_CATEGORIES = [
  "AUTO_VERIFY_RISK",
  "TASK_MAPPING_DIFF",
  "UNKNOWN_CLASSIFICATION",
  "ORG_SCOPE_BLOCKED",
];

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = request.nextUrl;
    const category = searchParams.get("category");
    const reviewOnly = searchParams.get("reviewOnly") === "true";
    const orgId = searchParams.get("orgId");
    const from = searchParams.get("from")
      ? new Date(searchParams.get("from")!)
      : new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const to = searchParams.get("to")
      ? new Date(searchParams.get("to")!)
      : new Date();
    const limit = Math.min(parseInt(searchParams.get("limit") ?? "50", 10), 200);
    const offset = parseInt(searchParams.get("offset") ?? "0", 10);

    // 카테고리 필터
    const categories = category
      ? [category]
      : HIGH_RISK_CATEGORIES;

    const categoryPlaceholders = categories
      .map((_, i) => `$${i + 3}::"ShadowMismatchCategory"`)
      .join(", ");

    let whereExtra = "";
    const params: unknown[] = [from, to, ...categories];
    let paramIdx = categories.length + 3;

    if (orgId) {
      whereExtra += ` AND "orgId" = $${paramIdx}`;
      params.push(orgId);
      paramIdx++;
    }
    if (reviewOnly) {
      whereExtra += ` AND "isReviewCandidate" = true`;
    }

    params.push(limit, offset);

    const rows = (await db.$queryRawUnsafe(
      `SELECT
        "id", "requestId", "orgId", "documentId",
        "documentTypeByRules", "documentTypeByAi",
        "verificationByRules", "verificationByAi",
        "taskMappingByRules", "taskMappingByAi",
        "mismatchCategory", "confidence", "schemaValid", "fallbackReason",
        "aiLatencyMs", "tokenUsage", "provider", "model",
        "reviewTags", "isReviewCandidate", "createdAt"
      FROM "ShadowComparisonLog"
      WHERE "createdAt" >= $1 AND "createdAt" <= $2
        AND "mismatchCategory" IN (${categoryPlaceholders})
        ${whereExtra}
      ORDER BY "createdAt" DESC
      LIMIT $${paramIdx} OFFSET $${paramIdx + 1}`,
      ...params,
    )) as Record<string, unknown>[];

    // Total count
    const countParams = params.slice(0, paramIdx - 1); // exclude limit/offset
    const countResults = (await db.$queryRawUnsafe(
      `SELECT COUNT(*)::bigint AS total
      FROM "ShadowComparisonLog"
      WHERE "createdAt" >= $1 AND "createdAt" <= $2
        AND "mismatchCategory" IN (${categoryPlaceholders})
        ${whereExtra}`,
      ...countParams,
    )) as { total: bigint }[];
    const countResult = countResults[0];

    return NextResponse.json({
      items: rows,
      total: Number(countResult.total),
      limit,
      offset,
    });
  } catch (error) {
    console.error("[ShadowSampling] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch shadow samples" },
      { status: 500 },
    );
  }
}
