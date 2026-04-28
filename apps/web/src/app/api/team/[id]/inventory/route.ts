import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * 팀 인벤토리 조회 (팀 멤버들의 모든 인벤토리)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: teamId } = await params;

    // 팀 멤버인지 확인 (Multi-tenancy isolation)
    const userMember = await db.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId,
        },
      },
    });

    if (!userMember) {
      return NextResponse.json(
        { error: "Forbidden: Not a member of this team" },
        { status: 403 }
      );
    }

    // 팀 멤버 목록 조회
    const teamMembers = await db.teamMember.findMany({
      where: { teamId },
      select: { userId: true },
    });

    const memberIds = teamMembers.map((m: any) => m.userId);

    // 팀 멤버들의 인벤토리 조회
    // §11.56 / #inventory-model-consolidation Phase 2 (endpoint redirect)
    //                                       Phase 3 (caller adaptation audit)
    // pre-fix: UserInventory findMany (legacy receipt log)
    // post-fix: ProductInventory findMany (LabAxis 운영 master, schema-designed path)
    // Phase 3 audit 결과: caller(`inventory-content.tsx` + `inventory-main.tsx`)
    // 는 처음부터 `ProductInventory` 시그니처로 작성되어 있었음
    // (`inv: ProductInventory`, `inv.currentQuantity`, `inv.product.name` 사용).
    // 즉 pre-Phase 1은 caller의 expected shape ↔ endpoint 반환 shape 의 silent
    // drift 였음. Phase 1 helper + Phase 2 endpoint redirect 가 이를 정렬,
    // Phase 3 audit 으로 caller drift 0 건 확정. UserInventory 모델 자체 drop
    // 은 별도 트랙(`#userInventory-schema-drop`, operator-shell migration).
    const inventories = await db.productInventory.findMany({
      where: {
        userId: {
          in: memberIds,
        },
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        product: {
          select: {
            id: true,
            name: true,
            brand: true,
            catalogNumber: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return NextResponse.json({ inventories });
  } catch (error) {
    console.error("Error fetching team inventory:", error);
    return NextResponse.json(
      { error: "Failed to fetch team inventory" },
      { status: 500 }
    );
  }
}


