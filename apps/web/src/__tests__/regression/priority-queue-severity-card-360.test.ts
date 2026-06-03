/**
 * §11.360 (회귀) — 권장 액션 카드 severity-색상 매핑 sentinel
 *
 * 카드 행 배경이 severity 미분기(단일 하드코딩) → RISK_CONFIG.cardBg(배지와 동일 팔레트)
 * 로 분기. 긴급=red/높음=yellow(§11.302 amber 금지)/보통=blue/낮음=neutral. 약채도+좌측보더.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
const SRC = readFileSync(
  join(APP_WEB_ROOT, "src/components/inventory/priority-action-queue.tsx"),
  "utf8",
);

describe("§11.360 — RISK_CONFIG.cardBg severity 분기", () => {
  it("4 severity 모두 cardBg 보유 + 동일 팔레트", () => {
    expect(SRC).toContain("cardBg:");
    expect(SRC).toContain("border-l-red-400"); // critical
    expect(SRC).toContain("border-l-yellow-400"); // high (§11.302 yellow)
    expect(SRC).toContain("border-l-blue-300"); // medium
    expect(SRC).toContain("border-l-slate-200"); // low
  });
  it("§11.302 정합 — amber/orange 미사용", () => {
    expect(SRC).not.toMatch(/amber-|orange-/);
  });
});

describe("§11.360 — 카드 행에 cardBg 적용(단일 하드코딩 제거)", () => {
  it("riskCfg.cardBg 를 카드 className 에 사용", () => {
    expect(SRC).toContain("${riskCfg.cardBg}");
    // 기존 단일 하드코딩(hover:bg-slate-50/80 단독) 제거
    expect(SRC).not.toContain('className="px-4 py-3 hover:bg-slate-50/80 transition-colors cursor-pointer group"');
  });
});
