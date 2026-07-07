import { describe, it, expect } from "vitest";
import {
  resolveReceivingStepCode,
  resolveReceivingStepStates,
  resolveReceivingDocState,
} from "../receiving-list-view-model";

describe("§11.334 P3 — 퀵뷰 진행 스텝 파생(시안 setSteps 이식)", () => {
  it("bucketKey → step code", () => {
    expect(resolveReceivingStepCode("waiting_external")).toBe("cur0");
    expect(resolveReceivingStepCode("needs_review")).toBe("cur1");
    expect(resolveReceivingStepCode("blocked")).toBe("alert2");
    expect(resolveReceivingStepCode("ready")).toBe("cur3");
    expect(resolveReceivingStepCode("handoff")).toBe("done4");
  });

  it("step code → 4단계 상태 (i<idx=done, i===idx=kind)", () => {
    expect(resolveReceivingStepStates("cur0")).toEqual(["cur", "idle", "idle", "idle"]);
    expect(resolveReceivingStepStates("cur1")).toEqual(["done", "cur", "idle", "idle"]);
    expect(resolveReceivingStepStates("alert2")).toEqual(["done", "done", "alert", "idle"]);
    expect(resolveReceivingStepStates("cur3")).toEqual(["done", "done", "done", "cur"]);
    expect(resolveReceivingStepStates("done4")).toEqual(["done", "done", "done", "done"]);
  });

  it("문서 상태: blocked=miss, 그 외 ok", () => {
    expect(resolveReceivingDocState("blocked")).toBe("miss");
    expect(resolveReceivingDocState("needs_review")).toBe("ok");
    expect(resolveReceivingDocState("ready")).toBe("ok");
    expect(resolveReceivingDocState("handoff")).toBe("ok");
  });
});
