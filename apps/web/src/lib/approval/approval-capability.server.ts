/**
 * §approval-gate-single-source (2026-09-25 · 호영님 판정) · 서버 축.
 *
 * 순수 판정은 `approval-capability.ts` 가 가진다. 이 파일은 **그 판정이 먹을 입력을 모으는 일**만 한다.
 * db 를 보므로 클라이언트 컴포넌트가 import 하면 Prisma 가 번들에 실린다 — 서버에서만 부른다.
 *
 * 🛑 후보 풀은 `lib/billing/approver-routing.ts` 의 tier 매트릭스가 실제로 고르는 집합과 같다:
 *      워크스페이스 ADMIN · 조직 OWNER · 조직 ADMIN (self_admin 도 워크스페이스 ADMIN 이다)
 *    그쪽이 tier 로 **좁히는** 것이고 여기는 「한 명이라도 있는가」 를 본다
 *    (한계는 approval-capability.ts 머리말 참조).
 */

import { db } from "@/lib/db";
import {
  approvalBlockReason,
  canRequestApproval,
  type ApprovalBlockReason,
} from "./approval-capability";

export interface ApprovalCapability {
  enabled: boolean;
  reason: ApprovalBlockReason | null;
}

/** 워크스페이스·조직을 통틀어 결재자가 될 수 있는 사람 수. */
export async function countApproverCandidates(params: {
  workspaceId: string | null | undefined;
  organizationId: string | null | undefined;
}): Promise<number> {
  const { workspaceId, organizationId } = params;
  if (!workspaceId) return 0;

  const [workspaceAdmins, orgApprovers] = await Promise.all([
    db.workspaceMember.count({ where: { workspaceId, role: "ADMIN" } }),
    organizationId
      ? db.organizationMember.count({
          where: { organizationId, role: { in: ["OWNER", "ADMIN"] } },
        })
      : Promise.resolve(0),
  ]);
  return workspaceAdmins + orgApprovers;
}

/**
 * 이 사용자에게 결재 요청이 열려 있는가.
 * 🛑 화면 표면은 **이 결과만** 본다 — 요금제 이름을 직접 읽지 않는다.
 */
export async function resolveApprovalCapability(
  userId: string,
): Promise<ApprovalCapability> {
  const member = await db.workspaceMember.findFirst({
    where: { userId },
    select: {
      workspace: {
        select: { id: true, plan: true, stripePriceId: true, organizationId: true },
      },
    },
  });

  const approverCount = await countApproverCandidates({
    workspaceId: member?.workspace?.id,
    organizationId: member?.workspace?.organizationId,
  });

  const input = {
    workspacePlan: member?.workspace?.plan ?? null,
    workspaceStripePriceId: member?.workspace?.stripePriceId ?? null,
    approverCount,
  };

  return {
    enabled: canRequestApproval(input),
    reason: approvalBlockReason(input),
  };
}
