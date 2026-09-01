/**
 * #vendor-catalog-product-matching Phase 2 — `/api/organization-vendor-products` collection route.
 *
 * GET  — list current organization's vendor-product carry mappings (filter by vendorId).
 * POST — create new OrganizationVendorProduct (organizationId 자동 scope).
 *
 * canonical truth lock:
 *   - auth() 필수 — 비로그인 401.
 *   - current user 의 organization 확인 (OrganizationMember 의 첫 active row).
 *   - zod schema — vendorId / productId required.
 *   - @@unique([organizationId, vendorId, productId]) 충돌 시 P2002 → 409 한국어 메시지.
 *   - audit — createActivityLog (best-effort, mutation atomic 보호).
 *   - ownership: organizationId 자동 scope (response 가 다른 organization 노출 0).
 *   - vendorId 의 OrganizationVendor (organizationId 매칭) 존재 확인 — orphan 차단.
 *   - productId 의 Product 존재 확인 — orphan 차단.
 */

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import {
  resolveActiveOrganizationId,
  resolveOrganizationIdForMutation,
} from "@/lib/organizations/active-org";
import { z } from "zod";
import { createActivityLog, getActorRole } from "@/lib/activity-log";
import { extractRequestMeta } from "@/lib/audit";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api/organization-vendor-products");

// ── zod schema ──
const CreateOrganizationVendorProductSchema = z.object({
  vendorId: z.string().min(1, "공급사를 선택해 주세요"),
  productId: z.string().min(1, "제품을 선택해 주세요"),
  notes: z.string().max(2000).nullish(),
});

/* §invite-flow Phase 2-3 — 로컬 getCurrentOrganizationId 복사본 은퇴 (공유 resolver 로).
 * 읽기는 관대하게(활성 조직), 쓰기는 명시값을 무시하지 않는다(hint_forbidden → 403). */

