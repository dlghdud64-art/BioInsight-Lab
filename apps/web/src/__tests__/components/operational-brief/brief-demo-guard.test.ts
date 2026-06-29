/**
 * §brief-demo-guard (호영님 2026-06-29) — 운영 브리핑 시드(데모) 데이터 정직 가드
 *
 * 발견(truth recon): 운영 브리핑은 ops-store 의 createInitialGraph / ALL_QUOTE_REQUESTS
 *   **시드(데모) 데이터**로 렌더된다. 서버 hydration(실 quotes/PO/inventory 집계) 미구현.
 *   → 실데이터처럼 보이면 honesty 위반 + §brief-quote-status-email 통보가 데모 ID로 실 PATCH
 *     호출 시 404. 실데이터 연동 전까지 정직 가드:
 *   (1) 헤더 "데모 데이터" 배지(BRIEF_DATA_IS_LIVE=false 동안).
 *   (2) 견적 통보(QuoteNotifyAction = 실 PATCH)는 LIVE 일 때만 렌더, 아니면 정직 안내.
 *
 * 실데이터 연동 트랙에서 BRIEF_DATA_IS_LIVE 를 true 로 플립하면 배지 사라지고 통보 활성화.
 * 본 sentinel 은 플래그/게이트 **구조**를 핀(값이 아니라) — 플립 후에도 GREEN.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const POPUP = readFileSync(
  resolve(__dirname, "../../../components/operational-brief/popup.tsx"),
  "utf8",
);

describe("§brief-demo-guard — 데모 데이터 정직 가드", () => {
  it("BRIEF_DATA_IS_LIVE 플래그 존재(단일 SoT)", () => {
    expect(POPUP).toMatch(/const BRIEF_DATA_IS_LIVE\s*=/);
  });

  it("헤더 '데모 데이터' 배지 — !BRIEF_DATA_IS_LIVE 게이트", () => {
    expect(POPUP).toMatch(/!BRIEF_DATA_IS_LIVE && \(/);
    expect(POPUP).toContain("데모 데이터");
  });

  it("배지 = §11.302 yellow(신호색)", () => {
    expect(POPUP).toMatch(
      /!BRIEF_DATA_IS_LIVE && \([\s\S]{0,200}border-yellow-300 bg-yellow-50[\s\S]{0,220}데모 데이터/,
    );
  });

  it("견적 통보(실 PATCH) = BRIEF_DATA_IS_LIVE 일 때만 렌더 + 정직 안내 fallback", () => {
    expect(POPUP).toMatch(/BRIEF_DATA_IS_LIVE \? \([\s\S]{0,120}<QuoteNotifyAction/);
    expect(POPUP).toContain("실데이터 연동 후 활성화");
  });

  it("LIVE 시 통보 활성 경로 보존(QuoteNotifyAction 정의·csrfFetch PATCH)", () => {
    expect(POPUP).toContain("function QuoteNotifyAction");
    expect(POPUP).toMatch(/csrfFetch\(`\/api\/quotes\/\$\{quoteId\}\/status`/);
  });
});

describe("§brief-demo-guard — 보존(회귀 0)", () => {
  it("track-3/4 보존(dismiss/idle/미리보기)", () => {
    expect(POPUP).toContain("오늘 숨김");
    expect(POPUP).toContain("4개 모듈을 모니터링");
    expect(POPUP).toContain("확인하고 발송");
  });
  it("popup 핵심 보존(단일큐·헤더폭·a11y·honesty)", () => {
    expect(POPUP).toContain("지금 처리");
    expect(POPUP).toContain("md:w-[400px]");
    expect(POPUP).toContain("aria-expanded={expanded}");
    expect(POPUP).not.toContain("Real-time Operations");
  });
});
