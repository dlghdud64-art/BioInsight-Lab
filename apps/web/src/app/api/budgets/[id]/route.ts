import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 예산 수정
export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;
    const body = await request.json();

    const budget = await db.budget.findUnique({
      where: { id },
    });

    if (!budget) {
      return NextResponse.json(
        { error: "Budget not found" },
        { status: 404 }
      );
    }

    // 권한 확인 (조직 예산인 경우 조직 멤버 확인 필요)
    // 간단히 userId가 없으면 조직 예산으로 간주
    if (budget.organizationId) {
      const isOrgMember = await db.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          organizationId: budget.organizationId,
        },
      });

      if (!isOrgMember) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    const updated = await db.budget.update({
      where: { id },
      data: {
        ...(body.name && { name: body.name }),
        ...(body.amount !== undefined && { amount: parseFloat(body.amount) }),
        ...(body.currency && { currency: body.currency }),
        ...(body.periodStart && { periodStart: new Date(body.periodStart) }),
        ...(body.periodEnd && { periodEnd: new Date(body.periodEnd) }),
        ...(body.projectName !== undefined && { projectName: body.projectName || null }),
        ...(body.description !== undefined && { description: body.description || null }),
      },
    });

    return NextResponse.json({ budget: updated });
  } catch (error: any) {
    console.error("Error updating budget:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update budget" },
      { status: 500 }
    );
  }
}

// 예산 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = params;

    const budget = await db.budget.findUnique({
      where: { id },
    });

    if (!budget) {
      return NextResponse.json(
        { error: "Budget not found" },
        { status: 404 }
      );
    }

    // 권한 확인
    if (budget.organizationId) {
      const isOrgMember = await db.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          organizationId: budget.organizationId,
        },
      });

      if (!isOrgMember) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    await db.budget.delete({
      where: { id },
    });

    return NextResponse.json({ message: "Budget deleted" });
  } catch (error: any) {
    console.error("Error deleting budget:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete budget" },
      { status: 500 }
    );
  }
}

