/**
 * §11.372 (RED→GREEN) — /search 공개 랜딩 모바일 정합
 *
 * 증상(호영님 IMG_5796, 루트 아닌 /search):
 *   (a) 검색/비교/견적 3카드가 grid-cols-3 모바일 강제 → 375px 폭부족으로
 *       "제품명·CAS·카탈로그·브" 설명 텍스트 잘림.
 *   (b) 헤더 pt-28/space-y-10 모바일 여백 과대 → 핵심(헤드라인+검색+가입 CTA)이
 *       first-view 밖으로 밀림. 검색예시·필드설명이 위를 점유.
 *
 * Fix:
 *   (a) flowSteps 3카드 grid-cols-3 → grid-cols-1 sm:grid-cols-3 (모바일 1열).
 *   (b) 헤더 컨테이너 모바일 패딩/간격 축소(md+ 기존 보존).
 *
 * 공개 정적 페이지(canonical 무관). sentinel(readFileSync+regex). 최종은 ops 375px.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const PAGE = "src/app/search/page.tsx";

describe("§11.372 — 3카드 모바일 1열", () => {
  it("flowSteps 그리드 grid-cols-1 sm:grid-cols-3 (모바일 1열/sm 3열)", () => {
    const src = read(PAGE);
    expect(src).toMatch(/grid grid-cols-1 gap-3 sm:grid-cols-3/);
  });

  it("모바일 3열 강제(grid-cols-3 단독)가 flow 섹션에서 제거됨", () => {
    const src = read(PAGE);
    // landing-search-flow-steps 섹션의 naked grid-cols-3 제거
    expect(src).not.toMatch(/className="grid grid-cols-3 gap-3 sm:gap-4 text-left"/);
  });
});

describe("§11.372 — 헤더 모바일 여백 축소(first-view 확보)", () => {
  it("모바일 패딩/간격 축소 + md+ 기존 보존", () => {
    const src = read(PAGE);
    expect(src).toMatch(/md:pt-28/);
    expect(src).toMatch(/md:space-y-10/);
    // 모바일은 더 작은 값(pt-28 단독 강제 제거)
    expect(src).not.toMatch(/className="mx-auto max-w-5xl px-4 pt-28 pb-20 text-center space-y-10"/);
  });
});

describe("§11.372 — 회귀 0", () => {
  it("3카드 데이터·flow testid 보존", () => {
    const src = read(PAGE);
    expect(src).toMatch(/제품명·CAS·카탈로그·브랜드로 빠르게 찾기/);
    expect(src).toMatch(/data-testid="landing-search-flow-steps"/);
    expect(src).toMatch(/flowSteps\.map/);
  });

  it("검색 input + 가입 CTA + 검색예시 보존", () => {
    const src = read(PAGE);
    expect(src).toMatch(/placeholder="시약명·CAS·제조사"/);
    expect(src).toMatch(/data-testid="landing-search-primary-cta"/);
    expect(src).toMatch(/exampleQueries\.map/);
  });
});
