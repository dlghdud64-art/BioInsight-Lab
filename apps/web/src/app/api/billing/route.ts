/**
 * Billing API - 구독 정보 조회 및 관리
 *
 * GET: 현재 구독 정보, 결제 수단, 청구 내역 조회
 * POST: 구독 업그레이드/다운그레이드
 *
 * 가격 기준: lib/plans.ts (Single Source of Truth)
 */

import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  SubscriptionPlan,
  PLAN_DISPLAY,
  PLAN_LIMITS,
  PLAN_PRICES,
  PLAN_ORDER,
  ENTERPRISE_INFO,
} from "@/lib/plans";

// planInfo 응답 형태 (기존 API 호환 유지 + 통일된 가격)
const PLAN_INFO: Record<
  string,
  {
    name: string;
    nameKo: string;
    price: number | null;
    priceDisplay: string;
    maxSeats: number | null;
    maxQuotesPerMonth: number | null;
    features: string[];
  }
> = {
  FREE: {
    name: PLAN_DISPLAY[SubscriptionPlan.FREE].displayName,
    nameKo: "Starter",
    price: PLAN_PRICES[SubscriptionPlan.FREE],
    priceDisplay: "무료",
    maxSeats: PLAN_LIMITS[SubscriptionPlan.FREE].maxMembers,
    maxQuotesPerMonth: PLAN_LIMITS[SubscriptionPlan.FREE].maxQuotesPerMonth,
    features: [
      "개인 전용 (팀원 초대 불가)",
      "기본 검색 및 비교",
      "품목 등록 (최대 10개)",
      "기본 견적 요청",
    ],
  },
  TEAM: {
    name: PLAN_DISPLAY[SubscriptionPlan.TEAM].displayName,
    nameKo: "Team",
    price: PLAN_PRICES[SubscriptionPlan.TEAM],
    priceDisplay: PLAN_DISPLAY[SubscriptionPlan.TEAM].priceDisplay,
    maxSeats: PLAN_LIMITS[SubscriptionPlan.TEAM].maxMembers,
    maxQuotesPerMonth: PLAN_LIMITS[SubscriptionPlan.TEAM].maxQuotesPerMonth,
    features: [
      "팀원 5명까지",
      "팀원 공유 재고",
      "후보 품목 공유",
      "구매 요청 워크플로우",
      "품목 등록 (최대 50개)",
      "엑셀 업로드 · CSV 내보내기",
      "대체품 추천",
    ],
  },
  ORGANIZATION: {
    name: PLAN_DISPLAY[SubscriptionPlan.ORGANIZATION].displayName,
    nameKo: "Business",
    price: PLAN_PRICES[SubscriptionPlan.ORGANIZATION],
    priceDisplay: PLAN_DISPLAY[SubscriptionPlan.ORGANIZATION].priceDisplay,
    maxSeats: PLAN_LIMITS[SubscriptionPlan.ORGANIZATION].maxMembers,
    maxQuotesPerMonth: PLAN_LIMITS[SubscriptionPlan.ORGANIZATION].maxQuotesPerMonth,
    features: [
      "팀원 무제한",
      "전자결재 승인 라인",
      "예산 통합 관리",
      "Audit Trail",
      "MSDS 자동 연동",
      "Lot 관리 · 재고 소진 알림",
      "관리자 운영 대시보드",
      "품목 등록 무제한",
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

// POST: 구독 업그레이드/다운그레이드
export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'organization_update',
      targetEntityType: 'ai_action',
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/billing',
    });
    if (!enforcement.allowed) return enforcement.deny();

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

      // Enterprise (ORGANIZATION) 중 Enterprise급 문의가 필요한 경우
      // 현재 구조에서는 ORGANIZATION = Business, Enterprise는 별도 문의
      // Enterprise 문의는 프론트에서 /support로 리다이렉트

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

      // 다운그레이드 시 현재 멤버 수 체크
      const planInfo = PLAN_INFO[plan as keyof typeof PLAN_INFO];
      if (planInfo.maxSeats !== null) {
        const currentMembers = await db.organizationMember.count({
          where: { organizationId: membership.organization.id },
        });
        if (currentMembers > planInfo.maxSeats) {
          return NextResponse.json(
            {
              error: `현재 멤버 수(${currentMembers}명)가 ${planInfo.name} 플랜의 최대 인원(${planInfo.maxSeats}명)을 초과합니다. 먼저 멤버를 정리해주세요.`,
              code: "SEATS_EXCEEDED",
            },
            { status: 400 }
          );
        }
      }

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
            description: `${planInfo.name} 플랜 구독`,
            lineItems: [
              {
                description: `${planInfo.name} 플랜 (월간)`,
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
        message: `${planInfo.name} 플랜으로 변경되었습니다.`,
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
