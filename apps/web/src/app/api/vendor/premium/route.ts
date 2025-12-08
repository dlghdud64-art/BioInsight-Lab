import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 프리미엄 플랜 활성화/비활성화
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

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

    return NextResponse.json({ vendor: updatedVendor });
  } catch (error) {
    console.error("Error updating premium status:", error);
    return NextResponse.json(
      { error: "Failed to update premium status" },
      { status: 500 }
    );
  }
}

// 프리미엄 상태 조회