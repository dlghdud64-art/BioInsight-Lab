/**
 * #user-supplier-registration Phase 2 — `/api/organization-vendors/[id]` item route.
 *
 * PATCH  — update vendor (partial). ownership check via organizationId.
 * DELETE — delete vendor. ownership check.
 *
 * canonical truth lock:
 *   - auth() 필수.
 *   - ownership: vendor.organizationId === user.currentOrganizationId.
 *     불일치 시 404 (not found 또는 존재하지 않음 — 다른 organization 노출 0).
 *   - zod schema partial — 모든 field optional.
 *   - audit log (createActivityLog, best-effort).
 */

import { NextRequest, NextResponse } from "next/server";
import { resolveOrganizationIdForMutation } from "@/lib/organizations/active-org";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { z } from "zod";
import { createActivityLog, getActorRole } from "@/lib/activity-log";
import { extractRequestMeta } from "@/lib/audit";
import { createLogger } from "@/lib/logger";

const logger = createLogger("api/organization-vendors/[id]");

// ── zod schema (partial update) ──
// #vendor-partnership-tier Phase 2 — partnershipTier optional enum 추가.
const UpdateOrganizationVendorSchema = z.object({
  vendorName: z.string().min(1).max(200).optional(),
  vendorEmail: z.string().email("이메일 형식이 올바르지 않습니다").optional(),
  vendorPhone: z.string().max(50).nullish(),
  notes: z.string().max(2000).nullish(),
  isPrimary: z.boolean().optional(),
  partnershipTier: z.enum(["DIRECT_PARTNER", "VERIFIED", "GENERAL", "UNVERIFIED"]).nullish(),
  vendorId: z.string().nullish(),
});

/* §invite-flow Phase 2-3 — 로컬 getCurrentOrganizationId 복사본 은퇴 (공유 resolver 로).
 * PATCH·DELETE 는 쓰기라 명시값을 무시하지 않는다 — hint 검증 실패는 403 이다.
 * 🔑 아래 findVendorWithOwnership 이 소유 조직을 한 번 더 대조하므로 조직이 어긋나도
 *    남의 거래처가 바뀌지 않는다(404). 그래도 403 을 먼저 내는 이유: 명시한 조직이 틀렸다는
 *    사실을 "없는 거래처" 로 뭉개면 사용자가 자기 화면을 의심하게 된다. */
async function resolveMutationOrgOrForbidden(
  userId: string,
  hint: string | null,
): Promise<{ organizationId: string | null; forbidden: boolean }> {
  const r = await resolveOrganizationIdForMutation({ userId, hint });
  if (!r.ok && r.reason === "hint_forbidden") return { organizationId: null, forbidden: true };
  return { organizationId: r.ok ? r.organizationId : null, forbidden: false };
}

/**
 * Helper — vendor lookup + ownership check.
 * not found / 다른 organization 의 row → null (route 가 404 반환).
 */
