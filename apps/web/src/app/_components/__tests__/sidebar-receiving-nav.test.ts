import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

const REPO_ROOT = join(__dirname, "..", "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const SIDEBAR = "src/app/_components/dashboard-sidebar.tsx";

describe("§nav-receiving — 사이드바 입고 관리 진입점", () => {
  it("입고 관리 메뉴 항목이 존재하고 /dashboard/receiving 로 연결", () => {
    const src = read(SIDEBAR);
    expect(src).toMatch(/title: "입고 관리"/);
    expect(src).toMatch(/href: "\/dashboard\/receiving"/);
    expect(src).toMatch(/Truck/);
  });

  it("랩 운영 그룹에서 재고 관리 다음, 조직 관리 앞에 위치", () => {
    const src = read(SIDEBAR);
    const inv = src.indexOf('title: "재고 관리"');
    const rcv = src.indexOf('title: "입고 관리"');
    const org = src.indexOf('title: "조직 관리"');
    expect(inv).toBeGreaterThan(-1);
    expect(rcv).toBeGreaterThan(inv);
    expect(org).toBeGreaterThan(rcv);
  });
});
