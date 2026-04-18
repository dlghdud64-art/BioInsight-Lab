/**
 * /api/category-spending
 *
 * 카테고리별 지출 현황 조회 API
 * - GET: 조직의 카테고리별 월간 지출 집계
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { aggregateCategorySpending } from "@/lib/budget/category-spending-engine";
import { resolvePeriodYearMonth } from "@/lib/budget/category-budget-gate";

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");

    if (!organizationId) {
      return NextResponse.json(
        { error: "organizationId는 필수입니다." },
        { status: 400 },
      );
    }

    // 조직 멤버 확인 + timezone 조회
    const org = await db.organization.findUnique({
      where: { id: organizationId },
      select: { timezone: true },
    });
    const membership = await db.organizationMember.findFirst({
      where: { userId: session.user.id, organizationId },
    });
    if (!membership) {
      return NextResponse.json({ error: "조직 멤버가 아닙니다." }, { status: 403 });
    }

    // yearMonth: 쿼리 파라미터 → org timezone 기준 현재 월
    const orgTimezone = org?.timezone ?? "Asia/Seoul";
    const yearMonth =
      searchParams.get("yearMonth") ??
      resolvePeriodYearMonth(orgTimezone);

    const summary = await aggregateCategorySpending(organizationId, yearMonth);

    return NextResponse.json(summary);
  } catch (error) {
    console.error("Error fetching category spending:", error);
    return NextResponse.json(
      { error: "카테고리별 지출 현황을 불러오지 못했습니다." },
      { status: 500 },
    );
  }
}
