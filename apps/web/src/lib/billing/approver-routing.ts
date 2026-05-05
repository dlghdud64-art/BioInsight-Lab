/**
 * §11.209d-approver-routing — 결재자 자동 매핑 helper (3 tier 매트릭스).
 *
 * canonical truth (audit 발견):
 *   - WorkspaceMemberRole = ADMIN / MEMBER (OWNER 없음)
 *   - OrganizationRole = VIEWER / REQUESTER / APPROVER / ADMIN / OWNER
 *   - Workspace ↔ Organization 1:1 (Workspace.organizationId @unique, NOT NULL)
 *
 * 매트릭스 (#approver-routing-multi-tier-threshold — 3 tier):
 *   - low (amount < lowThreshold, default 1M)
 *     → workspace_admin → self_admin
 *   - mid (lowThreshold ≤ amount < highThreshold)
 *     → org_admin → workspace_admin → self_admin
 *   - high (amount ≥ highThreshold, default 10M)
 *     → org_owner → org_admin → workspace_admin (self_admin 차단 — escalation)
 *
 * source 필드 (audit 추적성):
 *   - workspace_admin / org_owner / org_admin / self_admin
 *
 * Lock:
 *   - 본인 외 우선 (requester !== approver, self-approval 차단)
 *   - single-admin workspace 호환 (low/mid 의 self_admin fallback)
 *   - high tier 의 self_admin 차단 (escalation 정합)
 *   - read-only DB query — mutation atomic 영향 0
 *   - threshold alias backward compat (직전 single-tier caller 호환)
 */

import { db } from "@/lib/db";

// ── 임계치 상수 ──
// high tier — 1,000만원 이상 → org_owner escalation (직전 batch)
export const APPROVAL_OWNER_ESCALATION_THRESHOLD_KRW = 10_000_000;
// mid tier — 100만원 이상 → org_admin first (#approver-routing-multi-tier-threshold)
export const APPROVAL_ORG_ADMIN_THRESHOLD_KRW = 1_000_000;

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
  /**
   * #approver-routing-multi-tier-threshold — high tier 임계치
   * (≥ 이 금액 → org_owner escalation). 미명시 시
   * APPROVAL_OWNER_ESCALATION_THRESHOLD_KRW (10,000,000) default.
   * 직전 'threshold' alias 도 highThreshold 로 매핑 (backward compat).
   */
  highThreshold?: number;
  /**
   * #approver-routing-multi-tier-threshold — mid tier 시작 임계치
   * (≥ 이 금액 → org_admin first). 미명시 시
   * APPROVAL_ORG_ADMIN_THRESHOLD_KRW (1,000,000) default.
   */
  lowThreshold?: number;
  /**
   * 직전 §11.209d-approver-routing — single-tier alias.
   * highThreshold 로 매핑되어 backward compat 유지.
   * @deprecated highThreshold 사용 권장.
   */
  threshold?: number;
}

/**
 * 결재 금액 + workspace/organization 컨텍스트로 결재자 자동 매핑 (3 tier).
 *
 * Tier 분기:
 *   - high (≥ highThreshold): org_owner → org_admin → workspace_admin → null
 *     (self_admin 차단 — escalation 보호)
 *   - mid (lowThreshold ≤ amount < highThreshold):
 *     org_admin → workspace_admin → self_admin → null
 *   - low (< lowThreshold): workspace_admin → self_admin → null
 *
 * 모든 후보 0 시 null 반환 — caller (request-approval route) 가 400 처리.
 */
export async function selectApproverByAmount(
  args: SelectApproverArgs,
): Promise<ApproverCandidate | null> {
  const { workspaceId, organizationId, totalAmount, requesterId } = args;
  // 임계치 정합 — highThreshold 우선, threshold alias 매핑, default 상수 fallback
  const effectiveHighThreshold =
    args.highThreshold ??
    args.threshold ??
    APPROVAL_OWNER_ESCALATION_THRESHOLD_KRW;
  const effectiveLowThreshold =
    args.lowThreshold ?? APPROVAL_ORG_ADMIN_THRESHOLD_KRW;

  const isHighTier = totalAmount >= effectiveHighThreshold;
  const isMidTier =
    !isHighTier && totalAmount >= effectiveLowThreshold;
  // low tier = !isHighTier && !isMidTier

  // ── HIGH tier: org_owner first ──
  if (isHighTier) {
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

    // OWNER 없음 → organization ADMIN fallback
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
    // org-level 모두 없음 → workspace_admin fallback (아래 일반 흐름)
  }

  // ── MID tier: org_admin first ──
  if (isMidTier) {
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
    // org_admin 없음 → workspace_admin fallback (아래 일반 흐름)
  }

  // ── 일반 결재 — workspace ADMIN (본인 외) ──
  // low tier first / mid+high tier fallback 모두 같은 query
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

  // ── self_admin fallback — high tier 차단 (escalation 보호) ──
  // low + mid tier 만 self_admin 허용 (single-admin workspace/org 정합)
  if (!isHighTier) {
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
