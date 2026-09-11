/**
 * Billing API - 구독 정보 조회 및 관리
 *
 * GET: 현재 구독 정보, 결제 수단, 청구 내역 조회
 * POST: 구독 업그레이드/다운그레이드
 *
 * 가격 기준: lib/plans.ts (Single Source of Truth)
 */

import { UNRESOLVED_ORG, enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
// §plan-change-claim (호영님 2026-09-06, (가)) — 상태·청구를 한 벌로 만드는 단일 정본.
//   🛑 형제 슬롯 전수 훑기(CLAUDE.md): 같은 결함이 이 경로에도 있었다.
import { buildPlanChangeClaim } from "@/lib/billing/plan-change-claim";
// §invite-flow 좌석 정본 — 화면 게이지와 초대 게이트가 같은 수를 쓴다.
import { assertSeatAvailable } from "@/lib/organizations/seats";
/* §billing-redesign P1: 사용량은 **한도를 집행하는 쪽과 같은 계산**을 쓴다.
 *   화면이 "3/3 한도 도달" 이라 말하는데 생성은 통과하는(또는 반대) 어긋남을 구조로 막는다. */
import { countUsageFor, resolveUsageScope } from "@/lib/billing/enforce-plan-limit";
import {
  resolveActiveOrganizationId,
  resolveOrganizationIdForMutation,
} from "@/lib/organizations/active-org";
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

    /* 🛑 데모 모드 제거 (호영님 2026-09-07). 이전 판본은 세션이 없으면
     *   `usage: { quotesUsed: 3, quotesLimit: 10, ... }` 를 **지어내서** 돌려줬다.
     *   같은 응답의 `planInfo.FREE.maxQuotesPerMonth` 는 3이라, 한 화면이 한도를
     *   10 이라고도 3 이라고도 말했다.
     *   호출자는 `/billing`·`/dashboard/settings` 둘뿐이고 둘 다 인증 게이트 안이라
     *   (§auth-page-gate) 이 분기는 제품에서 도달 불가이면서 직접 호출에만 거짓을 냈다. */
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
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
    /* §billing-redesign P1: enforce 와 같은 계산식(countUsageFor).
     *   🛑 이전 판본은 `new Date(new Date().setDate(1))` 로 **시각을 0으로 맞추지 않아**
     *     1일 오전 생성분이 화면 집계에서 빠졌다(enforce 는 setHours(0,0,0,0) 까지 한다).
     *     같은 달 같은 견적을 두 곳이 다르게 셌다. 계산을 한 곳으로 모으며 함께 닫는다. */
    /* §plan-limit-subject (호영님 2026-09-10) — 사용량도 **조직 기준**이다.
     *   이 화면은 바로 아래에서 `membership.organization.id` 의 플랜으로 한도를 그린다.
     *   사용량만 개인으로 세면 같은 카드가 "조직 한도 / 개인 사용량" 을 나란히 보여준다 —
     *   §billing-redesign P1 이 닫은 "두 곳이 다르게 센다" 의 세 번째 형태다.
     *   스코프는 enforce 와 **같은 해석기**에서 받는다(직접 조립하지 않는다). */
    const usageScope = await resolveUsageScope(
      userId,
      membership?.organization?.id ?? null,
    );
    const [quotesCount, itemsCount, labelScanCount] = await Promise.all([
      countUsageFor("quotes", usageScope),
      countUsageFor("inventory", usageScope),
      countUsageFor("labelScan", usageScope),
    ]);

    /* §invite-flow 좌석 정본 (2026-09-07) — **게이트와 같은 수를 쓴다.**
     * 🛑 이전 판본은 `organizationMember.count` 만 셌다. 그런데 초대를 막는 정본
     *   `assertSeatAvailable` 은 **멤버 + pending 초대**를 센다(lib/organizations/seats.ts).
     *   pending 이 하나라도 있으면 이 화면은 "1/3, 여유 있음" 이라고 말하는데
     *   실제 초대는 좌석 초과로 막힌다 — 같은 화면의 자기모순이다.
     *   `87d7941b` 이 조직 상세 페이지에서 닫은 형태가 여기 남아 있었다.
     * 🔑 한도(limit)도 같은 소스에서 받는다. 둘을 따로 계산하면 다시 갈라진다. */
    const seat = membership?.organization
      ? await assertSeatAvailable(membership.organization.id)
      : null;

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
      /* §billing-redesign P1: 화면이 쓰는 4지표. 한도는 PLAN_LIMITS 정본에서 받는다
       *   (PLAN_INFO 는 표시용 사본이라 재고·스캔 한도를 들고 있지 않다). */
      usage: {
        quotesUsed: quotesCount,
        quotesLimit: PLAN_INFO[currentPlan].maxQuotesPerMonth,
        seatsUsed: seat?.used ?? 1,
        seatsLimit: seat ? seat.limit : PLAN_INFO[currentPlan].maxSeats,
        itemsUsed: itemsCount,
        itemsLimit: PLAN_LIMITS[currentPlan as SubscriptionPlan].maxItems,
        labelScansUsed: labelScanCount,
        labelScansLimit: PLAN_LIMITS[currentPlan as SubscriptionPlan].maxLabelScansPerMonth,
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

      /* 대상 조직 — §invite-flow Phase 2-2 후속 (리뷰 지적 2026-09-01·02).
       * 돈이 움직이는 액션은 **암묵적 활성 조직이 아니라 요청이 명시한 조직**을 따른다.
       * 화면은 GET 이 돌려준 organizationId 를 그대로 실어 보내고, 여기서 그 값이 검증에
       * 실패하면 **조용히 활성 조직으로 갈아치우지 않고 403** 이다 — 갈아치우면 "보여준 조직 ≠
       * 적용된 조직" 이 에러 없이 되살아난다(플랜이 엉뚱한 조직에서 바뀐다). */
      const orgResolution = await resolveOrganizationIdForMutation({
        userId: session.user.id,
        hint: typeof body?.organizationId === "string" ? body.organizationId : null,
      });
      if (!orgResolution.ok && orgResolution.reason === "hint_forbidden") {
        enforcement.fail();
        return NextResponse.json(
          { error: "요청한 조직에 대한 권한이 없습니다." },
          { status: 403 }
        );
      }
      const activeOrgId = orgResolution.ok ? orgResolution.organizationId : null;
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

      /* §plan-change-claim (호영님 2026-09-06, (가)) — 이 경로도 결제를 받지 않는다.
       * PG 호출이 없고 `PaymentMethod` 도 0행이다. 그런데 이전 판본은
       * `status: "active"` + `Invoice{status:"PAID", amountPaid: 가격, paidAt: now}` 를 썼다 —
       * **"결제 완료" 를 canonical 에 지어내고 있었다.** 미수보다 무거운 거짓이다.
       * 🛑 `/api/organizations/[id]/subscription` 만 고치고 이 형제 슬롯을 놓쳤다(2026-09-07 적발).
       *   두 경로가 같은 정본을 쓰게 해서 다시 갈라지지 않게 한다. */
      const billingInfo = await db.billingInfo.findUnique({
        where: { organizationId: membership.organization.id },
        select: { businessNumber: true, taxInvoiceEmail: true },
      });
      const claim = buildPlanChangeClaim({
        plan: plan as SubscriptionPlan,
        periodMonths: 1,
        planLabel: planInfo.name,
        billingInfo,
        periodStart: now,
        periodEnd,
      });

      // 구독 업데이트 또는 생성
      const subscription = await db.subscription.upsert({
        where: { organizationId: membership.organization.id },
        update: {
          plan: plan as any,
          status: claim.subscriptionStatus,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          maxSeats: planInfo.maxSeats,
        },
        create: {
          organizationId: membership.organization.id,
          plan: plan as any,
          status: claim.subscriptionStatus,
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

      /* 미수 청구서. 🛑 `PAID` 를 쓰지 않는다 — 수금이 일어난 적이 없다.
       * 발행 배선(`taxInvoiceEmail` 소비처)도 0이라 번호도 붙이지 않는다. */
      if (claim.invoice) {
        await db.invoice.create({
          data: {
            subscriptionId: subscription.id,
            number: claim.invoice.number,
            status: claim.invoice.status,
            amountDue: claim.invoice.amountDue,
            amountPaid: claim.invoice.amountPaid,
            currency: claim.invoice.currency,
            periodStart: claim.invoice.periodStart,
            periodEnd: claim.invoice.periodEnd,
            dueDate: claim.invoice.dueDate,
            paidAt: claim.invoice.paidAt,
            description: claim.invoice.description,
            lineItems: claim.invoice.lineItems,
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

      enforcement.complete({ organizationId: UNRESOLVED_ORG,
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
