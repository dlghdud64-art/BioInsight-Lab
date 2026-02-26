/**
 * Billing API - 구독 정보 조회 및 관리
 *
 * GET: 현재 구독 정보, 결제 수단, 청구 내역 조회
 * POST: 구독 업그레이드/다운그레이드
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 플랜 정보 (가격, 기능) - Starter / Basic ₩29,000 / Pro ₩69,000 정책 반영
const PLAN_INFO: Record<string, { name: string; nameKo: string; price: number | null; priceDisplay: string; maxSeats: number | null; maxQuotesPerMonth: number | null; features: string[] }> = {
  FREE: {
    name: "Starter",
    nameKo: "무료",
    price: 0,
    priceDisplay: "무료",
    maxSeats: 1,
    maxQuotesPerMonth: 10,
    features: [
      "기본 검색 기능",
      "월 10개 견적 리스트",
      "기본 비교 기능",
    ],
  },
  TEAM: {
    name: "Basic",
    nameKo: "Basic",
    price: 29000,
    priceDisplay: "₩29,000/월",
    maxSeats: 3,
    maxQuotesPerMonth: 100,
    features: [
      "재고 최대 500개",
      "재고 예측 알림",
      "팀원 3명",
      "엑셀 업로드",
      "기본 검색",
    ],
  },
  ORGANIZATION: {
    name: "Pro",
    nameKo: "Pro",
    price: 69000,
    priceDisplay: "₩69,000/월",
    maxSeats: null, // 무제한
    maxQuotesPerMonth: null, // 무제한
    features: [
      "재고 무제한",
      "Lot 관리",
      "예산 분석",
      "감사 증적 (Audit Trail)",
      "팀원 초대",
      "재고 소진 알림",
    ],
  },
};

// GET: 구독 정보 조회
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    // 데모 모드: 세션이 없어도 기본 데이터 반환
    if (!session?.user?.id) {
      return NextResponse.json({
        subscription: {
          plan: "FREE",
          status: "active",
          currentSeats: 1,
          maxSeats: 1,
          currentPeriodStart: new Date().toISOString(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        planInfo: PLAN_INFO,
        paymentMethods: [],
        invoices: [],
        usage: {
          quotesUsed: 3,
          quotesLimit: 10,
          seatsUsed: 1,
          seatsLimit: 1,
        },
      });
    }

    const userId = session.user.id;

    // 사용자의 조직 찾기
    const membership = await db.organizationMember.findFirst({
      where: { userId },
      include: {
        organization: {
          include: {
            subscription: {
              include: {
                paymentMethods: true,
                invoices: {
                  orderBy: { periodStart: "desc" },
                  take: 12,
                },
              },
            },
          },
        },
      },
    });

    let subscription = membership?.organization?.subscription;

    // 구독이 없으면 기본 FREE 구독 생성
    if (!subscription && membership?.organization) {
      subscription = await db.subscription.create({
        data: {
          organizationId: membership.organization.id,
          plan: "FREE",
          status: "active",
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          currentSeats: 1,
          maxSeats: 1,
        },
        include: {
          paymentMethods: true,
          invoices: true,
        },
      });
    }

    // 사용량 계산
    const quotesCount = await db.quote.count({
      where: {
        userId,
        createdAt: {
          gte: new Date(new Date().setDate(1)), // 이번 달 1일부터
        },
      },
    });

    const membersCount = membership?.organization
      ? await db.organizationMember.count({
          where: { organizationId: membership.organization.id },
        })
      : 1;

    // 플랜 타입 확인 및 기본값 설정
    const currentPlan = (subscription?.plan && ["FREE", "TEAM", "ORGANIZATION"].includes(subscription.plan)
      ? subscription.plan
      : "FREE") as keyof typeof PLAN_INFO;

    return NextResponse.json({
      subscription: subscription || {
        plan: "FREE",
        status: "active",
        currentSeats: 1,
        maxSeats: 1,
        currentPeriodStart: new Date().toISOString(),
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
      },
      planInfo: PLAN_INFO,
      paymentMethods: subscription?.paymentMethods || [],
      invoices: subscription?.invoices || [],
      usage: {
        quotesUsed: quotesCount,
        quotesLimit: PLAN_INFO[currentPlan].maxQuotesPerMonth,
        seatsUsed: membersCount,
        seatsLimit: PLAN_INFO[currentPlan].maxSeats,
      },
    });
  } catch (error) {
    console.error("[Billing API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch billing information" },
      { status: 500 }
    );
  }
}

// POST: 구독 업그레이드
export async function POST(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { action, plan } = body;

    if (action === "upgrade" && plan) {
      // 유효한 플랜인지 확인
      if (!["FREE", "TEAM", "ORGANIZATION"].includes(plan)) {
        return NextResponse.json(
          { error: "Invalid plan" },
          { status: 400 }
        );
      }

      // Enterprise는 영업팀 문의
      if (plan === "ORGANIZATION") {
        return NextResponse.json({
          success: true,
          action: "contact_sales",
          message: "Enterprise 플랜은 영업팀에 문의해주세요.",
          contactEmail: "sales@bioinsight.co.kr",
        });
      }

      // 사용자의 조직 찾기
      const membership = await db.organizationMember.findFirst({
        where: { userId: session.user.id },
        include: { organization: { include: { subscription: true } } },
      });

      if (!membership?.organization) {
        return NextResponse.json(
          { error: "Organization not found" },
          { status: 404 }
        );
      }

      const planInfo = PLAN_INFO[plan as keyof typeof PLAN_INFO];
      const now = new Date();
      const periodEnd = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      // 구독 업데이트 또는 생성
      const subscription = await db.subscription.upsert({
        where: { organizationId: membership.organization.id },
        update: {
          plan: plan as any,
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          maxSeats: planInfo.maxSeats,
        },
        create: {
          organizationId: membership.organization.id,
          plan: plan as any,
          status: "active",
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          currentSeats: 1,
          maxSeats: planInfo.maxSeats,
        },
      });

      // 인보이스 생성 (유료 플랜인 경우)
      if (planInfo.price && planInfo.price > 0) {
        await db.invoice.create({
          data: {
            subscriptionId: subscription.id,
            number: `INV-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${Date.now().toString().slice(-4)}`,
            status: "PAID",
            amountDue: planInfo.price,
            amountPaid: planInfo.price,
            currency: "KRW",
            periodStart: now,
            periodEnd: periodEnd,
            paidAt: now,
            description: `${planInfo.nameKo} 플랜 구독`,
            lineItems: [
              {
                description: `${planInfo.nameKo} 플랜 (월간)`,
                quantity: 1,
                unitPrice: planInfo.price,
                amount: planInfo.price,
              },
            ],
          },
        });
      }

      // 조직 플랜도 업데이트
      await db.organization.update({
        where: { id: membership.organization.id },
        data: {
          plan: plan as any,
          maxMembers: planInfo.maxSeats,
          maxQuotesPerMonth: planInfo.maxQuotesPerMonth,
        },
      });

      return NextResponse.json({
        success: true,
        subscription,
        message: `${planInfo.nameKo} 플랜으로 업그레이드되었습니다.`,
      });
    }

    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    console.error("[Billing API] Upgrade error:", error);
    return NextResponse.json(
      { error: "Failed to process upgrade" },
      { status: 500 }
    );
  }
}
