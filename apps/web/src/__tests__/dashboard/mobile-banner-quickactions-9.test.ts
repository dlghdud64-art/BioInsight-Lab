/**
 * §dashboard-mobile #9 — 호영님 모바일 라이브 phase 2/2.
 *   - 우선추천 배너: 모바일 스택(flex-col), 제목 truncate 해제(2줄), CTA 본문 아래(가로 경쟁 제거).
 *   - 운영 바로가기: 모바일/태블릿 2×2(세로 1열 폭주 해소), 데스크탑 레일 1열 유지.
 *   - "요청 발송 전" 칩: 위험(red) → §12 s1 발송 단계(파랑·중립 대기). red 오독 해소.
 *   - KPI 카드: 같은 행 높이 정렬(h-full + CTA mt-auto, CTA 유무 무관).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const BANNER = readFileSync(resolve(__dirname, "../../components/quotes/priority-recommendation-card.tsx"), "utf8");
const QUICK = readFileSync(resolve(__dirname, "../../components/dashboard/operator-quick-actions.tsx"), "utf8");
const QUOTES = readFileSync(resolve(__dirname, "../../app/dashboard/quotes/page.tsx"), "utf8");
const DASH = readFileSync(resolve(__dirname, "../../app/dashboard/page.tsx"), "utf8");

describe("§dashboard-mobile #9", () => {
  it("배너 모바일 스택(flex-col sm:flex-row) + 제목 2줄 + CTA 아래", () => {
    expect(BANNER).toContain("flex flex-col gap-3 sm:flex-row");
    expect(BANNER).toContain("line-clamp-2 sm:truncate");
    expect(BANNER).toContain("w-full items-center gap-2 sm:w-auto");
  });

  it("운영 바로가기 모바일 2×2(데스크탑 레일 1열)", () => {
    expect(QUICK).toContain("grid-cols-2 lg:grid-cols-1");
  });

  it("요청 발송 전 칩 중립(§12 발송 파랑, red 제거)", () => {
    expect(QUOTES).toMatch(/요청_접수:[\s\S]{0,80}bg-blue-100/);
    expect(QUOTES).not.toMatch(/요청_접수:[\s\S]{0,80}bg-red-100/);
  });

  it("KPI 카드 행 높이 정렬(h-full + CTA mt-auto)", () => {
    expect(DASH).toContain('href={config.href} className="block h-full"');
    expect(DASH).toContain("mt-auto pt-1");
  });
});
