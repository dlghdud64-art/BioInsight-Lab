/**
 * §1-2⑤ — 제품 상세 정직화 batch sentinel
 *
 * 호영님 라이브 진단 (2026-06-11) → 승인 골격:
 *   ② 추천 fake — canned 폴백("유사한 제품입니다") + cross-category noise
 *   ③ context 하강 — 소싱 상태(비교 포함)가 full page 에서 소실
 *   ① spec tautology — identity 필드(브랜드·카테고리·카탈로그번호)를 spec 으로 위장
 *   ⑤ 권한 누수 — SDS/COA 업로드 buyer 노출 (게이트 부재 실측 확정)
 *   ④ PBS-3↔PBS-1A = seed 데이터(catno-master) — catalog A 트랙 이관 (코드 스코프 밖)
 *
 * A0 확정 사항:
 *   - 추천 박스는 rec.reason 조건부 렌더(기성) → route 폴백 제거 시 자동 숨김
 *   - route 는 ?category= 수신 구조 기성 → 일반 경로 category 고정만 추가
 *   - 견적 포함 배지는 useTestFlow(workbench provider) 경계로 defer — 비교 배지만 승계
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const ROUTE = "src/app/api/recommendations/personalized/route.ts";
const HOOK = "src/hooks/use-personalized-recommendations.ts";
const COMPONENT = "src/components/products/personalized-recommendations.tsx";
const DETAIL = "src/app/products/[id]/page.tsx";
const SDS = "src/components/safety/sds-documents-section.tsx";

describe("§1-2⑤ ② — 추천 정직화 (canned 폴백 0 + 카테고리 제한)", () => {
  it("route — '유사한 제품입니다' canned 폴백 제거 (근거 없으면 빈 문자열)", () => {
    const src = read(ROUTE);
    expect(src).not.toMatch(/유사한 제품입니다/);
  });

  it("route — productId 맥락에서 category 고정 (cross-category noise 차단)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/categoryLock/);
    expect(src).toMatch(/where\.category\s*=\s*categoryLock/);
  });

  it("hook — category 파라미터 전달", () => {
    const src = read(HOOK);
    expect(src).toMatch(/category/);
    expect(src).toMatch(/params\.set\("category"/);
  });

  it("component — category prop 수신 → hook 전달 + reason 조건부 렌더 보존", () => {
    const src = read(COMPONENT);
    expect(src).toMatch(/category/);
    expect(src).toMatch(/\{rec\.reason && \(/);
  });

  it("detail — PersonalizedRecommendations 에 category 전달", () => {
    const src = read(DETAIL);
    expect(src).toMatch(/<PersonalizedRecommendations[\s\S]{0,200}category=\{/);
  });
});

describe("§1-2⑤ ③ — 소싱 상태 승계 (비교 배지)", () => {
  it("detail — '비교에 포함됨' 배지 (compare-store hasProduct 기반)", () => {
    const src = read(DETAIL);
    expect(src).toMatch(/비교에 포함됨/);
    expect(src).toMatch(/hasProduct\(/);
  });
});

describe("§1-2⑤ ① — spec tautology 제거 (라벨 정직화)", () => {
  it("상세 스펙 그리드 — 브랜드·카테고리·카탈로그번호 identity 타일 제거", () => {
    const src = read(DETAIL);
    const gridStart = src.indexOf("상세 스펙 (Specifications)");
    expect(gridStart).toBeGreaterThan(-1);
    const grid = src.slice(gridStart, gridStart + 2600);
    expect(grid).not.toMatch(/>브랜드</);
    expect(grid).not.toMatch(/>카테고리</);
    expect(grid).not.toMatch(/>카탈로그 번호</);
    // 실 spec 필드만 노출 조건
    expect(grid).toMatch(/product\.specification \|\| product\.regulatoryCompliance/);
    // 정직한 empty 보존
    expect(grid).toMatch(/등록된 상세 스펙이 없습니다/);
  });
});

describe("§1-2⑤ ⑤ — SDS/COA 업로드 권한 게이트", () => {
  it("sds-documents-section — ADMIN·SUPPLIER 만 업로드 (buyer 노출 0)", () => {
    const src = read(SDS);
    expect(src).toMatch(/canUpload/);
    expect(src).toMatch(/ADMIN/);
    expect(src).toMatch(/SUPPLIER/);
  });
});

describe("§1-2⑤ — 회귀 0 (기존 보존)", () => {
  it("detail — 비교 추가·견적 담기 라벨 보존 (§1-2②)", () => {
    const src = read(DETAIL);
    expect(src).toMatch(/비교 추가/);
    expect(src).toMatch(/견적 담기/);
  });

  it("detail — 안전 정보 편집 isAdmin 게이트 보존", () => {
    const src = read(DETAIL);
    expect(src).toMatch(/\{isAdmin && \([\s\S]{0,300}안전 정보 편집/);
  });

  it("detail — 연관 추천 섹션 렌더 보존 + useCompareStore 보존", () => {
    const src = read(DETAIL);
    expect(src).toMatch(/<PersonalizedRecommendations/);
    expect(src).toMatch(/useCompareStore/);
  });

  it("route — 진짜 근거 생성 로직 보존 (reasons 조립)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/reasons\.push/);
    expect(src).toMatch(/reasons\.join/);
  });
});
