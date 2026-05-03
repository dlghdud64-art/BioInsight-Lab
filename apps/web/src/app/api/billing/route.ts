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
  // §11.201d — features array 정량 swap (PLAN_DESCRIPTOR 매트릭스 정합).
  //   이전 hardcoded fake unlimited 약속 → 운영자 N명 / RFQ N건 / 재고 N 품목
  //   정량. nameKo Team/Business → 한국어 Lab Team / R&D Operations
  //   (PLAN_DESCRIPTOR.label 정합). canonical SubscriptionPlan enum 변경 0 —
  //   display layer 만. Future drift 차단을 위해 추후 PLAN_DESCRIPTOR.features
  //   직접 import 가능 (별도 트랙).
  FREE: {
    name: PLAN_DISPLAY[SubscriptionPlan.FREE].displayName,
    nameKo: "Starter",
    price: PLAN_PRICES[SubscriptionPlan.FREE],
    priceDisplay: "무료",
    maxSeats: PLAN_LIMITS[SubscriptionPlan.FREE].maxMembers,
    maxQuotesPerMonth: PLAN_LIMITS[SubscriptionPlan.FREE].maxQuotesPerMonth,
    features: [
      "통합 검색 / 카탈로그",
      "견적 요청 (월 5건)",
      "PO 발행 (월 5건)",
      "재고 등록 (50 품목)",
      "AI 견적 비교 (Credit 차감)",
    ],
  },
  TEAM: {
    name: PLAN_DISPLAY[SubscriptionPlan.TEAM].displayName,
    nameKo: "Lab Team",
    price: PLAN_PRICES[SubscriptionPlan.TEAM],
    priceDisplay: PLAN_DISPLAY[SubscriptionPlan.TEAM].priceDisplay,
    maxSeats: PLAN_LIMITS[SubscriptionPlan.TEAM].maxMembers,
    maxQuotesPerMonth: PLAN_LIMITS[SubscriptionPlan.TEAM].maxQuotesPerMonth,
    features: [
      "Starter 전체 +",
      "운영자 5명 권장",
      "견적 요청 (월 30건)",
      "PO 발행 (월 30건)",
      "재고 운영 (500 품목)",
      "운영 브리핑 (AI 인사이트)",
      "활동 로그 / 권한 관리",
    ],
  },
  ORGANIZATION: {
    name: PLAN_DISPLAY[SubscriptionPlan.ORGANIZATION].displayName,
    nameKo: "R&D Operations",
    price: PLAN_PRICES[SubscriptionPlan.ORGANIZATION],
    priceDisplay: PLAN_DISPLAY[SubscriptionPlan.ORGANIZATION].priceDisplay,
    maxSeats: PLAN_LIMITS[SubscriptionPlan.ORGANIZATION].maxMembers,
    maxQuotesPerMonth: PLAN_LIMITS[SubscriptionPlan.ORGANIZATION].maxQuotesPerMonth,
    features: [
      "Lab Team 전체 +",
      "운영자 15명 권장",
      "견적 요청 (월 80건)",
      "PO 발행 (월 80건)",
      "재고 운영 (2,000 품목)",
      "다중 부서 / 비용센터 분리",
      "감사 로그 PDF 내보내기",
      "워크플로 템플릿 / 승인자 매트릭스",
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
