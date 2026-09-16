/**
 * §reorder-need-canonical-call (2026-09-16) — 재주문 판정 **정의는 한 곳**이다.
 *
 * 왜 개별 핀이 아니라 검출기인가: 이 결함은 파일마다 따로 났다.
 *   드로어 게이지 `<` · 테이블 게이지 `<` · 제품 상세 `<` + null 분기 없음 ·
 *   브리핑 `<` + null 분기 없음 · 모바일은 정본과 **같은 이름의 함수를 로컬 재정의**.
 *   다섯 곳을 각각 핀하면 여섯 번째가 또 생긴다. 정의를 세는 쪽이 계열을 닫는다.
 *
 * 🛑 이 파일은 **정의**만 막는다. 게이지 JSX 의 인라인 비교(지역변수 safety 기반)는
 *   별개이며 각자의 경계 핀이 잡는다(inventory-drawer-safety-gauge · -dday90).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const WEB_ROOT = join(__dirname, "..", "..", "..");
const SRC = join(WEB_ROOT, "src");
const CANON_REL = join("lib", "inventory", "reorder-need.ts");

/** src 전량을 훑는다 — 파일명을 손으로 적지 않는다. */
function sourceFiles(): string[] {
  const out: string[] = [];
  (function walk(dir: string) {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      if (e.name === "__tests__" || e.name === "generated" || e.name === "node_modules") continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name)) out.push(p);
    }
  })(SRC);
  return out;
}

const DEFINE =
  /(?:export\s+)?(?:function|const)\s+(isReorderNeeded|isReorderNeededByLeadTime|isReorderNeededBySafetyStock)\b/;

describe("§reorder-need · 판정 정의는 정본 한 곳", () => {
  it("축이 비어 있지 않다 (검사가 조용히 사라지지 않게)", () => {
    expect(sourceFiles().length).toBeGreaterThan(200);
  });

  it("🛑 정본 밖에서 재주문 판정 함수를 정의하지 않는다", () => {
    const offenders = sourceFiles()
      .filter((f) => !f.endsWith(CANON_REL))
      .filter((f) => DEFINE.test(stripComments(readFileSync(f, "utf8"))))
      .map((f) => f.slice(WEB_ROOT.length + 1));
    expect(
      offenders,
      `정본(lib/inventory/reorder-need.ts) 밖에서 판정을 다시 정의한 파일:\n${offenders.join("\n")}\n` +
        `→ 정의하지 말고 import 해서 부르십시오. 이름이 같아도 내용은 갈립니다.`,
    ).toHaveLength(0);
  });

  it("정본이 두 축을 각각 내보내고, 복합 판정이 그것들을 통과한다", () => {
    const canon = readFileSync(join(SRC, CANON_REL), "utf8");
    expect(canon).toMatch(/export function isReorderNeededByLeadTime\(/);
    expect(canon).toMatch(/export function isReorderNeededBySafetyStock\(/);
    expect(canon).toMatch(
      /function isReorderNeeded\(inv: ReorderNeedInput\)[\s\S]{0,200}?isReorderNeededByLeadTime\(inv\)[\s\S]{0,120}?return isReorderNeededBySafetyStock\(inv\)/,
    );
  });
});
