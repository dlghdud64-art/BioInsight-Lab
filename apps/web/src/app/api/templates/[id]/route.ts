import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";

/**
 * GET /api/templates/:id
 * Get template by ID
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params;

    // TODO: Fetch from database
    // Mock response
    const template = {
      id,
      name: "Cell Culture Basic",
      description: "기본 세포 배양 실험에 필요한 시약 및 소모품",
      category: "Cell Culture",
      itemCount: 8,
      items: [
        { name: "PBS Buffer", quantity: 500, unit: "ml" },
        { name: "Trypsin-EDTA", quantity: 100, unit: "ml" },
      ],
      createdAt: new Date().toISOString(),
    };

    return NextResponse.json(template);
  } catch (error) {
    console.error("[Template] Error:", error);
    return NextResponse.json(
      { error: "Failed to fetch template" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/templates/:id
 * Delete template
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    const { id } = params;

    console.log("[Template] Deleting template:", id);
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_import',
      targetEntityType: 'product',
      // §enforcement-handle-close-sweep (templates) — params id 확정 이후로 핸들 이동.
      //   ⚠️ 이 라우트는 아직 DB 삭제를 하지 않는다(아래 TODO) → fail() 로 닫는다.
      //   ⚠️ enum 에 template 타입 부재 → §audit-taxonomy-review.
      targetEntityId: id,
      sourceSurface: 'web_app',
      routePath: '/templates/id',
    });
    if (!enforcement.allowed) return enforcement.deny();


    // TODO: Delete from database

    // ⚠️ 위 TODO 가 남아 있는 한 DB 쓰기가 0이다 → fail().
    enforcement.fail();
    return NextResponse.json({ success: true });
  } catch (error) {
    enforcement?.fail();
    console.error("[Template] Error:", error);
    return NextResponse.json(
      { error: "Failed to delete template" },
      { status: 500 }
    );
  }
}
