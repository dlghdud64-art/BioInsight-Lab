/**
 * §S2 #approval-limit-server-enforce — per-user 단일건 승인 한도 서버 강제 helper.
 *
 * audit(ONTOLOGY_SECURITY_AUDIT_2026-06-14) S2 HIGH:
 *   approvalLimit(단일 건 결재 한도)이 저장·라우팅 추천에만 반영되고 승인 실행
 *   시점에 재검증되지 않아, 권한 보유 actor 가 자기 한도 초과 건을 직접 승인하던
 *   우회를 차단한다.
 *
 * canonical 한도 검증 패턴(selectApproverByAmount, approver-routing.ts:120-123 정합):
 *   approvalLimit == null → 무제한(통과) / amount <= approvalLimit → 통과 / 초과 → 차단.
 *
 * 순수 함수(DB 의존 0) — 호출 측에서 actor 의 OrganizationMember.approvalLimit 과
 * 대상 금액을 넘겨 사용. 차단 동작 = 403 + 상위 승인자 안내(escalation 자동화는 후속).
 */

export interface ApprovalLimitResult {
  /** true = 승인 진행 허용, false = 한도 초과 차단 */
  allowed: boolean;
  /** 차단 시 사용자 안내 사유(internal key 미포함) */
  reason?: string;
}

/**
 * actor 의 단일건 승인 한도 대비 대상 금액 검증.
 *
 * @param approvalLimit OrganizationMember.approvalLimit (null = 무제한)
 * @param amount 승인 대상 금액(KRW)
 */
export function checkApprovalLimit(
  approvalLimit: number | bigint | null | undefined,
  amount: number,
): ApprovalLimitResult {
  // null/undefined = 한도 미설정 = 무제한(default).
  if (approvalLimit == null) return { allowed: true };
  const limit =
    typeof approvalLimit === "bigint" ? Number(approvalLimit) : approvalLimit;
  if (amount <= limit) return { allowed: true };
  return {
    allowed: false,
    reason:
      "단일 건 승인 한도를 초과하여 직접 승인할 수 없습니다. 상위 승인자가 필요합니다.",
  };
}
