/**
 * #user-supplier-registration Phase 2 — `/api/organization-vendors` collection route.
 *
 * GET  — list current user organization's vendors (org_book).
 * POST — create new OrganizationVendor (organizationId 자동 scope).
 *
 * canonical truth lock:
 *   - auth() 필수 — 비로그인 401.
 *   - current user 의 organization 확인 (OrganizationMember 의 첫 active row).
 *   - zod schema 검증 — vendorName / vendorEmail required.
 *   - @@unique([organizationId, vendorEmail]) 충돌 시 P2002 → 409 한국어 메시지.
 *   - audit — createActivityLog (best-effort, mutation atomic 보호).
 *   - ownership: organizationId 자동 scope (response 가 다른 organization 노출 0).
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

const logger = createLogger("api/organization-vendors");

// ── zod schema ──
// #vendor-partnership-tier Phase 2 — partnershipTier optional enum 추가.
//   null/undefined 시 Vendor.partnershipTier (글로벌 baseline) fallback 사용.
const CreateOrganizationVendorSchema = z.object({
  vendorName: z.string().min(1, "공급사 이름을 입력해 주세요").max(200),
  vendorEmail: z.string().email("이메일 형식이 올바르지 않습니다"),
  vendorPhone: z.string().max(50).nullish(),
  notes: z.string().max(2000).nullish(),
  isPrimary: z.boolean().nullish(),
  partnershipTier: z.enum(["DIRECT_PARTNER", "VERIFIED", "GENERAL", "UNVERIFIED"]).nullish(),
  // 기존 platform Vendor 연결 (선택). 없으면 inline 만으로 등록.
  vendorId: z.string().nullish(),
});

/* §invite-flow Phase 2-3 — 로컬 getCurrentOrganizationId 복사본 은퇴.
 *   "첫 멤버십" 을 파일마다 따로 고르던 자리다(같은 복사본이 vendor 계열 4파일에 있었다).
 *   ownership 의 single source 는 이제 공유 resolver 다 — 읽기는 관대하게(활성 조직),
 *   쓰기는 명시값을 무시하지 않는다(hint_forbidden → 403). */

/**
 * GET /api/organization-vendors
 * List current user's organization vendors (org_book source).
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
      // organization 미가입 user — empty list (graceful).
      return NextResponse.json({ organizationId: null, vendors: [] });
    }

    const vendors = await db.organizationVendor.findMany({
      where: { organizationId },
      orderBy: [{ isPrimary: "desc" }, { vendorName: "asc" }],
      select: {
        id: true,
        vendorName: true,
        vendorEmail: true,
        vendorPhone: true,
        notes: true,
        isPrimary: true,
        partnershipTier: true,
        vendorId: true,
        createdAt: true,
        updatedAt: true,
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        vendor: {
          select: { id: true, name: true, country: true, partnershipTier: true },
        },
      },
    });

    return NextResponse.json({
      /* §invite-flow Phase 2-3 — 이 목록이 **어느 조직의** 것인지 화면에 알린다.
       * 화면은 이 값을 mutation 에 그대로 실어 "보여준 조직에 적용" 을 보장한다(짝 계약). */
      organizationId,
      // §11.235 — Prisma findMany return type implicit any narrow.
      vendors: vendors.map((v: typeof vendors[number]) => ({
        ...v,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
      })),
    });
  } catch (error) {
    logger.error("[organization-vendors/GET] Error", error);
    return NextResponse.json(
      { error: "공급사 목록을 불러오지 못했습니다" },
      { status: 500 },
    );
  }
}

/**
 * POST /api/organization-vendors
 * Create new OrganizationVendor for current user's organization.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    /* body 를 먼저 읽는다 — 생성 대상 조직(hint)이 body 에 있기 때문이다.
     * 파싱 실패는 아래 스키마 검증이 받아내므로 여기서 던지지 않는다(요청 스트림은 1회 소비). */
    const body = await request.json().catch(() => ({}));

    /* 생성은 mutation — 명시한 조직이 검증에 실패하면 조용히 활성 조직에 만들지 않는다.
     * (거래처가 사용자가 보던 조직이 아닌 곳에 생기는 것이 이 표면의 조용한 오적용이다.) */
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
        { error: "조직에 가입된 사용자만 공급사를 등록할 수 있습니다" },
        { status: 403 },
      );
    }

    const parsed = CreateOrganizationVendorSchema.safeParse(body);
    if (!parsed.success) {
      const firstIssue = parsed.error.issues[0];
      return NextResponse.json(
        {
          error: "VENDOR_REGISTRATION_VALIDATION_FAILED",
          message: firstIssue?.message ?? "공급사 정보를 다시 확인해 주세요",
          details: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 },
      );
    }

    const data = parsed.data;

    try {
      const vendor = await db.organizationVendor.create({
        data: {
          organizationId,
          createdById: session.user.id,
          vendorName: data.vendorName,
          vendorEmail: data.vendorEmail,
          vendorPhone: data.vendorPhone ?? null,
          notes: data.notes ?? null,
          isPrimary: data.isPrimary ?? false,
          // #vendor-partnership-tier — null 시 Vendor.partnershipTier
          //   (글로벌 baseline) fallback 사용 (overlay pattern).
          partnershipTier: data.partnershipTier ?? null,
          vendorId: data.vendorId ?? null,
        },
        select: {
          id: true,
          vendorName: true,
          vendorEmail: true,
          vendorPhone: true,
          notes: true,
          isPrimary: true,
          partnershipTier: true,
          vendorId: true,
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
          // §11.235 — ActivityType enum 에 ORGANIZATION_VENDOR_* 미정의.
          //   spec 정합 미완성 → as cast 로 type 검사 silence + 향후 schema migration 시점에 정합.
          activityType: "organization_vendor_created" as unknown as import("@prisma/client").ActivityType,
          entityType: "OrganizationVendor",
          entityId: vendor.id,
          actorRole: await getActorRole(session.user.id, organizationId),
          metadata: {
            vendorName: vendor.vendorName,
            vendorEmail: vendor.vendorEmail,
            isPrimary: vendor.isPrimary,
          },
          ipAddress,
          userAgent,
        });
      } catch (auditError) {
        logger.warn("[organization-vendors/POST] Audit log failed", auditError);
      }

      return NextResponse.json({
        vendor: {
          ...vendor,
          createdAt: vendor.createdAt.toISOString(),
          updatedAt: vendor.updatedAt.toISOString(),
        },
      });
    } catch (error: unknown) {
      // P2002 — unique constraint (organizationId + vendorEmail) 충돌.
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        return NextResponse.json(
          {
            error: "VENDOR_ALREADY_REGISTERED",
            message: "이미 등록된 이메일입니다",
          },
          { status: 409 },
        );
      }
      throw error;
    }
  } catch (error) {
    logger.error("[organization-vendors/POST] Error", error);
    return NextResponse.json(
      { error: "공급사 등록에 실패했습니다" },
      { status: 500 },
    );
  }
}
