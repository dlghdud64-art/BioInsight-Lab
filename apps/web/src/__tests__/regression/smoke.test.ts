/**
 * 회귀 방지 smoke test — 브랜드 전용 (BioInsight → LabAxis 완전대체).
 *
 * 재작성 (§suite-red-cleanup, 호영님 "LabAxis 완전대체" 2026-07-01):
 *   구 smoke 는 execSync grep 기반이라 vitest 환경에서 STACK_TRACE 로 붕괴했고,
 *   "라이트모드 잔재 금지(bg-white/text-slate-900)" · "하드코딩 hex 금지(bg-[#...])"
 *   · "navy hue 금지" 정책을 강제했으나 — 이는 현행 §11.302(muted amber 하드코딩
 *   bg-[#fdf3ec]/#b45821 필수) 와 §web-mobile-reskin(navy 헤더 + white 카드) 을
 *   정면 위반하는 obsolete 정책이라 폐기. 브랜드 회귀 방지만 readFileSync 기반으로 유지.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SRC = join(__dirname, "..", "..");

function walkTsx(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry === "__tests__") continue;
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walkTsx(full));
    else if (entry.endsWith(".tsx")) out.push(full);
  }
  return out;
}

// 사용자 노출 브랜드 문자열만 탐지 — 컴포넌트/파일명 식별자·import·주석은 허용.
function brandLiteralHits(needle: string): string[] {
  const hits: string[] = [];
  for (const f of walkTsx(SRC)) {
    const lines = readFileSync(f, "utf8").split("\n");
    lines.forEach((ln, i) => {
      const trimmed = ln.trim();
      if (trimmed.startsWith("//") || trimmed.startsWith("*") || trimmed.startsWith("/*")) return;
      if (ln.includes("import ") || ln.includes("from ")) return;
      if (ln.includes(needle)) hits.push(`${f.replace(SRC, "src")}:${i + 1}`);
    });
  }
  return hits;
}

describe("브랜드 회귀 방지 — BioInsight → LabAxis 완전대체", () => {
  it('사용자 노출 문자열 리터럴 "BioInsight 0 (식별자/import/주석 제외)', () => {
    expect(brandLiteralHits('"BioInsight')).toHaveLength(0);
  });

  it('사용자 노출 alt/텍스트 "BioInsight Lab" 0', () => {
    expect(brandLiteralHits("BioInsight Lab")).toHaveLength(0);
  });

  it('JSX 텍스트 노출 ">BioInsight" 0', () => {
    expect(brandLiteralHits(">BioInsight")).toHaveLength(0);
  });
});
