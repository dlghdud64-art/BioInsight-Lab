import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { OrganizationRole } from "@prisma/client";

/**
 * 위험물/규제 구매 예산 대시보드 API
 * GET /api/safety/spend/summary
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get("organizationId");
    const period = searchParams.get("period") || "month";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const vendorId = searchParams.get("vendor");
    const category = searchParams.get("category");

    // 권한 확인: safety_admin/admin/purchaser
    if (organizationId) {
      const membership = await db.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          organizationId,
        },
      });

      const hasAccess =
        session.user.role === "ADMIN" ||
        membership?.role === OrganizationRole.ADMIN ||
        membership?.role === OrganizationRole.APPROVER ||
        membership?.role === OrganizationRole.VIEWER;

      if (!hasAccess) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // 기간 계산
    let dateStart: Date;
    let dateEnd: Date = new Date();

    if (startDate && endDate) {
      dateStart = new Date(startDate);
      dateEnd = new Date(endDate);
    } else {
      switch (period) {
        case "month":
          dateStart = new Date();
          dateStart.setMonth(dateStart.getMonth() - 1);
          break;
        case "30days":
          dateStart = new Date();
          dateStart.setDate(dateStart.getDate() - 30);
          break;
        case "quarter":
          dateStart = new Date();
          dateStart.setMonth(dateStart.getMonth() - 3);
          break;
        default:
          dateStart = new Date();
          dateStart.setMonth(dateStart.getMonth() - 1);
      }
    }

    // SQL aggregation으로 집계 (성능 최적화)
    const conditions: string[] = [
      `"purchaseDate" >= $1`,
      `"purchaseDate" <= $2`,
    ];
    const params: any[] = [dateStart, dateEnd];
    let paramIndex = 3;

    if (organizationId) {
      conditions.push(`"organizationId" = $${paramIndex}`);
      params.push(organizationId);
      paramIndex++;
    }

    if (vendorId) {
      conditions.push(`"vendorId" = $${paramIndex}`);
      params.push(vendorId);
      paramIndex++;
    }

    if (category) {
      conditions.push(`"category" = $${paramIndex}`);
      params.push(category);
      paramIndex++;
    }

    const whereClause = `WHERE ${conditions.join(" AND ")}`;

    // KPI 집계 (hazardSnapshot 활용)
    const kpiQuery = `
      SELECT
        COALESCE(SUM("totalAmount"), 0) as "totalAmount",
        COALESCE(SUM(CASE 
          WHEN "hazardSnapshot" IS NOT NULL 
            AND ("hazardSnapshot"->>'hazardCodes')::jsonb IS NOT NULL 
            AND jsonb_array_length(("hazardSnapshot"->>'hazardCodes')::jsonb) > 0
          THEN "totalAmount" 
          ELSE 0 
        END), 0) as "hazardousAmount",
        COALESCE(SUM(CASE 
          WHEN "hazardSnapshot" IS NOT NULL 
            AND (("hazardSnapshot"->>'msdsUrl') IS NULL OR ("hazardSnapshot"->>'msdsUrl') = '')
          THEN "totalAmount" 
          ELSE 0 
        END), 0) as "missingSdsAmount",
        COUNT(CASE WHEN "productId" IS NULL THEN 1 END) as "unmappedCount",
        COALESCE(SUM(CASE WHEN "productId" IS NULL THEN "totalAmount" ELSE 0 END), 0) as "unmappedAmount"
      FROM "PurchaseRecord"
      ${whereClause}
    `;

    const kpiResult = (await db.$queryRawUnsafe(kpiQuery, ...params) as Array<{
      totalAmount: number;
      hazardousAmount: number;
      missingSdsAmount: number;
      unmappedCount: bigint;
      unmappedAmount: number;
    }>)[0];

    const totalAmount = Number(kpiResult.totalAmount) || 0;
    const hazardousAmount = Number(kpiResult.hazardousAmount) || 0;
    const missingSdsAmount = Number(kpiResult.missingSdsAmount) || 0;
    const unmappedCount = Number(kpiResult.unmappedCount) || 0;
    const unmappedAmount = Number(kpiResult.unmappedAmount) || 0;
    const hazardousRatio = totalAmount > 0 ? (hazardousAmount / totalAmount) * 100 : 0;

    // 월별 통계 (SQL aggregation)
    const byMonthQuery = `
      SELECT
        TO_CHAR("purchaseDate", 'YYYY-MM') as "yearMonth",
        COALESCE(SUM("totalAmount"), 0) as "total",
        COALESCE(SUM(CASE 
          WHEN "hazardSnapshot" IS NOT NULL 
            AND ("hazardSnapshot"->>'hazardCodes')::jsonb IS NOT NULL 
            AND jsonb_array_length(("hazardSnapshot"->>'hazardCodes')::jsonb) > 0
          THEN "totalAmount" 
          ELSE 0 
        END), 0) as "hazardous",
        COALESCE(SUM(CASE 
          WHEN "hazardSnapshot" IS NOT NULL 
            AND (("hazardSnapshot"->>'msdsUrl') IS NULL OR ("hazardSnapshot"->>'msdsUrl') = '')
          THEN "totalAmount" 
          ELSE 0 
        END), 0) as "missingSds"
      FROM "PurchaseRecord"
      ${whereClause}
      GROUP BY TO_CHAR("purchaseDate", 'YYYY-MM')
      ORDER BY "yearMonth" ASC
    `;

    const byMonth = (await db.$queryRawUnsafe(byMonthQuery, ...params) as Array<{
      yearMonth: string;
      total: number;
      hazardous: number;
      missingSds: number;
    }>).map((row) => ({
      month: row.yearMonth,
      total: Number(row.total) || 0,
      hazardous: Number(row.hazardous) || 0,
      missingSds: Number(row.missingSds) || 0,
    }));

    // Top Hazard Codes (hazardSnapshot에서 추출)
    const topHazardCodesQuery = `
      SELECT
        hazard_code as "code",
        SUM(amount) as "amount"
      FROM (
        SELECT
          jsonb_array_elements_text(("hazardSnapshot"->>'hazardCodes')::jsonb) as hazard_code,
          "totalAmount" as amount
        FROM "PurchaseRecord"
        ${whereClause}
        WHERE "hazardSnapshot" IS NOT NULL 
          AND ("hazardSnapshot"->>'hazardCodes')::jsonb IS NOT NULL
      ) sub
      GROUP BY hazard_code
      ORDER BY SUM(amount) DESC
      LIMIT 10
    `;

    const topHazardCodes = (await db.$queryRawUnsafe(topHazardCodesQuery, ...params) as Array<{
      code: string;
      amount: number;
    }>).map((row) => ({
      code: row.code,
      amount: Number(row.amount) || 0,
    }));

    // Top Vendors (SQL aggregation)
    const topVendorsQuery = `
      SELECT
        v.name as "vendorName",
        COALESCE(SUM(pr."totalAmount"), 0) as "amount"
      FROM "PurchaseRecord" pr
      LEFT JOIN "Vendor" v ON pr."vendorId" = v.id
      ${whereClause}
      WHERE v.name IS NOT NULL
      GROUP BY v.name
      ORDER BY SUM(pr."totalAmount") DESC
      LIMIT 10
    `;

    const topVendors = (await db.$queryRawUnsafe(topVendorsQuery, ...params) as Array<{
      vendorName: string;
      amount: number;
    }>).map((row) => ({
      name: row.vendorName,
      amount: Number(row.amount) || 0,
    }));

    // 감사 로그 기록
    try {
      const { createAuditLog } = await import("@/lib/audit/audit-logger");
      await createAuditLog({
        organizationId: organizationId || undefined,
        userId: session.user.id,
        eventType: "SETTINGS_CHANGED",
        entityType: "safety_spend",
        action: "safety_spend_view",
        metadata: {
          period: {
            start: dateStart.toISOString(),
            end: dateEnd.toISOString(),
          },
        },
      });
    } catch (auditError) {
      console.error("Failed to create audit log:", auditError);
    }

    return NextResponse.json({
      totalAmount,
      hazardousAmount,
      missingSdsAmount,
      hazardousSharePct: hazardousRatio,
      byMonth,
      topHazardCodes,
      topVendors,
      unmappedCount,
      unmappedAmount,
    });
  } catch (error: any) {
    console.error("Error fetching safety spend data:", error);
    return NextResponse.json(
      { error: "Failed to fetch safety spend data" },
      { status: 500 }
    );
  }
}






