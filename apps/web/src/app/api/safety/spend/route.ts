import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 두 날짜 간의 월 수 계산
function getMonthsDifference(start: Date, end: Date): number {
  const months = (end.getFullYear() - start.getFullYear()) * 12
    + (end.getMonth() - start.getMonth());
  return months;
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const organizationId = searchParams.get("organizationId");

    // 날짜 검증
    if (!from || !to) {
      return NextResponse.json({
        error: "Both 'from' and 'to' date parameters are required"
      }, { status: 400 });
    }

    const fromDate = new Date(from);
    const toDate = new Date(to);

    if (isNaN(fromDate.getTime()) || isNaN(toDate.getTime())) {
      return NextResponse.json({
        error: "Invalid date format. Use YYYY-MM-DD"
      }, { status: 400 });
    }

    if (fromDate > toDate) {
      return NextResponse.json({
        error: "Start date must be before end date"
      }, { status: 400 });
    }

    // 기간 제한 (2년 이상 경고)
    const monthsDiff = getMonthsDifference(fromDate, toDate);
    if (monthsDiff > 24) {
      return NextResponse.json({
        error: "Date range exceeds 2 years. Please select a shorter period."
      }, { status: 400 });
    }

    // 구매 데이터 조회
    const whereClause: any = {
      purchaseDate: {
        gte: fromDate,
        lte: toDate,
      },
    };

    if (organizationId) {
      whereClause.organizationId = organizationId;
    }

    const purchases = await db.purchaseRecord.findMany({
      where: whereClause,
      include: {
        vendor: true,
        product: true,
      },
      orderBy: {
        purchaseDate: 'desc',
      },
    });

    // 데이터 집계
    let totalAmount = 0;
    let hazardousAmount = 0;
    let missingSdsAmount = 0;
    let unmappedCount = 0;
    let unmappedAmount = 0;

    const monthlyMap = new Map<string, { total: number; hazardous: number; missingSds: number }>();
    const hazardCodeMap = new Map<string, number>();
    const vendorMap = new Map<string, number>();

    purchases.forEach((purchase: any) => {
      const amount = purchase.totalAmount;
      totalAmount += amount;

      const product = purchase.product;
      const hasProduct = !!product;

      if (!hasProduct) {
        unmappedCount++;
        unmappedAmount += amount;
      }

      // 위험 물질 여부 체크
      const hazardCodes = product?.hazardCodes as string[] | null;
      const isHazardous = hazardCodes && Array.isArray(hazardCodes) && hazardCodes.length > 0;

      if (isHazardous) {
        hazardousAmount += amount;

        // 위험 코드별 집계
        hazardCodes.forEach((code: string) => {
          hazardCodeMap.set(code, (hazardCodeMap.get(code) || 0) + amount);
        });
      }

      // SDS 누락 체크
      const hasSds = !!product?.msdsUrl;
      if (!hasSds && hasProduct) {
        missingSdsAmount += amount;
      }

      // 월별 집계
      const yearMonth = purchase.purchaseDate.toISOString().substring(0, 7);
      const monthData = monthlyMap.get(yearMonth) || { total: 0, hazardous: 0, missingSds: 0 };
      monthData.total += amount;
      if (isHazardous) monthData.hazardous += amount;
      if (!hasSds && hasProduct) monthData.missingSds += amount;
      monthlyMap.set(yearMonth, monthData);

      // 벤더별 집계
      const vendorName = purchase.vendor?.name || 'Unknown';
      vendorMap.set(vendorName, (vendorMap.get(vendorName) || 0) + amount);
    });

    const hazardousSharePct = totalAmount > 0 ? (hazardousAmount / totalAmount) * 100 : 0;

    // 월별 데이터 정렬
    const byMonth = Array.from(monthlyMap.entries())
      .map(([yearMonth, data]) => ({
        yearMonth,
        total: data.total,
        hazardous: data.hazardous,
        missingSds: data.missingSds,
      }))
      .sort((a, b) => a.yearMonth.localeCompare(b.yearMonth));

    // 상위 위험 코드 (Top 10)
    const topHazardCodes = Array.from(hazardCodeMap.entries())
      .map(([code, amount]) => ({ code, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    // 상위 벤더 (Top 10)
    const topVendors = Array.from(vendorMap.entries())
      .map(([vendorName, amount]) => ({ vendorName, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10);

    return NextResponse.json({
      summary: {
        totalAmount,
        hazardousAmount,
        hazardousSharePct,
        missingSdsAmount,
        unmappedCount,
        unmappedAmount,
      },
      breakdown: {
        byMonth,
        topHazardCodes,
        topVendors,
      },
    });

  } catch (error: any) {
    console.error("Error fetching safety spend data:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch safety spend data" },
      { status: 500 }
    );
  }
}
