import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
// §11.348-B-1 B1-1 — SDS 파일 업로드(스토리지 + 메타).
import { uploadSdsFile, StorageNotConfiguredError } from "@/lib/safety/sds-storage";
// §cas-hazard-classification P3c — MSDS 업로드 시 위험분류 backfill(best-effort, fill-empty).
import { backfillHazardFromMsds } from "@/lib/safety/msds-hazard-backfill";
import { supersedePriorSds } from "@/lib/safety/supersede-sds";
import { createActivityLog } from "@/lib/activity-log";
import { ActivityType, OrganizationRole } from "@prisma/client";
// §sds-upload-role-gate — 서버측 role 게이트 + enforceAction 핸들 마감(§enforcement-handle-close).
import {
  enforceAction,
  type InlineEnforcementHandle,
} from "@/lib/security/server-enforcement-middleware";

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
  let enforcement: InlineEnforcementHandle | undefined;
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

    // §enforcement-handle-close — productId 확정 이후 호출(targetEntityId 'unknown' 금지).
    //   아래 모든 early-return 과 catch 에서 fail(), 성공 시 complete() 로 닫는다.
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: 'sensitive_data_import',
      targetEntityType: 'product',
      targetEntityId: productId,
      sourceSurface: 'web_app',
      routePath: '/api/products/id/sds',
    });
    if (!enforcement.allowed) return enforcement.deny();

    const form = await request.formData();
    const file = form.get("file");
    if (!file || typeof file === "string") {
      enforcement.fail();
      return NextResponse.json({ error: "파일이 필요합니다.", code: "FILE_REQUIRED" }, { status: 400 });
    }
    const f = file as File;
    const buffer = Buffer.from(await f.arrayBuffer());
    // §11.348-B-1 B1-4 — docType(sds/coa). 미지정/비정상 시 "sds".
    const rawDocType = form.get("docType");
    const docType = rawDocType === "coa" ? "coa" : "sds";

    // §msds-version-validation — 버전 메타(버전상태 휴리스틱 분류 입력). 전부 optional.
    const docVersionRaw = form.get("docVersion");
    const issuedAtRaw = form.get("issuedAt");
    const expiresAtRaw = form.get("expiresAt");
    const docVersion = typeof docVersionRaw === "string" && docVersionRaw.trim() ? docVersionRaw.trim() : null;
    const parseDate = (v: FormDataEntryValue | null): Date | null => {
      if (typeof v !== "string" || !v) return null;
      const d = new Date(v);
      return Number.isNaN(d.getTime()) ? null : d;
    };
    const issuedAt = parseDate(issuedAtRaw);
    const expiresAt = parseDate(expiresAtRaw);

    // 조직 스코프: 요청자의 조직 목록(첫 조직 = 문서 org, 없으면 공용 null).
    const memberships = await db.organizationMember.findMany({
      where: { userId: session.user.id },
      select: { organizationId: true, role: true },
    });
    const orgIds = memberships.map((m: { organizationId: string }) => m.organizationId);
    const organizationId = orgIds[0] ?? null;

    // §sds-upload-role-gate (2026-08-09) — **docType 분기 게이트**.
    //   이 라우트는 인증만 통과하면 누구나 쓸 수 있었다(role 게이트 부재). 안전 문서 쓰기가
    //   그대로 열려 있는 상태라 서버에서 막는다. 단 docType 별로 행위자 계층이 다르다:
    //
    //   · sds — 제품 카탈로그 레벨 안전자료. 소유 관계가 없어 role 로만 판정한다.
    //     `/api/products/[id]/safety` 와 **동일한 합집합**(global ADMIN · SUPPLIER ·
    //     조직 ADMIN/VIEWER=safety_admin) — 둘 다 제품 안전 정보 쓰기라 계열을 맞춘다.
    //   · coa — 입고 lot(InventoryRestock) 귀속 문서. 재고를 받은 실무자(RESEARCHER 포함)가
    //     올리는 것이 정상 경로이고, **소유권 검증이 이미 게이트 역할**을 한다(아래 restock
    //     조회가 요청자 본인/조직의 lot 만 허용). 여기에 role 게이트를 걸면 회귀다.
    //
    //   ⚠️ UI 동반 게이트 필수: 서버만 막으면 대시보드 버튼은 열려 있고 저장만 403 나는
    //   front-only 실패가 된다(§product-detail-sourcing-v21 에서 고친 바로 그 클래스).
    //   dashboard/safety 의 MSDS 업로드 진입을 동일 권한으로 게이트했다.
    const globalRole = session.user.role;
    const isPrivilegedGlobalRole = globalRole === "ADMIN" || globalRole === "SUPPLIER";
    const isSafetyAdminOrgMember = memberships.some(
      (m: { role: OrganizationRole }) =>
        m.role === OrganizationRole.OWNER || m.role === OrganizationRole.ADMIN || m.role === OrganizationRole.VIEWER,
    );
    if (docType === "sds" && !isPrivilegedGlobalRole && !isSafetyAdminOrgMember) {
      enforcement.fail();
      return NextResponse.json(
        {
          error: "SDS(MSDS) 등록 권한이 없습니다. 관리자·공급사 또는 조직 안전관리자만 등록할 수 있습니다.",
          code: "SDS_UPLOAD_FORBIDDEN",
        },
        { status: 403 },
      );
    }

    // #inventory-lot-entity P3 — COA는 lot-scoped(실 입고 lot=InventoryRestock 귀속). docType별 정합:
    //   coa → restockId 필수 + 소유(해당 product·요청자 org/user의 입고 lot) 검증 → 422(명시 거부; DB CHECK 차단 승격)
    //   inventoryId 는 restock.inventoryId 에서 파생(재고 단위 그룹핑/인덱스용 denorm).
    //   sds → restockId/inventoryId 항상 null (CHECK: SDSDocument_coa_lot_check, sds→restockId IS NULL)
    let inventoryId: string | null = null;
    let restockId: string | null = null;
    if (docType === "coa") {
      const rawRestockId = form.get("restockId");
      if (typeof rawRestockId !== "string" || !rawRestockId) {
        enforcement.fail();
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
        enforcement.fail();
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
        enforcement.fail();
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
        // §msds-version-validation — 버전 메타 저장(휴리스틱 분류 입력).
        docVersion,
        issuedAt,
        expiresAt,
      },
      select: { id: true, fileName: true, source: true, createdAt: true },
    });

    // §cas-hazard-classification P3c — sds(PDF) 업로드면 위험분류 backfill.
    //   best-effort·fill-empty — 실패/무키/이미분류 시 조용히 skip(업로드는 이미 성공, canonical).
    let hazardBackfilled = false;
    if (docType === "sds") {
      // §msds-audit-versioning — 개정본 대체(이전 현행본 supersede) + 감사(누가·언제). best-effort(등록은 canonical).
      try { await supersedePriorSds(productId, doc.id); } catch (e) { console.error("MSDS supersede 실패:", e); }
      try {
        await createActivityLog({
          activityType: ActivityType.MSDS_REGISTERED, entityType: "PRODUCT", entityId: productId,
          userId: session.user.id, organizationId,
          metadata: { fileName: f.name, docVersion, source: "single" },
        });
      } catch (e) { console.error("MSDS 감사 로그 실패:", e); }
      const bf = await backfillHazardFromMsds({ productId, buffer, contentType: f.type, docType });
      hazardBackfilled = bf.backfilled;
    }

    // §enforcement-handle-close — 성공 시 audit envelope 기록 + lock 해제.
    //   업로드는 신규 문서 생성이라 beforeState 는 "해당 lot/제품에 문서 없음" 기준선만 남긴다.
    enforcement.complete({
      beforeState: { productId, docType, sdsDocumentId: null },
      afterState: {
        productId,
        docType,
        sdsDocumentId: doc.id,
        fileName: doc.fileName,
        restockId,
        organizationId,
      },
    });

    return NextResponse.json({ ok: true, sdsDocument: doc, hazardBackfilled }, { status: 201 });
  } catch (error: any) {
    // §enforcement-handle-close — 예외 경로에서도 lock 해제(스토리지 throw·DB 에러 포함).
    enforcement?.fail();
    console.error("Error uploading SDS document:", error);
    return NextResponse.json({ error: "Failed to upload SDS document" }, { status: 500 });
  }
}
