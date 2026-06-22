import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// §quote-screen-sian §09c — 발송 검토 모달 좁은 폭 반응형(send-modal.css ≤680/≤560
//   1:1). 스텝퍼·추가 폼·수신처 카드가 좁은 폭에서 찌그러지던 문제 해결. 호영님
//   개선 시안(README "반응형(좁은 폭)" + send-modal.css) 정합.
const WORKBENCH_PATH = join(
  __dirname,
  "..",
  "..",
  "..",
  "components",
  "quotes",
  "dispatch",
  "vendor-dispatch-workbench.tsx",
);

describe("§quote-screen-sian §09c — 발송 모달 반응형 브레이크포인트", () => {
  const src = readFileSync(WORKBENCH_PATH, "utf8");

  it("스텝퍼 — ≤680 sdot 26px·slabel 11px·sline top 12px, ≤560 slabel 10px", () => {
    expect(src).toContain("max-[680px]:h-[26px]");
    expect(src).toContain("max-[680px]:w-[26px]");
    expect(src).toContain("max-[680px]:text-[11px]");
    expect(src).toContain("max-[560px]:text-[10px]");
    expect(src).toContain("max-[680px]:top-[12px]");
  });

  it("스텝퍼 ssub — ≤680 숨김(>680만 노출)", () => {
    expect(src).toContain("min-[681px]:block");
  });

  it("이메일 추가 폼 — ≤560 1열 스택(>560만 가로)", () => {
    expect(src).toContain("flex flex-col gap-2 min-[561px]:flex-row");
  });

  it("공급사 수신처 카드 — ≤560 wrap", () => {
    expect(src).toContain("max-[560px]:flex-wrap");
  });

  it("회귀 0 — §09b no-supplier 히어로 + 스텝퍼 보존", () => {
    expect(src).toContain('data-testid="quote-dispatch-no-supplier-hero"');
    expect(src).toContain('data-testid="quote-dispatch-stepper"');
    expect(src).toContain("showNoSupplierHero");
  });
});
