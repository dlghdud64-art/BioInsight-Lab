/**
 * GET /api/orders/[id]/po-document — 발주서 PDF 열람 (§quote-scan-public-storage P0-b1)
 *
 * 호영님 판정 2026-09-12: 서명 URL 이 아니라 **프록시 라우트**로 간다.
 *   ① 요구가 없다 — 서명 URL 은 "인증 없는 제3자에게 한시적으로" 쓰는 도구다.
 *      발주서는 조직 내부 문서이고 외부 공유 요구가 없다.
 *   ② 감사 축 — 프록시면 **누가 언제 열었는지** enforceAction 에 남는다.
 *      서명 URL 은 발급만 남고 실제 열람은 안 남는다.
 *
 * 순서: 인증 → 발주 조회 → **조직 대조** → enforceAction → private 스트림 전달.
 *   Order.poDocumentUrl 에는 storage key 가 들어 있다(컬럼명은 레거시 · URL 아님).
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }
    const { id } = await params;

    const order = await db.order.findUnique({
      where: { id },
      select: { id: true, userId: true, organizationId: true, orderNumber: true, poDocumentUrl: true },
    });
    if (!order) {
      return NextResponse.json({ error: "발주를 찾을 수 없습니다." }, { status: 404 });
    }

    /* 🛑 조직 대조 — 다른 조직의 발주서를 열 수 없다(오늘 닫은 cross-tenant 형태와 같은 축).
     *   발주에 조직이 있으면 그 조직 멤버여야 하고, 없으면 본인 발주여야 한다. */
    const isOwner = order.userId === session.user.id;
    let isOrgMember = false;
    if (order.organizationId) {
      const membership = await db.organizationMember.findFirst({
        where: { userId: session.user.id, organizationId: order.organizationId },
        select: { id: true },
      });
      isOrgMember = !!membership;
    }
    if (!isOwner && !isOrgMember) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (!order.poDocumentUrl) {
      return NextResponse.json(
        { error: "발주서 문서가 아직 생성되지 않았습니다.", code: "NO_PO_DOCUMENT" },
        { status: 404 },
      );
    }

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: "sensitive_data_export",
      targetEntityType: "order",
      targetEntityId: order.id,
      sourceSurface: "web_app",
      routePath: "/api/orders/[id]/po-document",
    });
    if (!enforcement.allowed) return enforcement.deny();

    const { get } = await import("@vercel/blob");
    const blob = await get(order.poDocumentUrl, { access: "private" });
    if (!blob) {
      enforcement.fail();
      return NextResponse.json(
        { error: "문서를 찾을 수 없습니다.", code: "BLOB_NOT_FOUND" },
        { status: 404 },
      );
    }

    // 열람도 감사 대상이다(호영님) — 스트림을 내보내기 전에 기록한다.
    enforcement.complete({ organizationId: order.organizationId });

    return new NextResponse(blob.stream as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        // 파일명 보존 — 발주번호로 내려받는다.
        "Content-Disposition": `inline; filename="${order.orderNumber ?? order.id}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    enforcement?.fail();
    console.error("[orders/[id]/po-document] error:", error);
    return NextResponse.json({ error: "문서를 여는 중 오류가 발생했습니다." }, { status: 500 });
  }
}
