/**
 * 알림 고도화 #notif-inventory-received — 입고 완료 INVENTORY_RECEIVED trigger 배선
 *
 * 인프라(dispatcher/UI/href/preference)는 §11.209d Stage 2 완비. 갭 = 재고/발주
 *   eventType 의 dispatchNotificationEvent caller 0(dead code). 본 배선으로 입고
 *   완료 시 INVENTORY_RECEIVED 알림 생성 → bell/모바일 노출.
 *
 * 원칙: best-effort(메인 mutation 비차단), 소유자+조직 OWNER/ADMIN 브로드캐스트(공통 헬퍼),
 *   dead 알림 0(buildNotificationHref INVENTORY 커버 기존). sentinel(readFileSync+regex).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", ".."); // apps/web
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const RECIPIENTS = "src/lib/notifications/recipients.ts";
const INDEX = "src/lib/notifications/index.ts";
const ROUTE = "src/app/api/inventory/smart-receiving/route.ts";

describe("알림 — resolveOrgRecipients 공통 헬퍼", () => {
  it("소유자 + 조직 OWNER/ADMIN dedup(Set) + graceful fallback", () => {
    const src = read(RECIPIENTS);
    expect(src).toMatch(/export async function resolveOrgRecipients/);
    expect(src).toMatch(/role:\s*\{\s*in:\s*\["OWNER",\s*"ADMIN"\]/);
    expect(src).toMatch(/new Set<string>\(\)/);
    expect(src).toMatch(/catch/); // org 조회 실패 시 owner fallback
  });

  it("index 에서 resolveOrgRecipients export", () => {
    const src = read(INDEX);
    expect(src).toMatch(/resolveOrgRecipients/);
  });
});

describe("알림 — smart-receiving INVENTORY_RECEIVED trigger", () => {
  it("dispatch import + 두 분기(기존/신규) 모두 INVENTORY_RECEIVED", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/import \{ dispatchNotificationEvent, resolveOrgRecipients \}/);
    const received = src.match(/eventType:\s*"INVENTORY_RECEIVED"/g) ?? [];
    expect(received.length).toBe(2); // 기존 매칭재고 + 신규 품목
    expect(src).toMatch(/entityType:\s*"INVENTORY"/);
  });

  it("best-effort — dispatch 실패가 mutation 차단 안 함(try-catch)", () => {
    const src = read(ROUTE);
    // dispatch 는 try/catch 로 감싸 실패 시 console.error 만(throw 0 → response 정상 반환).
    expect(src).toMatch(/INVENTORY_RECEIVED dispatch 실패/);
    expect(src).toMatch(/resolveOrgRecipients\(/);
  });

  it("isNewProduct 구분 metadata (기존 false / 신규 true)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/isNewProduct:\s*false/);
    expect(src).toMatch(/isNewProduct:\s*true/);
  });
});

describe("알림 — 회귀 0", () => {
  it("smart-receiving 기존 transaction/audit/응답 보존", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/db\.\$transaction/);
    expect(src).toMatch(/createAuditLog/);
    expect(src).toMatch(/isNew:\s*false/);
    expect(src).toMatch(/isNew:\s*true/);
  });
});
