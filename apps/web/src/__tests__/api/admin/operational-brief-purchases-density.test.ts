/**
 * §11.187 #operational-brief-density-up-other-surfaces (Phase 3: purchases)
 *
 * purchases/page.tsx 의 핵심 근거 section 이 4-cell MetricCell grid 적용 검증.
 * §11.180 inventory 패턴 복제.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.187 purchases — 4-cell MetricCell grid", () => {
  const PATH = "src/app/dashboard/purchases/page.tsx";

  it("MetricCell shared import", () => {
    const src = read(PATH);
    expect(src).toMatch(/import\s+\{\s*MetricCell\s*\}\s+from\s+["']@\/components\/operational-brief\/metric-cell["']/);
  });

  it("판단 근거 section grid-cols-2 + 4 MetricCell", () => {
    const src = read(PATH);
    // brief-facts id 부터 다음 brief-* section 까지 capture
    const m = src.match(/id="brief-facts"[\s\S]*?id="brief-/);
    expect(m, "판단 근거 section 미발견").not.toBeNull();
    const block = m![0];
    expect(block).toMatch(/grid-cols-2/);
    const cells = block.match(/<MetricCell\b/g) ?? [];
    expect(cells.length).toBe(4);
  });

  it("4 MetricCell label — 상태 / 공급사 회신 / 총액 / 유효기간", () => {
    const src = read(PATH);
    // brief-facts id 부터 다음 brief-* section 까지 capture
    const m = src.match(/id="brief-facts"[\s\S]*?id="brief-/);
    const block = m![0];
    expect(block).toMatch(/label="상태"/);
    expect(block).toMatch(/label="공급사 회신"/);
    expect(block).toMatch(/label="총액"/);
    expect(block).toMatch(/label="유효기간"/);
  });

  it("replyTone derive — 회신 = 전체 → ok / 일부 → warn / 0 → danger", () => {
    const src = read(PATH);
    expect(src).toMatch(/replyTone[\s\S]*?totalSuppliers\s*===\s*0[\s\S]*?"danger"/);
    expect(src).toMatch(/supplierReplies\s*===\s*selectedItem\.totalSuppliers[\s\S]*?"ok"/);
    expect(src).toMatch(/"warn"/);
  });

  it("expiryTone derive — 만료 → danger / validUntil 있으면 ok / null → neutral", () => {
    const src = read(PATH);
    expect(src).toMatch(/expiryTone[\s\S]*?selectedItem\.isExpired[\s\S]*?"danger"/);
    expect(src).toMatch(/selectedItem\.validUntil[\s\S]*?"ok"/);
    expect(src).toMatch(/"neutral"/);
  });
});
