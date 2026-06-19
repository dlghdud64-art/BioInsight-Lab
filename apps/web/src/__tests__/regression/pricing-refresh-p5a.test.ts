/**
 * §pricing-refresh P5a (PLAN_pricing-refresh) — pricing 카드 용어 "운영자"→"사용자"
 *
 * 호영님 결정: 과금 시트 용어 = "사용자"(role 운영관리자/ops_admin 과는 별개).
 *   pricing/page.tsx + dashboard/pricing/page.tsx 의 seatsLine(운영범위 박스) 교체.
 *   (settings role 라벨·기타 UI = P5b, 주석은 보존.)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "..", "..");
const read = (rel: string) => readFileSync(join(ROOT, rel), "utf8");

const P = read("app/pricing/page.tsx");
const D = read("app/dashboard/pricing/page.tsx");

describe("§pricing-refresh P5a — pricing 카드 사용자 용어", () => {
  it("pricing/page seatsLine 사용자(운영자 0)", () => {
    expect(P).toMatch(/사용자 \$\{descriptor\.seatsRecommended\}명 권장/);
    expect(P).toMatch(/사용자 무제한 \(계약\)/);
    expect(P).not.toMatch(/운영자 \$\{descriptor\.seatsRecommended\}/);
    expect(P).not.toMatch(/운영자 무제한/);
  });
  it("dashboard/pricing seatsLine 사용자(운영자 0)", () => {
    expect(D).toMatch(/사용자 \$\{descriptor\.seatsRecommended\}명 권장/);
    expect(D).toMatch(/사용자 무제한 \(계약\)/);
    expect(D).not.toMatch(/운영자 무제한/);
  });
});
