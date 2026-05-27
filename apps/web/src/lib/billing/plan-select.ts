/**
 * Plan selection destination resolver
 *
 * 단일 진입점으로 플랜 선택 시 라우팅 대상을 결정한다.
 * pricing 카드 CTA에서 직접 `/auth/signin`으로 보내는 안티패턴을 막고,
 * 세션 / 워크스페이스 / 권한 / 구독 상태를 종합 판단해 올바른 목적지로 보낸다.
 *
 * 이 모듈은 절대 로그인된 사용자를 로그인 페이지로 보내지 않는다.
 */

import type { Session } from "next-auth";
import { db } from "@/lib/db";

export type PlanIntent = "starter" | "team" | "business" | "enterprise";

export const PLAN_INTENT_VALUES: readonly PlanIntent[] = [
  "starter",
  "team",
  "business",
  "enterprise",
];

/** 사용자 의도를 내부 WorkspacePlan enum으로 매핑 */
export function intentToWorkspacePlan(
  intent: PlanIntent
): "FREE" | "TEAM" | "ENTERPRISE" | null {
  switch (intent) {
    case "starter":
      return "FREE";
    case "team":
      return "TEAM";
    case "business":
      // 현재 WorkspacePlan은 FREE | TEAM | ENTERPRISE로만 구성.
      // Business 도 결제 대상이므로 TEAM 계층으로 보내되,
      // Stripe price id 매핑은 별도 레이어에서 business 용으로 해석한다.
      return "TEAM";
    case "enterprise":
      return "ENTERPRISE";
    default:
      return null;
  }
}

export type PlanSelectionDestination =
  | { kind: "login"; url: string; reason: string }
  | { kind: "create_workspace"; url: string; reason: string }
  | { kind: "permission_denied"; url: string; workspaceId: string; reason: string }
  | { kind: "checkout"; url: string; workspaceId: string; plan: PlanIntent }
  | { kind: "billing_portal"; url: string; workspaceId: string; reason: string }
  | { kind: "already_on_plan"; url: string; workspaceId: string; plan: PlanIntent }
  | { kind: "contact_sales"; url: string; plan: PlanIntent }
  | { kind: "start_free"; url: string };

export interface ResolvePlanSelectionInput {
  session: Session | null;
  selectedPlan: PlanIntent;
  /** 클라이언트에서 현재 활성 워크스페이스가 있다면 지정 */
  currentWorkspaceId?: string | null;
}

/**
 * 플랜 선택 목적지 결정
 *
 * 우선순위
 *  1) 비로그인         → /auth/signin?plan=...&callbackUrl=/pricing/continue?plan=...
 *  2) 로그인, 워크스페이스 없음 → /dashboard?onboarding=workspace&plan=...
 *  3) Starter(FREE)    → /dashboard (이미 기본 플랜이므로 대시보드로)
 *  4) Enterprise        → /support?topic=enterprise (영업 상담)
 *  5) 워크스페이스 있음, billing 권한 없음 → /billing?error=permission_denied
 *  6) 이미 활성 구독(같은 플랜) → /billing?status=already_active&plan=...
 *  7) 이미 활성 구독(다른 플랜) → /billing (플랜 변경 플로우)
 *  8) 권한 있고 구독 없음 → /dashboard/settings/plans?plan=...&intent=checkout
 */
