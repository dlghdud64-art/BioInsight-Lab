/**
 * Payment Methods API - 결제 수단 관리
 *
 * GET: 결제 수단 목록 조회
 * POST: 결제 수단 추가
 * DELETE: 결제 수단 삭제
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

// GET: 결제 수단 목록
export async function GET(request: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user?.id) {
      return NextResponse.json({ paymentMethods: [] });
    }

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      include: {
        organization: {
          include: {
            subscription: {
              include: { paymentMethods: true },
            },
          },
        },
      },
    });

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

    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      include: {
        organization: {
          include: { subscription: true },
        },
      },
    });

    if (!membership?.organization?.subscription) {
      return NextResponse.json(
        { error: "구독 정보가 없습니다." },
        { status: 404 }
      );
    }

    // 기존 기본 카드 해제 (새 카드가 기본인 경우)
    if (isDefault) {
      await prisma.paymentMethod.updateMany({
        where: { subscriptionId: membership.organization.subscription.id },
        data: { isDefault: false },
      });
    }

    // 결제 수단 생성
    const paymentMethod = await prisma.paymentMethod.create({
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

    return NextResponse.json({
      success: true,
      paymentMethod,
      message: "결제 수단이 등록되었습니다.",
    });
  } catch (error) {
    console.error("[PaymentMethods API] Create error:", error);
    return NextResponse.json(
      { error: "결제 수단 등록에 실패했습니다." },
      { status: 500 }
    );
  }
}

// DELETE: 결제 수단 삭제
export async function DELETE(request: NextRequest) {
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

    if (!paymentMethodId) {
      return NextResponse.json(
        { error: "결제 수단 ID가 필요합니다." },
        { status: 400 }
      );
    }

    // 삭제 권한 확인
    const membership = await prisma.organizationMember.findFirst({
      where: { userId: session.user.id },
      include: {
        organization: {
          include: {
            subscription: {
              include: { paymentMethods: true },
            },
          },
        },
      },
    });

    const subscriptionId = membership?.organization?.subscription?.id;
    if (!subscriptionId) {
      return NextResponse.json(
        { error: "구독 정보가 없습니다." },
        { status: 404 }
      );
    }

    // 해당 구독의 결제 수단인지 확인
    const paymentMethod = await prisma.paymentMethod.findFirst({
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
    await prisma.paymentMethod.delete({
      where: { id: paymentMethodId },
    });

    return NextResponse.json({
      success: true,
      message: "결제 수단이 삭제되었습니다.",
    });
  } catch (error) {
    console.error("[PaymentMethods API] Delete error:", error);
    return NextResponse.json(
      { error: "결제 수단 삭제에 실패했습니다." },
      { status: 500 }
    );
  }
}
