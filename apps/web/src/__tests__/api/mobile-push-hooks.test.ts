/**
 * #mobile-push-notification Phase 2 server hook — RED→GREEN test
 *
 * 3 결재 mutation route 에 sendPushNotification dispatch:
 *   - request-approval — approver 에게 "결재 요청 도착" push
 *   - approve — requester 에게 "결재 승인 완료" push
 *   - reject — requester 에게 "결재 반려" push (rejectionReason 포함)
 *
 * Lock:
 *   - try/catch graceful (push fail → mutation 영향 0)
 *   - mutation 성공 후 호출 (Stage 1 email + Stage 2 in-app 패턴)
 *   - data field 에 deep link metadata (quoteId / requestId)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("#mobile-push-notification Phase 2 — request-approval", () => {
  const ROUTE =
    "src/app/api/work-queue/purchase-conversion/[quoteId]/request-approval/route.ts";

  it("sendPushNotification import (lib/notifications/push-sender)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/sendPushNotification/);
    expect(src).toMatch(/from\s+["']@\/lib\/notifications\/push-sender["']/);
  });

  it("approverId 대상 sendPushNotification 호출 + title/body 한국어", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/sendPushNotification\(\s*approverId/);
    expect(src).toMatch(/title:\s*["'][^"']*결재 요청[^"']*["']/);
  });

  it("data field 에 deep link metadata (type / quoteId)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/data:\s*\{[\s\S]*?quoteId/);
  });

  it("try/catch graceful (push fail → mutation 정합 유지)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/try[\s\S]*?sendPushNotification[\s\S]*?catch/);
  });
});

describe("#mobile-push-notification Phase 2 — approve route", () => {
  const ROUTE = "src/app/api/request/[id]/approve/route.ts";

  it("sendPushNotification import", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/sendPushNotification/);
  });

  it("requesterId 대상 sendPushNotification 호출 + title 한국어 (승인)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/sendPushNotification\([\s\S]*?requesterId/);
    expect(src).toMatch(/title:\s*["'][^"']*승인[^"']*["']/);
  });

  it("try/catch graceful", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/try[\s\S]*?sendPushNotification[\s\S]*?catch/);
  });
});

describe("#mobile-push-notification Phase 2 — reject route", () => {
  const ROUTE = "src/app/api/request/[id]/reject/route.ts";

  it("sendPushNotification import", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/sendPushNotification/);
  });

  it("requesterId 대상 + title 한국어 (반려) + body 에 rejection reason", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/sendPushNotification\([\s\S]*?requesterId/);
    expect(src).toMatch(/title:\s*["'][^"']*반려[^"']*["']/);
    // rejection reason 포함 (body 에 reason 변수 사용)
    expect(src).toMatch(/body:[\s\S]*?reason|body:[\s\S]*?rejectedReason/);
  });

  it("try/catch graceful", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/try[\s\S]*?sendPushNotification[\s\S]*?catch/);
  });
});
