/**
 * 입고 quarantine 용어 정리(호영님 2026-07-05) — "격리" → "보류".
 * 입고 카드 공급 어댑터·governance 라벨의 한국어 "격리"를 "보류"로 통일(quarantine 개념 유지).
 * English 식별자(quarantined / quarantineStatus / quarantine_constrained key)는 보존.
 * ⚠ 범위: 입고 surface 한정. ai-pipeline·security의 isolation-meaning "격리"는 무접촉.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
const R = (rel: string) => readFileSync(join(__dirname, "..", "..", rel), "utf8");

const CORE = [
  "lib/ai/governance-grammar-registry.ts",
  "lib/ops-console/inbox-adapter.ts",
  "lib/ops-console/module-landing-adapter.ts",
  "lib/ops-console/blocker-adapter.ts",
  "lib/ops-console/dashboard-adapter.ts",
  "lib/ops-console/entity-operational-state.ts",
  "lib/ops-console/ops-adapters.ts",
  // 제거됨: "lib/ops-console/ops-store.tsx" — §po-seed-cutoff 2차(2026-09-24) · 시드 스토어 삭제
  "lib/ops-console/ownership-adapter.ts",
];

// batch-2 (호영님 2026-07-05, operator) — 나머지 입고 surface 일괄 격리→보류.
const BATCH2 = [
  "lib/ops-console/receiving-detail-adapter.ts",
  // 제거됨: "lib/ops-console/seed-data.ts" — §po-seed-cutoff 2차(2026-09-24) · 시드 데이터 삭제
  "lib/ops-console/command-adapters.ts",
  "lib/ops-console/phase1-execution-prompts.ts",
  "lib/review-queue/receiving-inbound-contract.ts",
  "lib/review-queue/receiving-inbound-view-models.ts",
  "lib/review-queue/reorder-expiry-stock-risk-contract.ts",
  "lib/review-queue/reorder-expiry-stock-risk-view-models.ts",
  "lib/ai/receiving-execution-governance-engine.ts",
  "lib/ai/receiving-intake-workbench-engine.ts",
  "lib/ai/receiving-execution-workbench-engine.ts",
  "lib/ontology/contextual-action/disposal-resolver.ts",
  "lib/procurement/inventory-intake-workbench.ts",
  "lib/procurement/available-stock-release-workbench.ts",
  "app/dashboard/receiving/[receivingId]/page.tsx",
  "components/approval/receiving-governance-workbench.tsx",
];

describe("입고 quarantine 용어 — 카드 공급 레이어 격리→보류", () => {
  it.each(CORE)("%s: 한국어 '격리' 잔재 0", (rel) => {
    expect(R(rel)).not.toMatch(/격리/);
  });

  it.each(BATCH2)("batch-2 %s: 한국어 '격리' 잔재 0", (rel) => {
    expect(R(rel)).not.toMatch(/격리/);
  });

  it("batch-2 dedupe(available-stock-release) — '보류/보류' 중복 0", () => {
    expect(R("lib/procurement/available-stock-release-workbench.ts")).not.toMatch(/보류\/보류/);
  });

  it("보류 라벨 반영 + English quarantine 식별자 보존(governance/inbox)", () => {
    const gov = R("lib/ai/governance-grammar-registry.ts");
    expect(gov).toMatch(/보류 보관/);
    expect(gov).toMatch(/status: "quarantined"/); // English status key 보존
    /* 🔁 앵커 이동 (§po-seed-cutoff 2차 · 2026-09-24)
     *    구 앵커는 inbox-adapter 의 **시드 전용 입고 빌더**(buildInboxFromReceiving) 안의 「보류 품목」 제목이었다.
     *    시드 군집이 삭제되며 그 빌더가 사라졌다 — 라벨 정책은 그대로이고, 그 정책을 쓰는 **살아 있는 자리**로 옮긴다.
     *    (blocker-adapter · entity-operational-state · ownership-adapter 는 같은 라벨을 계속 쓴다.) */
    expect(R("lib/ops-console/blocker-adapter.ts")).toMatch(/보류 품목/);
    expect(R("lib/ops-console/entity-operational-state.ts")).toMatch(/보류 품목/);
    expect(R("lib/ops-console/ownership-adapter.ts")).toMatch(/보류 품목/);
    // English 식별자 보존 — 같은 이동(구 앵커는 삭제된 시드 빌더였다). 살아 있는 자리에서 단언한다.
    expect(R("lib/ai/receiving-execution-workbench-engine.ts")).toMatch(/quarantineLines|quarantineFlag/);
  });
});
