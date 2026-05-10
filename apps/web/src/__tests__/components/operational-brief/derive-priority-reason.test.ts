/**
 * #operational-brief-critical-evidence-reason-d3 — Phase 1 RED + Phase 2 GREEN
 *
 * 호영님 D3 spec: "우선순위: 높음 / 납기: 미제출"만으로는 왜 높은지 모름.
 * "높음 — 3일 내 납기 확인 필요" 한 줄 이유.
 */

import { describe, it, expect } from "vitest";
import { derivePriorityReason } from "../../../components/operational-brief/derive-priority-reason";

const overdue = { label: "2일 초과", isOverdue: true, tone: "overdue" as const };
const dueSoon3 = { label: "3일 남음", isOverdue: false, tone: "due_soon" as const };
const dueSoon0 = { label: "오늘 마감", isOverdue: false, tone: "due_soon" as const };
const normal = { label: "5일 남음", isOverdue: false, tone: "normal" as const };
const noDeadline = { label: "기한 없음", isOverdue: false, tone: "normal" as const };

describe("#operational-brief-critical-evidence-reason-d3 — overdue tone", () => {
  it("overdue → '즉시 처리 필요' 매핑", () => {
    expect(derivePriorityReason({ priority: "p1", dueState: overdue })).toContain("즉시 처리 필요");
    expect(derivePriorityReason({ priority: "p1", dueState: overdue })).toContain("2일 초과");
  });

  it("priority 무관 overdue 통합", () => {
    expect(derivePriorityReason({ priority: "p3", dueState: overdue })).toContain("즉시 처리 필요");
  });
});

describe("#operational-brief-critical-evidence-reason-d3 — due_soon tone", () => {
  it("p0/p1 + due_soon → '즉시 확인 필요'", () => {
    expect(derivePriorityReason({ priority: "p0", dueState: dueSoon3 })).toBe("3일 남음 — 즉시 확인 필요");
    expect(derivePriorityReason({ priority: "p1", dueState: dueSoon0 })).toBe("오늘 마감 — 즉시 확인 필요");
  });

  it("p2/p3 + due_soon → '확인 권장'", () => {
    expect(derivePriorityReason({ priority: "p2", dueState: dueSoon3 })).toBe("3일 남음 — 확인 권장");
    expect(derivePriorityReason({ priority: "p3", dueState: dueSoon0 })).toBe("오늘 마감 — 확인 권장");
  });
});

describe("#operational-brief-critical-evidence-reason-d3 — normal tone", () => {
  it("p0 + normal → '긴급 — 우선 처리'", () => {
    expect(derivePriorityReason({ priority: "p0", dueState: normal })).toBe("긴급 — 우선 처리");
  });

  it("p1 + normal → '높음 — 우선 검토'", () => {
    expect(derivePriorityReason({ priority: "p1", dueState: normal })).toBe("높음 — 우선 검토");
  });

  it("p2/p3 + normal → dueState.label fallback", () => {
    expect(derivePriorityReason({ priority: "p2", dueState: normal })).toBe("5일 남음");
    expect(derivePriorityReason({ priority: "p3", dueState: normal })).toBe("5일 남음");
  });
});

describe("#operational-brief-critical-evidence-reason-d3 — 기한 없음", () => {
  it("p0/p1 + 기한 없음 → '긴급 — 기한 미설정, 확인 필요'", () => {
    expect(derivePriorityReason({ priority: "p0", dueState: noDeadline })).toBe("긴급 — 기한 미설정, 확인 필요");
    expect(derivePriorityReason({ priority: "p1", dueState: noDeadline })).toBe("긴급 — 기한 미설정, 확인 필요");
  });

  it("p2/p3 + 기한 없음 → '기한 미설정'", () => {
    expect(derivePriorityReason({ priority: "p2", dueState: noDeadline })).toBe("기한 미설정");
    expect(derivePriorityReason({ priority: "p3", dueState: noDeadline })).toBe("기한 미설정");
  });
});
