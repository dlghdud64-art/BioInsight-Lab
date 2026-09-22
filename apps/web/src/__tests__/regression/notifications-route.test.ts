/**
 * §notifications-route (2026-09-22 · 호영님 P1 최상단) · **알림 출처가 살아 있고, 본인 것만, 참으로 센다.**
 *
 * ── 왜 ──
 * 헤더 종 · 알림 센터 · 모바일이 `/api/notifications` 를 부르는데 라우트가 없었다(§11.90 f87aa9a2 에서 삭제된 뒤
 * 소비자만 다시 배선). 가짜 알림을 걷어낸(§notifications-single-source) 결과 세 화면이 **영구 0** 이 됐다.
 * 라우트만 되살리면 끝나지 않았다 — 원장 쪽에 두 결함이 더 있었다:
 *   ⓐ IN_APP 은 PENDING 으로 생기고 PENDING → SENT 를 옮기는 executor 는 호출자 0.
 *      미읽음을 SENT 로만 세면 **항상 0**, 읽음 처리는 SENT 만 받아 **항상 무시**(prod IN_APP 6행 전량 PENDING).
 *   ⓑ markNotificationRead 가 id 만으로 갱신 — 호출자가 소유 확인을 빠뜨리면 남의 알림을 읽음 처리한다.
 * 그리고 prod 재고 알림 3건은 품목명이 `productName` 에 있는데 문구는 `itemName` 을 읽어 「… 재고」 로만 보였다.
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① GET 은 로그인 사용자의 IN_APP 만 낸다(수신자 = 본인 · 종류는 원장이 정한다) · 비로그인 401
 *   ② 알림 종류를 이 라우트에서 새로 만들지 않는다 — 이벤트 생성 POST 0 · 다른 테이블 조회 0
 *   ③ 미읽음 = IN_APP · 상태 {PENDING, SENT} · readAt 없음 (집합 리터럴)
 *   ④ 읽음 처리는 본인 것만 — 조건부 갱신에 recipientId 가 있고, 남의 것·없는 것은 같은 404
 *   ⑤ 재고 알림 문구는 생산자가 쓰는 `productName` 을 읽고, 내부 키(eventType)를 화면에 내지 않는다(웹·모바일)
 *
 * ── 자기 한계 ──
 *   1. 어떤 이벤트가 **언제 발생하는가**(dispatch 경로)는 보지 않는다 — notif-inventory-* sentinel 몫.
 *   2. 알림 센터 화면 항목 클릭은 읽음 처리를 하지 않는다(헤더 종만 한다). 이 파일은 그걸 요구하지 않는다.
 *   3. PENDING → SENT executor 는 여전히 호출자 0 이다. 여기선 IN_APP 의 PENDING 을 "도착" 으로 읽는 쪽으로 닫았다.
 */
import { mockJsonResponse } from "@/__tests__/helpers/response-mock";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

