/**
 * §11.348-A 후속 (회귀) — 회신 도착 알림 + 라벨 재출력 sentinel
 *
 * (1) A-2 회신 제출(PENDING_REVIEW) → 연구소(소유자 + org OWNER/ADMIN) 알림
 *     (VENDOR_REPLIED 재사용, dispatch + push, graceful). 재고 mutation 0 유지.
 * (2) A-4b 패널: 승인 후 모달 닫아도 방금 확정분 라벨 재출력 어포던스.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
function codeOnly(rel: string): string {
  return read(rel).replace(/\/\*[\s\S]*?\*\//g, "").split("\n").map((l) => l.replace(/\/\/.*$/, "")).join("\n");
}
const RESP = "src/app/api/receiving/[token]/response/route.ts";
const PANEL = "src/components/receiving/receiving-review-panel.tsx";

describe("§11.348-A-2-notify — 회신 도착 알림", () => {
  it("dispatch + push + 연구소 수신자(소유자+org OWNER/ADMIN)", () => {
    const src = read(RESP);
    expect(src).toContain("dispatchNotificationEvent");
    expect(src).toContain("sendPushNotification");
    expect(src).toContain('eventType: "VENDOR_REPLIED"');
    expect(src).toContain('role: { in: ["OWNER", "ADMIN"] }');
    expect(src).toContain("recipientUserIds");
    expect(src).toContain("입고 회신 도착");
  });
  it("불변 유지 — 알림 경로에도 재고 mutation 0", () => {
    const code = codeOnly(RESP);
    expect(code).not.toContain("productInventory");
    expect(code).not.toContain("inventoryRestock");
  });
});

describe("§11.348-A-5b — 라벨 재출력 어포던스", () => {
  it("모달 닫힌 뒤 방금 확정분 재출력 버튼", () => {
    const src = read(PANEL);
    expect(src).toContain("labelItems.length > 0 && !labelOpen");
    expect(src).toContain("라벨 재출력");
    expect(src).toContain("setLabelOpen(true)");
  });
});
