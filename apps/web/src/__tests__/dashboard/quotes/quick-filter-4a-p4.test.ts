/**
 * §quotes-quick-filter-4a — P4 URL 동기화 sentinel
 *
 * 보호: ?mine&period&chips&sort&q 복원(1회)/반영 · 기존 파라미터(status/selected) 무손상 ·
 *       칩은 chips 파라미터(status 충돌 회피) · canonical parseStatusCsv 재사용.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(resolve(__dirname, "../../../app/dashboard/quotes/page.tsx"), "utf8");

describe("§quotes-quick-filter-4a P4 — URL 동기화", () => {
  it("useRouter 도입 + router.replace 반영", () => {
    expect(PAGE).toMatch(/import \{ useSearchParams, useRouter \} from "next\/navigation";/);
    expect(PAGE).toMatch(/const router = useRouter\(\);/);
    expect(PAGE).toMatch(/router\.replace\(qs \? `\?\$\{qs\}` : window\.location\.pathname, \{ scroll: false \}\)/);
  });

  it("복원 1회 게이트(qfUrlHydratedRef)", () => {
    expect(PAGE).toMatch(/const qfUrlHydratedRef = useRef\(false\)/);
    expect(PAGE).toMatch(/if \(qfUrlHydratedRef\.current\) return;/);
  });

  it("칩은 chips 파라미터(status 충돌 회피) + canonical parseStatusCsv", () => {
    expect(PAGE).toMatch(/parseStatusCsv\(searchParams\.get\("chips"\)\)/);
    expect(PAGE).toMatch(/params\.set\("chips", \[\.\.\.quickStatus\]\.join\(","\)\)/);
    // status 파라미터를 quick chips 로 덮지 않음(기존 statusFilter 보존)
    expect(PAGE).not.toMatch(/params\.set\("status", \[\.\.\.quickStatus\]/);
  });

  it("mine/period/sort/q 복원·반영", () => {
    expect(PAGE).toMatch(/searchParams\.get\("mine"\) === "1"/);
    expect(PAGE).toMatch(/searchParams\.get\("period"\)/);
    expect(PAGE).toMatch(/if \(sort === "dday"\) setSortState\(\{ key: "dday", direction: "asc" \}\)/);
    expect(PAGE).toMatch(/params\.set\("q", qv\)/);
  });

  it("기존 파라미터 보존 — window.location.search 기반 재구성(전체 삭제 아님)", () => {
    expect(PAGE).toMatch(/new URLSearchParams\(window\.location\.search\)/);
    // 기존 statusFilter/selected 초기화 파라미터는 그대로
    expect(PAGE).toMatch(/searchParams\.get\("status"\) \?\? "all"/);
    expect(PAGE).toMatch(/searchParams\.get\("selected"\)/);
  });
});
