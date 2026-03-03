import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * GET /api/inventory/scan?id={inventoryId}
 * QR 스캔 결과 조회 — 시스템 발급 QR(cuid 형식) 검증 후 재고 전체 상세 반환
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get("id")?.trim();

    if (!id) {
      return NextResponse.json({ error: "id 파라미터가 필요합니다." }, { status: 400 });
    }

    // cuid 형식 검증 — 우리 시스템이 발급한 QR인지 1차 확인
    // cuid: 'c' + 24자 이상의 영소문자+숫자 또는 cuid2: 24자 소문자+숫자
    const isCuid = /^[a-z0-9]{20,30}$/.test(id);
    if (!isCuid) {
      return NextResponse.json(
        { error: "등록되지 않거나 유효하지 않은 QR 코드입니다.", code: "INVALID_FORMAT" },
        { status: 422 }
      );
    }

    const inventory = await db.productInventory.findUnique({
      where: { id },
      include: {
        product: {
          include: {
            vendors: {
              include: { vendor: true },
              take: 3,
            },
          },
        },
        restockRecords: {
          orderBy: { restockedAt: "desc" },
          take: 3,
          include: { user: { select: { id: true, name: true } } },
        },
      },
    });

    if (!inventory) {
      return NextResponse.json(
        { error: "등록되지 않거나 유효하지 않은 QR 코드입니다.", code: "NOT_FOUND" },
        { status: 404 }
      );
    }

    // 접근 권한 확인: 본인 재고 또는 같은 조직 재고
    if (inventory.userId !== session.user.id) {
      if (inventory.organizationId) {
        const membership = await db.organizationMember.findFirst({
          where: { userId: session.user.id, organizationId: inventory.organizationId },
        });
        if (!membership) {
          return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
        }
      } else {
        return NextResponse.json({ error: "접근 권한이 없습니다." }, { status: 403 });
      }
    }

    return NextResponse.json({ inventory });
  } catch (error) {
    console.error("[inventory/scan GET]", error);
    return NextResponse.json({ error: "서버 오류가 발생했습니다." }, { status: 500 });
  }
}
