/**
 * §11.360 (회귀) — 권장 액션 카드 severity-색상 매핑 sentinel
 *
 * 카드 행 배경이 severity 미분기(단일 하드코딩) → 팔레트 분기. 약채도 + 좌측 보더.
 *
 * 🛑 재앵커 §inventory-state-tone (2026-09-26 · 호영님 판정) — **축이 바뀌었다.**
 *   옛 명제: 색을 **severity**(긴급 red / 높음 yellow / 보통 blue / 낮음 neutral)로 분기한다.
 *   호영님 라이브 실측: 안전재고 미만 품목의 큐 카드가 yellow 로 떴고 바로 위 「재주문 필요」 칩은 red 였다 —
 *   같은 화면에서 두 색. 원인은 severity 축이었다. 색은 **무슨 상태인가**에서 나온다.
 *   → 색은 category → 상태 → 정본 톤, severity 는 정렬·라벨만. 「약채도 + 좌측 보더」 형태는 불변이고,
 *     팔레트 값은 `lib/inventory/state-tone.ts` 가 든다(leftAccent · softBg).
 *   blue 는 상태 배지에서 빠졌다 — §9 의 정보 축이라 상태와 섞이면 안 된다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
const SRC = readFileSync(
  join(APP_WEB_ROOT, "src/components/inventory/priority-action-queue.tsx"),
  "utf8",
);

describe("§11.360 [재앵커] · 큐 카드 배경은 상태 팔레트로 분기한다", () => {
  it("카드 배경·좌측 보더가 정본 팔레트에서 온다", () => {
    expect(SRC).toContain("${tone.leftAccent} ${tone.softBg}");
    /* 구 severity 팔레트 부활 차단 — 특히 medium=blue 는 상태 축이 아니다. */
    expect(SRC).not.toContain("cardBg:");
    expect(SRC).not.toContain("border-l-blue-300");
  });
  it("§11.302 정합 — amber/orange 미사용", () => {
    expect(SRC).not.toMatch(/amber-|orange-/);
  });
});

describe("§11.360 — 카드 행에 cardBg 적용(단일 하드코딩 제거)", () => {
  it("정본 톤을 카드 className 에 사용 (severity 우회 0)", () => {
    expect(SRC).toContain("const tone = inventoryToneClass(CATEGORY_STATE[item.category]);");
    expect(SRC).not.toContain("riskCfg");
    // 기존 단일 하드코딩(hover:bg-slate-50/80 단독) 제거
    expect(SRC).not.toContain('className="px-4 py-3 hover:bg-slate-50/80 transition-colors cursor-pointer group"');
  });
});
