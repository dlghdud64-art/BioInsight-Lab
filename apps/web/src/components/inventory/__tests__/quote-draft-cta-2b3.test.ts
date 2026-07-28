import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

/**
 * §inventory-delta-label-kpi P2b-3 (호영님 2026-07-27 핸드오프 §2b, 경로 a) — 견적 초안 CTA.
 *   재발주 판단 → 견적 착수를 패널 안에서 닫음. Phase 0 확정: 앱 정규 견적 요청 엔트리
 *   /app/quote/request 로 정직 네비게이션(Link). 견적 생성·승인 게이트는 견적 화면 소관 —
 *   inventory 패널은 이동만(ops-store dispatch·서버 mutation·가짜 prefill·dead-link 0).
 */
const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");
const PANEL = read("src/components/inventory/inventory-context-panel.tsx");

describe("§P2b-3 — 견적 초안 CTA(정직 딥링크)", () => {
  it("CTA testid + /app/quote/request Link(next/link 정직 네비게이션)", () => {
    expect(PANEL).toMatch(/from "next\/link"/);
    expect(PANEL).toMatch(/data-testid="inventory-context-quote-draft-cta"/);
    expect(PANEL).toMatch(/href="\/app\/quote\/request"/);
    expect(PANEL).toMatch(/견적 초안 만들기/);
  });

  it("정직성 — ops-store dispatch·서버 mutation·가짜 prefill query 0(경로 a)", () => {
    // 견적 생성은 견적 화면 소관 — 패널은 이동만.
    expect(PANEL).not.toMatch(/createQuoteFromReorder/);
    // 딥링크에 품목 prefill query param 미부착(견적 화면 미수용 계약 — 가짜 prefill 금지)
    expect(PANEL).not.toMatch(/\/app\/quote\/request\?/);
  });

  it("dead-link/dead-button 0 — Link(상시 유효 네비게이션), 인위적 disabled 부재", () => {
    // CTA 인근에 disabled 부재(항상 유효한 네비게이션)
    expect(PANEL).toMatch(/quote-draft-cta"[\s\S]{0,300}견적 초안 만들기/);
    expect(PANEL).not.toMatch(/quote-draft-cta"[\s\S]{0,300}disabled/);
  });

  it("§9 신호등 토큰 — CTA는 blue(action), amber/orange 0", () => {
    expect(PANEL).not.toMatch(/amber-\d|orange-\d/);
  });
});
