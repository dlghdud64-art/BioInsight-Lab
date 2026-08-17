// @vitest-environment node
/**
 * §em-dash-scan — 판별기 자기검증 + 소급 완료분 잠금
 *
 * 🛑 도구를 커밋만 하고 안 돌리면 조항이 없는 것과 같다. 여기서 실제로 돌린다.
 *    이 세션에서 다섯 번 나온 형태의 도구판이다 — 조항은 있는데 집행 지점이 없던 것.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { scanEmDash, stripComments, isPlaceholder, violations } from "../_helpers/em-dash-scan";

const read = (rel: string) => readFileSync(join(__dirname, "..", "..", rel), "utf8");

describe("§em-dash-scan — 판별기 자기검증", () => {
  it("후행 라인 주석을 자른다 (구 구현이 놓친 지점)", () => {
    const src = 'const a = 1; // ISO date — 최근 구매처 표시\nconst b = "완료 — 3건";';
    const r = scanEmDash(src);
    expect(r.total).toBe(2);
    expect(r.comments).toBe(1); // 후행 주석 1건 제외
    expect(r.hits).toHaveLength(1);
    expect(r.hits[0].text).toContain("완료");
  });

  it("문자열 리터럴 안의 // 는 주석이 아니다", () => {
    const src = 'const u = "https://x.test/a"; const s = "완료 — 3건";';
    expect(violations(src)).toHaveLength(1);
  });

  it("블록 주석·JSX 주석 제외", () => {
    expect(violations("/* 설명 — 블록 */\nconst s = 1;")).toHaveLength(0);
    expect(stripComments("/* a — b */").includes("—")).toBe(false);
  });

  it("🛑 placeholder 는 위반이 아니다 — 계약 충돌 방지", () => {
    // quote-management-p1 · rfq-document-redesign 이 계약으로 잠근 형태
    expect(violations('{data.storageLocation ?? "—"}')).toHaveLength(0);
    expect(violations('return "—";')).toHaveLength(0);
    expect(isPlaceholder('const x = "—";', 11)).toBe(true);
  });

  it("구분자는 위반이다 — 앞뒤에 텍스트가 붙는다", () => {
    expect(violations('"안전 재고 미달 — 재고 운영 도우미 권장"')).toHaveLength(1);
    expect(violations("<p>완료 — 3건</p>")).toHaveLength(1);
  });
});

describe("§em-dash-scan — 소급 완료분 잠금 (회귀 0)", () => {
  /* 🛑 소급 완료 파일은 **여기서** 잠근다. 축 C(슬롯 대조)로는 안 잡히는 자리가 있다 —
   *    2026-08-16 실측: `quote-prepare-panel.tsx` L175 `— 탭해서 지정` 을 되돌려도
   *    축 C 는 GREEN 이었다(`1c.vendor.rec_meta` 는 전량 시드라 값 대조를 하지 않는다).
   *    조항 소급의 회귀 가드는 게이트 커버리지와 축이 다르므로 파일 단위로 여기 등재한다. */
  const DONE = [
    "app/dashboard/analytics/page.tsx",
    "components/inventory/ReorderReviewSheet.tsx",
    "app/dashboard/purchase-orders/new/page.tsx",
    "components/quotes/prepare/quote-prepare-panel.tsx", // 29146a6e(2건) + 369b1a15(L175)
  ];

  for (const rel of DONE) {
    it(`${rel} — 구분자 용법 0`, () => {
      const v = violations(read(rel));
      expect({ [rel]: v.map((h) => `L${h.line} ${h.text.slice(0, 50)}`) }).toEqual({ [rel]: [] });
    });
  }

  it("ReorderReviewSheet 의 placeholder 1건은 존치 — 치환하면 안 된다", () => {
    const r = scanEmDash(read("components/inventory/ReorderReviewSheet.tsx"));
    const ph = r.hits.filter((h) => h.kind === "placeholder");
    expect(ph).toHaveLength(1);
    expect(ph[0].text).toContain("storageLocation");
  });
});
