/**
 * #operational-brief-3-section-compress — Phase B-2 desktop RED
 *
 * 호영님 redesign Phase B-2. "7 섹션 평면 나열 → 3 섹션 (한 줄 요약 +
 * 다음 액션 + 상세 아코디언)". 인지 부하 감소 — '3초 안에 액션' 원칙.
 *
 * canonical truth lock:
 *   - 새 state `briefDetailExpanded` (default false) — 기존 factsExpanded 와
 *     의미 통합 (단일 토글).
 *   - always visible: § 1 brief-summary (narrative) + § 2 brief-facts 한 줄
 *     (Phase B-1 helper output) + § 4 brief-next + bottom CTA.
 *   - briefDetailExpanded === false 시: § 2 4 cell + brief-facts2 + 최근 활동
 *     + brief-risks + 운영 판단 모두 hidden (5 섹션 collapse).
 *   - chip click → 자동 setBriefDetailExpanded(true) + scrollIntoView.
 *   - "상세 보기" / "접기" toggle button.
 *
 * Out of scope (별도 phase):
 *   - mobile §11.222 (별도 mobile-bottom-sheet redesign)
 *   - chip scroll-spy 의 collapsed state visual hint (별도)
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("#operational-brief-3-section-compress — state 통합", () => {
  it("briefDetailExpanded state 정의 (factsExpanded 와 의미 통합)", () => {
    expect(page).toMatch(/briefDetailExpanded/);
  });

  it("setBriefDetailExpanded setter 사용", () => {
    expect(page).toMatch(/setBriefDetailExpanded/);
  });
});

describe("#operational-brief-3-section-compress — 5 섹션 collapse", () => {
  it("brief-facts2 (회신·비교 현황) 가 conditional render 안 wrap", () => {
    // brief-facts2 element 가 briefDetailExpanded conditional 안.
    // 매칭 패턴: briefDetailExpanded 가 brief-facts2 의 직전 conditional 위치.
    expect(page).toMatch(/briefDetailExpanded\s*&&[\s\S]{0,2000}brief-facts2/);
  });

  it("brief-risks (리스크) 가 conditional render 안 wrap", () => {
    expect(page).toMatch(/briefDetailExpanded\s*&&[\s\S]{0,12000}brief-risks/);
  });

  it("운영 판단 영역 / 최근 활동 영역 모두 conditional 안", () => {
    // "운영 판단" 섹션 + "최근 활동" 섹션 모두 briefDetailExpanded conditional 안.
    expect(page).toMatch(/briefDetailExpanded\s*&&[\s\S]{0,12000}운영 판단/);
  });
});

describe("#operational-brief-3-section-compress — chip click auto-expand", () => {
  it("chip click handler 가 setBriefDetailExpanded(true) 호출", () => {
    // chip onClick 안 setBriefDetailExpanded(true) 호출.
    expect(page).toMatch(/setBriefDetailExpanded\s*\(\s*true\s*\)/);
  });
});

describe("#operational-brief-3-section-compress — visible 3 섹션 보존", () => {
  it("§ 1 brief-summary 항상 visible (narrative)", () => {
    expect(page).toMatch(/id=["']brief-summary["']/);
  });

  it("§ 2 brief-facts 한 줄 요약 항상 visible (B-1 helper output)", () => {
    // brief-facts 영역 자체는 항상 mount + 한 줄은 항상 visible.
    expect(page).toMatch(/id=["']brief-facts["']/);
    expect(page).toMatch(/buildBriefRationale\s*\(/);
  });

  it("§ 4 brief-next 항상 visible (다음 조치)", () => {
    expect(page).toMatch(/id=["']brief-next["']/);
  });
});

describe("#operational-brief-3-section-compress — toggle button", () => {
  it("'상세 보기' / '접기' button 보존", () => {
    expect(page).toMatch(/상세 보기|접기/);
  });
});

describe("#operational-brief-3-section-compress — drift sentinel", () => {
  it("기존 factsExpanded 단독 잔존하지 않음 (state 통합 후)", () => {
    // factsExpanded 가 함수 인자 / type 정의 외에 state hook 으로 잔존하지 않아야.
    expect(page).not.toMatch(/const\s+\[\s*factsExpanded\s*,\s*setFactsExpanded\s*\]\s*=\s*useState/);
  });
});

describe("#operational-brief-3-section-compress — cluster trace", () => {
  it("cluster trace marker", () => {
    expect(page).toMatch(/#operational-brief-3-section-compress|3 섹션 압축|3-section/);
  });
});
