/**
 * #sourcing-cta-unify (RED -> GREEN) — 소싱 CTA·token 통일 sentinel.
 *
 * Phase 0 lock(호영님 권장): 소싱 bespoke solid CTA를 Button canonical variant로 흡수.
 * - blue primary = 기존 variant="default"(hover-blue-700) 재사용.
 * - 추가: success(emerald hover-700) variant + size xs(h-7 text-xs).
 * - core surface는 bespoke CTA hover 시그니처(hover:bg-blue-500 / hover:bg-emerald-500) 제거 → variant로.
 *   (badge 등 hover 없는 bg-X-600 은 CTA 아님 — 대상 아님.)
 * 스타일만 — onClick/href/문구 불변(diff 리뷰로 보장), amber sweep 별 트랙.
 *
 * Phase 1 기대: (a)variant RED, (b)core bespoke-hover RED.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string): string => readFileSync(join(APP_WEB_ROOT, rel), "utf8");

const BUTTON = "src/components/ui/button.tsx";
const W = "src/app/_workbench/_components/";
const CORE = [
  "compare-review-work-window.tsx",
  "sourcing-recommendation-drawer.tsx",
  "product-detail-summary.tsx",
  "sourcing-result-review-workbench.tsx",
  "vendor-request-modal.tsx",
];

describe("#sourcing-cta-unify (a) — buttonVariants 누락분", () => {
  it("success variant 존재", () => {
    expect(read(BUTTON)).toMatch(/success:\s*["'`]bg-emerald-600/);
  });
  it("size xs 존재", () => {
    expect(read(BUTTON)).toMatch(/xs:\s*["'`]h-7/);
  });
});

describe("#sourcing-cta-unify (b) — core surface bespoke CTA hover 제거", () => {
  for (const name of CORE) {
    it(`no bespoke CTA hover: ${name}`, () => {
      const src = read(W + name);
      // solid CTA hover만(tonal hover:bg-X-500/10 등 opacity-suffix 제외).
      expect(src).not.toMatch(/hover:bg-blue-500(?![/\d])/);
      expect(src).not.toMatch(/hover:bg-emerald-500(?![/\d])/);
    });
  }
});
