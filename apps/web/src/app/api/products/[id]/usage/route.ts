import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { auth } from "@/auth";
import { NextRequest, NextResponse } from "next/server";
import { getProductById } from "@/lib/api/products";
import { generateProductUsageDescription } from "@/lib/ai/openai";

// 제품 사용 용도 설명 생성 API
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
    const { id } = await params;

    // §enforcement-handle-close-sweep (products) — 대상 엔티티 실재(params id) → per-resource 키.
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_import',
      targetEntityType: 'product',
      targetEntityId: id,
      sourceSurface: 'web_app',
      routePath: '/api/products/id/usage',
    });
    if (!enforcement.allowed) return enforcement.deny();
    const product = await getProductById(id);

    if (!product) {
      enforcement.fail();
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    const usageDescription = await generateProductUsageDescription(
      product.name,
      product.description || undefined,
      product.category || undefined,
      product.specification || undefined
    );

    // ⚠️ 정상 완료 경로인데 fail() 이다 — **버그 아님. complete() 로 바꾸지 말 것.**
    //   이 라우트는 AI 로 용도 설명을 생성해 반환할 뿐 DB 를 바꾸지 않는다.
    //   complete() 는 before/after 를 남기므로 "제품이 변경됨"으로 읽히는 거짓 감사가 된다.
    enforcement.fail();
    return NextResponse.json({
      usageDescription,
    });
  } catch (error: any) {
    enforcement?.fail();
    console.error("Error generating usage description:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate usage description" },
      { status: 500 }
    );
  }
}



