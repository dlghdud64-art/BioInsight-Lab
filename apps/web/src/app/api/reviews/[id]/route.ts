import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { deleteReview } from "@/lib/api/reviews";

// 리뷰 삭제
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    // (죽은 재검사 제거: 같은 DELETE 핸들러 상단에서 이미 401 처리했다)
    const { id } = await params;
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_import',
      targetEntityType: 'ai_action',
      // §enforcement-handle-close-sweep (기타) — params id 확정 이후로 핸들 이동.
      //   대상 Review 가 실재한다. 소유자 검증은 deleteReview() 내부 throw 로 처리되므로
      //   실패 경로는 catch 의 fail() 로 수렴한다.
      targetEntityId: id,
      sourceSurface: 'web_app',
      routePath: '/api/reviews/id',
    });
    if (!enforcement.allowed) return enforcement.deny();

    await deleteReview(id, session.user.id);
    enforcement.complete({
      beforeState: { reviewId: id, deleted: false },
      afterState: { reviewId: id, deleted: true },
    });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    enforcement?.fail();
    console.error("Error deleting review:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete review" },
      { status: 500 }
    );
  }
}
