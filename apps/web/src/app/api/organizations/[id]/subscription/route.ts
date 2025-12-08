import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { SubscriptionPlan } from "@/lib/plans";

// 조직의 구독 정보 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const organization = await db.organization.findUnique({
      where: { id },
      include: {
        subscription: true,
        members: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // 권한 확인
    const isMember = await db.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId: id,
      },
    });

    if (!isMember) {
      return NextResponse.json(
        { error: "Forbidden" },
        { status: 403 }
      );
    }

    return NextResponse.json({
      organization,
      subscription: organization.subscription,
    });
  } catch (error: any) {
    console.error("Error fetching subscription:", error);
    return NextResponse.json(
      { error: "Failed to fetch subscription" },
      { status: 500 }
    );
  }
}

// 구독 업그레이드/변경