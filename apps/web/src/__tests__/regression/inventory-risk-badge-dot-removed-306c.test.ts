/**
 * §11.306c #inventory-risk-badge-dot-removed — Regression sentinel
 *
 * 호영님 P2 (2026-05-26) 옵션 A:
 *   mobile-inventory-view.tsx Badge 안 좌측 dot indicator 제거.
 *   배지 본체 색상 (statusCfg.badgeCls) 만으로 상태 충분 — 같은 색 dot 은
 *   대비 부족 (danger 의 bg-red-600 dot 이 bg-red-600 배지 안에서 안 보임).
 *
 * Fix:
 *   - line 395-398: 카드 row 1 Badge 안 dot 제거
 *   - line 511-514: Sheet header Badge 안 dot 제거
 *
 * 보존:
 *   - statusCfg.dotCls 정의 (line 152/157/162/167) — 다른 caller 있을 수 있음
 *   - 제품명 좌측 단독 dot (line ~306) — Badge 와 별도 시각 신호
 *   - §11.302d 신호등 (statusCfg.badgeCls 색상 토큰) 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const VIEW_PATH = "src/components/inventory/mobile-inventory-view.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.306c — Badge 안 dot indicator 제거", () => {
  it("Badge 안 dot span (rounded-full mr-1 statusCfg.dotCls) 0 occurrence", () => {
    const src = read(VIEW_PATH);
    // 정확 패턴: <span ... rounded-full mr-1 ${statusCfg.dotCls}/>
    expect(src).not.toMatch(/rounded-full\s+mr-1\s+\$\{statusCfg\.dotCls\}/);
  });

  it("statusCfg.dotCls 사용처 — Badge 안 직접 wrapping 0 (외부 별도 dot 만 허용)", () => {
    const src = read(VIEW_PATH);
    // <Badge>...<span ... statusCfg.dotCls/>...<label>...</Badge> 패턴 차단
    expect(src).not.toMatch(/<Badge[^>]*>\s*<span[^>]*statusCfg\.dotCls[^>]*\/>\s*\{statusCfg\.label\}/);
  });

  it("Badge label 만 직접 노출 (card row 1)", () => {
    const src = read(VIEW_PATH);
    // 카드 Badge 안에 dot 없이 label 직접:
    expect(src).toMatch(/<Badge\s+className=\{`text-\[10px\]\s+px-1\.5\s+py-0\s+border\s+shrink-0\s+\$\{statusCfg\.badgeCls\}`\}>\s*\{statusCfg\.label\}\s*<\/Badge>/);
  });
});

describe("§11.306c — 회귀 0 (보존)", () => {
  it("STATUS_CONFIG dotCls 정의 보존 (line 152/157/162/167) — 다른 caller 있을 수 있음", () => {
    const src = read(VIEW_PATH);
    expect(src).toMatch(/dotCls:\s*"bg-emerald-500"/);   // normal
    expect(src).toMatch(/dotCls:\s*"bg-red-500"/);       // low
    expect(src).toMatch(/dotCls:\s*"bg-yellow-500"/);    // expiring
    expect(src).toMatch(/dotCls:\s*"bg-red-600"/);       // danger
  });

  it("STATUS_CONFIG badgeCls (신호등 색상 토큰) 보존 — §11.302d 정합", () => {
    const src = read(VIEW_PATH);
    expect(src).toMatch(/badgeCls:\s*"bg-emerald-100 text-emerald-700 border-emerald-200"/);
    expect(src).toMatch(/badgeCls:\s*"bg-red-100 text-red-700 border-red-200"/);
    expect(src).toMatch(/badgeCls:\s*"bg-yellow-100 text-yellow-700 border-yellow-200"/);
    expect(src).toMatch(/badgeCls:\s*"bg-red-600 text-white border-red-700"/);
  });

  it("STATUS_CONFIG.label '위험' 등 신호등 label 보존", () => {
    const src = read(VIEW_PATH);
    expect(src).toMatch(/label:\s*"위험"/);
    expect(src).toMatch(/label:\s*"부족"/);
    expect(src).toMatch(/label:\s*"임박"/);
    expect(src).toMatch(/label:\s*"정상"/);
  });

  it("제품명 좌측 단독 dot (line ~306) 보존 — Badge 와 별도 시각 신호", () => {
    const src = read(VIEW_PATH);
    // 제품명 좌측 dot: inline-block h-1.5 w-1.5 rounded-full ${statusCfg.dotCls}
    // (Badge 안 패턴 'rounded-full mr-1 ...' 와는 mr-1 부재로 구분)
    expect(src).toMatch(/inline-block\s+h-1\.5\s+w-1\.5\s+rounded-full\s+\$\{statusCfg\.dotCls\}/);
  });
});
