/**
 * §11.209d-approver-routing — 결재자 자동 매핑 helper.
 *
 * canonical truth (audit 발견):
 *   - WorkspaceMemberRole = ADMIN / MEMBER (OWNER 없음)
 *   - OrganizationRole = VIEWER / REQUESTER / APPROVER / ADMIN / OWNER
 *   - Workspace ↔ Organization 1:1 (Workspace.organizationId @unique, NOT NULL)
 *
 * 매트릭스 (default — admin UI/env override 별도 batch):
 *   - amount < 10_000_000 → workspace ADMIN 첫 (본인 외) → self_admin fallback
 *   - amount >= 10_000_000 → org OWNER 첫 (본인 외) → org ADMIN fallback
 *     → workspace ADMIN fallback
 *
 * source 필드 (audit 추적성):
 *   - workspace_admin / org_owner / org_admin / self_admin
 *
 * Lock:
 *   - 본인 외 우선 (requester !== approver, self-approval 차단)
 *   - single-admin workspace 호환 (self_admin fallback)
 *   - read-only DB query — mutation atomic 영향 0
 */

import { db } from "@/lib/db";

// ── 임계치 상수 (1,000만원) ──

export const APPROVAL_OWNER_ESCALATION_THRESHOLD_KRW = 10_000_000;

// ── 반환 type ──

export type ApproverSource =
  | "workspace_admin"
  | "org_owner"
  | "org_admin"
  | "self_admin";

export interface ApproverCandidate {
  userId: string;
  email: string | null;
  name: string | null;
  source: ApproverSource;
}

// ── helper ──

export interface SelectApproverArgs {
  workspaceId: string;
  organizationId: string;
  totalAmount: number;
  requesterId: string;
}

/**
 * 결재 금액 + workspace/organization 컨텍스트로 결재자 자동 매핑.
 * fallback chain 정합:
 *   고액 → org_owner → org_admin → workspace_admin → null
 *   저액 → workspace_admin → self_admin → null
 *
 * 모든 후보 0 시 null 반환 — caller (request-approval route) 가 400 처리.
 */
export async function selectApproverByAmount(
  args: SelectApproverArgs,
): Promise<ApproverCandidate | null> {
  const { workspaceId, organizationId, totalAmount, requesterId } = args;

  // 1. 고액 escalation — organization OWNER 우선
  if (totalAmount >= APPROVAL_OWNER_ESCALATION_THRESHOLD_KRW) {
    const ownerMember = await db.organizationMember.findFirst({
      where: {
        organizationId,
        role: "OWNER",
        userId: { not: requesterId },
      },
      include: { user: { select: { email: true, name: true } } },
    });
    if (ownerMember?.user) {
      return {
        userId: ownerMember.userId,
        email: ownerMember.user.email,
        name: ownerMember.user.name,
        source: "org_owner",
      };
    }

    // 2. OWNER 없음 → organization ADMIN fallback
    const orgAdmin = await db.organizationMember.findFirst({
      where: {
        organizationId,
        role: "ADMIN",
        userId: { not: requesterId },
      },
      include: { user: { select: { email: true, name: true } } },
    });
    if (orgAdmin?.user) {
      return {
        userId: orgAdmin.userId,
        email: orgAdmin.user.email,
        name: orgAdmin.user.name,
        source: "org_admin",
      };
    }
    // org-level 모두 없음 → workspace fallback (아래 일반 흐름)
  }

  // 3. 일반 결재 — workspace ADMIN (본인 외)
  const wsAdmin = await db.workspaceMember.findFirst({
    where: {
      workspaceId,
      role: "ADMIN",
      userId: { not: requesterId },
    },
    include: { user: { select: { email: true, name: true } } },
  });
  if (wsAdmin?.user) {
    return {
      userId: wsAdmin.userId,
      email: wsAdmin.user.email,
      name: wsAdmin.user.name,
      source: "workspace_admin",
    };
  }

  // 4. fallback — single-admin workspace (본인 ADMIN 도 가능)
  // 단 고액 분기에서는 self_admin fallback 의도적 회피 — caller 가 escalation
  // 정합 위해 OWNER/orgADMIN 확보 필요. 저액에서만 self_admin fallback.
  if (totalAmount < APPROVAL_OWNER_ESCALATION_THRESHOLD_KRW) {
    const selfAdmin = await db.workspaceMember.findFirst({
      where: { workspaceId, role: "ADMIN" },
      include: { user: { select: { email: true, name: true } } },
    });
    if (selfAdmin?.user) {
      return {
        userId: selfAdmin.userId,
        email: selfAdmin.user.email,
        name: selfAdmin.user.name,
        source: "self_admin",
      };
    }
  }

  return null;
}
