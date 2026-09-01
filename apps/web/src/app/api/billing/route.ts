/**
 * Billing API - 구독 정보 조회 및 관리
 *
 * GET: 현재 구독 정보, 결제 수단, 청구 내역 조회
 * POST: 구독 업그레이드/다운그레이드
 *
 * 가격 기준: lib/plans.ts (Single Source of Truth)
 */

import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { resolveActiveOrganizationId } from "@/lib/organizations/active-org";
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
// #pricing-descriptor-direct-import — §11.201d hand-copy → direct import.
// PLAN_DESCRIPTOR single source. SubscriptionPlan ↔ PlanIntent 매핑:
// FREE→starter, TEAM→team, ORGANIZATION→business (R&D Operations SKU).
import { PLAN_DESCRIPTOR } from "@/lib/billing/plan-descriptor";

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
  // #pricing-descriptor-direct-import — features array hand-copy → direct
  // import. drift 차단 lock. 향후 PLAN_DESCRIPTOR 변경만으로 전 surface
  // (api/billing + settings/plans + /pricing public + /dashboard/pricing)
  // 자동 정합. nameKo 도 PLAN_DESCRIPTOR.label single source.
  FREE: {
    name: PLAN_DISPLAY[SubscriptionPlan.FREE].displayName,
    nameKo: PLAN_DESCRIPTOR.starter.label,
    price: PLAN_PRICES[SubscriptionPlan.FREE],
    priceDisplay: "무료",
    maxSeats: PLAN_LIMITS[SubscriptionPlan.FREE].maxMembers,
    maxQuotesPerMonth: PLAN_LIMITS[SubscriptionPlan.FREE].maxQuotesPerMonth,
    features: PLAN_DESCRIPTOR.starter.features,
  },
  TEAM: {
    name: PLAN_DISPLAY[SubscriptionPlan.TEAM].displayName,
    nameKo: PLAN_DESCRIPTOR.team.label,
    price: PLAN_PRICES[SubscriptionPlan.TEAM],
    priceDisplay: PLAN_DISPLAY[SubscriptionPlan.TEAM].priceDisplay,
    maxSeats: PLAN_LIMITS[SubscriptionPlan.TEAM].maxMembers,
    maxQuotesPerMonth: PLAN_LIMITS[SubscriptionPlan.TEAM].maxQuotesPerMonth,
    features: PLAN_DESCRIPTOR.team.features,
  },
  ORGANIZATION: {
    name: PLAN_DISPLAY[SubscriptionPlan.ORGANIZATION].displayName,
    nameKo: PLAN_DESCRIPTOR.business.label,
    price: PLAN_PRICES[SubscriptionPlan.ORGANIZATION],
    priceDisplay: PLAN_DISPLAY[SubscriptionPlan.ORGANIZATION].priceDisplay,
    maxSeats: PLAN_LIMITS[SubscriptionPlan.ORGANIZATION].maxMembers,
    maxQuotesPerMonth: PLAN_LIMITS[SubscriptionPlan.ORGANIZATION].maxQuotesPerMonth,
    features: PLAN_DESCRIPTOR.business.features,
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

    /* 사용자의 조직 — §invite-flow Phase 2: 첫 조직이 아니라 **활성 조직**.
     * hint 수용: 같은 화면의 읽기/쓰기 대상이 갈리지 않도록 GET 도 명시 조직을 받는다. */
    const { searchParams } = new URL(request.url);
    const activeOrganizationId = await resolveActiveOrganizationId({
      userId,
      hint: searchParams.get("organizationId"),
    });
    const membership = activeOrganizationId ? await db.organizationMember.findFirst({
      where: { userId, organizationId: activeOrganizationId },
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
    }) : null;

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
      /* 이 응답이 **어느 조직의** 청구인지 화면에 알린다 — 화면은 이 값을 mutation 에
       * 그대로 실어 "보여준 조직에 적용" 을 보장한다(짝 계약). */
      organizationId: membership?.organization?.id ?? null,
      organizationName: membership?.organization?.name ?? null,
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
      // §enforcement-handle-close-sweep (기타) — 'unknown' **교정 보류**.
      //   대상 조직은 body 가 아니라 세션 멤버십으로 결정되고, 그 조회 이전에
      //   검증 분기가 여러 개 있어 핸들을 그 뒤로 옮기면 앞선 400 들이 lock 밖으로
      //   빠진다(원하는 방향이긴 하나 분기 재배열이 필요해 sweep 범위를 넘는다).
      //   → §audit-taxonomy-review 에서 lock 입도와 함께 다룬다.
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/api/billing',
    });
    if (!enforcement.allowed) return enforcement.deny();

    // (죽은 재검사 제거: 같은 POST 핸들러 상단에서 이미 401 처리했다)
    const body = await request.json();
    const { action, plan } = body;

    if (action === "upgrade" && plan) {
      // 유효한 플랜인지 확인
      if (!["FREE", "TEAM", "ORGANIZATION"].includes(plan)) {
        enforcement.fail();
        return NextResponse.json(
          { error: "Invalid plan" },
          { status: 400 }
        );
      }

      // Enterprise (ORGANIZATION) 중 Enterprise급 문의가 필요한 경우
      // 현재 구조에서는 ORGANIZATION = Business, Enterprise는 별도 문의
      // Enterprise 문의는 프론트에서 /support로 리다이렉트

      /* 대상 조직 — §invite-flow Phase 2-2 후속 (리뷰 지적 2026-09-01).
       * 돈이 움직이는 액션은 **암묵적 활성 조직이 아니라 요청이 명시한 조직**을 따른다.
       * 화면은 GET 이 돌려준 organizationId 를 그대로 실어 보낸다 — "보여준 조직에 적용" 이
       * 보장되어야, 읽기와 쓰기 사이에 활성 조직이 바뀌어도(다른 탭 switcher) 엉뚱한 조직의
       * 구독이 바뀌지 않는다. hint 는 resolver 가 멤버십 검증 후 채택하므로 남의 조직 id 를
       * 넣어도 자기 활성 조직으로 떨어질 뿐이다(신규 검증 코드 0). */
      const activeOrgId = await resolveActiveOrganizationId({
        userId: session.user.id,
        hint: typeof body?.organizationId === "string" ? body.organizationId : null,
      });
      const membership = activeOrgId ? await db.organizationMember.findFirst({
        where: { userId: session.user.id, organizationId: activeOrgId },
        include: { organization: { include: { subscription: true } } },
      }) : null;

      if (!membership?.organization) {
        enforcement.fail();
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
          enforcement.fail();
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

      // §pricing-refresh P4b-2 — 유료 업그레이드 시 아카이브 복구(보존 무제한). org 멤버 전체 archivedAt=null.
      //   FREE 보존 만료로 숨겨졌던 데이터를 다시 노출(soft 복구). hard delete 0.
      if (plan !== "FREE") {
        const memberIds = (
          await db.organizationMember.findMany({
            where: { organizationId: membership.organization.id },
            select: { userId: true },
          })
        ).map((m: { userId: string }) => m.userId);
        if (memberIds.length > 0) {
          const restoreWhere = { userId: { in: memberIds }, archivedAt: { not: null } };
          await Promise.all([
            db.quote.updateMany({ where: restoreWhere, data: { archivedAt: null } }),
            db.order.updateMany({ where: restoreWhere, data: { archivedAt: null } }),
            db.productInventory.updateMany({ where: restoreWhere, data: { archivedAt: null } }),
          ]);
        }
      }

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

      enforcement.complete({
        beforeState: {
          organizationId: membership.organization.id,
          plan: membership.organization.plan,
        },
        afterState: {
          organizationId: membership.organization.id,
          plan,
          subscriptionId: subscription.id,
        },
      });

      return NextResponse.json({
        success: true,
        subscription,
        message: `${planInfo.name} 플랜으로 변경되었습니다.`,
      });
    }

    enforcement.fail();
    return NextResponse.json(
      { error: "Invalid action" },
      { status: 400 }
    );
  } catch (error) {
    enforcement?.fail();
    console.error("[Billing API] Upgrade error:", error);
    return NextResponse.json(
      { error: "Failed to process upgrade" },
      { status: 500 }
    );
  }
}
