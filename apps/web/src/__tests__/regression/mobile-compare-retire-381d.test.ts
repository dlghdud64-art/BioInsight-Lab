/**
 * §11.381d — mobile compare 라우트 retire + 알림 deep-link 재배선 sentinel
 *
 * 호영님 결정 (2026-06-11): web §11.381c retire 와의 canonical fork 해소.
 *   배경: §11.381c-2 orphan 제거가 web-only grep 사각으로 mobile
 *   compare/[id].tsx 의 /api/compare-sessions/[id] 소비를 놓침 → push
 *   알림 deep-link(/compare/{id})가 dead API 를 치는 broken link 발생.
 *
 * Fix:
 *   - app/compare/[id].tsx 삭제 (소비 API 부재 + canonical fork)
 *   - notifications.ts compare 타입 재배선: 과거 알림 payload 호환을 위해
 *     타입은 보존, 목적지만 mobile 소싱 canonical((tabs)/search)로 전환
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const NOTIF = "../mobile/lib/notifications.ts";

describe("§11.381d — mobile compare 라우트 retire", () => {
  it("app/compare/[id].tsx 부재 (canonical fork 해소)", () => {
    expect(existsSync(join(APP_WEB_ROOT, "../mobile/app/compare/[id].tsx"))).toBe(false);
  });

  it("dead API 참조 0 — mobile 에서 /api/compare-sessions 소비 부재", () => {
    const notif = read(NOTIF);
    expect(notif).not.toMatch(/compare-sessions/);
  });
});

describe("§11.381d — 알림 deep-link 재배선 (과거 payload 호환)", () => {
  it("compare 타입 보존 + 목적지 (tabs)/search 전환 (/compare/{id} 참조 0)", () => {
    const src = read(NOTIF);
    expect(src).toMatch(/"compare"/);
    expect(src).not.toMatch(/\/compare\/\$\{id\}|`\/compare\/`/);
    expect(src).toMatch(/compare:\s*\{[\s\S]{0,400}\(tabs\)\/search/);
  });

  it("기존 알림 타입 route 보존 (quote·purchase·inventory·inspection·receiving)", () => {
    const src = read(NOTIF);
    expect(src).toMatch(/quote:\s*\{[\s\S]{0,120}\/quotes\/\$\{id\}/);
    expect(src).toMatch(/purchase:\s*\{[\s\S]{0,120}\/purchases\/\$\{id\}/);
    expect(src).toMatch(/inventory:\s*\{[\s\S]{0,120}\/inventory\/\$\{id\}/);
    expect(src).toMatch(/inspection\?inventoryId=/);
    expect(src).toMatch(/lot-receive\?inventoryId=/);
  });
});
