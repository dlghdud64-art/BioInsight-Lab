import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { recordProductView } from "@/lib/api/search-history";

// 제품 조회 기록
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    const userId = session.user.id;
    const { id } = await params;

    // §enforcement-handle-close-sweep (products) — 대상 엔티티 실재(params id) → per-resource 키.
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_import',
      targetEntityType: 'product',
      targetEntityId: id,
      sourceSurface: 'web_app',
      routePath: '/api/products/id/view',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const body = await request.json().catch(() => ({}));
    const query = body.query || "";

    await recordProductView(userId, id, query);

    // recordProductView 가 조회 이력을 기록한다(쓰기) → complete() 로 audit + lock 해제.
    enforcement.complete({
      beforeState: { productId: id, viewerId: userId },
      afterState: { productId: id, viewerId: userId, query: query || null },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    enforcement?.fail();
    console.error("Error recording product view:", error);
    return NextResponse.json(
      { error: "Failed to record product view" },
      { status: 500 }
    );
  }
}

