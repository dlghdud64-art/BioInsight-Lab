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
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_import',
      targetEntityType: 'product',
      targetEntityId: 'unknown',
      sourceSurface: 'web_app',
      routePath: '/products/id/usage',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const { id } = await params;
    const product = await getProductById(id);

    if (!product) {
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

    return NextResponse.json({
      usageDescription,
    });
  } catch (error: any) {
    console.error("Error generating usage description:", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate usage description" },
      { status: 500 }
    );
  }
}



