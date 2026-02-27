import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  getOrganizationById,
  updateOrganization,
} from "@/lib/api/organizations";

// 조직 상세 조회
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
    const organization = await getOrganizationById(id, session.user.id);
    return NextResponse.json({ organization });
  } catch (error: any) {
    console.error("Error fetching organization:", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch organization" },
      { status: 500 }
    );
  }
}

// 조직 정보 수정 (관리자 전용)
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // 관리자 권한 확인
    const membership = await db.organizationMember.findFirst({
      where: { organizationId: id, userId: session.user.id },
    });
    if (!membership || (membership.role !== "ADMIN" && membership.role !== "OWNER")) {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }

    const body = await request.json();
    const { name, description, slug, logoUrl } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: "조직명을 입력해주세요." }, { status: 400 });
    }

    // slug 유효성 검사 (전달된 경우)
    if (slug !== undefined && slug !== null && slug !== "") {
      const SLUG_REGEX = /^[a-z0-9][a-z0-9-]{1,30}[a-z0-9]$/;
      if (!SLUG_REGEX.test(slug)) {
        return NextResponse.json(
          { error: "슬러그는 3~32자의 소문자 영문, 숫자, 하이픈(-)만 사용 가능합니다." },
          { status: 400 }
        );
      }
      // DB 중복 확인 (자신 제외)
      const slugConflict = await db.organization.findFirst({
        where: { slug, id: { not: id } },
      });
      if (slugConflict) {
        return NextResponse.json(
          { error: `'${slug}'는 이미 사용 중인 주소입니다.` },
          { status: 409 }
        );
      }
    }

    const updated = await updateOrganization(id, {
      name: name.trim(),
      description: description?.trim() || undefined,
      slug: slug === "" ? null : slug?.trim() || undefined,
      logoUrl: logoUrl !== undefined ? logoUrl : undefined,
    });

    return NextResponse.json({ organization: updated });
  } catch (error: any) {
    console.error("Error updating organization:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update organization" },
      { status: 500 }
    );
  }
}

// 조직 삭제 (관리자 전용)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // ADMIN/OWNER만 삭제 가능
    const membership = await db.organizationMember.findFirst({
      where: { organizationId: id, userId: session.user.id },
    });
    if (!membership || (membership.role !== "ADMIN" && membership.role !== "OWNER")) {
      return NextResponse.json({ error: "관리자 권한이 필요합니다." }, { status: 403 });
    }

    // 멤버 먼저 삭제 후 조직 삭제
    await db.organizationMember.deleteMany({ where: { organizationId: id } });
    await db.organization.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("Error deleting organization:", error);
    return NextResponse.json(
      { error: error.message || "Failed to delete organization" },
      { status: 500 }
    );
  }
}
