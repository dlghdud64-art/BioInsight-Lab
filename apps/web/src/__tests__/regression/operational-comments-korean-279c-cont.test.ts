/**
 * §11.279c-cont #operational-comments-korean — comment/JSDoc 영문 잔존 P3 sweep
 *   (§11.279c 후속 P3 backlog, ADR-002 명시).
 *
 * 호영님 결정 (2026-05-23): 잔여 3 spot comment/JSDoc 영문 한글 sweep.
 *   사용자 비노출 (dev-only) 이나 일관성 유지.
 *
 * Audit 결과 (Phase 0):
 *   1. vendor-dispatch-workbench.tsx:806 — comment `"Send to supplier disabled"`
 *      (SR aria-label lineage 표기 안)
 *   2. operator-quick-actions.tsx:210 — comment `Send to supplier 버튼`
 *      (펼친 카드 UI lineage 표기 안)
 *   3. send-confirmation-reentry-engine.ts:2 — JSDoc `Send Confirmation Re-entry
 *      Engine — final resend confirmation + ... + sent tracking handoff`
 *
 * Fix (minimum diff, 3 file 3 spot 한글 swap, lineage 보존):
 *   - dev-only comment 영문 lineage 한글로 변환
 *   - 변수/함수/타입명 변경 0 (lineage 단어 보존)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const FILES = {
  vendorDispatchWorkbench: readFileSync(
    resolve(__dirname, "../../components/quotes/dispatch/vendor-dispatch-workbench.tsx"),
    "utf8",
  ),
  operatorQuickActions: readFileSync(
    resolve(__dirname, "../../components/dashboard/operator-quick-actions.tsx"),
    "utf8",
  ),
  sendConfirmationReentryEngine: readFileSync(
    resolve(__dirname, "../../lib/ai/send-confirmation-reentry-engine.ts"),
    "utf8",
  ),
};

describe("§11.279c-cont — comment/JSDoc 영문 잔존 한글 sweep", () => {
  it("§11.279c-cont trace marker 존재 (최소 1 spot)", () => {
    const hasMarker = Object.values(FILES).some((src) =>
      /§11\.279c-cont/.test(src),
    );
    expect(hasMarker).toBe(true);
  });

  it("vendor-dispatch-workbench — comment 안 \"Send to supplier disabled\" 영문 부재", () => {
    expect(FILES.vendorDispatchWorkbench).not.toMatch(/"Send to supplier disabled"/);
  });

  it("operator-quick-actions — comment 안 \"Send to supplier 버튼\" 영문 잔존 부재", () => {
    expect(FILES.operatorQuickActions).not.toMatch(/Send to supplier 버튼/);
  });

  it("send-confirmation-reentry-engine — JSDoc 안 \"Send Confirmation Re-entry Engine\" 영문 부재", () => {
    expect(FILES.sendConfirmationReentryEngine).not.toMatch(/Send Confirmation Re-entry Engine —/);
  });

  it("send-confirmation-reentry-engine — JSDoc 안 \"sent tracking handoff\" 영문 부재", () => {
    expect(FILES.sendConfirmationReentryEngine).not.toMatch(/sent tracking handoff/);
  });
});

describe("§11.279c-cont — invariant 보존 (변수/함수/타입명 lineage 보존)", () => {
  it("vendor-dispatch-workbench — aria-label \"공급사 요청 전달 (비활성)\" 보존", () => {
    expect(FILES.vendorDispatchWorkbench).toMatch(/aria-label="공급사 요청 전달 \(비활성\)"/);
  });

  it("operator-quick-actions — setIsQuoteDispatchExpanded toggle 함수 보존", () => {
    expect(FILES.operatorQuickActions).toMatch(/setIsQuoteDispatchExpanded/);
  });

  it("send-confirmation-reentry-engine — type SendConfirmationReentryHandoff import 보존", () => {
    expect(FILES.sendConfirmationReentryEngine).toMatch(
      /import type \{ SendConfirmationReentryHandoff \}/,
    );
  });

  it("send-confirmation-reentry-engine — type SendConfirmationReentryStatus / Substatus 보존", () => {
    expect(FILES.sendConfirmationReentryEngine).toMatch(
      /export type SendConfirmationReentryStatus/,
    );
    expect(FILES.sendConfirmationReentryEngine).toMatch(
      /export type SendConfirmationReentrySubstatus/,
    );
  });
});
