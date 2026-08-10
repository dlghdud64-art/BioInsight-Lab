import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 리드당 과금 처리 (견적 요청 생성 시 호출)
export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'organization_update',
      targetEntityType: 'product',
      // §enforcement-handle-close-sweep (vendor) — 'unknown' 유지.
      //   vendorIds 배열을 루프로 과금하므로 **단일 대상 엔티티가 없다**
      //   (quoteId 는 요청 범위이지 쓰기 대상이 아니다).
      //   ⚠️ targetEntityType 'product' 도 실제 대상(Vendor/VendorBillingRecord)과
      //     어긋난다. enum 에 vendor 타입 부재 → §audit-taxonomy-review 후보.
      targetEntityId: 'unknown',
      sourceSurface: 'vendor_portal',
      routePath: '/vendor/billing',
    });
    if (!enforcement.allowed) return enforcement.deny();

        const body = await request.json();
    const { quoteId, vendorIds } = body;

    if (!quoteId || !vendorIds || !Array.isArray(vendorIds)) {
      enforcement.fail();
      return NextResponse.json({ error: "Invalid request" }, { status: 400 });
    }

    // 각 벤더에 대해 리드당 과금 처리
    const billingRecords = [];

    for (const vendorId of vendorIds) {
      const vendor = await db.vendor.findUnique({
        where: { id: vendorId },
        select: { id: true, leadPricePerQuote: true, isPremium: true },
      });

      if (!vendor || !vendor.leadPricePerQuote || vendor.leadPricePerQuote <= 0) {
        continue; // 과금이 설정되지 않은 벤더는 스킵
      }

      // 과금 기록 생성
      const billingRecord = await db.vendorBillingRecord.create({
        data: {
          vendorId: vendor.id,
          type: "LEAD",
          amount: vendor.leadPricePerQuote,
          quantity: 1,
          description: `견적 요청 #${quoteId}에 대한 리드 과금`,
        },
      });

      // 벤더 통계 업데이트
      await db.vendor.update({
        where: { id: vendor.id },
        data: {
          totalLeads: { increment: 1 },
          totalRevenue: { increment: vendor.leadPricePerQuote },
        },
      });

      billingRecords.push(billingRecord);
    }

    // 과금 설정이 없는 벤더는 continue 로 건너뛴다 → 쓰기가 0건일 수 있다.
    //   그 경우 complete() 는 없던 변경을 남기는 허위 audit 이 된다.
    if (billingRecords.length > 0) {
      enforcement.complete({
        beforeState: { quoteId, requestedVendors: vendorIds.length },
        afterState: {
          quoteId,
          billedVendors: billingRecords.length,
          billingRecordIds: billingRecords.map((r: { id: string }) => r.id),
        },
      });
    } else {
      enforcement.fail();
    }

    return NextResponse.json({ success: true, billingRecords });
  } catch (error) {
    enforcement?.fail();
    console.error("Error processing billing:", error);
    return NextResponse.json(
      { error: "Failed to process billing" },
      { status: 500 }
    );
  }
}

// 벤더 과금 기록 조회

