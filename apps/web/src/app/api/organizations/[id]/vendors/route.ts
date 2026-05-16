import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

/**
 * §11.229b-4 #mobile-vendor-request-org-book — 호영님 §11.229b-3 자연 후속.
 *
 * GET /api/organizations/[id]/vendors
 *   조직 등록 vendor directory (OrganizationVendor model).
 *   모바일 VendorRequestModal 의 "공급사 등록 목록" section 용.
 *
 * Strategy:
 *   - auth() session gate + 401.
 *   - organizationMember check + 403 (조직 멤버만 조회 가능).
 *   - db.organizationVendor.findMany — vendorName + vendorEmail + isPrimary select.
 *   - orderBy isPrimary desc, vendorName asc (운영자 자주 사용 vendor 우선).
 *
 * canonical truth lock:
 *   - OrganizationVendor.@@unique([organizationId, vendorEmail]) 정합 (server-side dedup).
 *   - §11.229c TLD blacklist + bare IP refine 보존 (vendors POST 가 자동 검증).
 *   - read-only — 본 endpoint 는 GET 만 (POST/PUT/DELETE 는 별도 cluster).
 */

interface OrgVendorRow {
  id: string;
  vendorName: string;
  vendorEmail: string;
  isPrimary: boolean;
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: organizationId } = await params;

    // §11.229b-4 — org member 만 조직 vendor directory 조회 가능.
    const membership = await db.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId,
      },
    });
    if (!membership) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const vendors = await db.organizationVendor.findMany({
      where: { organizationId },
      select: {
        id: true,
        vendorName: true,
        vendorEmail: true,
        isPrimary: true,
      },
      orderBy: [{ isPrimary: "desc" }, { vendorName: "asc" }],
    });

    const rows: OrgVendorRow[] = vendors.map((v: OrgVendorRow) => ({
      id: v.id,
      vendorName: v.vendorName,
      vendorEmail: v.vendorEmail,
      isPrimary: v.isPrimary,
    }));

    return NextResponse.json({ vendors: rows }, { status: 200 });
  } catch (error) {
    console.error("[organizations/vendors] GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch organization vendors" },
      { status: 500 },
    );
  }
}
