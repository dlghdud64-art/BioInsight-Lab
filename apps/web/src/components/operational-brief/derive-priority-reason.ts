/**
 * #operational-brief-critical-evidence-reason-d3 — Phase 2 GREEN
 *
 * 호영님 production 검증 5 axis redesign 의 Batch 2 (D3).
 *
 * spec: "CRITICAL EVIDENCE 가 너무 추상적 — '우선순위: 높음 / 납기: 미제출'
 *       만으로는 왜 높은지 모름. '높음 — 3일 내 납기 확인 필요' 같은 한 줄
 *       이유를 붙이는 것만으로도 차이가 나요."
 *
 * canonical truth lock:
 *   - InboxPriority (p0/p1/p2/p3) + dueState.tone (overdue/due_soon/normal)
 *     2-axis matrix → 한 줄 이유 매핑.
 *   - dueState.label 의 구체 정보 (e.g. "3일 남음") 활용.
 *   - 모든 case graceful — input 분기 미커버 시 dueState.label 그대로 fallback.
 */

export type PriorityReasonInput = {
  /** 'p0' | 'p1' | 'p2' | 'p3' */
  priority: string;
  dueState: {
    label: string;
    isOverdue: boolean;
    tone: "normal" | "due_soon" | "overdue";
  };
};

/**
 * priority + dueState matrix → 한 줄 이유 텍스트 ("3일 내 납기 확인 필요" 등).
 *
 * 매핑:
 *   - overdue: "납기 X일 초과 — 즉시 처리 필요"
 *   - due_soon (p0/p1): "{label} — 즉시 확인 필요"
 *   - due_soon (p2/p3): "{label} — 확인 권장"
 *   - normal (p0): "긴급 — 우선 처리"
 *   - normal (p1): "높음 — 우선 검토"
 *   - normal (p2/p3): "{label}"
 *   - 기한 없음 + p0/p1: "긴급 — 기한 미설정, 확인 필요"
 *   - 기한 없음 + p2/p3: "기한 미설정"
 */
export function derivePriorityReason(input: PriorityReasonInput): string {
  const { priority, dueState } = input;
  const isUrgent = priority === "p0" || priority === "p1";

  if (dueState.tone === "overdue") {
    return `${dueState.label} — 즉시 처리 필요`;
  }

  if (dueState.label === "기한 없음") {
    return isUrgent ? "긴급 — 기한 미설정, 확인 필요" : "기한 미설정";
  }

  if (dueState.tone === "due_soon") {
    return isUrgent
      ? `${dueState.label} — 즉시 확인 필요`
      : `${dueState.label} — 확인 권장`;
  }

  // normal tone
  if (priority === "p0") return "긴급 — 우선 처리";
  if (priority === "p1") return "높음 — 우선 검토";
  return dueState.label;
}
