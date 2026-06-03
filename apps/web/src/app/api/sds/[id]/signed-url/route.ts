import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
// §11.348-B-1 B1-1 — 실제 Supabase 서명 URL 생성.
import { createSdsSignedUrl } from "@/lib/safety/sds-storage";

// SDS 문서의 signed URL 생성
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
      targetEntityType: 'ai_action',
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/sds/id/signed-url',
    });
    if (!enforcement.allowed) return enforcement.deny();

        if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // SDS 문서 확인
    const sdsDocument = await db.sDSDocument.findUnique({
      where: { id },
      include: {
        product: true,
        organization: true,
      },
    });

    if (!sdsDocument) {
      return NextResponse.json(
        { error: "SDS document not found" },
        { status: 404 }
      );
    }

    // 권한 확인: 공용 문서이거나 사용자의 조직에 속한 문서
    if (sdsDocument.organizationId) {
      const membership = await db.organizationMember.findFirst({
        where: {
          userId: session.user.id,
          organizationId: sdsDocument.organizationId,
        },
      });

      if (!membership && session.user.role !== "ADMIN") {
        return NextResponse.json(
          { error: "Forbidden" },
          { status: 403 }
        );
      }
    }

    // §11.348-B-1 B1-1 — 실제 Supabase 서명 URL(1시간). 스토리지 미설정/실패 시
    // null → Product.msdsUrl(레거시 단일 URL) 폴백. silent fake success 금지.
    let signedUrl: string | null = null;
    if (sdsDocument.bucket && sdsDocument.path) {
      signedUrl = await createSdsSignedUrl({
        bucket: sdsDocument.bucket,
        path: sdsDocument.path,
      });
    }
    if (!signedUrl) {
      signedUrl = sdsDocument.product?.msdsUrl ?? null;
    }

    return NextResponse.json({
      signedUrl,
      expiresIn: 3600, // 1시간
    });
  } catch (error: any) {
    console.error("Error generating signed URL:", error);
    return NextResponse.json(
      { error: "Failed to generate signed URL" },
      { status: 500 }
    );
  }
}









