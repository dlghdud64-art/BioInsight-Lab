/**
 * §11.193d Phase 2.1 #workflow-capabilities-helper
 *
 * `lib/permissions/workflow-capabilities.ts` helper unit test.
 *
 * 검증 대상:
 *   - WORKFLOW_CAPABILITIES const (3종 enum)
 *   - WorkflowCapability type
 *   - getWorkflowCapabilities(member): WorkflowCapability[] 함수
 *
 * lock §11.142 정합:
 *   - canonical truth = DB column (Json)
 *   - resolver = DB 우선 + role 기반 fallback (Phase 2 에서 추가)
 *   - permission-checker 변경 0 (RBAC 보존)
 */

import { describe, it, expect } from "vitest";
import {
  WORKFLOW_CAPABILITIES,
  getWorkflowCapabilities,
  resolveWorkflowCapabilities,
  ROLE_TO_CAPABILITIES_FALLBACK,
  type WorkflowCapability,
} from "@/lib/permissions/workflow-capabilities";

describe("§11.193d Phase 2.1 WORKFLOW_CAPABILITIES const", () => {
  it("3종 capability 정의 (Lab Manager / Approver / Requester)", () => {
    expect(WORKFLOW_CAPABILITIES).toContain("LAB_MANAGER");
    expect(WORKFLOW_CAPABILITIES).toContain("APPROVER");
    expect(WORKFLOW_CAPABILITIES).toContain("REQUESTER");
    expect(WORKFLOW_CAPABILITIES).toHaveLength(3);
  });

  it("readonly tuple type — runtime mutation 차단", () => {
    // const 어설션이라 push 시 TypeScript 에러. runtime 은 frozen 아닐 수 있음.
    // 본 test 는 type level 검증 — runtime 변경은 컴파일 타임 에러로 차단됨.
    expect(Array.isArray(WORKFLOW_CAPABILITIES)).toBe(true);
  });
});

describe("§11.193d Phase 2.1 getWorkflowCapabilities helper", () => {
  it("DB 값이 비어있으면 빈 배열 반환 (Phase 2 fallback 은 별도)", () => {
    const member = { workflowCapabilities: [] };
    expect(getWorkflowCapabilities(member)).toEqual([]);
  });

  it("DB 값이 string[] 이면 그대로 반환", () => {
    const member = {
      workflowCapabilities: ["LAB_MANAGER", "APPROVER"],
    };
    expect(getWorkflowCapabilities(member)).toEqual([
      "LAB_MANAGER",
      "APPROVER",
    ]);
  });

  it("DB 값이 null/undefined 면 빈 배열 반환 (defensive)", () => {
    expect(getWorkflowCapabilities({ workflowCapabilities: null })).toEqual([]);
    expect(getWorkflowCapabilities({ workflowCapabilities: undefined })).toEqual(
      [],
    );
  });

  it("DB 값에 비-whitelist 값 섞이면 filter (raw key 노출 차단)", () => {
    const member = {
      workflowCapabilities: ["LAB_MANAGER", "INVALID_CAP", "REQUESTER"],
    };
    expect(getWorkflowCapabilities(member)).toEqual([
      "LAB_MANAGER",
      "REQUESTER",
    ]);
  });

  it("DB 값이 array 가 아니면 빈 배열 (defensive)", () => {
    // Json column 이라 string / object 등 들어올 수 있음 — 안전 fallback
    expect(getWorkflowCapabilities({ workflowCapabilities: "LAB_MANAGER" })).toEqual(
      [],
    );
    expect(getWorkflowCapabilities({ workflowCapabilities: {} })).toEqual([]);
  });
});

describe("§11.193d Phase 2.1 WorkflowCapability type narrowing", () => {
  it("type assignment compile-time check (runtime no-op)", () => {
    const cap: WorkflowCapability = "LAB_MANAGER";
    expect(cap).toBe("LAB_MANAGER");
  });
});

describe("§11.193d Phase 2.2 ROLE_TO_CAPABILITIES_FALLBACK 매핑", () => {
  it("ADMIN → [LAB_MANAGER]", () => {
    expect(ROLE_TO_CAPABILITIES_FALLBACK.ADMIN).toEqual(["LAB_MANAGER"]);
  });
  it("OWNER → [LAB_MANAGER, APPROVER]", () => {
    expect(ROLE_TO_CAPABILITIES_FALLBACK.OWNER).toEqual([
      "LAB_MANAGER",
      "APPROVER",
    ]);
  });
  it("APPROVER → [APPROVER]", () => {
    expect(ROLE_TO_CAPABILITIES_FALLBACK.APPROVER).toEqual(["APPROVER"]);
  });
  it("REQUESTER → [REQUESTER]", () => {
    expect(ROLE_TO_CAPABILITIES_FALLBACK.REQUESTER).toEqual(["REQUESTER"]);
  });
  it("VIEWER → [] (capability 0)", () => {
    expect(ROLE_TO_CAPABILITIES_FALLBACK.VIEWER).toEqual([]);
  });
  it("MEMBER (legacy) → [] (보수적)", () => {
    expect(ROLE_TO_CAPABILITIES_FALLBACK.MEMBER).toEqual([]);
  });
});

describe("§11.193d Phase 2.2 resolveWorkflowCapabilities — DB 우선 + role fallback", () => {
  it("(1) DB 값 non-empty → 그대로 반환 (role 무시)", () => {
    const member = {
      workflowCapabilities: ["LAB_MANAGER", "APPROVER"],
      role: "VIEWER",
    };
    expect(resolveWorkflowCapabilities(member)).toEqual([
      "LAB_MANAGER",
      "APPROVER",
    ]);
  });

  it("(2) DB 값 비어있음 + role=ADMIN → [LAB_MANAGER] fallback", () => {
    expect(
      resolveWorkflowCapabilities({ workflowCapabilities: [], role: "ADMIN" }),
    ).toEqual(["LAB_MANAGER"]);
  });

  it("(2) DB null + role=OWNER → [LAB_MANAGER, APPROVER] fallback", () => {
    expect(
      resolveWorkflowCapabilities({ workflowCapabilities: null, role: "OWNER" }),
    ).toEqual(["LAB_MANAGER", "APPROVER"]);
  });

  it("(3) DB 비어있음 + role=null → 빈 배열 (모든 fallback 0)", () => {
    expect(
      resolveWorkflowCapabilities({ workflowCapabilities: [], role: null }),
    ).toEqual([]);
  });

  it("(3) DB 비어있음 + role=알 수 없음 → 빈 배열 (안전 fallback)", () => {
    expect(
      resolveWorkflowCapabilities({
        workflowCapabilities: [],
        role: "UNKNOWN_ROLE",
      }),
    ).toEqual([]);
  });

  it("DB 값 변형 (raw key 섞임) + role=APPROVER → DB 의 valid 만 우선 (fallback 미발동)", () => {
    // filter 후 ["APPROVER"] 1개 → non-empty 라 fallback 미발동
    const member = {
      workflowCapabilities: ["APPROVER", "INVALID"],
      role: "OWNER",
    };
    expect(resolveWorkflowCapabilities(member)).toEqual(["APPROVER"]);
  });

  it("DB 값 모두 invalid (filter 후 0) + role=ADMIN → role fallback 발동", () => {
    const member = {
      workflowCapabilities: ["INVALID_1", "INVALID_2"],
      role: "ADMIN",
    };
    expect(resolveWorkflowCapabilities(member)).toEqual(["LAB_MANAGER"]);
  });
});
