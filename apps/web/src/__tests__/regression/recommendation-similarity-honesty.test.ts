/**
 * §1-2③ — 가짜 추천 "유사도 N%" 배지 제거 회귀 가드
 *
 * Truth (2026-06-08 cowork TR): /api/recommendations/personalized 기본 경로
 *   (generatePersonalizedRecommendations)의 score = 카테고리·브랜드 검색 빈도 카운트
 *   (0,1,2…) — 0~1 유사도가 아님. 과거 UI는 이를 ×100 % 표기 → 매칭 0이면
 *   "유사도 0%"인데도 추천 노출(+reason "유사한 제품입니다") = fake-metric 모순.
 *   §4 fake success 금지 + canonical truth 위반.
 *
 * Fix (호영님 §1-2③ (b) "유사도 배지 미표시"): personalized-recommendations.tsx 에서
 *   "유사도 N%" 배지 + TrendingUp 아이콘 제거. explainability 는 "추천 근거"
 *   reason 박스 + "구매 패턴 기반" source 배지가 담당. score 는 정렬용으로만 유지.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}

const COMP = "src/components/products/personalized-recommendations.tsx";

describe("§1-2③ — 추천 유사도 fake-metric 제거", () => {
  it("유사도 % 표기(score×100) 재출현 0", () => {
    const src = read(COMP);
    // "유사도 NN%" 렌더 + score*100 표기 패턴 금지
    expect(src).not.toMatch(/유사도\s*\{/);
    expect(src).not.toMatch(/\*\s*100\)\.toFixed\(0\)\}%/);
  });

  it("TrendingUp(유사도 배지 아이콘) import·사용 0", () => {
    const src = read(COMP);
    // 주석 외 실제 JSX 사용 금지: <TrendingUp 태그 0
    expect(src).not.toMatch(/<TrendingUp\b/);
  });

  it("CardDescription 에 유사도 점수 마케팅 카피 없음", () => {
    const src = read(COMP);
    expect(src).not.toMatch(/유사도 점수/);
  });

  // 회귀 0 — explainability 보존
  it("추천 근거(reason) 박스·source 배지 보존", () => {
    const src = read(COMP);
    expect(src).toMatch(/추천 근거/);
    expect(src).toMatch(/구매 패턴 기반/);
  });
});
