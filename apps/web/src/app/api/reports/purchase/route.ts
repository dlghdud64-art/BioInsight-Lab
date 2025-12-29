import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 구매내역 리포트 조회
export async function GET(request: NextRequest) {
  try {
    // x-guest-key 헤더 또는 세션 인증 지원
    const guestKey = request.headers.get("x-guest-key");
    const session = await auth();

    // 게스트 키가 있거나 세션이 있으면 인증 통과
    // 개발 단계에서는 guest-demo를 기본값으로 사용
    const scopeKey = guestKey || (session?.user?.id ? `user-${session.user.id}` : "guest-demo");
    const userId = session?.user?.id;

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

    // QuoteList 기반 데이터 조회 (로그인된 경우에만)
    const quotes = userId ? await db.quote.findMany({
      where: {
        userId: userId,
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
    }) : [];

    // 실제 구매내역 조회 (PurchaseRecord)
    console.log("[Purchase API] Querying purchase records with:", {
      scopeKey: scopeKey,
      dateStart,
      dateEnd,
      vendorId,
      category
    });

    const purchaseRecords = await db.purchaseRecord.findMany({
      where: {
        scopeKey: scopeKey,
        ...(vendorId && { vendorName: vendorId }),
        purchasedAt: {
          gte: dateStart,
          lte: dateEnd,
        },
        ...(category && { category }),
      },
      orderBy: {
        purchasedAt: "desc",
      },
    });

    console.log("[Purchase API] Found purchase records:", purchaseRecords.length);

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
      actualAmount += record.amount;
      totalAmount += record.amount;
      if (record.vendorName) {
        vendorMap.set(
          record.vendorName,
          (vendorMap.get(record.vendorName) || 0) + record.amount
        );
      }
      if (record.category) {
        categoryMap.set(
          record.category,
          (categoryMap.get(record.category) || 0) + record.amount
        );
      }
      const month = record.purchasedAt.toISOString().substring(0, 7);
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + record.amount);
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

    // 예산 정보 조회 및 사용률 계산 (yearMonth 기반)
    console.log("[Purchase API] Querying budgets with scopeKey:", scopeKey);

    const budgets = await db.budget.findMany({
      where: {
        scopeKey: scopeKey,
      },
      include: {
        workspace: true,
      },
    });

    console.log("[Purchase API] Found budgets:", budgets.length);

    // 타입 에러 수정: budget 파라미터에 타입 명시
    const budgetUsage = budgets.map((budget: any) => {
      // yearMonth에 해당하는 사용 금액 계산
      const budgetMonth = budget.yearMonth; // "YYYY-MM" 형식
      let usedAmount = 0;

      // QuoteList 기반 계산
      quotes.forEach((quote: any) => {
        const quoteMonth = quote.createdAt.toISOString().substring(0, 7);
        if (quoteMonth === budgetMonth) {
          quote.items.forEach((item: any) => {
            usedAmount += (item.unitPrice || 0) * item.quantity;
          });
        }
      });

      // PurchaseRecord 기반 계산
      purchaseRecords.forEach((record: any) => {
        const purchaseMonth = record.purchasedAt.toISOString().substring(0, 7);
        if (purchaseMonth === budgetMonth) {
          usedAmount += record.amount;
        }
      });

      const usageRate = budget.amount > 0 ? (usedAmount / budget.amount) * 100 : 0;
      const remaining = budget.amount - usedAmount;

      return {
        id: budget.id,
        name: budget.description || budgetMonth,
        organization: "-",
        projectName: "-",
        budgetAmount: budget.amount,
        usedAmount,
        remaining,
        usageRate,
        yearMonth: budget.yearMonth,
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
        date: record.purchasedAt.toISOString().split("T")[0],
        organization: "-",
        project: "-",
        vendor: record.vendorName || "-",
        category: record.category || "-",
        productName: record.itemName || "-",
        amount: record.amount,
        notes: "-",
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
      { error: "Failed to fetch reports", details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    );
  }
}
