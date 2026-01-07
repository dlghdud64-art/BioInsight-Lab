import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PurchaseRequestStatus, TeamRole } from "@prisma/client";

/**
 * 구매 요청 거절 (ADMIN/OWNER만 가능)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: requestId } = await params;
    const body = await request.json();
    const { reason } = body;

    // 구매 요청 조회
    const purchaseRequest = await db.purchaseRequest.findUnique({
      where: { id: requestId },
      include: {
        team: true,
      },
    });

    if (!purchaseRequest) {
      return NextResponse.json(
        { error: "Purchase request not found" },
        { status: 404 }
      );
    }

    if (purchaseRequest.status !== PurchaseRequestStatus.PENDING) {
      return NextResponse.json(
        { error: "Purchase request is not pending" },
        { status: 400 }
      );
    }

    // 권한 확인: ADMIN 또는 OWNER만 거절 가능
    const teamMember = await db.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId: purchaseRequest.teamId || "",
        },
      },
    });

    if (!teamMember || (teamMember.role !== TeamRole.OWNER && teamMember.role !== TeamRole.ADMIN)) {
      return NextResponse.json(
        { error: "Forbidden: Only OWNER or ADMIN can reject requests" },
        { status: 403 }
      );
    }

    // 구매 요청 거절
    const rejectedRequest = await db.purchaseRequest.update({
      where: { id: requestId },
      data: {
        status: PurchaseRequestStatus.REJECTED,
        approverId: session.user.id,
        rejectedAt: new Date(),
        rejectedReason: reason || null,
      },
      include: {
        requester: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
        approver: {
          select: {
            id: true,
            name: true,
            email: true,
            image: true,
          },
        },
      },
    });

    return NextResponse.json({ purchaseRequest: rejectedRequest });
  } catch (error) {
    console.error("Error rejecting purchase request:", error);
    return NextResponse.json(
      { error: "Failed to reject purchase request" },
      { status: 500 }
    );
  }
}


