import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 구매내역 리포트 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const period = searchParams.get("period") || "month";
    const startDate = searchParams.get("startDate");
    const endDate = searchParams.get("endDate");
    const organizationId = searchParams.get("organizationId");
    const vendorId = searchParams.get("vendorId");
    const category = searchParams.get("category");

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
        case "quarter":
          dateStart = new Date();
          dateStart.setMonth(dateStart.getMonth() - 3);
          break;
        case "year":
          dateStart = new Date();
          dateStart.setFullYear(dateStart.getFullYear() - 1);
          break;
        default:
          dateStart = new Date();
          dateStart.setMonth(dateStart.getMonth() - 1);
      }
    }

    // 필터 조건
    const where: any = {
      createdAt: {
        gte: dateStart,
        lte: dateEnd,
      },
    };

    if (organizationId) {
      where.organizationId = organizationId;
    }

    // QuoteList 기반 데이터 조회
    const quotes = await db.quote.findMany({
      where: {
        userId: session.user.id,
        createdAt: {
          gte: dateStart,
          lte: dateEnd,
        },
        ...(organizationId && { organizationId }),
      },
      include: {
        organization: true,
        items: {
          include: {
            product: {
              include: {
                vendors: {
                  include: {
                    vendor: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    // 실제 구매내역 조회 (PurchaseRecord)
    const purchaseRecords = await db.purchaseRecord.findMany({
      where: {
        ...(organizationId && { organizationId }),
        ...(vendorId && { vendorId }),
        purchaseDate: {
          gte: dateStart,
          lte: dateEnd,
        },
        ...(category && { category }),
      },
      include: {
        vendor: true,
        product: true,
        organization: true,
      },
    });

    // 메트릭 계산
    let totalAmount = 0;
    let estimatedAmount = 0; // 예상 구매액 (QuoteList 기반)
    let actualAmount = 0; // 실제 구매액 (PurchaseRecord 기반)
    const vendorMap = new Map<string, number>();
    const categoryMap = new Map<string, number>();
    const monthlyMap = new Map<string, number>();

    // QuoteList 기반 계산 (예상 구매액)
    // 타입 에러 수정: quote 파라미터에 타입 명시
    quotes.forEach((quote: any) => {
      // 타입 에러 수정: item 파라미터에 타입 명시
      quote.items.forEach((item: any) => {
        const amount = (item.unitPrice || 0) * item.quantity;
        estimatedAmount += amount;
        totalAmount += amount;

        const vendor = item.product.vendors?.[0]?.vendor;
        if (vendor) {
          vendorMap.set(vendor.name, (vendorMap.get(vendor.name) || 0) + amount);
        }

        if (item.product.category) {
          categoryMap.set(
            item.product.category,
            (categoryMap.get(item.product.category) || 0) + amount
          );
        }

        const month = quote.createdAt.toISOString().substring(0, 7);
        monthlyMap.set(month, (monthlyMap.get(month) || 0) + amount);
      });
    });

    // PurchaseRecord 기반 계산 (실제 구매액)
      // 타입 에러 수정: record 파라미터에 타입 명시
      purchaseRecords.forEach((record: any) => {
      actualAmount += record.totalAmount;
      totalAmount += record.totalAmount;
      if (record.vendor) {
        vendorMap.set(
          record.vendor.name,
          (vendorMap.get(record.vendor.name) || 0) + record.totalAmount
        );
      }
      if (record.category) {
        categoryMap.set(
          record.category,
          (categoryMap.get(record.category) || 0) + record.totalAmount
        );
      }
      const month = record.purchaseDate.toISOString().substring(0, 7);
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + record.totalAmount);
    });

    // 월별 데이터 정렬
    const monthlyData = Array.from(monthlyMap.entries())
      .map(([month, amount]) => ({ month, amount }))
      .sort((a, b) => a.month.localeCompare(b.month));

    // 벤더별 데이터
    const vendorData = Array.from(vendorMap.entries())
      // 타입 에러 수정: 파라미터에 타입 명시
      .map(([name, amount]: [string, number]) => ({ name, amount }))
      .sort((a: any, b: any) => b.amount - a.amount)
      .slice(0, 6);

    // 카테고리별 데이터
    // 타입 에러 수정: 파라미터에 타입 명시
    const categoryData = Array.from(categoryMap.entries()).map(([name, amount]: [string, number]) => ({
      name,
      amount,
    }));

    // 예산 정보 조회 및 사용률 계산
    const budgets = await db.budget.findMany({
      where: {
        ...(organizationId && { organizationId }),
        periodStart: { lte: dateEnd },
        periodEnd: { gte: dateStart },
      },
      include: {
        organization: true,
      },
    });

    // 타입 에러 수정: budget 파라미터에 타입 명시
    const budgetUsage = budgets.map((budget: any) => {
      // 해당 예산 기간 내의 실제 사용 금액 계산
      let usedAmount = 0;

      // QuoteList 기반 계산
      // 타입 에러 수정: quote 파라미터에 타입 명시
    quotes.forEach((quote: any) => {
        if (
          (!budget.organizationId || quote.organizationId === budget.organizationId) &&
          quote.createdAt >= budget.periodStart &&
          quote.createdAt <= budget.periodEnd
        ) {
          // 타입 에러 수정: item 파라미터에 타입 명시
      quote.items.forEach((item: any) => {
            usedAmount += (item.unitPrice || 0) * item.quantity;
          });
        }
      });

      // PurchaseRecord 기반 계산
      // 타입 에러 수정: record 파라미터에 타입 명시
      purchaseRecords.forEach((record: any) => {
        if (
          (!budget.organizationId || record.organizationId === budget.organizationId) &&
          record.purchaseDate >= budget.periodStart &&
          record.purchaseDate <= budget.periodEnd
        ) {
          usedAmount += record.totalAmount;
        }
      });

      const usageRate = budget.amount > 0 ? (usedAmount / budget.amount) * 100 : 0;
      const remaining = budget.amount - usedAmount;

      return {
        id: budget.id,
        name: budget.name,
        organization: budget.organization?.name || "-",
        projectName: budget.projectName || "-",
        budgetAmount: budget.amount,
        usedAmount,
        remaining,
        usageRate,
        periodStart: budget.periodStart,
        periodEnd: budget.periodEnd,
      };
    });

    // 상세 테이블 데이터 구성
    const details: any[] = [];

    // QuoteList 기반 상세 데이터
    // 타입 에러 수정: quote 파라미터에 타입 명시
    quotes.forEach((quote: any) => {
      // 타입 에러 수정: item 파라미터에 타입 명시
      quote.items.forEach((item: any) => {
        const vendor = item.product.vendors?.[0]?.vendor;
        details.push({
          id: item.id,
          date: quote.createdAt.toISOString().split("T")[0],
          organization: quote.organization?.name || "-",
          project: quote.description || "-",
          vendor: vendor?.name || "-",
          category: item.product.category || "-",
          productName: item.product.name,
          amount: (item.unitPrice || 0) * item.quantity,
          notes: item.notes || "-",
          type: "quote",
        });
      });
    });

    // PurchaseRecord 기반 상세 데이터
      // 타입 에러 수정: record 파라미터에 타입 명시
      purchaseRecords.forEach((record: any) => {
      details.push({
        id: record.id,
        date: record.purchaseDate.toISOString().split("T")[0],
        organization: record.organization?.name || "-",
        project: record.projectName || "-",
        vendor: record.vendor?.name || "-",
        category: record.category || "-",
        productName: record.product?.name || record.productName || "-",
        amount: record.totalAmount,
        notes: record.notes || "-",
        type: "purchase",
      });
    });

    // 날짜순 정렬
    // 타입 에러 수정: a, b 파라미터에 타입 명시
    details.sort((a: any, b: any) => b.date.localeCompare(a.date));

    return NextResponse.json({
      metrics: {
        totalAmount,
        estimatedAmount,
        actualAmount,
        difference: actualAmount - estimatedAmount, // 실제 - 예상 (양수면 초과, 음수면 절감)
        vendorCount: vendorMap.size,
        // 타입 에러 수정: sum, q 파라미터에 타입 명시
        itemCount: quotes.reduce((sum: number, q: any) => sum + q.items.length, 0) + purchaseRecords.length,
        listCount: quotes.length,
      },
      monthlyData,
      vendorData,
      categoryData,
      details,
      budgetUsage,
    });
  } catch (error) {
    console.error("Error fetching purchase reports:", error);
    return NextResponse.json(
      { error: "Failed to fetch reports" },
      { status: 500 }
    );
  }
}