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
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let id: string | undefined;
  let body: any;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    ({ id } = await params);
    body = await request.json();
    const { plan, periodMonths = 1 } = body;

    if (!plan || !Object.values(SubscriptionPlan).includes(plan)) {
      return NextResponse.json(
        { error: "Invalid plan" },
        { status: 400 }
      );
    }

    // 조직 확인
    const organization = await db.organization.findUnique({
      where: { id },
      include: {
        members: true,
        subscription: true,
      },
    });

    if (!organization) {
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // 관리자 권한 확인
    const membership = await db.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId: id,
        role: "ADMIN",
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 }
      );
    }

    // 구독 업데이트 또는 생성
    const planExpiresAt = plan !== SubscriptionPlan.FREE
      ? new Date(Date.now() + periodMonths * 30 * 24 * 60 * 60 * 1000)
      : null;

    // Organization 업데이트
    const updatedOrg = await db.organization.update({
      where: { id },
      data: {
        plan: plan as SubscriptionPlan,
        planExpiresAt,
      },
    });

    // Subscription 업데이트 또는 생성
    let subscription;
    if (organization.subscription) {
      subscription = await db.subscription.update({
        where: { id: organization.subscription.id },
        data: {
          plan: plan as SubscriptionPlan,
          status: "active",
          currentPeriodStart: new Date(),
          currentPeriodEnd: planExpiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          cancelAtPeriodEnd: false,
        },
      });
    } else {
      subscription = await db.subscription.create({
        data: {
          organizationId: id,
          plan: plan as SubscriptionPlan,
          status: "active",
          currentPeriodStart: new Date(),
          currentPeriodEnd: planExpiresAt || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          cancelAtPeriodEnd: false,
        },
      });
    }

    return NextResponse.json({
      organization: updatedOrg,
      subscription,
    });
  } catch (error: any) {
    const errMsg = error?.message ?? "Unknown error";
    const errCode = error?.code;
    const errStack = error?.stack;

    console.error("[Subscription API] POST Error:", {
      message: errMsg,
      code: errCode,
      stack: errStack,
      organizationId: id,
      requestedPlan: body?.plan,
    });

    if (errCode === "P2002") {
      return NextResponse.json(
        { error: "구독 정보가 이미 존재합니다. 페이지를 새로고침 후 다시 시도해주세요." },
        { status: 409 }
      );
    }
    if (errCode === "P2003") {
      return NextResponse.json(
        { error: "조직 정보를 찾을 수 없습니다. 조직 선택을 확인해주세요." },
        { status: 400 }
      );
    }
    if (errCode === "P2025") {
      return NextResponse.json(
        { error: "구독 레코드를 찾을 수 없습니다. 페이지를 새로고침 후 다시 시도해주세요." },
        { status: 404 }
      );
    }

    return NextResponse.json(
      {
        error: "요금제 변경 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.",
        details: process.env.NODE_ENV === "development" ? errMsg : undefined,
      },
      { status: 500 }
    );
  }
}