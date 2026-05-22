/**
 * §11.279c #operational-briefing-eyebrow-korean — application-wide 영문 잔존 일괄 한글 sweep
 *   (§11.279 cluster P2 sprint, §11.142 운영 브리핑 lock 완전 정합).
 *
 * 호영님 결정 (2026-05-22): "완전 한글화 안" — OPERATIONAL BRIEFING 7 spot 모두 한글
 *   "운영 브리핑" 으로 swap + tracking-[0.12em] uppercase 제거 (한글은 uppercase 불필요).
 *   font-bold + text-blue-700 보존. sent tracking 1 spot → "전송 추적" swap.
 *
 * Fix (minimum diff, 8 file byte-level swap):
 *   - apps/web/src/app/dashboard/inbox/page.tsx (line 747)
 *   - apps/web/src/components/dashboard/console/queue-detail-panel.tsx (line 123)
 *   - apps/web/src/components/inventory/inventory-context-panel.tsx (line 449)
 *   - apps/web/src/components/operational-brief/surface-header.tsx (line 47)
 *   - apps/web/src/app/dashboard/_components/operational-detail-shell.tsx (line 572)
 *   - apps/web/src/app/dashboard/purchases/page.tsx (line 894)
 *   - apps/web/src/app/dashboard/quotes/page.tsx (line 3305)
 *   - apps/web/src/components/quotes/dispatch/vendor-dispatch-workbench.tsx (line 339, sent tracking)
 *
 * canonical truth 보존:
 *   - eyebrow visual hierarchy (text-[11px] font-bold text-blue-700) 보존
 *   - 한글 "운영 브리핑" 단어 + tracking removed (visual 정합)
 *   - vendor-dispatch-workbench setSentTracking statusLabel canonical 유지
 *   - 다른 surface text / data flow / handler 변경 0
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FILES = {
  inbox: readFileSync(
    resolve(__dirname, "../../app/dashboard/inbox/page.tsx"),
    "utf8",
  ),
  queueDetailPanel: readFileSync(
    resolve(__dirname, "../../components/dashboard/console/queue-detail-panel.tsx"),
    "utf8",
  ),
  inventoryContextPanel: readFileSync(
    resolve(__dirname, "../../components/inventory/inventory-context-panel.tsx"),
    "utf8",
  ),
  surfaceHeader: readFileSync(
    resolve(__dirname, "../../components/operational-brief/surface-header.tsx"),
    "utf8",
  ),
  operationalDetailShell: readFileSync(
    resolve(__dirname, "../../app/dashboard/_components/operational-detail-shell.tsx"),
    "utf8",
  ),
  purchasesPage: readFileSync(
    resolve(__dirname, "../../app/dashboard/purchases/page.tsx"),
    "utf8",
  ),
  quotesPage: readFileSync(
    resolve(__dirname, "../../app/dashboard/quotes/page.tsx"),
    "utf8",
  ),
  vendorDispatchWorkbench: readFileSync(
    resolve(__dirname, "../../components/quotes/dispatch/vendor-dispatch-workbench.tsx"),
    "utf8",
  ),
};

describe("§11.279c — OPERATIONAL BRIEFING eyebrow 영문 잔존 부재 (7 spot)", () => {
  it("§11.279c trace marker comment 존재 (8 file 중 최소 1 spot)", () => {
    const hasMarker =
      Object.values(FILES).some((content) => /§11\.279c/.test(content));
    expect(hasMarker).toBe(true);
  });

  it("inbox/page.tsx — \"OPERATIONAL BRIEFING\" 부재", () => {
    expect(FILES.inbox).not.toMatch(/OPERATIONAL BRIEFING/);
  });

  it("queue-detail-panel.tsx — \"OPERATIONAL BRIEFING\" 부재", () => {
    expect(FILES.queueDetailPanel).not.toMatch(/OPERATIONAL BRIEFING/);
  });

  it("inventory-context-panel.tsx — \"OPERATIONAL BRIEFING\" 부재", () => {
    expect(FILES.inventoryContextPanel).not.toMatch(/OPERATIONAL BRIEFING/);
  });

  it("surface-header.tsx — \"OPERATIONAL BRIEFING\" 부재", () => {
    expect(FILES.surfaceHeader).not.toMatch(/OPERATIONAL BRIEFING/);
  });

  it("operational-detail-shell.tsx — \"OPERATIONAL BRIEFING\" 부재", () => {
    expect(FILES.operationalDetailShell).not.toMatch(/OPERATIONAL BRIEFING/);
  });

  it("purchases/page.tsx — \"OPERATIONAL BRIEFING\" 부재", () => {
    expect(FILES.purchasesPage).not.toMatch(/OPERATIONAL BRIEFING/);
  });

  it("quotes/page.tsx — \"OPERATIONAL BRIEFING\" 부재", () => {
    expect(FILES.quotesPage).not.toMatch(/OPERATIONAL BRIEFING/);
  });
});

describe("§11.279c — 한글 \"운영 브리핑\" 정합 (7 spot 한글 라벨)", () => {
  it("inbox/page.tsx — 한글 \"운영 브리핑\" 존재", () => {
    expect(FILES.inbox).toMatch(/운영 브리핑/);
  });

  it("queue-detail-panel.tsx — 한글 \"운영 브리핑\" 존재", () => {
    expect(FILES.queueDetailPanel).toMatch(/운영 브리핑/);
  });

  it("inventory-context-panel.tsx — 한글 \"운영 브리핑\" 존재", () => {
    expect(FILES.inventoryContextPanel).toMatch(/운영 브리핑/);
  });

  it("surface-header.tsx — 한글 \"운영 브리핑\" 존재", () => {
    expect(FILES.surfaceHeader).toMatch(/운영 브리핑/);
  });

  it("operational-detail-shell.tsx — 한글 \"운영 브리핑\" 존재", () => {
    expect(FILES.operationalDetailShell).toMatch(/운영 브리핑/);
  });

  it("purchases/page.tsx — 한글 \"운영 브리핑\" 존재", () => {
    expect(FILES.purchasesPage).toMatch(/운영 브리핑/);
  });

  it("quotes/page.tsx — 한글 \"운영 브리핑\" 존재", () => {
    expect(FILES.quotesPage).toMatch(/운영 브리핑/);
  });
});

describe("§11.279c — sent tracking 영문 statusLabel 부재 (vendor-dispatch-workbench)", () => {
  it("vendor-dispatch-workbench — statusLabel \"sent tracking\" 부재", () => {
    expect(FILES.vendorDispatchWorkbench).not.toMatch(/"sent tracking"/);
  });

  it("vendor-dispatch-workbench — 한글 \"전송 추적\" statusLabel 존재", () => {
    expect(FILES.vendorDispatchWorkbench).toMatch(/"전송 추적"/);
  });

  it("vendor-dispatch-workbench — failedCount 분기 보존 (canonical setSentTracking 호출)", () => {
    expect(FILES.vendorDispatchWorkbench).toMatch(/setSentTracking/);
    expect(FILES.vendorDispatchWorkbench).toMatch(/failedCount > 0/);
  });
});

describe("§11.279c — visual invariant 보존 (한글 라벨 visual hierarchy)", () => {
  it("eyebrow font-bold + text-blue-700 (한글 swap 후에도 visual hierarchy)", () => {
    // 최소 7 spot 의 eyebrow span 들이 font-bold + text-blue-700 보존
    expect(FILES.inbox).toMatch(/text-blue-700/);
    expect(FILES.queueDetailPanel).toMatch(/text-blue-700/);
    expect(FILES.inventoryContextPanel).toMatch(/text-blue-700/);
    expect(FILES.surfaceHeader).toMatch(/text-blue-700/);
    expect(FILES.operationalDetailShell).toMatch(/text-blue-700/);
    expect(FILES.purchasesPage).toMatch(/text-blue-700/);
    expect(FILES.quotesPage).toMatch(/text-blue-700/);
  });
});
