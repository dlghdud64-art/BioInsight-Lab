import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";

// SDS 문서의 signed URL 생성
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
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

    // Supabase Storage signed URL 생성 (구현 필요)
    // 현재는 임시로 경로 반환
    // TODO: Supabase Storage signed URL 생성
    // const { data, error } = await supabase.storage
    //   .from(sdsDocument.bucket!)
    //   .createSignedUrl(sdsDocument.path!, 3600); // 1시간 유효

    // 임시: 직접 URL 반환 (실제로는 signed URL 사용)
    const signedUrl = sdsDocument.path
      ? `/api/sds/${id}/download` // 임시 다운로드 엔드포인트
      : sdsDocument.product.msdsUrl || null;

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









