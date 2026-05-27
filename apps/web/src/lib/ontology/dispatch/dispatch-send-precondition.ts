/**
 * Dispatch Send Precondition Guard
 *
 * 목적:
 *   `Send now` / `Schedule send` irreversible action 이 실제로 잠겨 있는지를
 *   결정하는 마지막 방어선. dispatch-preparation-workbench-handlers 와
 *   dispatch-outbound-store call site 양쪽 모두에서 사용된다.
 *
 * 고정 규칙:
 *   1. canonical truth 변경 X. read-only / pure / deterministic.
 *   2. optimistic unlock 금지. 입력 governance state 가 한 글자라도 blocker 면
 *      `allowed=false` 가 반환되며, caller 는 무조건 존중해야 한다.
 *   3. UI 의 "경고 표시" 와 분리되어 있으며, 본 함수는
 *      buttonDisabled / store mutation gate 의 단일 source of truth 다.
 *   4. governance state 외 별도 입력은 받지 않는다 (po-dispatch-governance-engine
 *      이 이미 모든 결정 자료를 통합한 상태). 그 위에 한 번 더 derived check 만 한다.
 *
 * 차단 조건:
 *   - hardBlockers.length > 0  (snapshot invalidated, policy hold, missing docs, …)
 *   - readiness !== "ready_to_send" 인데 sendNow 를 시도하는 경우
 *   - approvalSnapshotValid === false 또는 conversionSnapshotValid === false
 *   - totalBlockerCount 와 hardBlockers/softBlockers 의 정합성 fail
 *     (방어적 — derived state 가 부패한 경우)
 *
 * 본 모듈은 dispatch-preparation 의 마지막 정문(turnstile)이며,
 * 이 함수가 allow 한 후에만 store.issuePO / scheduleSend 가 호출되어야 한다.
 */

import type {
  DispatchBlocker,
  DispatchPreparationGovernanceState,
} from "@/lib/ai/po-dispatch-governance-engine";

// ══════════════════════════════════════════════
// Result
// ══════════════════════════════════════════════

export type DispatchSendActionKind = "send_now" | "schedule_send";

export interface DispatchSendPreconditionResult {
  /** true 이면 caller 가 실제 mutation 진행 가능 */
  allowed: boolean;
  /** action 별 분리 — UI dock 이 두 버튼을 따로 제어 */
  sendNowAllowed: boolean;
  scheduleSendAllowed: boolean;
  /** block 사유 (allowed=true 면 빈 배열) */
  blockReasons: DispatchSendBlockReason[];
  /** 사용자에게 표시할 1줄 요약 (i18n 친화적, dock tooltip 용) */
  summary: string;
}

export interface DispatchSendBlockReason {
  code: DispatchSendBlockCode;
  message: string;
  /** 해결 hint */
  remediation: string;
  /** 이 block 이 어느 action 을 막았는지 */
  blocks: DispatchSendActionKind[];
}

export type DispatchSendBlockCode =
  | "approval_snapshot_invalid"
  | "conversion_snapshot_invalid"
  | "policy_hold_active"
  | "required_document_missing"
  | "supplier_contact_incomplete"
  | "commercial_terms_missing"
  | "po_data_changed_after_approval"
  | "supplier_profile_changed"
  | "hard_blocker_present"
  | "readiness_not_send_ready"
  | "derived_state_corrupt";

// ══════════════════════════════════════════════
// Block reason mapping
// ══════════════════════════════════════════════

const BLOCKER_TYPE_TO_CODE: Record<string, DispatchSendBlockCode> = {
  snapshot_invalidated: "approval_snapshot_invalid",
  policy_hold_active: "policy_hold_active",
  required_document_missing: "required_document_missing",
  shipping_contact_incomplete: "supplier_contact_incomplete",
  billing_contact_incomplete: "supplier_contact_incomplete",
  commercial_terms_missing: "commercial_terms_missing",
  po_data_changed_after_approval: "po_data_changed_after_approval",
  supplier_profile_changed: "supplier_profile_changed",
  approval_expired: "approval_snapshot_invalid",
  supplier_mismatch: "supplier_contact_incomplete",
};

function blockerToReason(b: DispatchBlocker): DispatchSendBlockReason {
  return {
    code: BLOCKER_TYPE_TO_CODE[b.type] ?? "hard_blocker_present",
    message: b.detail,
    remediation: b.remediationAction,
    // hard blocker 는 두 action 모두 차단. soft 는 send_now 만.
    blocks:
      b.severity === "hard"
        ? ["send_now", "schedule_send"]
        : ["send_now"],
  };
}

// ══════════════════════════════════════════════
// Evaluator
// ══════════════════════════════════════════════

/**
 * dispatch send precondition 을 평가한다.
 * 입력은 이미 evaluateDispatchGovernance 가 만들어 둔 통합 state.
 * 본 함수는 그 위에 한 번 더 derived check 를 수행해 store/handler call 의
 * 마지막 정문 역할을 한다.
 */
