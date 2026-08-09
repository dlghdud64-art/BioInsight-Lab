import { enforceAction, InlineEnforcementHandle } from "@/lib/security/server-enforcement-middleware";
import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { isAdmin } from "@/lib/api/admin";
import { getEmbedding } from "@/lib/ai/embeddings";
import { db } from "@/lib/db";

// 제품 임베딩 생성/업데이트 (관리자용)
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
    // 권한 확인은 lock 획득 **이전**에 — 403 이 lock 을 잡지 않게 한다.
    if (!(await isAdmin(session.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
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
      routePath: '/products/id/embedding',
    });
    if (!enforcement.allowed) return enforcement.deny();
    const product = await db.product.findUnique({
      where: { id },
      select: {
        name: true,
        nameEn: true,
        description: true,
        descriptionEn: true,
      },
    });

    if (!product) {
      enforcement.fail();
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // 제품 정보를 텍스트로 결합
    const text = [
      product.name,
      product.nameEn,
      product.description,
      product.descriptionEn,
    ]
      .filter(Boolean)
      .join(" ");

    if (!text) {
      return NextResponse.json(
        { error: "Product has no text content to embed" },
        { status: 400 }
      );
    }

    // 임베딩 생성
    const embedding = await getEmbedding(text);

    if (!embedding) {
      return NextResponse.json(
        { error: "Failed to generate embedding" },
        { status: 500 }
      );
    }

    // pgvector에 저장 (raw query 사용)
    // Prisma는 vector 타입을 직접 지원하지 않으므로 raw query 필요
    try {
      const embeddingArray = `[${embedding.join(",")}]`;
      await db.$executeRawUnsafe(
        `UPDATE "Product" SET embedding = $1::vector WHERE id = $2`,
        embeddingArray,
        id
      );

      // pgvector UPDATE 성공 = 실제 쓰기 → complete() 로 audit + lock 해제.
      enforcement.complete({
        beforeState: { productId: id, embedding: "(previous)" },
        afterState: { productId: id, embedding: `(vector[${embedding.length}])` },
      });

      return NextResponse.json({ success: true, message: "Embedding updated" });
    } catch (error: any) {
      // pgvector 확장이 활성화되지 않은 경우
      if (error.message?.includes("vector") || error.message?.includes("pgvector")) {
        // ⚠️ 내부 catch 가 자체 return 한다 — 외부 catch 를 거치지 않으므로 여기서 닫지 않으면
        //   pgvector 미활성 경로에서만 lock 이 TTL 까지 남는다(E6 가 잠그는 클래스).
        enforcement.fail();
        return NextResponse.json(
          {
            error: "pgvector extension is not enabled",
            message: "Please enable pgvector extension in PostgreSQL",
          },
          { status: 500 }
        );
      }
      throw error;
    }
  } catch (error: any) {
    enforcement?.fail();
    console.error("Error updating product embedding:", error);
    return NextResponse.json(
      { error: error.message || "Failed to update embedding" },
      { status: 500 }
    );
  }
}
