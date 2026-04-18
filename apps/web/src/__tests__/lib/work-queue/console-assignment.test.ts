/**
 * Console Assignment & Handoff Tests
 *
 * 배정 상태 결정, 전이 규칙, 액션 검증, 뷰 필터링, 인수인계 검증.
 */

import {
  resolveAssignmentState,
  canTransition,
  validateAction,
  buildHandoffPayload,
  extractHandoffInfo,
  isMyWork,
  isUnassigned,
  shouldActorAct,
  filterForView,
  getAvailableActions,
  ASSIGNMENT_STATE_DEFS,
  ASSIGNMENT_ACTION_DEFS,
  type AssignmentState,
  type AssignmentAction,
  type ConsoleView,
} from "@/lib/work-queue/console-assignment";

// ── Test Helpers ──

function makeAssignmentItem(overrides: {
  assigneeId?: string | null;
  metadata?: Record<string, unknown>;
  taskStatus?: string;
} = {}) {
  return {
    assigneeId: overrides.assigneeId ?? null,
    metadata: overrides.metadata ?? {},
    taskStatus: overrides.taskStatus ?? "ACTION_NEEDED",
  };
}

// ── 1. resolveAssignmentState (4 tests) ──

describe("resolveAssignmentState", () => {
  test("returns unassigned when no assigneeId and no metadata state", () => {
    expect(resolveAssignmentState(makeAssignmentItem())).toBe("unassigned");
  });

  test("returns assigned when assigneeId is set without explicit metadata", () => {
    expect(
      resolveAssignmentState(makeAssignmentItem({ assigneeId: "user-1" }))
    ).toBe("assigned");
  });

  test("returns resolved when taskStatus is COMPLETED regardless of assigneeId", () => {
    expect(
      resolveAssignmentState(makeAssignmentItem({ assigneeId: "user-1", taskStatus: "COMPLETED" }))
    ).toBe("resolved");
  });

  test("returns explicit metadata state when set", () => {
    expect(
      resolveAssignmentState(
        makeAssignmentItem({
          assigneeId: "user-1",
          metadata: { assignmentState: "in_progress" },
        })
      )
    ).toBe("in_progress");
  });
});

// ── 2. canTransition (3 tests) ──

describe("canTransition", () => {
  test("unassigned → assigned via claim is valid", () => {
    expect(canTransition("unassigned", "claim")).toBe(true);
  });

  test("assigned → blocked via mark_blocked is invalid (must go through in_progress)", () => {
    expect(canTransition("assigned", "mark_blocked")).toBe(false);
  });

  test("handed_off → assigned via claim is valid", () => {
    expect(canTransition("handed_off", "claim")).toBe(true);
  });
});

// ── 3. validateAction (3 tests) ──

