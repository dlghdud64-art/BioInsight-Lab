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
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_import',
      targetEntityType: 'product',
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/products/id/view',
    });
    if (!enforcement.allowed) return enforcement.deny();

        const userId = session?.user?.id || null;
    const { id } = await params;

    const body = await request.json().catch(() => ({}));
    const query = body.query || "";

    await recordProductView(userId, id, query);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error recording product view:", error);
    return NextResponse.json(
      { error: "Failed to record product view" },
      { status: 500 }
    );
  }
}

