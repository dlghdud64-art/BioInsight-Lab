/**
 * §11.270b #settings-compliance-aria-label — compliance-links 3 spot X button
 *   aria-label 추가 (§11.270 P3 backlog 자연 후속)
 *
 * §11.270 에서 settings 5 spot 44x44 touch target 적용 시 workspace + security
 * 는 aria-label 명시 (`aria-label={`${domain} 제거`}`), compliance-links 3 spot
 * (hazard code / pictogram / category) 은 부재로 P3 backlog 에 park.
 *
 * Fix (minimum diff, 3 spot aria-label 추가):
 *   - hazardCode:   aria-label={`hazard code ${code} 제거`}
 *   - pictogramsAny: aria-label={`피크토그램 ${pictogram} 제거`}
 *   - categoryIn:   aria-label={`카테고리 ${PRODUCT_CATEGORIES[...] || category} 제거`}
 *
 * canonical truth lock:
 *   - §11.270 swap (min-h-[44px] + min-w-[44px] + inline-flex) 전부 보존
 *   - X icon h-3 w-3 보존
 *   - removeHazardCode + updateRule×2 onClick 보존
 *   - Badge variant="secondary" + ml-1 + hover:bg-slate-200 + rounded-full 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const COMPLIANCE = readFileSync(
  resolve(__dirname, "../../app/settings/compliance-links/page.tsx"),
  "utf8",
);

describe("§11.270b #1 — compliance-links 3 spot X button aria-label 추가", () => {
  it("§11.270b trace marker comment 존재", () => {
    expect(COMPLIANCE).toMatch(/§11\.270b/);
  });

  it("hazard code X button 에 aria-label 적용", () => {
    expect(COMPLIANCE).toMatch(
      /removeHazardCode\(code\)[\s\S]{0,500}aria-label=\{`hazard code \$\{code\} 제거`\}/,
    );
  });

  it("pictogram X button 에 aria-label 적용", () => {
    expect(COMPLIANCE).toMatch(
      /"pictogramsAny"[\s\S]{0,600}aria-label=\{`피크토그램 \$\{pictogram\} 제거`\}/,
    );
  });

  it("category X button 에 aria-label 적용", () => {
    expect(COMPLIANCE).toMatch(
      /"categoryIn"[\s\S]{0,600}aria-label=\{`카테고리 \$\{PRODUCT_CATEGORIES\[category as keyof typeof PRODUCT_CATEGORIES\] \|\| category\} 제거`\}/,
    );
  });
});

describe("§11.270b #2 — invariant 보존 (§11.270 + canonical truth)", () => {
  it("§11.270 44x44 swap (min-h-[44px] + min-w-[44px]) 3 spot 보존", () => {
    const matches = (COMPLIANCE.match(/min-h-\[44px\] min-w-\[44px\]/g) || []).length;
    expect(matches).toBeGreaterThanOrEqual(3);
  });

  it("§11.270 inline-flex items-center justify-center 3 spot 보존", () => {
    const matches = (COMPLIANCE.match(/inline-flex items-center justify-center/g) || []).length;
    expect(matches).toBeGreaterThanOrEqual(3);
  });

  it("X icon h-3 w-3 보존 (visual size)", () => {
    const matches = (COMPLIANCE.match(/<X className="h-3 w-3"/g) || []).length;
    expect(matches).toBeGreaterThanOrEqual(3);
  });

  it("removeHazardCode + updateRule×2 onClick 보존", () => {
    expect(COMPLIANCE).toMatch(/onClick=\{\(\) => removeHazardCode\(code\)\}/);
    expect(COMPLIANCE).toMatch(/updateRule\(\s*"pictogramsAny"/);
    expect(COMPLIANCE).toMatch(/updateRule\(\s*"categoryIn"/);
  });

  it("Badge variant=\"secondary\" 3 spot 보존", () => {
    const matches = (COMPLIANCE.match(/<Badge[\s\S]{0,200}variant="secondary"/g) || []).length;
    expect(matches).toBeGreaterThanOrEqual(3);
  });

  it("ml-1 + hover:bg-slate-200 + rounded-full 3 spot 보존", () => {
    const matches = (COMPLIANCE.match(/ml-1 inline-flex[\s\S]{0,200}hover:bg-slate-200 rounded-full/g) || []).length;
    expect(matches).toBeGreaterThanOrEqual(3);
  });
});
