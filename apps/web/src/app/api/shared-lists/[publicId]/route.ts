import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 공유 링크 조회 (로그인 불필요)
export async function GET(
  request: NextRequest,
  { params }: { params: { publicId: string } }
) {
  try {
    const { publicId } = params;

    const sharedList = await db.sharedList.findUnique({
      where: { publicId },
    });

    if (!sharedList) {
      return NextResponse.json(
        { error: "Shared list not found" },
        { status: 404 }
      );
    }

    // 비활성화 확인
    if (!sharedList.isActive) {
      return NextResponse.json(
        { error: "This shared list is no longer available" },
        { status: 410 }
      );
    }

    // 만료 확인 및 자동 비활성화
    if (sharedList.expiresAt && new Date(sharedList.expiresAt) < new Date()) {
      // 만료된 링크는 자동으로 비활성화
      if (sharedList.isActive) {
        await db.sharedList.update({
          where: { id: sharedList.id },
          data: { isActive: false },
        });
      }
      return NextResponse.json(
        { error: "This shared list has expired" },
        { status: 410 }
      );
    }

    // 조회 수 증가
    await db.sharedList.update({
      where: { id: sharedList.id },
      data: { viewCount: { increment: 1 } },
    });

    return NextResponse.json({
      id: sharedList.id,
      publicId: sharedList.publicId,
      title: sharedList.title,
      description: sharedList.description,
      snapshot: sharedList.snapshot,
      createdAt: sharedList.createdAt,
      expiresAt: sharedList.expiresAt,
      viewCount: sharedList.viewCount + 1,
    });
  } catch (error) {
    console.error("Error fetching shared list:", error);
    return NextResponse.json(
      { error: "Failed to fetch shared list" },
      { status: 500 }
    );
  }
}

// 공유 링크 업데이트 (비활성화, 만료일 변경 등)
export async function PATCH(
  request: NextRequest,
  { params }: { params: { publicId: string } }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { publicId } = params;
    const body = await request.json();
    const { isActive, expiresAt } = body;

    const sharedList = await db.sharedList.findUnique({
      where: { publicId },
      include: {
        quote: {
          select: {
            userId: true,
            organizationId: true,
          },
        },
      },
    });

    if (!sharedList) {
      return NextResponse.json(
        { error: "Shared list not found" },
        { status: 404 }
      );
    }

    // 권한 확인 (본인 또는 조직 멤버)
    if (sharedList.quote.userId !== session.user.id) {
      const isOrgMember = await db.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          organizationId: sharedList.quote.organizationId || undefined,
        },
      });

      if (!isOrgMember) {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403 }
        );
      }
    }

    // 업데이트
    const updated = await db.sharedList.update({
      where: { id: sharedList.id },
      data: {
        ...(isActive !== undefined && { isActive }),
        ...(expiresAt !== undefined && { expiresAt: expiresAt ? new Date(expiresAt) : null }),
      },
    });

    return NextResponse.json({ sharedList: updated });
  } catch (error: any) {
    console.error("Error updating shared list:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update shared list" },
      { status: 500 }
    );
  }
}