vi.mock("next/server", () => ({
  NextResponse: {
    json: (data: unknown, init?: { status?: number }) => mockJsonResponse(data, init),
  },
}));
vi.mock("@/auth", () => ({ auth: vi.fn(async () => null) }));
vi.mock("@/lib/auth/mobile-jwt", () => ({ getAuthUser: vi.fn() }));
vi.mock("@/lib/db", () => ({
  db: {
    notificationAction: {
      findMany: vi.fn(),
      count: vi.fn(),
      updateMany: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import { db } from "@/lib/db";
import { getAuthUser } from "@/lib/auth/mobile-jwt";
import { GET } from "@/app/api/notifications/route";
import { POST as READ } from "@/app/api/notifications/[id]/read/route";
import { IN_APP_UNREAD_STATUSES } from "@/lib/notifications/notification-query";
import { buildNotificationText } from "@/lib/notifications/event-category-map";
import type { NotificationItem } from "@/lib/notifications/notification-query";

const na = (db as unknown as { notificationAction: Record<string, ReturnType<typeof vi.fn>> }).notificationAction;
const asUser = (id: string | null) =>
  (getAuthUser as unknown as ReturnType<typeof vi.fn>).mockResolvedValue(id ? { id } : null);
const req = (url: string) => ({ url }) as never;
const params = (id: string) => ({ params: Promise.resolve({ id }) });

const SRC = join(__dirname, "..", "..");
const code = (rel: string) => stripComments(readFileSync(join(SRC, rel), "utf8"));
const ROUTE = "app/api/notifications/route.ts";
const READ_ROUTE = "app/api/notifications/[id]/read/route.ts";

beforeEach(() => {
  vi.clearAllMocks();
  na.findMany.mockResolvedValue([]);
  na.count.mockResolvedValue(0);
});

describe("§notifications-route · 알림 출처", () => {
  it("① GET · 비로그인 401 · 로그인 사용자의 IN_APP 만 · 응답 모양", async () => {
    asUser(null);
    expect((await GET(req("http://x/api/notifications"))).status).toBe(401);
    expect(na.findMany).not.toHaveBeenCalled();

    asUser("u1");
    na.count.mockResolvedValue(3);
    const res = await GET(req("http://x/api/notifications?actionType=EMAIL_DRAFT&limit=500&offset=-4"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ notifications: [], unreadCount: 3, limit: 100, offset: 0 });
    const where = na.findMany.mock.calls[0][0].where;
    expect(where.recipientId).toBe("u1");
    // 쿼리의 actionType 을 따르지 않는다 — 이 라우트는 인앱만 낸다
    expect(where.actionType).toBe("IN_APP");
  });

  it("② 이 라우트에서 알림 종류를 만들지 않는다 (POST 0 · 원장 밖 조회 0)", () => {
    const src = code(ROUTE);
    expect(src).not.toMatch(/export\s+async\s+function\s+POST\b/);
    expect(src).not.toMatch(/\bdispatchNotificationEvent\b/);
    expect(src).not.toMatch(/\bdb\.\w+/); // 직접 조회 0 · 원장 조회 함수만
    expect(src).toMatch(/\bgetUserNotifications\(user\.id,/);
    expect(src).toMatch(/\bgetUnreadCount\(user\.id\)/);
  });

  it("③ 미읽음 = IN_APP · {PENDING, SENT} · readAt 없음", async () => {
    expect([...IN_APP_UNREAD_STATUSES].sort()).toEqual(["PENDING", "SENT"]);
    asUser("u1");
    await GET(req("http://x/api/notifications"));
    const where = na.count.mock.calls[0][0].where;
    expect(where).toEqual({
      recipientId: "u1",
      actionType: "IN_APP",
      status: { in: ["PENDING", "SENT"] },
      readAt: null,
    });
  });

  it("④ 읽음 처리 · 본인 것만 · 남의 것·없는 것은 같은 404", async () => {
    asUser(null);
    expect((await READ(req("http://x"), params("a1"))).status).toBe(401);
    expect(na.updateMany).not.toHaveBeenCalled();

    asUser("u1");
    na.updateMany.mockResolvedValue({ count: 1 });
    const ok = await READ(req("http://x"), params("a1"));
    expect(ok.status).toBe(200);
    expect(await ok.json()).toEqual({ success: true, alreadyRead: false });
    const w = na.updateMany.mock.calls[0][0].where;
    expect(w).toEqual({
      id: "a1",
      recipientId: "u1",
      actionType: "IN_APP",
      status: { in: ["PENDING", "SENT"] },
      readAt: null,
    });

    // 남의 알림 — 조건부 갱신 0행 + 본인 소유 조회도 0 → 404
    na.updateMany.mockResolvedValue({ count: 0 });
    na.findFirst.mockResolvedValue(null);
    expect((await READ(req("http://x"), params("someone-elses"))).status).toBe(404);
    expect(na.findFirst.mock.calls[0][0].where.recipientId).toBe("u1");

    // 이미 읽은 본인 알림 — 성공 · alreadyRead
    na.findFirst.mockResolvedValue({ id: "a1" });
    const again = await READ(req("http://x"), params("a1"));
    expect(again.status).toBe(200);
    expect(await again.json()).toEqual({ success: true, alreadyRead: true });

    // id 만으로 갱신하는 형태가 돌아오지 않는다
    expect(code("lib/notifications/notification-query.ts")).not.toMatch(/notificationAction\.update\(/);
    expect(code(READ_ROUTE)).toMatch(/\bmarkNotificationRead\(id,\s*user\.id\)/);
  });

  it("⑤ 재고 알림 문구는 productName 을 읽고 내부 키를 내지 않는다 (웹 · 모바일)", () => {
    const item = (eventType: string, metadata: Record<string, unknown>) =>
      ({ event: { eventType, metadata }, payload: null }) as unknown as NotificationItem;
    // prod 실측 모양(2026-09-22): EXPIRING 은 productName, RECEIVED 는 multi·lineCount
    expect(buildNotificationText(item("INVENTORY_EXPIRING", { productName: "Trypsin-EDTA" }))).toBe(
      "유효기한 임박 · Trypsin-EDTA",
    );
    expect(buildNotificationText(item("INVENTORY_LOW", { productName: "PBS" }))).toBe("재고 부족 · PBS");
    expect(buildNotificationText(item("INVENTORY_RECEIVED", { multi: true, lineCount: 3 }))).toBe("입고 완료 · 3개 품목");
    expect(buildNotificationText(item("INVENTORY_EXPIRING", {}))).toBe("유효기한 임박");
    expect(buildNotificationText(item("SOME_FUTURE_EVENT", {}))).toBe("새 알림");

    const mobile = stripComments(readFileSync(join(SRC, "..", "..", "mobile", "lib", "event-category-map.ts"), "utf8"));
    for (const [name, src] of [["web", code("lib/notifications/event-category-map.ts")], ["mobile", mobile]] as const) {
      expect(src, `${name}: productName`).toMatch(/meta\.productName\b/);
      expect(src, `${name}: 내부 키 노출`).not.toMatch(/`[^`]*\$\{eventType\}[^`]*`/);
      expect(src, `${name}: 품목명 대신 「재고」`).not.toMatch(/\?\?\s*"재고"/);
    }
  });
});
