/**
 * §invite-flow Phase 1 — 활성 조직 읽기/쓰기 (canonical 의 유일한 쓰기 지점)
 *   (PLAN: docs/plans/PLAN_invite-flow.md Phase 1)
 *
 * GET   현재 활성 조직 id — resolver 규칙(hint → 저장값 → createdAt asc 첫 멤버십)의 결과.
 *       `persisted` 로 "저장된 선택" 과 "fallback 으로 고른 값" 을 구분한다.
 *       UI 는 이 구분으로 "아직 고른 적 없음" 을 알 수 있다(없는 선택을 있다고 말하지 않는다).
 * PATCH 활성 조직 저장. 멤버십을 검증하고, 실패하면 403 — 조용히 무시하고 성공을 돌려주면
 *       placeholder success 다(사용자는 바꿨다고 믿고 화면은 그대로).
 *
 * CSRF: 라우트 레지스트리 기본값이 `protection: "required"` 라 별도 등록 없이 보호된다.
 *       클라이언트는 `csrfFetch` 로 부른다.
 */
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { resolveActiveOrganizationId } from "@/lib/organizations/active-org";

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await db.user.findUnique({
      where: { id: session.user.id },
      select: { activeOrganizationId: true },
    });
    const organizationId = await resolveActiveOrganizationId({ userId: session.user.id });

    return NextResponse.json({
      organizationId,
      // 저장된 선택이 그대로 쓰였는가 — fallback 으로 고른 값과 구분한다.
      persisted: Boolean(user?.activeOrganizationId) && user?.activeOrganizationId === organizationId,
    });
  } catch (error) {
    console.error("[me/active-organization/GET]", error);
    return NextResponse.json({ error: "활성 조직을 불러오지 못했습니다." }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const organizationId = typeof body?.organizationId === "string" ? body.organizationId.trim() : "";
    if (!organizationId) {
      return NextResponse.json({ error: "organizationId is required" }, { status: 400 });
    }

    // 멤버십 검증 — 남의 조직을 거처로 삼을 수 없다.
    const membership = await db.organizationMember.findFirst({
      where: { userId: session.user.id, organizationId },
      select: { id: true },
    });
    if (!membership) {
      return NextResponse.json(
        { error: "Forbidden: 해당 조직의 멤버가 아닙니다." },
        { status: 403 },
      );
    }

    await db.user.update({
      where: { id: session.user.id },
      data: { activeOrganizationId: organizationId },
    });

    return NextResponse.json({ organizationId, persisted: true });
  } catch (error) {
    console.error("[me/active-organization/PATCH]", error);
    return NextResponse.json({ error: "활성 조직 저장에 실패했습니다." }, { status: 500 });
  }
}
