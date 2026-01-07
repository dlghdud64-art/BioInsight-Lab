import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 예산 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();
    const {
      name,
      amount,
      currency,
      periodStart,
      periodEnd,
      projectName,
      description,
    } = body;

    const budget = await db.budget.findUnique({
      where: { id },
    });

    if (!budget) {
      return NextResponse.json(
        { error: "Budget not found" },
        { status: 404 }
      );
    }

    // 권한 확인: scopeKey가 사용자 ID 기반이거나, 조직 멤버인 경우만 허용
    const userScopeKey = `user-${session.user.id}`;
    if (budget.scopeKey !== userScopeKey) {
      // 조직 예산인 경우 조직 멤버인지 확인
      const isOrgMember = await db.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          organizationId: budget.scopeKey,
        },
      });

      if (!isOrgMember) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // 금액을 정수로 변환
    let amountInt = budget.amount;
    if (amount !== undefined) {
      amountInt = Math.round(Number(amount));
      if (isNaN(amountInt) || amountInt <= 0) {
        return NextResponse.json(
          { error: "Invalid amount. Must be a positive number" },
          { status: 400 }
        );
      }
    }

    // periodStart에서 yearMonth 추출
    let yearMonth = budget.yearMonth;
    if (periodStart) {
      const startDate = new Date(periodStart);
      if (!isNaN(startDate.getTime())) {
        yearMonth = `${startDate.getFullYear()}-${String(startDate.getMonth() + 1).padStart(2, '0')}`;
      }
    }

    // 설명 필드 구성 (name, projectName, description 통합)
    const descriptionParts: string[] = [];
    const finalName = name !== undefined ? name : null;
    const finalProjectName = projectName !== undefined ? projectName : null;
    const finalDescription = description !== undefined ? description : null;

    if (finalName) descriptionParts.push(`[${finalName}]`);
    if (finalProjectName) descriptionParts.push(`프로젝트: ${finalProjectName}`);
    if (finalDescription) descriptionParts.push(finalDescription);
    const combinedDescription = descriptionParts.length > 0 ? descriptionParts.join(' | ') : budget.description;

    if (process.env.NODE_ENV === "development") {
      console.log("[Budget API] Updating budget:", {
        id,
        yearMonth,
        amount: amountInt,
        currency: currency || budget.currency,
      description: combinedDescription,
    });

    const updated = await db.budget.update({
      where: { id },
      data: {
        yearMonth,
        amount: amountInt,
        currency: currency || budget.currency,
        description: combinedDescription,
      },
    });

    // 프론트엔드가 기대하는 형식으로 응답 변환
    const [year, month] = updated.yearMonth.split("-").map(Number);
    const responseBudget = {
      ...updated,
      name: finalName || `${updated.yearMonth} Budget`,
      periodStart: new Date(year, month - 1, 1).toISOString(),
      periodEnd: new Date(year, month, 0, 23, 59, 59).toISOString(),
      projectName: finalProjectName,
    };

    return NextResponse.json({ budget: responseBudget });
  } catch (error: any) {
    console.error("[Budget API] Error updating budget:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update budget", details: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}

// 예산 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const budget = await db.budget.findUnique({
      where: { id },
    });

    if (!budget) {
      return NextResponse.json(
        { error: "Budget not found" },
        { status: 404 }
      );
    }

    // 권한 확인: scopeKey가 사용자 ID 기반이거나, 조직 멤버인 경우만 허용
    const userScopeKey = `user-${session.user.id}`;
    if (budget.scopeKey !== userScopeKey) {
      // 조직 예산인 경우 조직 멤버인지 확인
      const isOrgMember = await db.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          organizationId: budget.scopeKey,
        },
      });

      if (!isOrgMember) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    await db.budget.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("[Budget API] Error deleting budget:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete budget" },
      { status: 500 }
    );
  }
}
