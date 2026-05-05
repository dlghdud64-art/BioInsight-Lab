/**
 * §11.209d-notification-inapp-server-wiring Phase 1 — RED test
 *
 * lib/notifications/event-types.ts 에 3 결재-specific 신규 event type
 * 추가 정합:
 *   - PURCHASE_APPROVAL_REQUESTED — approver 수신, IN_APP + QUEUE_ITEM
 *   - PURCHASE_APPROVED — requester 수신, IN_APP
 *   - PURCHASE_REJECTED — requester 수신, IN_APP
 *
 * canonical truth: dispatchNotificationEvent (이미 land) — 본 batch 는
 * 신규 type 정의만 추가. EMAIL_DRAFT 제외 (Stage 1 sendEmail 이 직접
 * 처리 — contract 충돌 차단).
 *
 * entityType = "PURCHASE_REQUEST" (Stage 1 와 일관).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
const EVENT_TYPES = "src/lib/notifications/event-types.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.209d-notification-inapp-server-wiring — 3 신규 event type", () => {
  it("NOTIFICATION_EVENT_TYPES 에 PURCHASE_APPROVAL_REQUESTED 추가", () => {
    const src = read(EVENT_TYPES);
    expect(src).toMatch(/PURCHASE_APPROVAL_REQUESTED:\s*["']PURCHASE_APPROVAL_REQUESTED["']/);
  });

  it("NOTIFICATION_EVENT_TYPES 에 PURCHASE_APPROVED 추가", () => {
    const src = read(EVENT_TYPES);
    expect(src).toMatch(/PURCHASE_APPROVED:\s*["']PURCHASE_APPROVED["']/);
  });

  it("NOTIFICATION_EVENT_TYPES 에 PURCHASE_REJECTED 추가", () => {
    const src = read(EVENT_TYPES);
    expect(src).toMatch(/PURCHASE_REJECTED:\s*["']PURCHASE_REJECTED["']/);
  });
});

describe("§11.209d-notification-inapp-server-wiring — EVENT_TYPE_META 확장", () => {
  it("PURCHASE_APPROVAL_REQUESTED meta — entityType=PURCHASE_REQUEST + IN_APP + QUEUE_ITEM", () => {
    const src = read(EVENT_TYPES);
    // EVENT_TYPE_META 안의 PURCHASE_APPROVAL_REQUESTED 블록
    expect(src).toMatch(/PURCHASE_APPROVAL_REQUESTED:\s*\{[\s\S]*?entityType:\s*["']PURCHASE_REQUEST["']/);
    expect(src).toMatch(/PURCHASE_APPROVAL_REQUESTED:\s*\{[\s\S]*?defaultActions:\s*\[[\s\S]*?["']IN_APP["'][\s\S]*?["']QUEUE_ITEM["']/);
  });

  it("PURCHASE_APPROVED meta — entityType=PURCHASE_REQUEST + IN_APP only (EMAIL_DRAFT 제외)", () => {
    const src = read(EVENT_TYPES);
    expect(src).toMatch(/PURCHASE_APPROVED:\s*\{[\s\S]*?entityType:\s*["']PURCHASE_REQUEST["']/);
    // PURCHASE_APPROVED 의 defaultActions 안에 IN_APP 명시
    const approvedBlock = src.match(/PURCHASE_APPROVED:\s*\{[\s\S]*?defaultActions:\s*(\[[^\]]*\])/);
    expect(approvedBlock).not.toBeNull();
    if (approvedBlock) {
      expect(approvedBlock[1]).toMatch(/["']IN_APP["']/);
      // EMAIL_DRAFT 잔존 0 (Stage 1 sendEmail 이 직접 처리)
      expect(approvedBlock[1]).not.toMatch(/EMAIL_DRAFT/);
    }
  });

  it("PURCHASE_REJECTED meta — entityType=PURCHASE_REQUEST + IN_APP only", () => {
    const src = read(EVENT_TYPES);
    expect(src).toMatch(/PURCHASE_REJECTED:\s*\{[\s\S]*?entityType:\s*["']PURCHASE_REQUEST["']/);
    const rejectedBlock = src.match(/PURCHASE_REJECTED:\s*\{[\s\S]*?defaultActions:\s*(\[[^\]]*\])/);
    expect(rejectedBlock).not.toBeNull();
    if (rejectedBlock) {
      expect(rejectedBlock[1]).toMatch(/["']IN_APP["']/);
      expect(rejectedBlock[1]).not.toMatch(/EMAIL_DRAFT/);
    }
  });

  it("3 신규 type 모두 한국어 label 명시", () => {
    const src = read(EVENT_TYPES);
    // PURCHASE_APPROVAL_REQUESTED label
    expect(src).toMatch(/PURCHASE_APPROVAL_REQUESTED:\s*\{[\s\S]*?label:\s*["'][^"']*결재[^"']*["']/);
    expect(src).toMatch(/PURCHASE_APPROVED:\s*\{[\s\S]*?label:\s*["'][^"']*승인[^"']*["']/);
    expect(src).toMatch(/PURCHASE_REJECTED:\s*\{[\s\S]*?label:\s*["'][^"']*반려[^"']*["']/);
  });

  it("§11.209d-notification-inapp-server-wiring 코멘트 명시 (drift 차단)", () => {
    const src = read(EVENT_TYPES);
    expect(src).toMatch(/§11\.209d-notification-inapp-server-wiring|11\.209d-notification-inapp-server-wiring|§11\.209d-notification-inapp/);
  });
});
