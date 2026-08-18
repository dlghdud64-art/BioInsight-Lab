/**
 * §receiving-doc-attach-canonical (T1) — 입고 증빙 문서 API
 *   GET    /api/receiving/documents/[id]  — 입고 건(PO) 증빙 목록 + 품목 MSDS 연동 정보
 *   POST   /api/receiving/documents/[id]  — 업로드(multipart). 스토리지 성공 시에만 레코드 생성.
 *   DELETE /api/receiving/documents/[id]?docId=  — 증빙 삭제
 *
 * ⚠️ 경로 주의: 정적 세그먼트 `documents` 아래에 둔다. `api/receiving/[token]`(벤더 수령 링크)이
 *   같은 레벨에 이미 있어 `api/receiving/[id]` 는 Next.js 슬러그 충돌('id' !== 'token')로 빌드 불능.
 *
 * [id] = Order.id (입고 건 = PO). 회차별 귀속은 restockId(선택).
 *
 * 핸드오프 §0 대응:
 *   - front-only success 금지: 업로드 → 스토리지 확인 → 그 다음에만 DB 레코드 생성.
 *     스토리지 미설정/실패는 명시 에러(placeholder success 0).
 *   - 허위 표시 금지: 상태는 레코드에서만 파생. seed 플래그 없음.
 *
 * 범위(T1): 거래명세서·기타(ReceivingDocument). SDS/COA 는 기존 /api/products/[id]/sds 소관
 *   (COA 는 restockId 필수 = 입고 확정 이후) — 본 라우트는 안전문서 테이블을 건드리지 않는다.
 *
 * ownership: Order.userId 또는 organizationMember (orders/[id]/generate-pdf 패턴 정합).
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  uploadReceivingDocument,
  removeReceivingDocument,
  ReceivingStorageNotConfiguredError,
} from "@/lib/receiving/receiving-doc-storage";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** 업로드 허용 종류. photo 는 T2/T3(검수 상태 사진)에서 UI 배선 — 모델·API는 선반영. */
const ALLOWED_DOC_TYPES = new Set(["invoice", "coa", "photo", "etc"]);
const MAX_SIZE_BYTES = 20 * 1024 * 1024; // 20MB

/**
 * db(@/lib/db)는 Prisma 미생성 fallback 위해 `any` → findMany 결과가 any 로 흘러
 * noImplicitAny(strict) 발생. 아래 select 화이트리스트에 대응하는 런타임 shape 명시.
 */
type ReceivingDocumentRow = {
  id: string;
  docType: string;
  fileName: string;
  contentType: string | null;
  sizeBytes: number | null;
  restockId: string | null;
  createdAt: Date;
  uploadedBy: { name: string | null } | null;
};

