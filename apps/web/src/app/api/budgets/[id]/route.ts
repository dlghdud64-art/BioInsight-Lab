import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// ìì° ìì 
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

    const budget = await db.budget.findUnique({
      where: { id },
    });

    if (!budget) {
      return NextResponse.json(
        { error: "Budget not found" },
        { status: 404 }
      );
    }

    // ê¶í íì¸ (ì¡°ì§ ìì°ì¸ ê²½ì° ì¡°ì§ ë©¤ë² íì¸ íì)
    // ê°ë¨í userIdê° ìì¼ë©´ ì¡°ì§ ìì°ì¼ë¡ ê°ì£¼
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

// ìì° ì­ì 