describe("validateAction", () => {
  test("hand_off without note is invalid", () => {
    const result = validateAction("hand_off", {
      actorUserId: "user-1",
      targetUserId: "user-2",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("사유");
  });

  test("assign without targetUserId is invalid", () => {
    const result = validateAction("assign", {
      actorUserId: "user-1",
    });
    expect(result.valid).toBe(false);
    expect(result.error).toContain("대상 사용자");
  });

  test("claim by org member is valid", () => {
    const result = validateAction("claim", {
      actorUserId: "user-1",
    });
    expect(result.valid).toBe(true);
  });
});

// ── 4. filterForView (4 tests) ──

describe("filterForView", () => {
  const items = [
    makeAssignmentItem({ assigneeId: "user-1", metadata: { assignmentState: "in_progress" } }),
    makeAssignmentItem({ assigneeId: null }),
    makeAssignmentItem({ assigneeId: "user-2", metadata: { assignmentState: "blocked" } }),
    makeAssignmentItem({
      assigneeId: "user-2",
      metadata: {
        assignmentState: "handed_off",
        handoff: {
          note: "인수인계합니다",
          fromUserId: "user-1",
          toUserId: "user-2",
          at: new Date().toISOString(),
          nextAction: "검토",
        },
      },
    }),
    makeAssignmentItem({ assigneeId: "user-1", taskStatus: "COMPLETED" }),
  ];

  test("my_work returns only items assigned to current user (not terminal)", () => {
    const result = filterForView(items, "my_work", "user-1");
    expect(result.length).toBe(1);
    expect(result[0].assigneeId).toBe("user-1");
    expect(result[0].taskStatus).not.toBe("COMPLETED");
  });

  test("unassigned returns only items without assigneeId (not terminal)", () => {
    const result = filterForView(items, "unassigned", "user-1");
    expect(result.length).toBe(1);
    expect(result[0].assigneeId).toBeNull();
  });

  test("team_urgent returns blocked items", () => {
    const result = filterForView(items, "team_urgent", "user-1");
    expect(result.length).toBe(1);
    expect(result[0].metadata.assignmentState).toBe("blocked");
  });

  test("recently_handed_off returns items with recent handoff", () => {
    const result = filterForView(items, "recently_handed_off", "user-1");
    expect(result.length).toBe(1);
    expect(result[0].metadata.assignmentState).toBe("handed_off");
  });
});

// ── 5. Handoff payload round-trip (2 tests) ──

describe("buildHandoffPayload / extractHandoffInfo", () => {
  test("round-trip: build then extract produces correct HandoffInfo", () => {
    const payload = buildHandoffPayload({
      fromUserId: "user-1",
      toUserId: "user-2",
      note: "긴급 건 인수인계합니다",
      nextAction: "벤더 응답 확인",
    });

    const handoff = extractHandoffInfo(payload);
    expect(handoff).not.toBeNull();
    expect(handoff!.fromUserId).toBe("user-1");
    expect(handoff!.toUserId).toBe("user-2");
    expect(handoff!.note).toBe("긴급 건 인수인계합니다");
    expect(handoff!.nextAction).toBe("벤더 응답 확인");
    expect(typeof handoff!.at).toBe("string");
  });

  test("extractHandoffInfo returns null when no handoff data", () => {
    expect(extractHandoffInfo({})).toBeNull();
    expect(extractHandoffInfo({ handoff: "invalid" })).toBeNull();
  });
});

// ── 6. shouldActorAct (2 tests) ──

describe("shouldActorAct", () => {
  test("returns true when item is assigned to actor and state is assigned/in_progress", () => {
    expect(
      shouldActorAct(
        makeAssignmentItem({ assigneeId: "user-1", metadata: { assignmentState: "assigned" } }),
        "user-1"
      )
    ).toBe(true);

    expect(
      shouldActorAct(
        makeAssignmentItem({ assigneeId: "user-1", metadata: { assignmentState: "in_progress" } }),
        "user-1"
      )
    ).toBe(true);
  });

  test("returns false when item is assigned to someone else", () => {
    expect(
      shouldActorAct(
        makeAssignmentItem({ assigneeId: "user-2", metadata: { assignmentState: "assigned" } }),
        "user-1"
      )
    ).toBe(false);
  });
});

// ── 7. getAvailableActions (2 tests) ──

describe("getAvailableActions", () => {
  test("unassigned item offers claim and assign", () => {
    const actions = getAvailableActions(makeAssignmentItem(), "user-1");
    expect(actions).toContain("claim");
    expect(actions).toContain("assign");
  });

  test("resolved item offers no actions", () => {
    const actions = getAvailableActions(
      makeAssignmentItem({ taskStatus: "COMPLETED" }),
      "user-1"
    );
    expect(actions).toEqual([]);
  });
});

// ── 8. State definitions integrity (1 test) ──

describe("ASSIGNMENT_STATE_DEFS", () => {
  test("all states have valid fields and Korean labels", () => {
    for (const def of Object.values(ASSIGNMENT_STATE_DEFS)) {
      expect(def.label.length).toBeGreaterThan(0);
      expect(def.description.length).toBeGreaterThan(0);
      expect(/[\uAC00-\uD7AF]/.test(def.label)).toBe(true);
      expect(Array.isArray(def.allowedTransitions)).toBe(true);
      expect(typeof def.priorityBoost).toBe("number");
    }
  });
});

// ── 9. Action definitions integrity (1 test) ──

describe("ASSIGNMENT_ACTION_DEFS", () => {
  test("all actions reference valid from-states and to-states", () => {
    const validStates = new Set(Object.keys(ASSIGNMENT_STATE_DEFS));
    for (const def of Object.values(ASSIGNMENT_ACTION_DEFS)) {
      expect(validStates.has(def.toState)).toBe(true);
      for (const from of def.fromStates) {
        expect(validStates.has(from)).toBe(true);
      }
      expect(def.activityLogEvent.length).toBeGreaterThan(0);
    }
  });
});
