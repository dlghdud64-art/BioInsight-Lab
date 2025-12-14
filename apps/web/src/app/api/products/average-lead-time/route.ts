import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";

// 제품별 평균 납기일 조회 API
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { productIds } = body;

    if (!productIds || !Array.isArray(productIds) || productIds.length === 0) {
      return NextResponse.json(
        { error: "Product IDs are required" },
        { status: 400 }
      );
    }

    // 각 제품별로 평균 납기일 계산
    const averageLeadTimes: Record<string, number> = {};

    for (const productId of productIds) {
      // PurchaseRecord에서 해당 제품의 구매 기록을 찾아서
      // 견적 요청일과 실제 구매일의 차이를 계산하여 평균 납기일 추정
      // 또는 QuoteResponse에서 실제 납기일 정보를 가져오기
      
      // 일단 간단하게 ProductVendor의 leadTime 평균을 사용
      // 나중에 실제 구매 데이터가 쌓이면 그걸 사용하도록 개선
      const productVendors = await db.productVendor.findMany({
        where: {
          productId: productId,
          leadTime: {
            not: null,
            gt: 0,
          },
        },
        select: {
          leadTime: true,
        },
      });

      if (productVendors.length > 0) {
        const leadTimes = productVendors
          .map((pv: { leadTime: number | null }) => pv.leadTime)
          .filter((lt: number | null): lt is number => lt !== null && lt > 0);
        
        if (leadTimes.length > 0) {
          const sum = leadTimes.reduce((a: number, b: number) => a + b, 0);
          const average = Math.round(sum / leadTimes.length);
          averageLeadTimes[productId] = average;
        }
      }

      // 실제 구매 데이터가 있으면 그것을 우선 사용 (향후 개선)
      // const purchaseRecords = await db.purchaseRecord.findMany({
      //   where: {
      //     productId: productId,
      //   },
      //   include: {
      //     quote: true,
      //   },
      // });
    }

    return NextResponse.json({ averageLeadTimes });
  } catch (error) {
    console.error("Error calculating average lead times:", error);
    return NextResponse.json(
      { error: "Failed to calculate average lead times" },
      { status: 500 }
    );
  }
}


