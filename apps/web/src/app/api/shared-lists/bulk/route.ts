import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 공유 링크 일괄 삭제
export async function DELETE(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { publicIds } = body;

    if (!publicIds || !Array.isArray(publicIds) || publicIds.length === 0) {
      return NextResponse.json(
        { error: "publicIds array is required" },
        { status: 400 }
      );
    }

    // 공유 링크 조회 및 권한 확인
    const sharedLists = await db.sharedList.findMany({
      where: {
        publicId: {
          in: publicIds,
        },
      },
      include: {
        quote: {
          select: {
            userId: true,
            organizationId: true,
          },
        },
      },
    });

    // 권한 확인: 본인이 생성한 링크만 삭제 가능
    const authorizedListIds: string[] = [];
    for (const sharedList of sharedLists) {
      if (sharedList.createdBy === session.user.id) {
        authorizedListIds.push(sharedList.id);
      } else if (sharedList.quote.organizationId) {
        // 조직 멤버인 경우도 확인
        const member = await db.organizationMember.findFirst({
          where: {
            userId: session.user.id,
            organizationId: sharedList.quote.organizationId,
          },
        });
        if (member) {
          authorizedListIds.push(sharedList.id);
        }
      }
    }

    if (authorizedListIds.length === 0) {
      return NextResponse.json(
        { error: "No authorized shared lists found" },
        { status: 403 }
      );
    }

    // 일괄 삭제
    const deleted = await db.sharedList.deleteMany({
      where: {
        id: {
          in: authorizedListIds,
        },
      },
    });

    return NextResponse.json({
      deleted: deleted.count,
      requested: publicIds.length,
      authorized: authorizedListIds.length,
    });
  } catch (error) {
    console.error("Error deleting shared lists:", error);
    return NextResponse.json(
      { error: "Failed to delete shared lists" },
      { status: 500 }
    );
  }
}
