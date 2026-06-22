import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// §quote-screen-sian §09 — 발송 검토 모달 스텝퍼를 시안 원형 노드로 차용.
//   호영님 2026-06-22 지시: 사각칩 철회, 시안 1:1 (원형 sdot + 연결선 +
//   2단 라벨). sub 문구는 실제 step readiness 파생 — 거짓 "완료" 표기 금지.
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

describe("§quote-screen-sian §09 — 스텝퍼 시안 원형 노드 차용", () => {
  const src = readFileSync(WORKBENCH_PATH, "utf8");

  it("원형 노드(sdot) — rounded-full 30px + current ring(시안 box-shadow)", () => {
    expect(src).toMatch(/rounded-full/);
    expect(src).toMatch(/h-\[30px\] w-\[30px\]/);
    // 시안 current .sdot box-shadow:0 0 0 4px accent-weak → ring-4 ring-blue-100
    expect(src).toMatch(/ring-4 ring-blue-100/);
  });

  it("연결선(sline) — 진행 도달 시 emerald, 첫 노드 제외", () => {
    expect(src).toContain("absolute right-1/2 top-[14px]");
    expect(src).toMatch(/i > 0 &&/);
  });

  it("2단 라벨(slabel/ssub) — sub 렌더 + ssub 모바일 숨김(sm:block)", () => {
    expect(src).toContain("{step.sub}");
    expect(src).toMatch(/hidden text-\[10\.5px\][^"]*sm:block/);
  });

  it("sub 문구는 state 파생(하드코딩 거짓 완료 금지)", () => {
    // subMap 이 state(done/blocked/current/pending) 별로 분기되어야 함.
    expect(src).toContain("const subMap");
    expect(src).toContain('done: "선택 완료"');
    expect(src).toContain('blocked: "후보 없음"');
    expect(src).toContain("subMap[s.key]?.[state]");
    // state 자체가 readiness(s.ready) 파생 — 별도 저장 truth 없음.
    expect(src).toMatch(/const state[^=]*=\s*s\.ready/);
  });

  it("회귀 0 — 옛 사각칩 마크업 제거", () => {
    expect(src).not.toContain("flex items-stretch gap-1.5");
    expect(src).not.toContain("truncate text-[11px] font-medium md:text-xs");
  });

  it("회귀 0 — testid / honesty CTA / tone 파생 보존", () => {
    expect(src).toContain("quote-dispatch-stepper");
    expect(src).toContain("quote-dispatch-step-${step.key}");
    expect(src).toContain("data-step-state={step.state}");
    expect(src).toContain("quote-dispatch-supplier-remediation-visible-cta");
  });
});
