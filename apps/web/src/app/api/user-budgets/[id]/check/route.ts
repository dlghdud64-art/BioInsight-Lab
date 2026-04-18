import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * GET /api/user-budgets/[id]/check?amount=xxx
 *
 * 예산 잔액 대비 금액 사전 검증 엔드포인트
 * - 견적 구매 확정 전 UI에서 호출하여 예산 초과 여부를 미리 표시
 *
 * Response:
 *   200 { canAfford: true,  remainingAmount, requestedAmount, afterAmount }
 *   200 { canAfford: false, remainingAmount, requestedAmount, shortfall, afterAmount }
 *   400 amount 파라미터 누락 / 잘못된 값
 *   403 해당 예산에 접근 권한 없음
 *   404 예산 없음
 */
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
    const { searchParams } = new URL(request.url);
    const rawAmount = searchParams.get("amount");

    if (!rawAmount) {
      return NextResponse.json(
        { error: "amount 쿼리 파라미터가 필요합니다." },
        { status: 400 }
      );
    }

    const requestedAmount = Number(rawAmount);
    if (isNaN(requestedAmount) || requestedAmount <= 0) {
      return NextResponse.json(
        { error: "amount는 0보다 큰 숫자여야 합니다." },
        { status: 400 }
      );
    }

    // 예산 조회
    const budget = await db.userBudget.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        userId: true,
        organizationId: true,
        remainingAmount: true,
        totalAmount: true,
        usedAmount: true,
        currency: true,
        isActive: true,
        endDate: true,
      },
    });

    if (!budget) {
      return NextResponse.json(
        { error: "예산을 찾을 수 없습니다." },
        { status: 404 }
      );
    }

    // 권한 확인: 본인 또는 소속 조직 멤버
    const isOwner = budget.userId === session.user.id;
    let isOrgMember = false;
    if (!isOwner && budget.organizationId) {
      const membership = await db.organizationMember.findFirst({
        where: { userId: session.user.id, organizationId: budget.organizationId },
      });
      isOrgMember = !!membership;
    }
    if (!isOwner && !isOrgMember) {
      return NextResponse.json(
        { error: "해당 예산에 접근 권한이 없습니다." },
        { status: 403 }
      );
    }

    // 만료 여부
    const isExpired = budget.endDate ? new Date(budget.endDate) < new Date() : false;

    const afterAmount = budget.remainingAmount - requestedAmount;
    const canAfford = !isExpired && budget.isActive && afterAmount >= 0;

    return NextResponse.json({
      canAfford,
      budgetId: budget.id,
      budgetName: budget.name,
      currency: budget.currency,
      totalAmount: budget.totalAmount,
      usedAmount: budget.usedAmount,
      remainingAmount: budget.remainingAmount,
      requestedAmount,
      afterAmount,
      shortfall: canAfford ? 0 : Math.abs(afterAmount),
      warnings: [
        ...(!budget.isActive ? ["비활성 예산입니다."] : []),
        ...(isExpired ? ["예산 유효기간이 만료되었습니다."] : []),
        ...(!canAfford && budget.isActive && !isExpired
          ? [`잔액이 ${Math.abs(afterAmount).toLocaleString()} ${budget.currency} 부족합니다.`]
          : []),
      ],
    });
  } catch (error) {
    console.error("[UserBudget/check]", error);
    return NextResponse.json(
      { error: "예산 검증에 실패했습니다." },
      { status: 500 }
    );
  }
}
