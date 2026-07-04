import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { extractTextFromPDF } from "@/lib/ai/pdf-parser";
import { extractSafetyInfoFromMSDS } from "@/lib/ai/safety-extractor";
import { matchMsdsToProducts, type MatchProduct } from "@/lib/safety/msds-match";

/**
 * §msds-bulk-registration B-P3 — 일괄 MSDS 프리뷰(추출 + 매칭).
 *   POST multipart(files[]) → 각 PDF 동기 추출(제품명·CAS) → 재고 품목 매칭 프리뷰.
 *   파일 미저장(stateless). 확인은 /bulk/commit 에서 파일 재전송 + 확정 productId.
 *   OPENAI_API_KEY 없으면 extractionAvailable:false(자동매칭 불가 → 수동만, 정직 skip).
 */
const MAX_FILES = 20;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
    }

    const form = await request.formData();
    const files = form.getAll("files").filter((f): f is File => typeof f !== "string");
    if (files.length === 0) {
      return NextResponse.json({ error: "MSDS 파일이 필요합니다.", code: "FILES_REQUIRED" }, { status: 400 });
    }
    if (files.length > MAX_FILES) {
      return NextResponse.json({ error: `한 번에 최대 ${MAX_FILES}개까지 처리합니다.`, code: "TOO_MANY" }, { status: 400 });
    }

    // 재고 품목 풀(사용자·조직 스코프) — 매칭 대상.
    const memberships = await db.organizationMember.findMany({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });
    const orgIds = memberships.map((m: { organizationId: string }) => m.organizationId);
    const inventories = await db.productInventory.findMany({
      where: { OR: [{ userId: session.user.id }, ...(orgIds.length ? [{ organizationId: { in: orgIds } }] : [])] },
      select: { product: { select: { id: true, name: true, brand: true, catalogNumber: true, casNo: true } } },
    });
    const poolMap = new Map<string, MatchProduct>();
    for (const inv of inventories as Array<{ product: MatchProduct | null }>) {
      if (inv.product && !poolMap.has(inv.product.id)) poolMap.set(inv.product.id, inv.product);
    }
    const pool = [...poolMap.values()];

    const extractionAvailable = !!process.env.OPENAI_API_KEY;

    const items = [] as Array<Record<string, unknown>>;
    for (let i = 0; i < files.length; i++) {
      const f = files[i];
      const isPdf = (f.type || "").toLowerCase().includes("pdf") || f.name.toLowerCase().endsWith(".pdf");
      let productName: string | null = null;
      let casNumber: string | null = null;
      let reason: string | null = null;
      if (extractionAvailable && isPdf) {
        try {
          const buffer = Buffer.from(await f.arrayBuffer());
          const text = await extractTextFromPDF(buffer);
          if (text && text.trim().length > 0) {
            const info = await extractSafetyInfoFromMSDS(text);
            productName = info.productName ?? null;
            casNumber = info.casNumber ?? null;
          } else {
            reason = "no_text";
          }
        } catch {
          reason = "extract_failed";
        }
      } else {
        reason = !extractionAvailable ? "no_api_key" : "not_pdf";
      }
      const match = matchMsdsToProducts({ casNo: casNumber, productName }, pool);
      items.push({
        index: i,
        fileName: f.name,
        sizeBytes: f.size,
        extracted: { productName, casNumber },
        extractionReason: reason,
        match,
      });
    }

    // 수동 매칭용 경량 품목 목록(재고 품목, 매칭 실패/모호 건 사용자 지정).
    const poolOptions = pool.map((p) => ({ id: p.id, name: p.name, catalogNumber: p.catalogNumber ?? null }));
    return NextResponse.json({ extractionAvailable, poolCount: pool.length, pool: poolOptions, items });
  } catch (error) {
    console.error("Error in MSDS bulk preview:", error);
    return NextResponse.json({ error: "일괄 프리뷰에 실패했습니다." }, { status: 500 });
  }
}
