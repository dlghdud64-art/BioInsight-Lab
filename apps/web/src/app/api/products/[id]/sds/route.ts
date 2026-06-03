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
    const where: any = {
      productId: id,
      ...(docType ? { docType } : {}),
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

    // 조직 스코프: 요청자의 첫 조직(없으면 공용 null).
    const membership = await db.organizationMember.findFirst({
      where: { userId: session.user.id },
      select: { organizationId: true },
    });
    const organizationId = membership?.organizationId ?? null;

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
