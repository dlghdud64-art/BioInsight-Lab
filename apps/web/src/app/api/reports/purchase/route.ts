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
    // 개발 단계에서는 모든 사용자에게 guest-demo 데이터 표시
    const scopeKey = guestKey || "guest-demo";
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
    // DB 스키마 불일치 문제 대비 try-catch 처리
    let quotes: any[] = [];
    if (userId) {
      try {
        quotes = await db.quote.findMany({
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
            // §reports-honesty P2/P4 — 실벤더. product 카탈로그 첫 벤더 매핑 폐기(오표기 원인).
            //   P4 실측: QuoteVendor(vendors)는 프로덕션 전역 0행 — 실제 RFQ 수신처는
            //   QuoteVendorRequest(vendorRequests)에 기록됨. 둘 다 포함해 폴백(overfetch 최소 select).
            vendors: { select: { vendorName: true } },
            vendorRequests: { select: { vendorName: true } },
            items: {
              include: {
                product: { select: { category: true, name: true } },
              },
            },
          },
        });
      } catch (quoteError) {
        console.error("[Purchase API] Quote query failed:", quoteError);
        quotes = [];
      }
    }

    // 실제 구매내역 조회 (PurchaseRecord)
    if (process.env.NODE_ENV === "development") {
      console.log("[Purchase API] Querying purchase records with:", {
        scopeKey: scopeKey,
        dateStart,
        dateEnd,
        vendorId,
        category
      });
    }

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

    if (process.env.NODE_ENV === "development") {
      console.log("[Purchase API] Found purchase records:", purchaseRecords.length);
    }

    // 메트릭 계산
    let totalAmount = 0;
    let estimatedAmount = 0; // 예상 구매액 (QuoteList 기반)
    let actualAmount = 0; // 실제 구매액 (PurchaseRecord 기반)
    const vendorMap = new Map<string, number>();
    const categoryMap = new Map<string, number>();
    const monthlyMap = new Map<string, number>();

    // §reports-honesty P2 — 견적 기반 계산 (예상 구매액).
    //   truth: 견적 측 유일 구조 금액 = `Quote.totalAmount`. QuoteItem 에는 가격 필드가 **부재**하여
    //   기존의 품목 단가 × 수량 파생은 구조적으로 항상 0 → 미확정 견적을 ₩0 지출로 날조했음.
    //   ⇒ totalAmount 미입력(미확정)은 합계/월별/벤더 집계에서 **제외**하고 건수만 반영.
    let pendingQuoteCount = 0; // 회신 대기(금액 미확정) 견적 건수
    quotes.forEach((quote: any) => {
      const quoteAmount = quote.totalAmount ?? null;
      if (quoteAmount == null) {
        pendingQuoteCount += 1;
        return; // 미확정 — 금액 단정 금지(0 가산 금지)
      }
      estimatedAmount += quoteAmount;
      totalAmount += quoteAmount;

      // 실벤더 = QuoteVendor → (P4 폴백) QuoteVendorRequest → AI vendor. 카탈로그 첫 벤더 매핑 폐기.
      const quoteVendorName =
        quote.vendors?.[0]?.vendorName ??
        quote.vendorRequests?.[0]?.vendorName ??
        quote.vendor ??
        null;
      if (quoteVendorName) {
        vendorMap.set(quoteVendorName, (vendorMap.get(quoteVendorName) || 0) + quoteAmount);
      }

      const month = quote.createdAt.toISOString().substring(0, 7);
      monthlyMap.set(month, (monthlyMap.get(month) || 0) + quoteAmount);

      // 카테고리 집계 제외: 카테고리는 item 단위인데 Quote.totalAmount 는 견적 단위 —
      //   item 가격 부재로 정직한 배분이 불가(임의 배분 = 날조). 카테고리는 실구매 기준만 집계.
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
      .sort((a: any, b: any) => a.month.localeCompare(b.month));

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
    if (process.env.NODE_ENV === "development") {
      console.log("[Purchase API] Querying budgets with scopeKey:", scopeKey);
    }

    const budgets = await db.budget.findMany({
      where: {
        scopeKey: scopeKey,
      },
      include: {
        workspace: true,
      },
    });

    if (process.env.NODE_ENV === "development") {
      console.log("[Purchase API] Found budgets:", budgets?.length || 0);
    }

    // 타입 에러 수정: budget 파라미터에 타입 명시
    // budgets가 배열이 아닐 경우 빈 배열로 처리
    const budgetUsage = (Array.isArray(budgets) ? budgets : []).map((budget: any) => {
      // yearMonth에 해당하는 사용 금액 계산
      const budgetMonth = budget.yearMonth; // "YYYY-MM" 형식
      let usedAmount = 0;

      // §reports-honesty P2 — 견적 사용액도 Quote.totalAmount 기준.
      //   미확정 견적은 예산 사용액에 가산하지 않음(₩0 가산 = 무의미, 미확정 단정 금지).
      quotes.forEach((quote: any) => {
        const quoteMonth = quote.createdAt.toISOString().substring(0, 7);
        if (quoteMonth === budgetMonth && quote.totalAmount != null) {
          usedAmount += quote.totalAmount;
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
      // §reports-honesty P2 — 상세행 3결함 교정.
      //   ① amount: 품목 단가가 스키마상 부재 → 품목 금액은 구조적으로 미상. 0 단정 금지(null).
      //      견적 단위 확정 총액은 quoteTotalAmount 로 별도 전달, 미확정 여부는 pending 로 표기(P3 UI).
      //   ② vendor: 견적 실벤더(QuoteVendor) → Quote.vendor(AI 추출) → "-" 순 폴백.
      //   ③ project: 요청 메시지 원문(description) 노출 폐기 → 견적 식별자(견적번호 ?? 제목).
      const quoteVendorName =
        quote.vendors?.[0]?.vendorName ??
        quote.vendorRequests?.[0]?.vendorName ??
        quote.vendor ??
        "-";
      const quotePending = quote.totalAmount == null;
      quote.items.forEach((item: any) => {
        details.push({
          id: item.id,
          date: quote.createdAt.toISOString().split("T")[0],
          organization: quote.organization?.name || "-",
          project: quote.quoteNumber ?? quote.title,
          vendor: quoteVendorName,
          category: item.product?.category || "-",
          productName: item.product?.name || "-",
          amount: null,
          quoteTotalAmount: quote.totalAmount ?? null,
          pending: quotePending,
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
        // §reports-honesty P2 — 금액 미확정(회신 대기) 견적 건수. 합계에서 제외된 몫을
        //   숨기지 않고 건수로 정직하게 노출(P3 UI "회신 대기 N건" 표기 근거).
        pendingQuoteCount,
      },
      monthlyData,
      vendorData,
      categoryData,
      details,
      budgetUsage: Array.isArray(budgetUsage) ? budgetUsage : [],
    });
  } catch (error) {
    console.error("Error fetching purchase reports:", error);
    return NextResponse.json(
      { 
        error: "Failed to fetch reports", 
        details: error instanceof Error ? error.message : String(error),
        budgetUsage: [], // 에러 발생 시에도 빈 배열 반환
      },
      { status: 500 }
    );
  }
}
