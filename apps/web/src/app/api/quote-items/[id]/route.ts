import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db, isPrismaAvailable } from "@/lib/db";
import { isDemoMode } from "@/lib/env";

// 견적 요청 아이템 수정
export async function PUT(
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
    const { quantity, unitPrice, currency, notes } = body;

    // 데모 모드이거나 DB가 없는 경우
    if (isDemoMode() || !isPrismaAvailable || id.startsWith("demo-")) {
      return NextResponse.json({
        id,
        quantity: quantity || 1,
        unitPrice: unitPrice || 0,
        currency: currency || "KRW",
        lineTotal: (unitPrice || 0) * (quantity || 1),
        notes: notes || null,
        updatedAt: new Date().toISOString(),
        demo: true,
      });
    }

    // 권한 확인
    const existingItem = await db.quoteListItem.findUnique({
      where: { id },
      include: {
        quote: true,
      },
    });

    if (!existingItem) {
      return NextResponse.json({ error: "Quote item not found" }, { status: 404 });
    }

    // 팀 기반 권한 체크: 본인 또는 같은 조직 멤버면 수정 가능
    const isOwner = existingItem.quote.userId === session.user.id;
    let isTeamMember = false;

    if (!isOwner && existingItem.quote.organizationId) {
      const membership = await db.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          organizationId: existingItem.quote.organizationId,
        },
      });
      isTeamMember = !!membership;
    }

    if (!isOwner && !isTeamMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 업데이트
    const updatedItem = await db.quoteListItem.update({
      where: { id },
      data: {
        ...(quantity !== undefined && { quantity }),
        ...(unitPrice !== undefined && { unitPrice }),
        ...(currency && { currency }),
        ...(notes !== undefined && { notes }),
        ...(quantity !== undefined || unitPrice !== undefined
          ? {
              lineTotal:
                (quantity !== undefined ? quantity : existingItem.quantity) *
                (unitPrice !== undefined ? unitPrice : existingItem.unitPrice || 0),
            }
          : {}),
      },
      include: {
        product: {
          include: {
            vendors: {
              include: {
                vendor: true,
              },
            },
          },
        },
      },
    });

    return NextResponse.json(updatedItem);
  } catch (error) {
    console.error("Error updating quote item:", error);
    return NextResponse.json(
      { error: "Failed to update quote item" },
      { status: 500 }
    );
  }
}

// 견적 요청 아이템 삭제
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

    // 데모 모드이거나 DB가 없는 경우
    if (isDemoMode() || !isPrismaAvailable || id.startsWith("demo-")) {
      return NextResponse.json({ success: true, demo: true });
    }

    // 권한 확인
    const existingItem = await db.quoteListItem.findUnique({
      where: { id },
      include: {
        quote: true,
      },
    });

    if (!existingItem) {
      return NextResponse.json({ error: "Quote item not found" }, { status: 404 });
    }

    // 팀 기반 권한 체크: 본인 또는 같은 조직 멤버면 삭제 가능
    const isOwner = existingItem.quote.userId === session.user.id;
    let isTeamMember = false;

    if (!isOwner && existingItem.quote.organizationId) {
      const membership = await db.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          organizationId: existingItem.quote.organizationId,
        },
      });
      isTeamMember = !!membership;
    }

    if (!isOwner && !isTeamMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // 삭제
    await db.quoteListItem.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting quote item:", error);
    return NextResponse.json(
      { error: "Failed to delete quote item" },
      { status: 500 }
    );
  }
}




