async function findVendorWithOwnership(
  vendorId: string,
  organizationId: string,
) {
  const vendor = await db.organizationVendor.findUnique({
    where: { id: vendorId },
    select: {
      id: true,
      organizationId: true,
      vendorName: true,
      vendorEmail: true,
      vendorPhone: true,
      notes: true,
      isPrimary: true,
      vendorId: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  // ownership: 다른 organization 의 row 도 not found 처리 (정보 노출 0).
  if (!vendor || vendor.organizationId !== organizationId) {
    return null;
  }

  return vendor;
}

/**
 * PATCH /api/organization-vendors/[id]
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const orgResolution = await resolveMutationOrgOrForbidden(
      session.user.id,
      new URL(request.url).searchParams.get("organizationId"),
    );
    if (orgResolution.forbidden) {
      return NextResponse.json(
        { error: "요청한 조직에 대한 권한이 없습니다." },
        { status: 403 },
      );
    }
    const organizationId = orgResolution.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "공급사를 찾을 수 없습니다" }, { status: 404 });
    }

    const { id } = await params;
    const existing = await findVendorWithOwnership(id, organizationId);
    if (!existing) {
      return NextResponse.json({ error: "공급사를 찾을 수 없습니다" }, { status: 404 });
    }

    const body = await request.json();
    const parsed = UpdateOrganizationVendorSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "VENDOR_UPDATE_VALIDATION_FAILED",
          message: parsed.error.issues[0]?.message ?? "공급사 정보를 다시 확인해 주세요",
          details: parsed.error.issues.map((i) => ({
            path: i.path.join("."),
            message: i.message,
          })),
        },
        { status: 400 },
      );
    }

    const updateData: Record<string, unknown> = {};
    const data = parsed.data;
    if (data.vendorName !== undefined) updateData.vendorName = data.vendorName;
    if (data.vendorEmail !== undefined) updateData.vendorEmail = data.vendorEmail;
    if (data.vendorPhone !== undefined) updateData.vendorPhone = data.vendorPhone ?? null;
    if (data.notes !== undefined) updateData.notes = data.notes ?? null;
    if (data.isPrimary !== undefined) updateData.isPrimary = data.isPrimary;
    // #vendor-partnership-tier — null 명시적 전달 시 글로벌 baseline fallback.
    if (data.partnershipTier !== undefined) updateData.partnershipTier = data.partnershipTier ?? null;
    if (data.vendorId !== undefined) updateData.vendorId = data.vendorId ?? null;

    try {
      const updated = await db.organizationVendor.update({
        where: { id },
        data: updateData,
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
          // §11.235 — ActivityType cast (schema migration 대기).
          activityType: "organization_vendor_updated" as unknown as import("@prisma/client").ActivityType,
          entityType: "OrganizationVendor",
          entityId: id,
          actorRole: await getActorRole(session.user.id, organizationId),
          metadata: { changes: Object.keys(updateData) },
          ipAddress,
          userAgent,
        });
      } catch (auditError) {
        logger.warn("[organization-vendors/[id]/PATCH] Audit log failed", auditError);
      }

      return NextResponse.json({
        vendor: {
          ...updated,
          createdAt: updated.createdAt.toISOString(),
          updatedAt: updated.updatedAt.toISOString(),
        },
      });
    } catch (error: unknown) {
      if (
        error &&
        typeof error === "object" &&
        "code" in error &&
        (error as { code: string }).code === "P2002"
      ) {
        return NextResponse.json(
          {
            error: "VENDOR_EMAIL_CONFLICT",
            message: "이미 등록된 이메일입니다",
          },
          { status: 409 },
        );
      }
      throw error;
    }
  } catch (error) {
    logger.error("[organization-vendors/[id]/PATCH] Error", error);
    return NextResponse.json(
      { error: "공급사 수정에 실패했습니다" },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/organization-vendors/[id]
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "로그인이 필요합니다" }, { status: 401 });
    }

    const orgResolution = await resolveMutationOrgOrForbidden(
      session.user.id,
      new URL(request.url).searchParams.get("organizationId"),
    );
    if (orgResolution.forbidden) {
      return NextResponse.json(
        { error: "요청한 조직에 대한 권한이 없습니다." },
        { status: 403 },
      );
    }
    const organizationId = orgResolution.organizationId;
    if (!organizationId) {
      return NextResponse.json({ error: "공급사를 찾을 수 없습니다" }, { status: 404 });
    }

    const { id } = await params;
    const existing = await findVendorWithOwnership(id, organizationId);
    if (!existing) {
      return NextResponse.json({ error: "공급사를 찾을 수 없습니다" }, { status: 404 });
    }

    await db.organizationVendor.delete({ where: { id } });

    // audit (best-effort).
    try {
      const { ipAddress, userAgent } = extractRequestMeta(request);
      await createActivityLog({
        userId: session.user.id,
        organizationId,
        // §11.235 — ActivityType cast (schema migration 대기).
        activityType: "organization_vendor_deleted" as unknown as import("@prisma/client").ActivityType,
        entityType: "OrganizationVendor",
        entityId: id,
        actorRole: await getActorRole(session.user.id, organizationId),
        metadata: {
          vendorName: existing.vendorName,
          vendorEmail: existing.vendorEmail,
        },
        ipAddress,
        userAgent,
      });
    } catch (auditError) {
      logger.warn("[organization-vendors/[id]/DELETE] Audit log failed", auditError);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error("[organization-vendors/[id]/DELETE] Error", error);
    return NextResponse.json(
      { error: "공급사 삭제에 실패했습니다" },
      { status: 500 },
    );
  }
}
