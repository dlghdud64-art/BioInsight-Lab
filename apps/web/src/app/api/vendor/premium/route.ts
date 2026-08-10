import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 프리미엄 플랜 활성화/비활성화
export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    // (죽은 재검사 제거: 같은 POST 핸들러 상단에서 이미 401 처리했다)
    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, email: true },
    });

    if (user?.role !== "SUPPLIER") {
      return NextResponse.json({ error: "Only suppliers can access this" }, { status: 403 });
    }

    const vendor = await db.vendor.findFirst({
      where: { email: user.email || undefined },
    });

    if (!vendor) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_import',
      targetEntityType: 'product',
      // §enforcement-handle-close-sweep (vendor) — 대상 Vendor 확정 이후로 핸들을 옮겼다.
      //   403(비-SUPPLIER)·404(vendor 없음)가 lock 보다 앞서므로 lock 을 잡지 않는다.
      //   ⚠️ enum 에 vendor 타입이 없어 'product' 가 대리로 남아 있다 → §audit-taxonomy-review.
      targetEntityId: vendor.id,
      sourceSurface: 'vendor_portal',
      routePath: '/vendor/premium',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const body = await request.json();
    const { isPremium, premiumExpiresAt } = body;

    const updatedVendor = await db.vendor.update({
      where: { id: vendor.id },
      data: {
        isPremium: isPremium ?? vendor.isPremium,
        premiumExpiresAt: premiumExpiresAt ? new Date(premiumExpiresAt) : vendor.premiumExpiresAt,
      },
    });

    // 프리미엄 활성화 시 과금 기록 생성
    if (isPremium && !vendor.isPremium) {
      await db.vendorBillingRecord.create({
        data: {
          vendorId: vendor.id,
          type: "PREMIUM",
          amount: 0, // 실제로는 결제 시스템 연동 필요
          description: "프리미엄 플랜 활성화",
          periodStart: new Date(),
          periodEnd: premiumExpiresAt ? new Date(premiumExpiresAt) : null,
        },
      });
    }

    enforcement.complete({
      beforeState: {
        vendorId: vendor.id,
        isPremium: vendor.isPremium,
        premiumExpiresAt: vendor.premiumExpiresAt?.toISOString() ?? null,
      },
      afterState: {
        vendorId: updatedVendor.id,
        isPremium: updatedVendor.isPremium,
        premiumExpiresAt: updatedVendor.premiumExpiresAt?.toISOString() ?? null,
      },
    });

    return NextResponse.json({ vendor: updatedVendor });
  } catch (error) {
    enforcement?.fail();
    console.error("Error updating premium status:", error);
    return NextResponse.json(
      { error: "Failed to update premium status" },
      { status: 500 }
    );
  }
}

// 프리미엄 상태 조회

