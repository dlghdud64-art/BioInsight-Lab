/**
 * §11.180 #operational-brief-density-up-other-surfaces (Phase 2: inventory)
 *
 * inventory-context-panel.tsx 의 핵심 근거 section 이 4-cell MetricCell grid
 * + text-3xl 수치 + tone 별 액센트 적용 검증.
 *
 * 다른 4 surface (purchases/quotes/queue/PO+receiving) 는 §11.181~184 별도 batch.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.180 inventory-context-panel — 4-cell MetricCell grid", () => {
  const PATH = "src/components/inventory/inventory-context-panel.tsx";

  it("MetricCell + formatRelativeKr import", () => {
    const src = read(PATH);
    expect(src).toMatch(/import\s+\{\s*MetricCell\s*\}\s+from\s+["']@\/components\/operational-brief\/metric-cell["']/);
    expect(src).toMatch(/import\s+\{\s*formatRelativeKr\s*\}\s+from\s+["']@\/components\/operational-brief\/relative-time["']/);
  });

  it("핵심 근거 section 안에 4-cell grid (grid-cols-2 + 4 MetricCell)", () => {
    const src = read(PATH);
    // SectionHeader label="핵심 근거" 부터 닫는 div 까지 사이에 grid-cols-2 + MetricCell 4 occurrence
    const m = src.match(/SectionHeader[^"]*"핵심 근거"[\s\S]*?<\/section>/);
    expect(m, "핵심 근거 section 미발견").not.toBeNull();
    const block = m![0];
    expect(block).toMatch(/grid-cols-2/);
    const metricCellMatches = block.match(/<MetricCell\b/g) ?? [];
    expect(metricCellMatches.length).toBe(4);
  });

  it("4 MetricCell label 가 운영 의미 ontology — 현재 수량 / 안전재고 / 만료까지 / 최단 Lot", () => {
    const src = read(PATH);
    const m = src.match(/SectionHeader[^"]*"핵심 근거"[\s\S]*?<\/section>/);
    const block = m![0];
    expect(block).toMatch(/label="현재 수량"/);
    expect(block).toMatch(/label="안전재고"/);
    expect(block).toMatch(/label="만료까지"/);
    expect(block).toMatch(/label="최단 Lot"/);
  });

  it("qty tone — currentQuantity 0 → danger / safetyStock 미만 → warn / 그 외 → ok", () => {
    const src = read(PATH);
    const m = src.match(/SectionHeader[^"]*"핵심 근거"[\s\S]*?<\/section>/);
    const block = m![0];
    expect(block).toMatch(/qtyTone[\s\S]*?currentQuantity\s*===\s*0[\s\S]*?"danger"/);
    expect(block).toMatch(/safetyStock[\s\S]*?currentQuantity\s*<=\s*item\.safetyStock[\s\S]*?"warn"/);
    expect(block).toMatch(/"ok"/);
  });

  it("expiry tone — expired (음수) → danger / 30일 이내 → warn / 그 외 → ok / null → neutral", () => {
    const src = read(PATH);
    const m = src.match(/SectionHeader[^"]*"핵심 근거"[\s\S]*?<\/section>/);
    const block = m![0];
    expect(block).toMatch(/expiryTone[\s\S]*?expiryDays\s*<\s*0[\s\S]*?"danger"/);
    expect(block).toMatch(/expiryDays\s*<=\s*30[\s\S]*?"warn"/);
    expect(block).toMatch(/expiryDays\s*===\s*null[\s\S]*?"neutral"/);
  });

  it("보조 metadata (카테고리/보관/위치/시험항목) 정보 보존 — InfoRow 4개 유지", () => {
    const src = read(PATH);
    const m = src.match(/SectionHeader[^"]*"핵심 근거"[\s\S]*?<\/section>/);
    const block = m![0];
    expect(block).toMatch(/InfoRow label="카테고리"/);
    expect(block).toMatch(/InfoRow label="보관 조건"/);
    expect(block).toMatch(/InfoRow label="위치"/);
    expect(block).toMatch(/InfoRow label="시험항목"/);
  });
});
