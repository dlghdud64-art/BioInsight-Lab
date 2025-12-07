import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { SubscriptionPlan } from "@/lib/plans";

// 조직의 구독 정보 조회
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const organization = await db.organization.findUnique({
      where: { id: params.id },
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
        organizationId: params.id,
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
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { plan, periodMonths = 1 } = body;

    if (!plan || !Object.values(SubscriptionPlan).includes(plan)) {
      return NextResponse.json(
        { error: "Invalid plan" },
        { status: 400 }
      );
    }

    const organization = await db.organization.findUnique({
      where: { id: params.id },
      include: {
        subscription: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // 권한 확인 (조직 관리자만)
    const isAdmin = await db.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId: params.id,
        role: "ADMIN",
      },
    });

    if (!isAdmin) {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    // 구독 기간 계산
    const now = new Date();
    const periodEnd = new Date(now);
    periodEnd.setMonth(periodEnd.getMonth() + periodMonths);

    // 구독 생성/업데이트
    const subscription = await db.subscription.upsert({
      where: { organizationId: params.id },
      create: {
        organizationId: params.id,
        plan,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
      },
      update: {
        plan,
        status: "active",
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        cancelAtPeriodEnd: false,
      },
    });

    // 조직 플랜 정보 업데이트
    await db.organization.update({
      where: { id: params.id },
      data: {
        plan,
        planExpiresAt: periodEnd,
      },
    });

    return NextResponse.json({ subscription });
  } catch (error: any) {
    console.error("Error updating subscription:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update subscription" },
      { status: 500 }
    );
  }
}