/**
 * GET /api/organization-vendor-products
 * List current organization's vendor-product carry mappings.
 * Optional ?vendorId= filter — settings/suppliers vendor expand 안 product list.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const organizationId = await resolveActiveOrganizationId({
      userId: session.user.id,
      hint: new URL(request.url).searchParams.get("organizationId"),
    });
    if (!organizationId) {
      return NextResponse.json({ entries: [] });
    }

    const url = new URL(request.url);
    const vendorIdFilter = url.searchParams.get("vendorId");

    const entries = await db.organizationVendorProduct.findMany({
      where: {
        organizationId,
        ...(vendorIdFilter ? { vendorId: vendorIdFilter } : {}),
      },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        organizationId: true,
        vendorId: true,
        productId: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        vendor: { select: { id: true, name: true } },
        product: {
          select: {
            id: true,
            name: true,
            brand: true,
            category: true,
            catalogNumber: true,
          },
        },
        createdBy: { select: { id: true, name: true, email: true } },
      },
    });

    return NextResponse.json({
      // §11.235 — Prisma findMany return type implicit any narrow.
      entries: entries.map((e: typeof entries[number]) => ({
        ...e,
        createdAt: e.createdAt.toISOString(),
        updatedAt: e.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    logger.error("[organization-vendor-products/GET] Error", error);
    return NextResponse.json(
      { error: "거래처-제품 매핑을 불러오지 못했습니다" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/organization-vendor-products
 * Create new OrganizationVendorProduct.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    /* body 를 먼저 읽는다 — 등록 대상 조직(hint)이 body 에 있다. 파싱 실패는 아래 스키마
     * 검증이 받아낸다(요청 스트림은 1회 소비라 여기서 던지면 검증 경로가 사라진다). */
    const body = await request.json().catch(() => ({}));

    const orgResolution = await resolveOrganizationIdForMutation({
      userId: session.user.id,
      hint: typeof (body as any)?.organizationId === "string" ? (body as any).organizationId : null,
    });
    if (!orgResolution.ok && orgResolution.reason === "hint_forbidden") {
      return NextResponse.json(
        { error: "요청한 조직에 대한 권한이 없습니다." },
        { status: 403 },
      );
    }
    const organizationId = orgResolution.ok ? orgResolution.organizationId : null;
    if (!organizationId) {
      return NextResponse.json(
        { error: "조직에 가입된 사용자만 거래처-제품 매핑을 등록할 수 있습니다" },
        { status: 403 },
      );
    }

    const parsed = CreateOrganizationVendorProductSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        {
          error: "VENDOR_PRODUCT_MAPPING_VALIDATION_FAILED",
          message: firstIssue?.message ?? "거래처-제품 매핑 정보를 다시 확인해 주세요",
          details: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 },
      );
    }

    const data = parsed.data;

    // Orphan 차단:
    //   - vendorId 가 platform Vendor 에 존재해야 (OrganizationVendor 와 platform Vendor 둘 다 검증).
    //   - productId 가 Product 에 존재해야.
    //   - vendorId 가 current organization 의 OrganizationVendor 에도 link 되어야 (다른 조직 vendor 차단).
    const [vendor, product, orgVendorMatch] = await Promise.all([
      db.vendor.findUnique({ where: { id: data.vendorId }, select: { id: true } }),
      db.product.findUnique({ where: { id: data.productId }, select: { id: true } }),
      db.organizationVendor.findFirst({
        where: { organizationId, vendorId: data.vendorId },
        select: { id: true },
      }),
    ]);

    if (!vendor) {
      return NextResponse.json(
        { error: "공급사를 찾을 수 없습니다" },
        { status: 404 },
      );
    }
    if (!product) {
      return NextResponse.json(
        { error: "제품을 찾을 수 없습니다" },
        { status: 404 },
      );
    }
    if (!orgVendorMatch) {
      // 다른 organization 의 vendor 거나, 본 조직에 등록 안 된 vendor.
      return NextResponse.json(
        { error: "이 조직에 등록되지 않은 공급사입니다. 먼저 거래처를 등록해 주세요." },
        { status: 400 },
      );
    }

    try {
      const entry = await db.organizationVendorProduct.create({
        data: {
          organizationId,
          createdById: session.user.id,
          vendorId: data.vendorId,
          productId: data.productId,
          notes: data.notes ?? null,
        },
        select: {
          id: true,
          organizationId: true,
          vendorId: true,
          productId: true,
          notes: true,
          createdAt: true,
          updatedAt: true,
        },
      });

      // audit (best-effort).
      try {
        const { ipAddress, userAgent } = extractRequestMeta(request);
        await createActivityLog({
          userId: session.user.id,
          organizationId,
          // §11.235 — ActivityType cast (schema migration 대기).
          activityType: "organization_vendor_product_created" as unknown as import("@prisma/client").ActivityType,
          entityType: "OrganizationVendorProduct",
          entityId: entry.id,
          actorRole: await getActorRole(session.user.id, organizationId),
          metadata: {
            vendorId: entry.vendorId,
            productId: entry.productId,
          },
          ipAddress,
          userAgent,
        });
      } catch (auditError) {
        logger.warn("[organization-vendor-products/POST] Audit log failed", auditError);
      }

      return NextResponse.json({
        entry: {
          ...entry,
          createdAt: entry.createdAt.toISOString(),
          updatedAt: entry.updatedAt.toISOString(),
        },
      });
    } catch (error: unknown) {
      // P2002 — unique constraint (organizationId + vendorId + productId).
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        return NextResponse.json(
          {
            error: "VENDOR_PRODUCT_MAPPING_ALREADY_EXISTS",
            message: "이미 등록된 거래처-제품 매핑입니다",
          },
          { status: 409 },
        );
      }
      throw error;
    }
  } catch (error) {
    logger.error("[organization-vendor-products/POST] Error", error);
    return NextResponse.json(
      { error: "거래처-제품 매핑 등록에 실패했습니다" },
      { status: 500 },
    );
  }
}
