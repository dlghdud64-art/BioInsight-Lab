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
  it("MobileOperationalBriefSheet 의 facts prop 영역에 인과관계 메시지 (mobile + desktop 둘 다 매칭)", () => {
    // §11.221 desktop 도 같은 메시지 — 적어도 한 곳 매칭 (mobile inline duplicate).
    // mobile 영역 마커: "facts={" 직후 200~600 byte 안에 "→" + emoji 가 있어야.
    const mobileFactsMatch = src.match(/MobileOperationalBriefSheet[\s\S]*?facts=\{[\s\S]{0,1500}/);
    expect(mobileFactsMatch).toBeTruthy();
    expect(mobileFactsMatch?.[0]).toMatch(/(📋|📤|📥|📊|✅|⚠️)[\s\S]{0,100}→/);
  });

  it("같은 factsExpanded state 재사용 (desktop + mobile 동일)", () => {
    // factsExpanded state 1개만 정의 — mobile 도 같은 state 사용.
    const stateMatches = src.match(/const\s+\[factsExpanded,\s*setFactsExpanded\]/g);
    expect(stateMatches?.length).toBe(1);
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
