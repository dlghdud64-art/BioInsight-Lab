/**
 * §11.193d Phase 2.4 #organization-member-capabilities-edit
 *
 * PATCH /api/organizations/[id]/members/[memberId]/capabilities
 *
 * ADMIN/OWNER 가 다른 member 의 workflow capabilities (LAB_MANAGER /
 * APPROVER / REQUESTER) 를 수정. 기존 RBAC role 과 별도 layer (RBAC
 * permission-checker 변경 0).
 *
 * Body: `{ capabilities: WorkflowCapability[] }`
 *   - whitelist: lib/permissions/workflow-capabilities.ts 의 WORKFLOW_CAPABILITIES
 *   - 비-whitelist 값은 zod 가 reject (422)
 *
 * Security:
 *   - auth required (401)
 *   - requester = OWNER/ADMIN (403)
 *   - target member 가 해당 organization 에 속해야 함 (404, cross-org 차단)
 *   - enforceAction + audit log
 *
 * Response:
 *   200: { member: { id, capabilities } }
 *   400: invalid body
 *   401: unauthenticated
 *   403: insufficient permission
 *   404: member not found
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { db } from "@/lib/db";
import { OrganizationRole } from "@prisma/client";
import {
  enforceAction,
  InlineEnforcementHandle,
} from "@/lib/security/server-enforcement-middleware";
import { WORKFLOW_CAPABILITIES } from "@/lib/permissions/workflow-capabilities";

// zod schema — WORKFLOW_CAPABILITIES whitelist 강제 (raw key 노출 차단)
const PatchBodySchema = z.object({
  capabilities: z.array(z.enum(WORKFLOW_CAPABILITIES)).max(WORKFLOW_CAPABILITIES.length),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; memberId: string }> },
) {
  let enforcement: InlineEnforcementHandle | undefined;
  try {
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id: organizationId, memberId } = await params;

    // body parse + zod validation (whitelist 강제)
    const rawBody = await request.json().catch(() => null);
    const parsed = PatchBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Invalid body — capabilities must be an array of LAB_MANAGER / APPROVER / REQUESTER",
          details: parsed.error.flatten(),
        },
        { status: 400 },
      );
    }
    const { capabilities } = parsed.data;

    // Security enforcement (audit log via enforcement.complete/fail)
    enforcement = enforceAction({
      userId: session.user.id,
      userRole: session.user.role ?? undefined,
      action: "member_capabilities_change",
      targetEntityType: "organization",
      targetEntityId: memberId,
      sourceSurface: "org-members-capabilities-api",
      routePath: "/api/organizations/[id]/members/[memberId]/capabilities",
    });
    if (!enforcement.allowed) return enforcement.deny();

    // requester 권한 (OWNER/ADMIN)
    const requesterMembership = await db.organizationMember.findFirst({
      where: {
        userId: session.user.id,
        organizationId,
        role: { in: [OrganizationRole.OWNER, OrganizationRole.ADMIN] },
      },
    });
    if (!requesterMembership) {
      enforcement.fail();
      return NextResponse.json(
        { error: "Forbidden: Admin access required" },
        { status: 403 },
      );
    }

    // target member 가 해당 organization 에 속하는지 검증 (cross-org 차단)
    const targetMember = await db.organizationMember.findFirst({
      where: { id: memberId, organizationId },
    });
    if (!targetMember) {
      enforcement.fail();
      return NextResponse.json(
        { error: "Member not found in this organization" },
        { status: 404 },
      );
    }

    // capabilities update — Json column write
    const updated = await db.organizationMember.update({
      where: { id: memberId },
      data: { workflowCapabilities: capabilities },
      select: {
        id: true,
        userId: true,
        organizationId: true,
        role: true,
        workflowCapabilities: true,
      },
    });

    enforcement.complete({
      beforeState: {
        memberId,
        previousCapabilities: targetMember.workflowCapabilities,
      },
      afterState: { memberId, newCapabilities: capabilities },
    });

    return NextResponse.json({ member: updated });
  } catch (error: any) {
    enforcement?.fail();
    console.error("[organizations/members/capabilities/PATCH] Error:", {
      message: error?.message,
      code: error?.code,
    });
    return NextResponse.json(
      { error: "Failed to update member capabilities" },
      { status: 500 },
    );
  }
}
