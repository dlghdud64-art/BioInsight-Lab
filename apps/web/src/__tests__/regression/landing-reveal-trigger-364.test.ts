import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const FILE = "src/app/_components/final-cta-section.tsx";

describe("§11.364 D-6c — 랜딩 2번째 섹션 reveal 트리거 보장", () => {
  it("Reveal viewport = amount 기반 (15% 진입 발화) — margin 지연 제거", () => {
    const src = read(FILE);
    expect(src).toMatch(/viewport=\{\{ once: true, amount: 0\.15 \}\}/);
  });

  it("흐릿 멈춤 원인 margin:'-60px' 제거", () => {
    const src = read(FILE);
    expect(src).not.toMatch(/margin: "-60px"/);
  });

  it("회귀 0 — whileInView + once:true(재발화 0) 보존", () => {
    const src = read(FILE);
    expect(src).toMatch(/whileInView=\{\{ opacity: 1, y: 0 \}\}/);
    expect(src).toMatch(/once: true/);
    // 무효 prop 미혼입 가드
    expect(src).not.toMatch(/whileInViewFallback/);
  });
});
