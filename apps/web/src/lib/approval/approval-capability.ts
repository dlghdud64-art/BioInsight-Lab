/**
 * §approval-gate-single-source (2026-09-25 · 호영님 판정)
 *
 * **API 가 결재를 받아주는 조건과 화면이 결재를 보여주는 조건을 같은 함수로 만든다.**
 *
 * ── 왜 요금제로 가리지 않는가 (호영님) ──
 * 「요금제로 가리기」 는 **어떤 요금제가 결재를 켠다** 는 전제 위에 있다. 오늘 그런 요금제가 없다:
 *   · FREE 는 approvalPolicy "none"
 *   · 유료는 결제 게이트가 닫혀 있다(CLAUDE.md §유료 결제 오픈 전 게이트)
 *   · 결제해도 webhook 은 Workspace.plan 에 "TEAM" 만 쓴다
 *   · 거기에 ADMIN 0명이면 또 400 이다
 * 즉 결재는 FREE 에서만 막힌 게 아니라 **모든 사용자에게** 막혀 있다.
 * 요금제 라벨로 가리면 그 라벨이 또 하나의 약속이 된다.
 *
 * ── 그래서 ──
 * 판정식은 남기고 **표면을 판정식 뒤에 둔다.** 결재가 실제로 켜지는 날 저절로 보인다.
 * §quote-selection-recorded 의 「선정 완료」 가지와 같은 모양이다.
 *
 * ── 이 모듈이 담는 것 ──
 * `request-approval` 라우트의 **400 두 개를 그대로** 담는다. 라우트도 화면도 여기만 부른다.
 *   ① 정책이 in_app_approval 이 아님   → APPROVAL_POLICY_NOT_ENABLED
 *   ② 결재자가 없음                     → APPROVER_NOT_FOUND
 *
 * 🛑 순수 함수다 · DB 접근 0 · Prisma import 0. 클라이언트 컴포넌트가 직접 써도 된다.
 *    (서버 축 카운트는 `approval-capability.server.ts` 가 맡는다 — 그쪽만 db 를 본다.)
 *
 * ⚠️ 자기 한계 — **금액 구간은 여기서 보지 않는다.**
 *    라우트의 결재자 선정(`selectApproverByAmount`)은 금액 tier 로 후보를 좁히고,
 *    high tier(기본 1,000만원 이상)에서는 self_admin 을 **막는다**(escalation 정합).
 *    화면은 견적 금액을 모르는 자리(퍼널·지원센터)에서도 판정해야 하므로
 *    여기서는 「결재자가 **한 명이라도** 있는가」 만 본다.
 *    → 워크스페이스 ADMIN 이 요청자 본인 하나뿐이고 금액이 high tier 인 견적은
 *      화면이 보여주고 라우트가 400 을 낸다. 그 경우는 **라우트가 정본**이고, 좁히는 것은
 *      금액을 아는 자리(견적 상세)의 몫이다. 이 한계를 지우려면 화면에 금액을 들려보내야 한다.
 */

import { resolveApprovalPolicyForPlan } from "@/lib/billing/plan-descriptor";

/** 결재 요청이 막히는 이유. 라우트의 400 두 개와 1:1 이다. */
export type ApprovalBlockReason = "policy_not_enabled" | "no_approver";

export interface ApprovalCapabilityInput {
  /** Workspace.plan */
  workspacePlan: string | null;
  /** Workspace.stripePriceId — SKU 판별자. 빠뜨리면 Pro 가 Basic 으로 떨어진다. */
  workspaceStripePriceId: string | null;
  /** 결재자로 지정될 수 있는 사람 수(워크스페이스 ADMIN + 조직 OWNER/ADMIN). */
  approverCount: number;
}

/** ① 라우트 400 `APPROVAL_POLICY_NOT_ENABLED` 와 같은 판정. */
export function isApprovalPolicyEnabled(
  workspacePlan: string | null,
  workspaceStripePriceId: string | null,
): boolean {
  return (
    resolveApprovalPolicyForPlan(workspacePlan, workspaceStripePriceId) ===
    "in_app_approval"
  );
}

/** ② 라우트 400 `APPROVER_NOT_FOUND` 와 같은 판정. */
export function hasApproverCandidate(approverCount: number): boolean {
  return approverCount > 0;
}

/** 두 술어의 합성. 막힌 이유를 돌려주고, 막히지 않으면 null 이다. */
export function approvalBlockReason(
  input: ApprovalCapabilityInput,
): ApprovalBlockReason | null {
  if (!isApprovalPolicyEnabled(input.workspacePlan, input.workspaceStripePriceId)) {
    return "policy_not_enabled";
  }
  if (!hasApproverCandidate(input.approverCount)) {
    return "no_approver";
  }
  return null;
}

/**
 * 화면이 부르는 단일 판정.
 * 🛑 화면이 요금제 이름(`plan === "TEAM"` 같은 것)을 직접 읽는 곳은 0이어야 한다.
 */
export function canRequestApproval(input: ApprovalCapabilityInput): boolean {
  return approvalBlockReason(input) === null;
}

/** 라우트가 400 에 실어 보내는 문구. 사유와 문구가 갈리지 않게 여기 둔다. */
export const APPROVAL_BLOCK_MESSAGE: Record<ApprovalBlockReason, string> = {
  policy_not_enabled:
    "결재 정책이 활성화되지 않은 플랜입니다. R&D Operations 또는 Enterprise 플랜으로 업그레이드 후 사용 가능합니다.",
  no_approver:
    "결재자가 미설정 상태입니다. 워크스페이스에 ADMIN 권한 사용자를 추가해 주세요.",
};
