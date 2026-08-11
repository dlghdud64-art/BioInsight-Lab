import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// 공유 링크 일괄 삭제
export async function DELETE(request: NextRequest) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_import',
      targetEntityType: 'ai_action',
      // §enforcement-handle-close-sweep (shared-lists) — 'unknown' 유지.
      //   ⚠️ enum 에 shared_list 타입이 없다(정확한 선택지 부재).
      //   → §audit-taxonomy-review 후보. 여기서 바꾸면 checkServerAuthorization 의
      //     접근 판정 입력이 달라지므로 sweep 범위에서는 손대지 않는다.
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/api/shared-lists/bulk',
    });
    if (!enforcement.allowed) return enforcement.deny();

    // (죽은 재검사 제거: 같은 핸들러 상단에서 이미 401 처리했다)
    const body = await request.json();
    const { publicIds } = body;

    if (!publicIds || !Array.isArray(publicIds) || publicIds.length === 0) {
      enforcement.fail();
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
      enforcement.fail();
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

    enforcement.complete({
      beforeState: { requestedPublicIds: publicIds.length, authorized: authorizedListIds.length },
      afterState: { deleted: deleted.count },
    });

    return NextResponse.json({
      deleted: deleted.count,
      requested: publicIds.length,
      authorized: authorizedListIds.length,
    });
  } catch (error) {
    enforcement?.fail();
    console.error("Error deleting shared lists:", error);
    return NextResponse.json(
      { error: "Failed to delete shared lists" },
      { status: 500 }
    );
  }
}
