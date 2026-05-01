/**
 * §11.188-190 #operational-brief-density-up-other-surfaces (Phase 4-6)
 *
 * 3 surface 의 핵심 근거 section 4-cell MetricCell grid 적용 검증.
 *   - §11.188 quotes/page.tsx
 *   - §11.189 queue-detail-panel.tsx
 *   - §11.190 operational-detail-shell.tsx (sr-only label 한국어 정합)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.188 quotes — 4-cell MetricCell grid", () => {
  const PATH = "src/app/dashboard/quotes/page.tsx";

  it("MetricCell shared import", () => {
    const src = read(PATH);
    expect(src).toMatch(/import\s+\{\s*MetricCell\s*\}\s+from\s+["']@\/components\/operational-brief\/metric-cell["']/);
  });

  it("판단 근거 section grid-cols-2 + 4 MetricCell", () => {
    const src = read(PATH);
    const m = src.match(/id="brief-facts"[\s\S]*?id="brief-facts2"/);
    expect(m, "brief-facts section 미발견").not.toBeNull();
    const block = m![0];
    expect(block).toMatch(/판단 근거/);
    expect(block).toMatch(/grid-cols-2/);
    const cells = block.match(/<MetricCell\b/g) ?? [];
    expect(cells.length).toBe(4);
  });

  it("4 MetricCell label — 현재 상태 / 회신 / 비교 가능 / 발주 전환", () => {
    const src = read(PATH);
    const m = src.match(/id="brief-facts"[\s\S]*?id="brief-facts2"/);
    const block = m![0];
    expect(block).toMatch(/label="현재 상태"/);
    expect(block).toMatch(/label="회신"/);
    expect(block).toMatch(/label="비교 가능"/);
    expect(block).toMatch(/label="발주 전환"/);
  });

  it("replyTone derive — sqResponseCount = total → ok / 일부 → warn / 0 → danger", () => {
    const src = read(PATH);
    expect(src).toMatch(/replyTone[\s\S]*?sqResponseCount\s*===\s*0[\s\S]*?"danger"/);
    expect(src).toMatch(/sqResponseCount\s*>=\s*totalItems[\s\S]*?"ok"/);
  });
});

describe("§11.189 queue-detail-panel — 4-cell MetricCell grid", () => {
  const PATH = "src/components/dashboard/console/queue-detail-panel.tsx";

  it("MetricCell shared import", () => {
    const src = read(PATH);
    expect(src).toMatch(/import\s+\{\s*MetricCell\s*\}\s+from\s+["']@\/components\/operational-brief\/metric-cell["']/);
  });

  it("판단 근거 BriefSection grid-cols-2 + 4 MetricCell", () => {
    const src = read(PATH);
    const m = src.match(/<BriefSection id="facts" title="판단 근거">[\s\S]*?<\/BriefSection>/);
    expect(m, "판단 근거 BriefSection 미발견").not.toBeNull();
    const block = m![0];
    expect(block).toMatch(/grid-cols-2/);
    const cells = block.match(/<MetricCell\b/g) ?? [];
    expect(cells.length).toBe(4);
  });

  it("4 MetricCell label — 우선순위 / 배정 / 담당 / 상태", () => {
    const src = read(PATH);
    const m = src.match(/<BriefSection id="facts" title="판단 근거">[\s\S]*?<\/BriefSection>/);
    const block = m![0];
    expect(block).toMatch(/label="우선순위"/);
    expect(block).toMatch(/label="배정"/);
    expect(block).toMatch(/label="담당"/);
    expect(block).toMatch(/label="상태"/);
  });

  it("priorityTone derive — critical/high → danger, medium → warn", () => {
    const src = read(PATH);
    expect(src).toMatch(/priorityTone[\s\S]*?critical[\s\S]*?high[\s\S]*?"danger"/);
    expect(src).toMatch(/"medium"[\s\S]*?"warn"/);
  });
});

describe("§11.190 operational-detail-shell — 한국어 sr-only label 정합", () => {
  const PATH = "src/app/dashboard/_components/operational-detail-shell.tsx";

  it("sr-only label '판단 근거' (한국어 정합)", () => {
    const src = read(PATH);
    // §11.190 — "핵심 근거" → "판단 근거" sr-only swap (PO/receiving page-level
    // 4-cell grid 는 §11.190b 별도 batch — shell 자체는 children layout)
    expect(src).toMatch(/<span className="sr-only">판단 근거<\/span>/);
  });
});
