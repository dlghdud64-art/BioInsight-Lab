import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { PurchaseRequestStatus, TeamRole } from "@prisma/client";

/**
 * 구매 요청 생성 (MEMBER만 가능)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { teamId, title, message, items, quoteId, totalAmount } = body;

    if (!teamId || !title || !items || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { error: "Team ID, title, and items are required" },
        { status: 400 }
      );
    }

    // 팀 멤버인지 확인
    const teamMember = await db.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId,
        },
      },
    });

    if (!teamMember) {
      return NextResponse.json(
        { error: "Forbidden: Not a member of this team" },
        { status: 403 }
      );
    }

    // MEMBER만 요청 가능 (OWNER/ADMIN은 직접 결제)
    if (teamMember.role === TeamRole.ADMIN || teamMember.role === TeamRole.ADMIN) {
      return NextResponse.json(
        { error: "OWNER and ADMIN cannot create purchase requests. Please checkout directly." },
        { status: 400 }
      );
    }

    // 구매 요청 생성
    const purchaseRequest = await db.purchaseRequest.create({
      data: {
        requesterId: session.user.id,
        teamId,
        title,
        message,
        items: items as any, // JSON 필드
        totalAmount: totalAmount || null,
        quoteId: quoteId || null,
        status: PurchaseRequestStatus.PENDING,
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
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

    return NextResponse.json({ purchaseRequest }, { status: 201 });
  } catch (error) {
    console.error("Error creating purchase request:", error);
    return NextResponse.json(
      { error: "Failed to create purchase request" },
      { status: 500 }
    );
  }
}

/**
 * 구매 요청 목록 조회
 * - MEMBER: 자신이 요청한 것만
 * - ADMIN/OWNER: 팀의 모든 요청
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const teamId = searchParams.get("teamId");
    const status = searchParams.get("status") as PurchaseRequestStatus | null;

    if (!teamId) {
      return NextResponse.json(
        { error: "Team ID is required" },
        { status: 400 }
      );
    }

    // 팀 멤버인지 확인
    const teamMember = await db.teamMember.findUnique({
      where: {
        userId_teamId: {
          userId: session.user.id,
          teamId,
        },
      },
    });

    if (!teamMember) {
      return NextResponse.json(
        { error: "Forbidden: Not a member of this team" },
        { status: 403 }
      );
    }

    // 권한에 따라 필터링
    const where: any = { teamId };
    if (status) {
      where.status = status;
    }

    // MEMBER는 자신이 요청한 것만 조회
    if (teamMember.role === TeamRole.MEMBER) {
      where.requesterId = session.user.id;
    }
    // ADMIN/OWNER는 팀의 모든 요청 조회

    const purchaseRequests = await db.purchaseRequest.findMany({
      where,
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
        team: {
          select: {
            id: true,
            name: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ purchaseRequests });
  } catch (error) {
    console.error("Error fetching purchase requests:", error);
    return NextResponse.json(
      { error: "Failed to fetch purchase requests" },
      { status: 500 }
    );
  }
}


