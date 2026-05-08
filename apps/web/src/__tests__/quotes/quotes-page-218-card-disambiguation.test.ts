/**
 * §11.218 카드 구분자 — PBS 3건 disambiguation regression guard
 *
 * Goal: 같은 품목 다른 quote 의 sub-context 노출 — 요청자 / 부서 / 요청 일자.
 *
 * canonical truth lock:
 *   - /api/quotes GET 응답에 user.name + organization.name forward.
 *   - QuoteCard 의 displayTitle 아래 sub-context 노출 (조용한 시각적 라벨).
 *   - 한국어 라벨 + sr-only.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROUTE_PATH = resolve(__dirname, "../../app/api/quotes/route.ts");
const PAGE_PATH = resolve(__dirname, "../../app/dashboard/quotes/page.tsx");

const routeSource = readFileSync(ROUTE_PATH, "utf8");
const pageSource = readFileSync(PAGE_PATH, "utf8");

describe("§11.218 — /api/quotes GET include user + organization", () => {
  it("user.select 에 name 포함 (요청자 forward)", () => {
    expect(routeSource).toMatch(/user:\s*\{[\s\S]*?select:\s*\{[\s\S]*?name:\s*true/);
  });

  it("organization.select 에 name 포함 (부서/조직 forward)", () => {
    expect(routeSource).toMatch(/organization:\s*\{[\s\S]*?select:\s*\{[\s\S]*?name:\s*true/);
  });

  it("response mapping 에 user / organization forward", () => {
    expect(routeSource).toMatch(/user:\s*q\.user|user:\s*\{[\s\S]*?name:/);
    expect(routeSource).toMatch(/organization:\s*q\.organization|organization:\s*\{[\s\S]*?name:/);
  });

  it("§11.218 주석 marker", () => {
    expect(routeSource).toMatch(/§11\.218|card disambiguation|requester forward/i);
  });
});

describe("§11.218 — QuoteCard sub-context 표시", () => {
  it("Quote interface 에 user / organization 보유", () => {
    expect(pageSource).toMatch(/user\?:\s*\{[\s\S]*?name:|user\?:\s*[A-Z][a-zA-Z]*\s*\|/);
    expect(pageSource).toMatch(/organization\?:\s*\{[\s\S]*?name:|organization\?:\s*[A-Z][a-zA-Z]*\s*\|/);
  });

  it("QuoteCard 의 displayTitle 영역에 requester 또는 organization 표시", () => {
    // canonical: quote.user?.name 또는 quote.organization?.name 노출
    expect(pageSource).toMatch(/quote\.user\?\.name|quote\.organization\?\.name/);
  });

  it("§11.218 카드 구분자 주석 marker (page.tsx)", () => {
    expect(pageSource).toMatch(/§11\.218|카드 구분자|sub-context|disambiguation/i);
  });
});
