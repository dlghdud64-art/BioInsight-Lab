import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const CARD = "src/components/quotes/priority-recommendation-card.tsx";

describe("§11.329 — 견적 우선추천 카드 navy 파란 띠 제거(중립 흰 카드)", () => {
  it("컨테이너가 중립 흰 카드다 (navy 그라데이션 제거)", () => {
    const src = read(CARD);
    expect(src).toMatch(/rounded-xl bg-white border border-slate-200 shadow-sm/);
    expect(src).not.toMatch(/linear-gradient\(100deg, #1b2b50/);
    expect(src).not.toMatch(/rounded-xl text-white px/);
  });

  it("파란 토큰(#a9c2f5)·navy boxShadow 잔재가 없다", () => {
    const src = read(CARD);
    expect(src).not.toMatch(/#a9c2f5/);
    expect(src).not.toMatch(/rgba\(20,38,80/);
  });

  it("眞 level 색이 §11.302 정합이다 (high=red-600·mid=amber·low=중립)", () => {
    const src = read(CARD);
    expect(src).toMatch(/high: "text-red-600 font-bold"/);
    expect(src).toMatch(/mid: "text-\[#b45821\] font-bold"/);
    expect(src).toMatch(/low: "text-slate-400"/);
    expect(src).not.toMatch(/text-yellow-300/);
  });
});

describe("§11.329 — 회귀 보호 (우선추천 기능·CTA·나중에 보존)", () => {
  it("CTA(케이스 열기) 실 핸들러가 유지된다", () => {
    const src = read(CARD);
    expect(src).toMatch(/onClick=\{\(\) => onOpen\(best!\.id\)\}/);
  });
  it("나중에(일시 보류) 핸들러가 유지된다", () => {
    const src = read(CARD);
    expect(src).toMatch(/n\.add\(best!\.id\)/);
  });
  it("'우선 추천' eyebrow·최우선 1건 노출 로직이 유지된다", () => {
    const src = read(CARD);
    expect(src).toMatch(/우선 추천/);
    expect(src).toMatch(/if \(!best\) return null/);
  });
});
