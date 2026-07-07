import { describe, it, expect } from "vitest";
import {
  buildReceivingFunnel,
  buildReceivingTabCounts,
  resolveReceivingRowVisual,
} from "../receiving-list-view-model";
import type { ModuleBucketKey, ModuleLandingItem } from "@/lib/ops-console/module-landing-adapter";

function item(bucketKey: ModuleBucketKey): ModuleLandingItem {
  return {
    moduleType: "receiving",
    entityId: `e-${bucketKey}-${Math.random()}`,
    title: "t",
    summary: "s",
    bucketKey,
    priority: "p2",
    assignmentState: "담당 배정",
    dueState: { label: "", isOverdue: false, tone: "normal" },
    nextAction: "",
    targetRoute: "/dashboard/receiving/x",
    updatedAt: new Date(0).toISOString(),
  };
}

describe("§11.334 P1 — 입고 퍼널 파생(파이프라인 4단계)", () => {
  it("bucketKey → 퍼널 단계 매핑", () => {
    const items = [
      item("waiting_external"),
      item("needs_review"), item("needs_review"),
      item("blocked"),
      item("ready"),
      item("handoff"), item("handoff"), item("handoff"),
    ];
    expect(buildReceivingFunnel(items)).toEqual({ waiting: 1, review: 2, blocked: 1, posted: 4 });
  });

  it("빈 목록은 전부 0", () => {
    expect(buildReceivingFunnel([])).toEqual({ waiting: 0, review: 0, blocked: 0, posted: 0 });
  });
});

describe("§11.334 P1 — 탭 카운트(처리 필요/전체/완료)", () => {
  it("완료=handoff, 처리 필요=나머지", () => {
    const items = [item("blocked"), item("needs_review"), item("ready"), item("handoff")];
    expect(buildReceivingTabCounts(items)).toEqual({ actionable: 3, all: 4, done: 1 });
  });
});

describe("§11.334 P1 — 행 visual·액션 분기(시안 색 3+1)", () => {
  it("blocked → rose·반영 차단·coa", () => {
    expect(resolveReceivingRowVisual("blocked")).toEqual({ tone: "rose", badgeLabel: "반영 차단", action: "coa" });
  });
  it("needs_review → amber·검수 대기·inspect", () => {
    expect(resolveReceivingRowVisual("needs_review")).toEqual({ tone: "amber", badgeLabel: "검수 대기", action: "inspect" });
  });
  it("ready → blue·반영 대기·post", () => {
    expect(resolveReceivingRowVisual("ready")).toEqual({ tone: "blue", badgeLabel: "반영 대기", action: "post" });
  });
  it("handoff → emerald·반영 완료·none", () => {
    expect(resolveReceivingRowVisual("handoff")).toEqual({ tone: "emerald", badgeLabel: "반영 완료", action: "none" });
  });
  it("waiting_external → slate·입고 대기·none", () => {
    expect(resolveReceivingRowVisual("waiting_external")).toEqual({ tone: "slate", badgeLabel: "입고 대기", action: "none" });
  });
});