export async function resolvePlanSelectionDestination(
  input: ResolvePlanSelectionInput
): Promise<PlanSelectionDestination> {
  const { session, selectedPlan, currentWorkspaceId } = input;
  const preservedPlan = encodeURIComponent(selectedPlan);

  // 1) 비로그인 → login (selectedPlan + returnTo 보존)
  if (!session?.user?.id) {
    const callbackUrl = encodeURIComponent(
      `/pricing/continue?plan=${preservedPlan}`
    );
    return {
      kind: "login",
      url: `/auth/signin?plan=${preservedPlan}&callbackUrl=${callbackUrl}`,
      reason: "no_session",
    };
  }

  const userId = session.user.id;

  // 4) Enterprise 는 workspace 상태 상관없이 영업 상담으로
  if (selectedPlan === "enterprise") {
    return {
      kind: "contact_sales",
      url: `/support?topic=enterprise&plan=${preservedPlan}`,
      plan: selectedPlan,
    };
  }

  // 현재 워크스페이스 해석: header/param → fallback 으로 최근 활성 워크스페이스
  const resolvedWorkspaceId = await resolveCurrentWorkspaceId(
    userId,
    currentWorkspaceId ?? null
  );

  // 2) 로그인 O, 워크스페이스 없음 → onboarding
  if (!resolvedWorkspaceId) {
    // Starter 면 워크스페이스 없이도 기본 사용 가능 → 대시보드
    if (selectedPlan === "starter") {
      return { kind: "start_free", url: `/dashboard?plan=${preservedPlan}` };
    }
    return {
      kind: "create_workspace",
      url: `/dashboard?onboarding=workspace&plan=${preservedPlan}`,
      reason: "no_workspace",
    };
  }

  // 3) Starter → 이미 기본 플랜. 대시보드로 안내.
  if (selectedPlan === "starter") {
    return {
      kind: "start_free",
      url: `/dashboard?plan=${preservedPlan}`,
    };
  }

  // 워크스페이스 + 권한 + 구독 상태 조회
  const [member, workspace] = await Promise.all([
    db.workspaceMember.findFirst({
      where: { workspaceId: resolvedWorkspaceId, userId },
      select: { role: true },
    }),
    db.workspace.findUnique({
      where: { id: resolvedWorkspaceId },
      select: {
        id: true,
        plan: true,
        billingStatus: true,
        stripeSubscriptionId: true,
      },
    }),
  ]);

  // 5) billing 권한 없음 (ADMIN 아님) → permission_denied
  if (!member || member.role !== "ADMIN") {
    return {
      kind: "permission_denied",
      url: `/billing?error=permission_denied&plan=${preservedPlan}`,
      workspaceId: resolvedWorkspaceId,
      reason: "not_workspace_admin",
    };
  }

  if (!workspace) {
    // 극히 예외적 — 권한은 있지만 workspace 조회 실패
    return {
      kind: "create_workspace",
      url: `/dashboard?onboarding=workspace&plan=${preservedPlan}`,
      reason: "workspace_missing",
    };
  }

  const hasActiveSubscription =
    Boolean(workspace.stripeSubscriptionId) &&
    (workspace.billingStatus === "ACTIVE" ||
      workspace.billingStatus === "TRIALING");

  const targetPlan = intentToWorkspacePlan(selectedPlan);

  // 6) 이미 같은 플랜으로 활성 구독
  if (hasActiveSubscription && targetPlan && workspace.plan === targetPlan) {
    return {
      kind: "already_on_plan",
      url: `/billing?status=already_active&plan=${preservedPlan}`,
      workspaceId: resolvedWorkspaceId,
      plan: selectedPlan,
    };
  }

  // 7) 다른 플랜 활성 구독 → billing portal / 플랜 변경 플로우
  if (hasActiveSubscription) {
    return {
      kind: "billing_portal",
      url: `/billing?action=change_plan&plan=${preservedPlan}`,
      workspaceId: resolvedWorkspaceId,
      reason: "existing_subscription",
    };
  }

  // 8) 권한 있고 구독 없음 → checkout 시작
  return {
    kind: "checkout",
    url: `/dashboard/settings/plans?plan=${preservedPlan}&intent=checkout&workspaceId=${resolvedWorkspaceId}`,
    workspaceId: resolvedWorkspaceId,
    plan: selectedPlan,
  };
}

/**
 * 현재 워크스페이스 ID 확정.
 *  1) 호출자가 지정한 workspaceId 가 있고 유저가 멤버면 그걸 사용
 *  2) 없거나 접근 불가하면 가장 최근 업데이트된 멤버십의 워크스페이스
 *  3) 전혀 없으면 null
 */
async function resolveCurrentWorkspaceId(
  userId: string,
  suggested: string | null
): Promise<string | null> {
  if (suggested) {
    const member = await db.workspaceMember.findFirst({
      where: { workspaceId: suggested, userId },
      select: { workspaceId: true },
    });
    if (member) return member.workspaceId;
  }

  const fallback = await db.workspaceMember.findFirst({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    select: { workspaceId: true },
  });

  return fallback?.workspaceId ?? null;
}

/** 클라이언트에서 destination.kind 에 따른 사용자 문구를 얻기 위한 헬퍼 */
export function destinationUserMessage(
  dest: PlanSelectionDestination
): { title: string; description: string } {
  switch (dest.kind) {
    case "login":
      return {
        title: "로그인이 필요합니다",
        description: "로그인 후 선택하신 플랜으로 다시 돌아옵니다.",
      };
    case "create_workspace":
      return {
        title: "워크스페이스 생성이 필요합니다",
        description: "플랜은 워크스페이스 단위로 적용됩니다. 먼저 워크스페이스를 설정해 주세요.",
      };
    case "permission_denied":
      return {
        title: "결제 권한이 없습니다",
        description: "워크스페이스 Admin 만 플랜을 변경할 수 있습니다. 조직 관리자에게 요청해 주세요.",
      };
    case "already_on_plan":
      return {
        title: "이미 해당 플랜을 사용 중입니다",
        description: "현재 구독 상태를 확인하실 수 있습니다.",
      };
    case "billing_portal":
      return {
        title: "기존 구독이 있습니다",
        description: "Billing 포털에서 플랜 변경을 진행해 주세요.",
      };
    case "contact_sales":
      return {
        title: "엔터프라이즈 도입 상담",
        description: "운영 범위를 함께 설계합니다. 상담 요청으로 연결됩니다.",
      };
    case "start_free":
      return {
        title: "Starter 플랜으로 시작합니다",
        description: "대시보드로 이동합니다.",
      };
    case "checkout":
      return {
        title: "결제 단계로 이동합니다",
        description: "선택하신 플랜의 결제 화면으로 이동합니다.",
      };
  }
}
