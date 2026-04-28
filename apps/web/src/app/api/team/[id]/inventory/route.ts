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
    // §11.56 / #inventory-model-consolidation Phase 2:
    // pre-fix: db.userInventory.findMany (legacy receipt log)
    // post-fix: db.productInventory.findMany (LabAxis 운영 master, schema-designed path)
    // 호출자(`/dashboard/inventory/inventory-content.tsx` + inventory-main.tsx)는
    // 같은 endpoint contract 사용. 응답 shape는 두 모델이 다르므로 caller는
    // ProductInventory shape로 적응 필요(별도 트랙 — Phase 3에서 audit).
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