async function resolveOrderAccess(orderId: string, userId: string) {
  const order = await db.order.findUnique({
    where: { id: orderId },
    select: { id: true, userId: true, organizationId: true },
  });
  if (!order) return { order: null, allowed: false as const };
  const isOwner = order.userId === userId;
  let isOrgMember = false;
  if (!isOwner && order.organizationId) {
    const member = await db.organizationMember.findFirst({
      where: { userId, organizationId: order.organizationId },
      select: { id: true },
    });
    isOrgMember = !!member;
  }
  return { order, allowed: isOwner || isOrgMember };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const { order, allowed } = await resolveOrderAccess(id, session.user.id);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const documents = await db.receivingDocument.findMany({
      where: { orderId: id },
      select: {
        id: true,
        docType: true,
        fileName: true,
        contentType: true,
        sizeBytes: true,
        restockId: true,
        createdAt: true,
        uploadedBy: { select: { name: true } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({
      documents: documents.map((d: ReceivingDocumentRow) => ({
        id: d.id,
        docType: d.docType,
        fileName: d.fileName,
        contentType: d.contentType,
        sizeBytes: d.sizeBytes,
        restockId: d.restockId,
        uploadedAt: d.createdAt.toISOString(),
        uploadedBy: d.uploadedBy?.name ?? null,
      })),
    });
  } catch (error) {
    console.error("[receiving/documents/GET]", error);
    return NextResponse.json({ error: "Failed to fetch documents" }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const { order, allowed } = await resolveOrderAccess(id, session.user.id);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const form = await request.formData();
    const file = form.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ error: "파일이 필요합니다.", code: "FILE_REQUIRED" }, { status: 400 });
    }
    if (file.size === 0) {
      return NextResponse.json({ error: "빈 파일입니다.", code: "FILE_EMPTY" }, { status: 400 });
    }
    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: "파일이 너무 큽니다(최대 20MB).", code: "FILE_TOO_LARGE" },
        { status: 413 },
      );
    }
    const rawType = form.get("docType");
    const docType = typeof rawType === "string" && ALLOWED_DOC_TYPES.has(rawType) ? rawType : "etc";
    const rawRestockId = form.get("restockId");
    let restockId: string | null =
      typeof rawRestockId === "string" && rawRestockId.trim() ? rawRestockId.trim() : null;
    if (restockId) {
      // 회차 귀속은 같은 PO 의 입고 레코드만 허용(교차 참조 차단).
      const restock = await db.inventoryRestock.findFirst({
        where: { id: restockId, orderId: id },
        select: { id: true },
      });
      if (!restock) {
        return NextResponse.json(
          { error: "해당 입고 건의 입고 회차가 아닙니다.", code: "RESTOCK_MISMATCH" },
          { status: 422 },
        );
      }
    }

    // ① 스토리지 업로드 먼저 — 성공해야만 ② 레코드 생성(front-only success 방지).
    const buffer = Buffer.from(await file.arrayBuffer());
    let stored: { bucket: string; path: string };
    try {
      stored = await uploadReceivingDocument({
        orderId: id,
        fileName: file.name,
        buffer,
        contentType: file.type || undefined,
      });
    } catch (err) {
      if (err instanceof ReceivingStorageNotConfiguredError) {
        return NextResponse.json(
          {
            error: "문서 저장소가 설정되지 않아 첨부할 수 없습니다. 관리자에게 문의해주세요.",
            code: "STORAGE_NOT_CONFIGURED",
          },
          { status: 503 },
        );
      }
      console.error("[receiving/documents/POST] upload 실패", err);
      return NextResponse.json(
        { error: "업로드에 실패했습니다. 다시 시도해주세요.", code: "UPLOAD_FAILED" },
        { status: 502 },
      );
    }

    const created = await db.receivingDocument.create({
      data: {
        orderId: id,
        restockId,
        organizationId: order.organizationId,
        uploadedById: session.user.id,
        docType,
        fileName: file.name,
        bucket: stored.bucket,
        path: stored.path,
        contentType: file.type || null,
        sizeBytes: file.size,
      },
      select: {
        id: true,
        docType: true,
        fileName: true,
        contentType: true,
        sizeBytes: true,
        restockId: true,
        createdAt: true,
        uploadedBy: { select: { name: true } },
      },
    });

    return NextResponse.json(
      {
        document: {
          id: created.id,
          docType: created.docType,
          fileName: created.fileName,
          contentType: created.contentType,
          sizeBytes: created.sizeBytes,
          restockId: created.restockId,
          uploadedAt: created.createdAt.toISOString(),
          uploadedBy: created.uploadedBy?.name ?? null,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    console.error("[receiving/documents/POST]", error);
    return NextResponse.json({ error: "Failed to upload document" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { id } = await params;
    const { order, allowed } = await resolveOrderAccess(id, session.user.id);
    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const docId = request.nextUrl.searchParams.get("docId");
    if (!docId) {
      return NextResponse.json({ error: "docId 가 필요합니다.", code: "DOC_ID_REQUIRED" }, { status: 400 });
    }
    const doc = await db.receivingDocument.findFirst({
      where: { id: docId, orderId: id },
      select: { id: true, bucket: true, path: true },
    });
    if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

    // 스토리지 원본 삭제 실패해도 메타는 정리(고아 메타로 허위 첨부 표시 방지).
    await removeReceivingDocument(doc.bucket, doc.path);
    await db.receivingDocument.delete({ where: { id: doc.id } });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("[receiving/documents/DELETE]", error);
    return NextResponse.json({ error: "Failed to delete document" }, { status: 500 });
  }
}
