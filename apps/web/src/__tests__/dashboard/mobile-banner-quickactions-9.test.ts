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
  it("배너 inline 1행(§quotes-mobile-density P3 supersession) + truncate + CTA inline", () => {
    // §quotes-mobile-density P3(호영님 시안) — 배너 mobile-stack(flex-col·제목 2줄·CTA 아래) → inline 1행 truncate로
    //   supersede(chrome 30%↓). #9 보호의도(배너가 정의된 모바일 레이아웃 + CTA 존재)는 불변, 레이아웃만 dense 갱신(§11.307 supersession 동형).
    expect(BANNER).toContain("flex items-center gap-2.5");          // inline 1행(옛 flex-col 스택 대체)
    expect(BANNER).toContain("truncate");                            // 단일 행(옛 line-clamp-2 대체)
    expect(BANNER).toContain("inline-flex flex-none items-center");  // CTA 인라인(옛 w-full sm:w-auto 대체, onOpen dead button 0)
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
