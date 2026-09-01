/**
 * Payment Methods API - 결제 수단 관리
 *
 * GET: 결제 수단 목록 조회
 * POST: 결제 수단 추가
 * DELETE: 결제 수단 삭제
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { resolveActiveOrganizationId } from "@/lib/organizations/active-org";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";

// GET: 결제 수단 목록
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ paymentMethods: [] });
    }

    // §invite-flow Phase 2 — 활성 조직의 결제 수단 (hint 우선: 화면이 보는 조직).
    const activeOrganizationId = await resolveActiveOrganizationId({
      userId: session.user.id,
      hint: new URL(request.url).searchParams.get("organizationId"),
    });
    const membership = activeOrganizationId ? await db.organizationMember.findFirst({
      where: { userId: session.user.id, organizationId: activeOrganizationId },
      include: {
        organization: {
          include: {
            subscription: {
              include: { paymentMethods: true },
            },
          },
        },
      },
    }) : null;

    return NextResponse.json({
      paymentMethods: membership?.organization?.subscription?.paymentMethods || [],
    });
  } catch (error) {
    console.error("[PaymentMethods API] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch payment methods" },
      { status: 500 }
    );
  }
}

// POST: 결제 수단 추가 (실제 PG 연동 전 Mock)
export async function POST(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { cardNumber, expMonth, expYear, cvc, isDefault } = body;

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'billing_payment_method',
      targetEntityType: 'billing',
      targetEntityId: body.id || 'unknown',
      sourceSurface: 'billing-payment-methods-api',
      routePath: '/api/billing/payment-methods',
    });
    if (!enforcement.allowed) return enforcement.deny();

    // 기본 유효성 검사
    if (!cardNumber || !expMonth || !expYear) {
      return NextResponse.json(
        { error: "카드 정보가 불완전합니다." },
        { status: 400 }
      );
    }

    // 카드 브랜드 추정
    const getBrand = (num: string) => {
      const firstDigit = num[0];
      const firstTwo = num.slice(0, 2);
      if (firstDigit === "4") return "visa";
      if (["51", "52", "53", "54", "55"].includes(firstTwo)) return "mastercard";
      if (["34", "37"].includes(firstTwo)) return "amex";
      return "unknown";
    };

    /* §invite-flow Phase 2 후속 — 카드를 붙일 조직은 **화면이 보여준 조직**이다.
     * hint 없으면 활성 조직으로 떨어진다(기존 동작). resolver 가 멤버십을 검증한다. */
    const activeOrgId = await resolveActiveOrganizationId({
      userId: session.user.id,
      hint: typeof body?.organizationId === "string" ? body.organizationId : null,
    });
    const membership = activeOrgId ? await db.organizationMember.findFirst({
      where: { userId: session.user.id, organizationId: activeOrgId },
      include: {
        organization: {
          include: { subscription: true },
        },
      },
    }) : null;

    if (!membership?.organization?.subscription) {
      return NextResponse.json(
        { error: "구독 정보가 없습니다." },
        { status: 404 }
      );
    }

    // 기존 기본 카드 해제 (새 카드가 기본인 경우)
    if (isDefault) {
      await db.paymentMethod.updateMany({
        where: { subscriptionId: membership.organization.subscription.id },
        data: { isDefault: false },
      });
    }

    // 결제 수단 생성
    const paymentMethod = await db.paymentMethod.create({
      data: {
        subscriptionId: membership.organization.subscription.id,
        brand: getBrand(cardNumber.replace(/\s/g, "")),
        last4: cardNumber.replace(/\s/g, "").slice(-4),
        expMonth: parseInt(expMonth),
        expYear: parseInt(expYear),
        isDefault: isDefault || false,
        isValid: true,
        // 실제 연동 시 Stripe PaymentMethod ID 저장
        stripePaymentMethodId: `pm_mock_${Date.now()}`,
      },
    });

    enforcement.complete({});

    return NextResponse.json({
      success: true,
      paymentMethod,
      message: "결제 수단이 등록되었습니다.",
    });
  } catch (error) {
    enforcement?.fail();
    console.error("[PaymentMethods API] Create error:", error);
    return NextResponse.json(
      { error: "결제 수단 등록에 실패했습니다." },
      { status: 500 }
    );
  }
}

// DELETE: 결제 수단 삭제
export async function DELETE(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const paymentMethodId = searchParams.get("id");

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'billing_payment_method',
      targetEntityType: 'billing',
      targetEntityId: paymentMethodId || 'unknown',
      sourceSurface: 'billing-payment-methods-api',
      routePath: '/api/billing/payment-methods',
    });
    if (!enforcement.allowed) return enforcement.deny();

    if (!paymentMethodId) {
      return NextResponse.json(
        { error: "결제 수단 ID가 필요합니다." },
        { status: 400 }
      );
    }

    /* 삭제 권한 확인 — §invite-flow Phase 2: **화면이 보여준 조직**의 구독에 속한 수단만 지운다.
     * (아래 paymentMethod.findFirst 가 subscriptionId 로 소속을 한 번 더 확인하므로,
     *  조직이 어긋나도 남의 수단은 지워지지 않고 404 로 떨어진다 — 두 층이 각자 막는다.) */
    const activeOrgId = await resolveActiveOrganizationId({
      userId: session.user.id,
      hint: searchParams.get("organizationId"),
    });
    const membership = activeOrgId ? await db.organizationMember.findFirst({
      where: { userId: session.user.id, organizationId: activeOrgId },
      include: {
        organization: {
          include: {
            subscription: {
              include: { paymentMethods: true },
            },
          },
        },
      },
    }) : null;

    const subscriptionId = membership?.organization?.subscription?.id;
    if (!subscriptionId) {
      return NextResponse.json(
        { error: "구독 정보가 없습니다." },
        { status: 404 }
      );
    }

    // 해당 구독의 결제 수단인지 확인
    const paymentMethod = await db.paymentMethod.findFirst({
      where: {
        id: paymentMethodId,
        subscriptionId,
      },
    });

    if (!paymentMethod) {
      return NextResponse.json(
        { error: "결제 수단을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 삭제
    await db.paymentMethod.delete({
      where: { id: paymentMethodId },
    });

    enforcement.complete({});

    return NextResponse.json({
      success: true,
      message: "결제 수단이 삭제되었습니다.",
    });
  } catch (error) {
    enforcement?.fail();
    console.error("[PaymentMethods API] Delete error:", error);
    return NextResponse.json(
      { error: "결제 수단 삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}
