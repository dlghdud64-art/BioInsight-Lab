/**
 * §inventory-reorder-surface-unify P1 — Contract: MobileOperationalBriefSheet mode prop
 *   (PLAN: docs/plans/PLAN_inventory-reorder-surface-unify.md)
 *
 * P1 계약(최소 증분): 공유 모바일 브리프 시트에 mode?: "detail"|"reorder" 도입.
 *   - reorder mode → 헤더 eyebrow "재발주 검토" (데스크탑 InventoryContextPanel mode 분기 동형)
 *   - default "detail" = 회귀 0 (운영 브리핑 / aria-label / md:hidden / primaryCta / 4 chips 보존)
 *
 * 후속(P2~): reorder 섹션 렌더 + content openReorderReviewSheet 승격은 각 phase sentinel로 가드.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}
const SHEET = "src/components/operational-brief/mobile-bottom-sheet.tsx";

describe("§inventory-reorder-surface-unify P1 — MobileOperationalBriefSheet mode 계약", () => {
  it("mode prop 정의('detail'|'reorder')", () => {
    const src = read(SHEET);
    expect(src).toMatch(/mode\?:\s*"detail"\s*\|\s*"reorder"/);
    expect(src).toMatch(/mode = "detail"/); // default detail = 회귀 0
  });

  it("헤더 eyebrow mode 분기(재발주 검토 / 운영 브리핑)", () => {
    const src = read(SHEET);
    expect(src).toMatch(/mode === "reorder" \? "재발주 검토" : "운영 브리핑"/);
  });
});

describe("§inventory-reorder-surface-unify P1 — 회귀 0 (§11.142 / §11.264a 보존)", () => {
  const src = read(SHEET);
  it("'운영 브리핑' 문자열 + aria-label 보존", () => {
    expect(src).toContain("운영 브리핑");
    expect(src).toMatch(/aria-label="운영 브리핑"/);
  });
  it("md:hidden(모바일 전용) 보존", () => {
    expect(src).toMatch(/md:hidden/);
  });
  it("primaryCta sticky CTA 보존", () => {
    expect(src).toMatch(/primaryCta\.onClick/);
    expect(src).toMatch(/primaryCta\.disabled/);
  });
  it("DEFAULT_CHIPS 4개(상태 요약/핵심 근거/리스크/다음 조치) 보존", () => {
    expect(src).toContain("상태 요약");
    expect(src).toContain("핵심 근거");
    expect(src).toContain("리스크");
    expect(src).toContain("다음 조치");
  });
});
