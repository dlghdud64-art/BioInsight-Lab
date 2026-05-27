/**
 * §11.302d-6a-3-α #ai-action-inbox-amber-removed — Regression sentinel
 *
 * 호영님 P1 sweep batch 3/4 (1/2) — ai-action-inbox.tsx variant 매핑 ~10 위치.
 *
 * 신호등 swap 결정 (variant 의미 분석):
 *   - FOLLOWUP_DRAFT (회신 대기): amber → yellow (긴급/주의 의미 유지)
 *   - REORDER_SUGGESTION (재고 위험): orange → red 격상 (위험 강조,
 *     STAGE_CONFIG.REORDER_SUGGESTION 도 이미 red — 일관성)
 *   - STAGE_CONFIG.QUOTE_DRAFT (검토 필요): orange → yellow (검토 단계)
 *   - STAGE_CONFIG.VENDOR_EMAIL_DRAFT (검토 필요): orange → yellow (검토 단계)
 *   - STAGE_CONFIG.FOLLOWUP_DRAFT (응답 대기): amber → yellow (긴급/주의)
 *
 * canonical truth 보존:
 *   - 6 CONFIG entry (VENDOR_EMAIL_DRAFT/FOLLOWUP_DRAFT/STATUS_CHANGE_SUGGEST/
 *     REORDER_SUGGESTION/EXPIRY_ALERT + 다른 entry) 구조 보존
 *   - 6 STAGE_CONFIG entry 보존
 *   - icon / title / description / cta / approveToast / approveHref 변경 0
 *   - dark mode 짝 (bg-*-950/40 + text-*-400 + border-*-800) 모두 swap
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const PATH = "src/components/dashboard/ai-action-inbox.tsx";

describe("§11.302d-6a-3-α — amber/orange Tailwind class 0 (전체 file)", () => {
  it("bg-amber-* class 0", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/bg-amber-\d/);
  });

  it("text-amber-* class 0", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/text-amber-\d/);
  });

  it("border-amber-* / border-l-amber-* class 0", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/border-amber-\d/);
    expect(src).not.toMatch(/border-l-amber-\d/);
  });

  it("bg-orange-* class 0", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/bg-orange-\d/);
  });

  it("text-orange-* class 0", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/text-orange-\d/);
  });

  it("border-orange-* / border-l-orange-* class 0", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/border-orange-\d/);
    expect(src).not.toMatch(/border-l-orange-\d/);
  });
});

describe("§11.302d-6a-3-α — CONFIG variant swap", () => {
  it("FOLLOWUP_DRAFT yellow tone (iconBg / iconColor / borderColor / badgeClass)", () => {
    const src = read(PATH);
    expect(src).toMatch(/FOLLOWUP_DRAFT:\s*\{[\s\S]{0,500}iconBg:\s*"bg-yellow-50/);
    expect(src).toMatch(/FOLLOWUP_DRAFT:\s*\{[\s\S]{0,500}iconColor:\s*"text-yellow-600 text-yellow-400"/);
    expect(src).toMatch(/FOLLOWUP_DRAFT:\s*\{[\s\S]{0,500}borderColor:\s*"border-l-yellow-500"/);
    expect(src).toMatch(/FOLLOWUP_DRAFT:\s*\{[\s\S]{0,500}badgeClass:\s*"bg-yellow-50 text-yellow-700/);
  });

  it("REORDER_SUGGESTION red 격상 (재고 위험 = 위험 강조)", () => {
    const src = read(PATH);
    expect(src).toMatch(/REORDER_SUGGESTION:\s*\{[\s\S]{0,500}iconBg:\s*"bg-red-50/);
    expect(src).toMatch(/REORDER_SUGGESTION:\s*\{[\s\S]{0,500}iconColor:\s*"text-red-600 text-red-400"/);
    expect(src).toMatch(/REORDER_SUGGESTION:\s*\{[\s\S]{0,500}borderColor:\s*"border-l-red-500"/);
    expect(src).toMatch(/REORDER_SUGGESTION:\s*\{[\s\S]{0,500}badgeClass:\s*"bg-red-50 text-red-700/);
  });

  it("FOLLOWUP_DRAFT badgeLabel '회신 대기' 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/FOLLOWUP_DRAFT:[\s\S]{0,500}badgeLabel:\s*"회신 대기"/);
  });

  it("REORDER_SUGGESTION badgeLabel '재고 위험' 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/REORDER_SUGGESTION:[\s\S]{0,500}badgeLabel:\s*"재고 위험"/);
  });
});

describe("§11.302d-6a-3-α — STAGE_CONFIG variant swap", () => {
  it("STAGE_CONFIG.QUOTE_DRAFT yellow tone (검토 필요)", () => {
    const src = read(PATH);
    expect(src).toMatch(/QUOTE_DRAFT:\s*\{\s*label:\s*"검토 필요",\s*className:\s*"bg-yellow-50 text-yellow-700/);
  });

  it("STAGE_CONFIG.VENDOR_EMAIL_DRAFT yellow tone (검토 필요)", () => {
    const src = read(PATH);
    expect(src).toMatch(/VENDOR_EMAIL_DRAFT:\s*\{\s*label:\s*"검토 필요",\s*className:\s*"bg-yellow-50 text-yellow-700/);
  });

  it("STAGE_CONFIG.FOLLOWUP_DRAFT yellow tone (응답 대기)", () => {
    const src = read(PATH);
    expect(src).toMatch(/FOLLOWUP_DRAFT:\s*\{\s*label:\s*"응답 대기",\s*className:\s*"bg-yellow-50 text-yellow-700/);
  });
});

describe("§11.302d-6a-3-α — 회귀 0 (다른 variant + 핵심 wiring 보존)", () => {
  it("VENDOR_EMAIL_DRAFT CONFIG blue 보존 (변경 0)", () => {
    const src = read(PATH);
    expect(src).toMatch(/VENDOR_EMAIL_DRAFT:\s*\{[\s\S]{0,500}iconBg:\s*"bg-blue-50/);
  });

  it("STATUS_CHANGE_SUGGEST CONFIG purple 보존 (변경 0)", () => {
    const src = read(PATH);
    expect(src).toMatch(/STATUS_CHANGE_SUGGEST:\s*\{[\s\S]{0,500}iconBg:\s*"bg-purple-50/);
  });

  it("EXPIRY_ALERT CONFIG red 보존 (변경 0)", () => {
    const src = read(PATH);
    expect(src).toMatch(/EXPIRY_ALERT:\s*\{[\s\S]{0,500}iconBg:\s*"bg-red-50/);
  });

  it("STAGE_CONFIG.REORDER_SUGGESTION red 보존 (REORDER_SUGGESTION CONFIG 와 일관 — 둘 다 red)", () => {
    const src = read(PATH);
    expect(src).toMatch(/REORDER_SUGGESTION:\s*\{\s*label:\s*"조치 필요",\s*className:\s*"bg-red-50 text-red-700/);
  });

  it("STAGE_CONFIG.EXPIRY_ALERT yellow 보존 (변경 0)", () => {
    const src = read(PATH);
    expect(src).toMatch(/EXPIRY_ALERT:\s*\{\s*label:\s*"확인 필요",\s*className:\s*"bg-yellow-50 text-yellow-700/);
  });

  it("FOLLOWUP_DRAFT approveHref + STATUS_CHANGE_SUGGEST approveHref 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/FOLLOWUP_DRAFT:[\s\S]{0,800}approveHref:\s*"\/dashboard\/purchase-orders"/);
    expect(src).toMatch(/STATUS_CHANGE_SUGGEST:[\s\S]{0,800}approveHref:\s*"\/dashboard\/purchase-orders"/);
  });

  it("REORDER_SUGGESTION approveHref /dashboard/inventory 보존", () => {
    const src = read(PATH);
    expect(src).toMatch(/REORDER_SUGGESTION:[\s\S]{0,800}approveHref:\s*"\/dashboard\/inventory"/);
  });
});
