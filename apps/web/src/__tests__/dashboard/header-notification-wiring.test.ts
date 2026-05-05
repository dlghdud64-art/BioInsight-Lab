/**
 * §11.209d-notification-inapp-web-bell-ui Phase 1 — RED test
 *
 * Header.tsx 의 mock notifications array → /api/notifications 실제 데이터
 * swap. 사용자에게 false notification 표시 0 (canonical truth = API).
 *
 * Source-level grep 검증:
 *   - 하드코딩 mock notifications array 잔존 0
 *   - useQuery 호출 (/api/notifications, actionType=IN_APP)
 *   - useMutation 호출 (/api/notifications/${id}/read)
 *   - lib/notifications/event-category-map import + 사용
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const HEADER = "src/components/dashboard/Header.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.209d-notification-inapp-web-bell-ui — Header mock 제거", () => {
  it("하드코딩된 mock notifications array (id: 1~8) 잔존 0", () => {
    const src = read(HEADER);
    // mock array 의 특정 패턴 (id: 1, category: "stock_alert", read: false 같은 inline data) 잔존 0
    // 실제 mock 의 첫 entry: { id: 1, category: "stock_alert", read: false, text: "..."
    expect(src).not.toMatch(/id:\s*1,\s*category:\s*["']stock_alert["']/);
    expect(src).not.toMatch(/id:\s*2,\s*category:\s*["']expiry_warning["']/);
  });

  it("useState<Notification\\[\\]>(... mock array) 패턴 제거", () => {
    const src = read(HEADER);
    // 8 entry mock array 가 useState 안에 있는 패턴 차단
    expect(src).not.toMatch(/useState<Notification\[\]>\(\[[\s\S]*?id:\s*1,/);
  });
});

describe("§11.209d-notification-inapp-web-bell-ui — Header useQuery wiring", () => {
  it("useQuery import (react-query)", () => {
    const src = read(HEADER);
    expect(src).toMatch(/useQuery/);
  });

  it("/api/notifications fetch 호출 (actionType=IN_APP filter)", () => {
    const src = read(HEADER);
    expect(src).toMatch(/\/api\/notifications/);
    expect(src).toMatch(/actionType[=:][^,)]*IN_APP/);
  });

  it("queryKey ['notifications'] 또는 ['notifications', ...] 정의", () => {
    const src = read(HEADER);
    expect(src).toMatch(/queryKey:\s*\[\s*["']notifications["']/);
  });
});

describe("§11.209d-notification-inapp-web-bell-ui — Header read mutation", () => {
  it("useMutation import", () => {
    const src = read(HEADER);
    expect(src).toMatch(/useMutation/);
  });

  it("/api/notifications/${id}/read POST 호출", () => {
    const src = read(HEADER);
    expect(src).toMatch(/\/api\/notifications\/\$\{[^}]+\}\/read/);
  });

  it("onSuccess invalidate ['notifications'] (refetch)", () => {
    const src = read(HEADER);
    expect(src).toMatch(/invalidateQueries[\s\S]*?["']notifications["']/);
  });
});

describe("§11.209d-notification-inapp-web-bell-ui — event-category-map import", () => {
  it("eventTypeToCategory / buildNotificationText / buildNotificationHref / formatNotificationTime import", () => {
    const src = read(HEADER);
    expect(src).toMatch(/eventTypeToCategory/);
    expect(src).toMatch(/buildNotificationText/);
    expect(src).toMatch(/buildNotificationHref/);
    expect(src).toMatch(/formatNotificationTime/);
  });

  it("@/lib/notifications/event-category-map import path", () => {
    const src = read(HEADER);
    expect(src).toMatch(/from\s+["']@\/lib\/notifications\/event-category-map["']/);
  });
});

describe("§11.209d-notification-inapp-web-bell-ui — drift 차단", () => {
  it("§11.209d-notification-inapp-web-bell-ui 코멘트 명시", () => {
    const src = read(HEADER);
    expect(src).toMatch(/§11\.209d-notification-inapp-web-bell-ui|11\.209d-notification-inapp-web-bell-ui/);
  });
});