export function evaluateDispatchSendPrecondition(
  state: DispatchPreparationGovernanceState | null | undefined,
): DispatchSendPreconditionResult {
  // governance state 가 없으면 무조건 차단 — 미평가 = 미허가
  if (!state) {
    return {
      allowed: false,
      sendNowAllowed: false,
      scheduleSendAllowed: false,
      blockReasons: [
        {
          code: "readiness_not_send_ready",
          message: "Dispatch governance 가 아직 평가되지 않았습니다",
          remediation: "PO/승인/공급사 데이터를 다시 로드한 뒤 시도하세요",
          blocks: ["send_now", "schedule_send"],
        },
      ],
      summary: "발송 조건 평가 전",
    };
  }

  const reasons: DispatchSendBlockReason[] = [];

  // 1) Hard blockers — 모든 send action 차단
  for (const blocker of state.hardBlockers) {
    reasons.push(blockerToReason(blocker));
  }

  // 2) Snapshot validity 이중 확인 (governance engine 이 derived state 를 만들지만,
  //    여기서 한 번 더 명시적으로 검증해 lineage 가 명확해지게 한다)
  if (!state.approvalSnapshotValid) {
    if (!reasons.some((r) => r.code === "approval_snapshot_invalid")) {
      reasons.push({
        code: "approval_snapshot_invalid",
        message: state.snapshotInvalidationReason || "승인 스냅샷이 무효 상태",
        remediation: "재승인을 요청하세요",
        blocks: ["send_now", "schedule_send"],
      });
    }
  }
  if (!state.conversionSnapshotValid) {
    reasons.push({
      code: "conversion_snapshot_invalid",
      message: "PO 전환 스냅샷이 무효 상태",
      remediation: "PO 전환을 다시 실행하세요",
      blocks: ["send_now", "schedule_send"],
    });
  }

  // 3) Readiness 자체가 ready_to_send 가 아니면 send_now 차단
  //    (schedule_send 는 needs_review 까지 허용 — soft blocker 는 발송 시점이
  //    아직 미래이므로 그 사이 보정 가능)
  if (state.readiness !== "ready_to_send") {
    if (state.readiness === "needs_review") {
      // soft blocker 만 있는 경우 — send_now 만 차단
      if (!reasons.some((r) => r.blocks.includes("send_now"))) {
        reasons.push({
          code: "readiness_not_send_ready",
          message: "검토 필요 항목이 있어 즉시 발송이 잠겨 있습니다",
          remediation: "권장 항목을 보강한 후 즉시 발송이 가능합니다",
          blocks: ["send_now"],
        });
      }
    } else {
      // blocked / not_evaluated / cancelled / sent / scheduled 등 — 둘 다 차단
      if (!reasons.some((r) => r.blocks.includes("send_now"))) {
        reasons.push({
          code: "readiness_not_send_ready",
          message: `Readiness 상태(${state.readiness})에서는 발송이 불가합니다`,
          remediation: "차단 사유를 모두 해소한 뒤 다시 시도하세요",
          blocks: ["send_now", "schedule_send"],
        });
      }
    }
  }

  // 4) Derived state 무결성 — totalBlockerCount 가 실제 합과 다르면 부패
  const recomputed = state.hardBlockers.length + state.softBlockers.length;
  if (state.totalBlockerCount !== recomputed) {
    reasons.push({
      code: "derived_state_corrupt",
      message: "Governance state 무결성 검증 실패 (blocker count 불일치)",
      remediation: "페이지를 새로고침해 governance state 를 재평가하세요",
      blocks: ["send_now", "schedule_send"],
    });
  }

  const sendNowBlocked = reasons.some((r) => r.blocks.includes("send_now"));
  const scheduleSendBlocked = reasons.some((r) =>
    r.blocks.includes("schedule_send"),
  );

  const sendNowAllowed = !sendNowBlocked;
  const scheduleSendAllowed = !scheduleSendBlocked;
  const allowed = sendNowAllowed || scheduleSendAllowed;

  let summary: string;
  if (allowed && sendNowAllowed && scheduleSendAllowed) {
    summary = "발송 가능";
  } else if (scheduleSendAllowed && !sendNowAllowed) {
    summary = "예약 발송만 가능 (즉시 발송 잠김)";
  } else {
    summary =
      reasons[0]?.message ?? "발송 차단 사유 미상";
  }

  return {
    allowed,
    sendNowAllowed,
    scheduleSendAllowed,
    blockReasons: reasons,
    summary,
  };
}

/**
 * 특정 action 한 가지에 대해서만 빠르게 평가한다.
 * caller 가 한 줄로 `if (!isSendActionAllowed(state, "send_now")) return;` 를
 * 쓸 수 있도록 제공.
 */
export function isSendActionAllowed(
  state: DispatchPreparationGovernanceState | null | undefined,
  action: DispatchSendActionKind,
): boolean {
  const result = evaluateDispatchSendPrecondition(state);
  return action === "send_now" ? result.sendNowAllowed : result.scheduleSendAllowed;
}
