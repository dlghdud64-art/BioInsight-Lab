// @ts-nocheck — vitest 미설치 환경에서 타입 체크 bypass
/**
 * Ontology Next-Action Resolver — Support Recovery Mode 테스트
 *
 * Scenario 1: Support direct entry (sourceContext 없음) → null
 * Scenario 2: Source route 만 존재 → "원래 작업으로 복귀" + 런북 + 티켓
 * Scenario 3: Source entityId 까지 있음 → "<entityId> 로 복귀" primary
 * Scenario 4: classifyRoute 가 /dashboard/support-center 를 감지
 * Scenario 5: unknown route 는 null 반환 (global launcher 회귀 차단)
 * Scenario 6: Empty overview (계정 없음/새 사용자) 는 null 반환
 */

import { describe, it, expect } from "vitest";

import {
  resolveNextAction,
  classifyRoute,
  type ContextualActionInput,
  type ContextualCounts,
} from "../ontology-next-action-resolver";

const EMPTY_COUNTS: ContextualCounts = {
  compareIds: 0,
  quoteItems: 0,
  pendingQuotes: 0,
  pendingApprovals: 0,
  activePoConversions: 0,
  dispatchPrepItems: 0,
  pendingReceiving: 0,
};

function baseInput(overrides: Partial<ContextualActionInput> = {}): ContextualActionInput {
  return {
    currentRoute: "support_center",
    selectedEntityIds: [],
    selectedEntityType: "none",
    currentStage: null,
    activeBlockers: [],
    snapshotValid: true,
    policyHoldActive: false,
    hasPendingCriticalEvents: false,
    activeWorkWindow: null,
    counts: EMPTY_COUNTS,
    ...overrides,
  };
}

describe("classifyRoute", () => {
  it("support-center 경로를 support_center 로 분류", () => {
    expect(classifyRoute("/dashboard/support-center")).toBe("support_center");
    expect(classifyRoute("/dashboard/support-center?tab=manual")).toBe("support_center");
    expect(classifyRoute("/dashboard/support-center?tab=ticket&from=/dashboard/orders"))
      .toBe("support_center");
  });
});

describe("resolveNextAction — support recovery", () => {
  it("Scenario 1: support direct entry → null (drawer 비노출)", () => {
    const r = resolveNextAction(baseInput({ sourceContext: null }));
    expect(r).toBeNull();
  });

  it("Scenario 1b: sourceContext 자체가 undefined 여도 null", () => {
    const r = resolveNextAction(baseInput());
    expect(r).toBeNull();
  });

  it("Scenario 2: sourceRoute 만 있음 → '원래 작업으로 복귀'", () => {
    const r = resolveNextAction(
      baseInput({
        sourceContext: { sourceRoute: "/dashboard/orders" },
      }),
    );
    expect(r).not.toBeNull();
    expect(r!.nextRequiredAction.label).toContain("복귀");
    expect(r!.nextRequiredAction.targetRoute).toBe("/dashboard/orders");
    expect(r!.availableFollowUpActions.length).toBeGreaterThanOrEqual(2);
    // secondary 에 런북 / 티켓 생성 포함
    const followLabels = r!.availableFollowUpActions.map((a) => a.label);
    expect(followLabels.some((l) => l.includes("런북"))).toBe(true);
    expect(followLabels.some((l) => l.includes("티켓"))).toBe(true);
  });

  it("Scenario 3: sourceEntityId 있음 → entityId 복귀 라벨", () => {
    const r = resolveNextAction(
      baseInput({
        sourceContext: {
          sourceRoute: "/dashboard/quotes/QT-20260310-001",
          sourceEntityType: "quote",
          sourceEntityId: "QT-20260310-001",
        },
      }),
    );
    expect(r).not.toBeNull();
    expect(r!.nextRequiredAction.label).toContain("QT-20260310-001");
    // 티켓 생성 secondary 에 sourceEntity 정보가 URL 로 실림
    const ticketAction = r!.availableFollowUpActions.find((a) =>
      a.label.includes("티켓"),
    );
    expect(ticketAction?.targetRoute).toContain("source=");
    expect(ticketAction?.targetRoute).toContain("QT-20260310-001");
  });

  it("Scenario 4: recovery result 의 mode 는 contextual (overview 아님)", () => {
    const r = resolveNextAction(
      baseInput({
        sourceContext: { sourceRoute: "/dashboard/orders" },
      }),
    );
    expect(r!.mode).toBe("contextual");
  });
});

describe("resolveNextAction — global launcher 회귀 차단", () => {
  it("Scenario 5: unknown route + 아무 counts 없음 → null", () => {
    const r = resolveNextAction(baseInput({ currentRoute: "unknown" }));
    expect(r).toBeNull();
  });

  it("Scenario 6: dashboard_overview + 아무 counts 없음 → null (대시보드 열기 금지)", () => {
    const r = resolveNextAction(baseInput({ currentRoute: "dashboard_overview" }));
    expect(r).toBeNull();
  });

  it("Scenario 7: dashboard_overview + 진행 중 작업 있음 → non-null", () => {
    const r = resolveNextAction(
      baseInput({
        currentRoute: "dashboard_overview",
        counts: { ...EMPTY_COUNTS, pendingApprovals: 3 },
      }),
    );
    expect(r).not.toBeNull();
    expect(r!.nextRequiredAction.label).toContain("승인");
  });
});
