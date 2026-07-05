import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";

/**
 * §SM-S1 P1 (호영님 2026-07-05) — 조직 안전(MSDS) 관리 대상 카테고리 설정.
 *   GET: 현재 safetyCategories(기본 ["REAGENT"]) — org 멤버 열람.
 *   PATCH: ADMIN/OWNER 만 저장. REAGENT 는 화학물질 확정이라 항상 포함(고정). 유효 ProductCategory 만 허용.
 *   P3 계약: 저장/읽기 = string[](예: ["REAGENT","RAW_MATERIAL"]). 안전 페이지는 콤마조인→GET category(P2 파싱).
 */
const VALID_CATEGORIES = new Set(["REAGENT", "TOOL", "EQUIPMENT", "RAW_MATERIAL", "CONSUMABLE"]);

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;

    const membership = await db.organizationMember.findFirst({
      where: { organizationId: id, userId: session.user.id },
      select: { id: true },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const org = await db.organization.findUnique({
      where: { id },
      select: { id: true, safetyCategories: true },
    });
    if (!org) {
      return NextResponse.json({ error: "Organization not found" }, { status: 404 });
    }
    return NextResponse.json({ safetyCategories: org.safetyCategories });
  } catch (error: any) {
    console.error("Error fetching safety settings:", error);
    return NextResponse.json({ error: "Failed to fetch safety settings" }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;

    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'organization_update',
      targetEntityType: 'organization',
      targetEntityId: id,
      sourceSurface: 'organization-safety-settings-api',
      routePath: '/api/organizations/[id]/safety-settings',
    });
    if (!enforcement.allowed) return enforcement.deny();

    // ADMIN/OWNER 만 쓰기(기존 org PATCH 게이트 mirror).
    const membership = await db.organizationMember.findFirst({
      where: { organizationId: id, userId: session.user.id },
    });
    if (!membership || (membership.role !== "ADMIN" && membership.role !== "OWNER")) {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }

    const body = await request.json();
    const input = Array.isArray(body?.safetyCategories) ? body.safetyCategories : null;
    if (!input) {
      return NextResponse.json(
        { error: "safetyCategories 배열이 필요합니다.", code: "BAD_INPUT" },
        { status: 400 }
      );
    }
    // 유효 ProductCategory 만 + REAGENT 항상 포함(화학물질 확정, 고정). 중복 제거.
    const filtered = input.filter(
      (c: unknown): c is string => typeof c === "string" && VALID_CATEGORIES.has(c)
    );
    const safetyCategories = Array.from(new Set(["REAGENT", ...filtered]));

    const updated = await db.organization.update({
      where: { id },
      data: { safetyCategories },
      select: { id: true, safetyCategories: true },
    });

    enforcement.complete({
      beforeState: { organizationId: id },
      afterState: { organizationId: id, safetyCategories: updated.safetyCategories },
    });
    return NextResponse.json({ safetyCategories: updated.safetyCategories }, { status: 200 });
  } catch (error: any) {
    enforcement?.fail();
    console.error("Error updating safety settings:", error);
    return NextResponse.json({ error: "Failed to update safety settings" }, { status: 500 });
  }
}
