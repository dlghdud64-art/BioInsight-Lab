import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { SubscriptionPlan, PLAN_LIMITS, PLAN_DISPLAY } from "@/lib/plans";
// §plan-change-claim (호영님 2026-09-06, (가)) — 유료 적용 시 상태·청구를 함께 만든다.
import { buildPlanChangeClaim } from "@/lib/billing/plan-change-claim";

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
  let enforcement: InlineEnforcementHandle | undefined;
  let id: string | undefined;
  let body: any = {};
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    ({ id } = await params);
    body = await request.json();
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'organization_update',
      targetEntityType: 'organization',
      // §enforcement-handle-close-sweep (기타) — params id 확정 이후로 핸들 이동.
      //   대상 Organization 이 실재하므로 per-entity lock 이 된다.
      targetEntityId: id,
      sourceSurface: 'web_app',
      routePath: '/api/organizations/id/subscription',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const { plan, periodMonths = 1 } = body;

    if (!plan || !Object.values(SubscriptionPlan).includes(plan)) {
      enforcement.fail();
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
      enforcement.fail();
      return NextResponse.json(
        { error: "Organization not found" },
        { status: 404 }
      );
    }

    // 관리자 권한 확인 (ADMIN 또는 OWNER)
    const membership = await db.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId: id,
        role: { in: ["ADMIN", "OWNER"] },
      },
    });

    if (!membership) {
      enforcement.fail();
      return NextResponse.json(
        { error: "Forbidden: 관리자만 플랜을 변경할 수 있습니다." },
        { status: 403 }
      );
    }

    // 구독 업데이트 또는 생성
    const planExpiresAt = plan !== SubscriptionPlan.FREE
      ? new Date(Date.now() + periodMonths * 30 * 24 * 60 * 60 * 1000)
      : null;

    // 플랜별 제한 가져오기
    const limits = PLAN_LIMITS[plan as SubscriptionPlan];

    /* §plan-change-claim (호영님 2026-09-06, (가)) — 상태를 정직하게 쓰기 위한 재료.
     * 🛑 시각은 **하나만** 잡는다. 이전 판본은 `planExpiresAt` 과 `currentPeriodStart` 를
     *   각각 `new Date()` 로 떠서 두 값의 밀리초가 어긋났다(실측: periodEnd 가 periodStart
     *   보다 0.759초 앞섰다). 같은 사건의 시각이 갈리면 나중에 "어느 경로가 썼는가" 를
     *   가르는 근거가 흐려진다 — 실제로 이번 조사에서 그 어긋남이 단서가 됐다. */
    const now = new Date();
    const periodEnd = planExpiresAt ?? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    /* 세금계산서 발행처. 이 경로는 B2B 계산서 신청 경로라 청구서가 이걸 참조한다.
     * 없으면 발행할 수 없고, 그 사실을 청구서에 남긴다(발행 가능한 척하지 않는다). */
    const billingInfo = await db.billingInfo.findUnique({
      where: { organizationId: id },
      select: { businessNumber: true, taxInvoiceEmail: true },
    });

    const claim = buildPlanChangeClaim({
      plan: plan as SubscriptionPlan,
      periodMonths,
      planLabel: PLAN_DISPLAY[plan as SubscriptionPlan].displayName,
      billingInfo,
      periodStart: now,
      periodEnd,
    });

    // Organization 업데이트 (플랜 + 제한값 동기화)
    const updatedOrg = await db.organization.update({
      where: { id },
      data: {
        plan: plan as SubscriptionPlan,
        planExpiresAt,
        maxMembers: limits?.maxMembers ?? null,
        maxQuotesPerMonth: limits?.maxQuotesPerMonth ?? null,
        maxSharedLinks: limits?.maxSharedLinks ?? null,
      },
    });

    /* Subscription 업데이트 또는 생성.
     * 🛑 `status` 를 `"active"` 로 고정하지 않는다 — 유료 플랜은 청구가 발생했는데
     *   수금된 적이 없으므로 `"unpaid"` 가 사실이다. FREE 는 `"active"` 가 맞다
     *   (신규 조직이 그 조합으로 생성되는 이 시스템의 기본 상태다). */
    let subscription;
    if (organization.subscription) {
      subscription = await db.subscription.update({
        where: { id: organization.subscription.id },
        data: {
          plan: plan as SubscriptionPlan,
          status: claim.subscriptionStatus,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        },
      });
    } else {
      subscription = await db.subscription.create({
        data: {
          organizationId: id,
          plan: plan as SubscriptionPlan,
          status: claim.subscriptionStatus,
          currentPeriodStart: now,
          currentPeriodEnd: periodEnd,
          cancelAtPeriodEnd: false,
        },
      });
    }

    /* 미수 청구서 1행. `status: "unpaid"` 는 "미수다" 라고만 말하고 **미수액을 말하지 못한다** —
     * 값과 근거는 같이 간다(호영님). 금액은 화면이 이미 보여준 식과 동일하게 계산한다. */
    let claimInvoiceId: string | null = null;
    if (claim.invoice) {
      const created = await db.invoice.create({
        data: {
          subscriptionId: subscription.id,
          number: claim.invoice.number,
          /* 🛑 `as InvoiceStatus` 캐스트를 쓰지 않는다 — 존재하지 않는 값을 컴파일러가
           *   통과시키는 형태다(§categorySource 사고: prod enum 에 없는 "OTHER" 를
           *   `as ProductCategory` 가 가려 신규 등록이 100% 실패했다).
           *   리터럴 그대로 두면 값이 enum 을 벗어나는 순간 빌드가 잡는다. */
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
        select: { id: true },
      });
      claimInvoiceId = created.id;
    }

    /* §plan-change-claim 2축 — **내구 감사 기록.**
     * 🛑 `enforcement.complete(...)` 로는 이 자리를 못 채운다. 그 경로는
     *   `appendAuditEnvelope` → 모듈 최상위 `let auditStore` 라 **인스턴스 메모리**이고,
     *   서버리스에서는 요청이 끝나면 사라진다(소스 주석도 "실제 production 에서는 외부
     *   storage 로 archive" 라고 스스로 적어 두었다). 실측: prod `MutationAuditEvent` 0행.
     *   그래서 여기서 DB 에 직접 쓴다. 전역 구조 문제는 별도 스윕 대상이다.
     * 🛑 감사 실패가 본 작업을 되돌리지는 않되(플랜은 이미 적용됐다) **삼키지도 않는다** —
     *   기록이 실패했다는 사실이 로그에 남아야 다음 조사가 이 자리를 의심할 수 있다. */
    try {
      await db.mutationAuditEvent.create({
        data: {
          auditEventKey: `${id}:/api/organizations/id/subscription:${subscription.id}:plan_change:${now.getTime()}`,
          occurredAt: now,
          orgId: id,
          actorId: session.user.id,
          route: "/api/organizations/id/subscription",
          action: "plan_change",
          entityType: "subscription",
          entityId: subscription.id,
          result: "success",
          correlationId: enforcement.correlationId,
          amount: claim.invoice?.amountDue ?? 0,
          decisionBasis: {
            planBefore: organization.plan,
            planAfter: updatedOrg.plan,
            statusBefore: organization.subscription?.status ?? null,
            statusAfter: subscription.status,
            periodMonths,
            invoiceId: claimInvoiceId,
            invoiceStatus: claim.invoice?.status ?? null,
            issuable: claim.invoice?.issuance.issuable ?? null,
            issuanceMissing: claim.invoice?.issuance.missing ?? [],
            /* 이 경로는 PG 를 부르지 않는다 — 계산서 신청 경로다(§checkout-two-paths). */
            paymentProvider: null,
          },
        },
      });
    } catch (auditError) {
      console.error("[Subscription API] 감사 기록 실패:", {
        organizationId: id,
        subscriptionId: subscription.id,
        reason: auditError instanceof Error ? auditError.message : String(auditError),
      });
    }

    enforcement.complete({
      beforeState: {
        organizationId: id,
        plan: organization.plan,
        status: organization.subscription?.status ?? null,
        subscriptionId: organization.subscription?.id ?? null,
      },
      afterState: {
        organizationId: id,
        plan: updatedOrg.plan,
        status: subscription.status,
        subscriptionId: subscription.id,
        invoiceId: claimInvoiceId,
      },
    });

    return NextResponse.json({
      organization: updatedOrg,
      subscription,
    });
  } catch (error: any) {
    enforcement?.fail();
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