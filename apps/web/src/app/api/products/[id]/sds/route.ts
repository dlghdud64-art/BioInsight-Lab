import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
// §11.348-B-1 B1-1 — SDS 파일 업로드(스토리지 + 메타).
import { uploadSdsFile, StorageNotConfiguredError } from "@/lib/safety/sds-storage";

// 제품의 SDS 문서 목록 조회
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    // 제품 확인
    const product = await db.product.findUnique({
      where: { id },
    });

    if (!product) {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }

    // 사용자가 속한 조직 확인 (로그인한 경우)
    let organizationIds: string[] | null = null;
    if (session?.user?.id) {
      const memberships = await db.organizationMember.findMany({
        where: {
          userId: session.user.id,
        },
        select: {
          organizationId: true,
        },
      });
      organizationIds = memberships.map((m: any) => m.organizationId);
    }

    // SDS 문서 조회
    // 공용(vendor) 또는 사용자의 조직에 속한 문서만 조회
    // §11.348-B-1 B1-4 — docType(sds/coa) 필터(미지정 시 전체).
    const { searchParams } = new URL(request.url);
    const docType = searchParams.get("docType");
    // §detail-page P3 — COA는 inventory record(ProductInventory) 귀속 → inventoryId 필터(레거시 denorm).
    const inventoryId = searchParams.get("inventoryId");
    // #inventory-lot-entity P4 — COA canonical scope = 입고 lot(InventoryRestock) → restockId 필터(미지정 시 전체).
    const restockId = searchParams.get("restockId");
    const where: any = {
      productId: id,
      ...(docType ? { docType } : {}),
      ...(inventoryId ? { inventoryId } : {}),
      ...(restockId ? { restockId } : {}),
      OR: [
        { organizationId: null }, // 공용 문서
        ...(organizationIds && organizationIds.length > 0
          ? [{ organizationId: { in: organizationIds } }]
          : []),
      ],
    };

    const sdsDocuments = await db.sDSDocument.findMany({
      where,
      orderBy: {
        createdAt: "desc",
      },
    });

    return NextResponse.json({ sdsDocuments });
  } catch (error: any) {
    console.error("Error fetching SDS documents:", error);
    return NextResponse.json(
      { error: "Failed to fetch SDS documents" },
      { status: 500 }
    );
  }
}





// §11.348-B-1 B1-1 — SDS 문서 업로드 (multipart). 파일→스토리지 + SDSDocument 메타 생성.
// canonical 안전필드(Product) 승격은 별도 사람 승인(api/sds/[id]/apply) — 업로드는 보관만.
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id: productId } = await params;

    const product = await db.product.findUnique({ where: { id: productId }, select: { id: true } });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      return NextResponse.json({ error: "파일이 필요합니다.", code: "FILE_REQUIRED" }, { status: 400 });
    }
    const f = file as File;
    const buffer = Buffer.from(await f.arrayBuffer());
    // §11.348-B-1 B1-4 — docType(sds/coa). 미지정/비정상 시 "sds".
    const rawDocType = form.get("docType");
    const docType = rawDocType === "coa" ? "coa" : "sds";

    // 조직 스코프: 요청자의 조직 목록(첫 조직 = 문서 org, 없으면 공용 null).
    const memberships = await db.organizationMember.findMany({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });
    const orgIds = memberships.map((m: any) => m.organizationId);
    const organizationId = orgIds[0] ?? null;

    // #inventory-lot-entity P3 — COA는 lot-scoped(실 입고 lot=InventoryRestock 귀속). docType별 정합:
    //   coa → restockId 필수 + 소유(해당 product·요청자 org/user의 입고 lot) 검증 → 422(명시 거부; DB CHECK 차단 승격)
    //   inventoryId 는 restock.inventoryId 에서 파생(재고 단위 그룹핑/인덱스용 denorm).
    //   sds → restockId/inventoryId 항상 null (CHECK: SDSDocument_coa_lot_check, sds→restockId IS NULL)
    let inventoryId: string | null = null;
    let restockId: string | null = null;
    if (docType === "coa") {
      const rawRestockId = form.get("restockId");
      if (typeof rawRestockId !== "string" || !rawRestockId) {
        return NextResponse.json(
          { error: "COA(시험성적서)는 입고 lot 에 귀속됩니다. 입고 항목(lot)을 먼저 선택하세요.", code: "RESTOCK_REQUIRED" },
          { status: 422 },
        );
      }
      const restock = await db.inventoryRestock.findFirst({
        where: {
          id: rawRestockId,
          inventory: {
            productId,
            OR: [
              { userId: session.user.id },
              ...(orgIds.length > 0 ? [{ organizationId: { in: orgIds } }] : []),
            ],
          },
        },
        select: { id: true, inventoryId: true },
      });
      if (!restock) {
        return NextResponse.json(
          { error: "유효하지 않은 입고 lot 입니다. 본인/조직의 입고 항목만 선택할 수 있습니다.", code: "RESTOCK_INVALID" },
          { status: 422 },
        );
      }
      restockId = restock.id;
      inventoryId = restock.inventoryId;
    }

    // 스토리지 업로드 — 미설정 시 503 graceful(silent 성공 금지).
    let stored: { bucket: string; path: string };
    try {
      stored = await uploadSdsFile({
        productId,
        fileName: f.name || "sds.pdf",
        buffer,
        contentType: f.type || undefined,
      });
    } catch (e) {
      if (e instanceof StorageNotConfiguredError) {
        return NextResponse.json(
          { error: "파일 스토리지가 설정되지 않았습니다. 관리자에게 문의하세요.", code: "STORAGE_NOT_CONFIGURED" },
          { status: 503 },
        );
      }
      throw e;
    }

    const doc = await db.sDSDocument.create({
      data: {
        productId,
        organizationId,
        inventoryId,
        restockId,
        fileName: f.name || "sds.pdf",
        bucket: stored.bucket,
        path: stored.path,
        source: "upload",
        docType,
        contentType: f.type || null,
        sizeBytes: buffer.length,
      },
      select: { id: true, fileName: true, source: true, createdAt: true },
    });

    return NextResponse.json({ ok: true, sdsDocument: doc }, { status: 201 });
  } catch (error: any) {
    console.error("Error uploading SDS document:", error);
    return NextResponse.json({ error: "Failed to upload SDS document" }, { status: 500 });
  }
}
