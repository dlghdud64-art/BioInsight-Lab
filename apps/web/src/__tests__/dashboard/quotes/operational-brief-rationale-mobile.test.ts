/**
 * §11.222 — RED test (mobile bottom sheet)
 *
 * Goal: §11.221 의 desktop 인과관계 한 줄 + collapsible 패턴을 mobile
 *       MobileOperationalBriefSheet 의 facts prop 에도 적용.
 *
 * canonical truth lock:
 *   - mobile facts ReactNode 안에 인과관계 한 줄 ("→" + emoji) 매칭.
 *   - 같은 factsExpanded useState 재사용 (desktop + mobile 동일 state).
 *   - 기존 mobile facts 의 3-row table (현재 상태 / 다음 액션 / 수신 견적) 가
 *     collapsed 안에 보존.
 *   - dead button 0 (toggle button onClick wired).
 *
 * Out of scope (별도 트랙):
 *   - helper 추출 (desktop + mobile 6-case duplicate 일시 허용).
 *   - other 5 surface (Purchase Conversion / Work Queue / Inbox / Inventory) — quote 만.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const src = readFileSync(PAGE_PATH, "utf8");

describe("§11.222 — mobile bottom sheet 인과관계 정합", () => {
  it("MobileOperationalBriefSheet 의 facts prop 영역에 인과관계 helper call (또는 inline emoji)", () => {
    // §11.222 land 시 inline emoji + → 매칭, Phase 2 helper 추출 후 buildBriefRationaleSummary call.
    // 둘 다 허용 — mobile 영역에 인과관계 source 가 있어야.
    const mobileFactsMatch = src.match(/MobileOperationalBriefSheet[\s\S]*?facts=\{[\s\S]{0,2500}/);
    expect(mobileFactsMatch).toBeTruthy();
    const block = mobileFactsMatch?.[0] ?? "";
    const hasHelperCall = /buildBriefRationaleSummary/.test(block);
    const hasInlineEmoji = /(📋|📤|📥|📊|✅|⚠️)[\s\S]{0,100}→/.test(block);
    expect(hasHelperCall || hasInlineEmoji).toBe(true);
  });

  it("같은 collapse state 재사용 (desktop + mobile 동일)", () => {
    // #operational-brief-3-section-compress (Phase B-2) — factsExpanded 가 새
    //   briefDetailExpanded 로 rename + alias 보존. mobile 도 같은 state 사용.
    const newStateMatches = src.match(/const\s+\[briefDetailExpanded,\s*setBriefDetailExpanded\]/g);
    expect(newStateMatches?.length).toBe(1);
    // backward compat alias 보존 — factsExpanded = briefDetailExpanded.
    expect(src).toMatch(/factsExpanded\s*=\s*briefDetailExpanded/);
  });

  it("mobile facts 의 3-row table (현재 상태 / 다음 액션 / 수신 견적) collapsed 안에 보존", () => {
    // mobile facts ReactNode 안에 3-row 라벨 잔존 — collapsible 안에 wrap.
    const mobileFactsMatch = src.match(/MobileOperationalBriefSheet[\s\S]*?facts=\{[\s\S]{0,2500}/);
    expect(mobileFactsMatch?.[0]).toMatch(/현재 상태/);
    expect(mobileFactsMatch?.[0]).toMatch(/다음 액션/);
    expect(mobileFactsMatch?.[0]).toMatch(/수신 견적/);
  });

  it("mobile 영역에도 toggle '상세 보기' 또는 '접기' CTA 한국어", () => {
    const mobileFactsMatch = src.match(/MobileOperationalBriefSheet[\s\S]*?facts=\{[\s\S]{0,2500}/);
    expect(mobileFactsMatch?.[0]).toMatch(/상세 보기|접기|펼치기/);
  });

  it("§11.222 cluster trace marker", () => {
    expect(src).toMatch(/§11\.222|mobile.*인과관계|mobile bottom sheet 인과관계/);
  });
});
