/**
 * §4-warn-dedup — 발송 검토 모달 경고 부분 통합 (호영님 견적 고도화 P4, 2026-07-13)
 *
 * 재정의: §4 핵심(스텝퍼 실상태 파생·공급사 히어로·CTA 공급사0 비활성)은 이미 충족
 *   (§quote-screen-sian P6.4 §09). 잔여 갭 = blocked+공급사선택 상태에서 경고 3겹 동시 노출.
 *
 * minimal de-dup(옵션 1, full 통합=옵션 2 별도 backlog):
 *   - L624 스텝퍼 막힘배너를 includedCount === 0 로 게이팅 → 공급사 선택 후 숨김.
 *   - 특정 사유(firstReadinessBlocker)는 2상태 배너 하위문으로 승계 → 정보 손실 0.
 *   - 결과: blocked+선택 상태 경고 3겹(막힘배너·2상태·send-gate) → 2겹. dead/no-warn 아님.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WB = readFileSync(
  resolve(
    __dirname,
    "../../../components/quotes/dispatch/vendor-dispatch-workbench.tsx",
  ),
  "utf8",
);

describe("§4-warn-dedup — 막힘배너 includedCount 게이팅", () => {
  it("스텝퍼 막힘배너 조건에 includedCount === 0 추가(공급사 선택 후 숨김)", () => {
    // sendReadiness blocked + !showNoSupplierHero + includedCount === 0 동시 조건.
    expect(WB).toMatch(
      /sendReadiness === "blocked" && !showNoSupplierHero && includedCount === 0 &&/,
    );
  });

  it("2상태 배너 blocked 하위문이 firstReadinessBlocker 흡수(정보 손실 0)", () => {
    expect(WB).toMatch(/공급사 \$\{includedCount\}곳 선택됨 · \$\{firstReadinessBlocker \?\?/);
  });
});

describe("§4-warn-dedup — 무회귀(canonical truth 보존)", () => {
  it("보강 CTA testid·라벨 보존(§292 정합 — 미선택 blocked 전용으로 잔존)", () => {
    expect(WB).toContain('data-testid="quote-dispatch-supplier-remediation-visible-cta"');
    expect(WB).toContain("공급사 후보 보강");
  });

  it("'공급사 후보 보강' 라벨 workbench 내 정확 1회(중복 CTA 재도입 0)", () => {
    const hits = WB.match(/공급사 후보 보강/g) ?? [];
    expect(hits).toHaveLength(1);
  });

  it("2상태 배너 + send-gate 배너 보존(surviving 경고 2점)", () => {
    expect(WB).toContain('data-testid="quote-dispatch-state-banner"');
    expect(WB).toContain('data-testid="quote-dispatch-send-gate"');
  });

  it("스텝퍼(실상태 파생) 보존", () => {
    expect(WB).toContain('data-testid="quote-dispatch-stepper"');
  });

  it("공급사 추가 히어로(파란 테두리) 보존", () => {
    expect(WB).toMatch(/이메일로 공급사 추가/);
    expect(WB).toMatch(/border-blue-200/);
  });

  it("amber/orange Tailwind 0(신호등 유지)", () => {
    expect(WB).not.toMatch(/\b(bg|text|border)-(amber|orange)-\d{2,3}\b/);
  });
});
