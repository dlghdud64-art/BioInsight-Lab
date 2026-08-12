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

  /**
   * 승계 (§sourcing-quote-flow v1.1 §4, 호영님 2026-08-12) — 개인화 추천 섹션이
   * 제품 상세에서 **제거**되어 category 전달 지점 자체가 없다.
   *
   * 원 계약의 목적(cross-category noise 차단)은 컴포넌트 쪽에 남아 있다 —
   * 위 "component — category prop 수용" it 이 계속 잠근다. 여기서는 제거를 고정한다.
   */
  it("detail — 개인화 추천 미렌더 (§v1.1 §4 제거 승계)", () => {
    const src = read(DETAIL);
    expect(src).not.toMatch(/<PersonalizedRecommendations/);
  });
});

describe("§1-2⑤ ③ — 소싱 상태 승계 (비교 배지)", () => {
  it("detail — '비교에 포함됨' 배지 (compare-store hasProduct 기반)", () => {
    const src = read(DETAIL);
    // supersede(§product-detail-refinement 계약⑨-1): 비교함·견적함 배지가 통합 문구로 정합됐다. 의도(담긴 상태를 truth 기반으로 표기)는 유지.
    expect(src).toMatch(/견적함·비교함에 담김/);
    expect(src).toMatch(/hasProduct\(/);
  });
});

describe("§1-2⑤ ① — spec tautology 제거 (라벨 정직화)", () => {
  it("상세 스펙 그리드 — 브랜드·카테고리·카탈로그번호 identity 타일 제거", () => {
    const src = read(DETAIL);
    const gridStart = src.indexOf("상세 스펙 (Specifications)");
    expect(gridStart).toBeGreaterThan(-1);
    // #catalog-spec-backfill ② (2026-06-11) 으로 "스펙 편집" button JSX 가 헤더/본문 사이 ~900 chars
    //   삽입 → slice 범위 정합(2600 → 3500). 정직화 의도(empty state 보존) 동일.
    const grid = src.slice(gridStart, gridStart + 3500);
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
    // supersede(§product-detail-refinement 계약④): '비교 추가' → '비교 검토'(보조 2분할). 의도(비교 진입 라벨 존재)는 유지.
    expect(src).toMatch(/비교 검토/);
    expect(src).toMatch(/견적 담기/);
  });

  /* 🔁 진화 (2026-08-09, §product-detail-sourcing-v21 §1 — 호영님 승인).
   *   원 계약은 `isAdmin`(ADMIN 전용) 게이트를 잠갔다. §1 이 "스펙 편집·안전 정보 편집·
   *   SDS 업로드는 ADMIN/SUPPLIER 만 렌더"로 확정하면서 `canEditSpec`(ADMIN·SUPPLIER)으로
   *   확대 — 새 결정이 아니라 §1 의 귀결이며, 같은 파일 아래 "sds-documents-section —
   *   ADMIN·SUPPLIER 만 업로드" 형제 계약과도 정합한다.
   *   보호 의도(권한 없는 사용자에게 편집 진입을 만들지 않는다)는 불변 — 잠금 대상만 이동.
   *   ⚠️ 서버측 동반 교정 완료: `PATCH /api/products/[id]/safety` 가 SUPPLIER 를 거부해
   *   front-only 실패(버튼은 열리고 저장 403)였던 것을 합집합
   *   (global ADMIN · SUPPLIER · 조직 ADMIN/VIEWER)으로 확대했다. UI 만 열고 서버를
   *   방치하면 dead button 보다 나쁘다. */
  it("detail — 안전 정보 편집 권한 게이트 보존 (canEditSpec = ADMIN·SUPPLIER)", () => {
    const src = read(DETAIL);
    expect(src).toMatch(/\{canEditSpec && \([\s\S]{0,300}안전 정보 편집/);
  });

  /**
   * 승계 (§sourcing-quote-flow v1.1 §4) — 연관(개인화) 추천 렌더 보존은 은퇴.
   * `useCompareStore` 보존은 **원 계약 그대로 유지**한다(제거 대상이 아니었다).
   */
  it("detail — useCompareStore 보존 (연관 추천 렌더 보존은 §v1.1 §4 로 은퇴)", () => {
    const src = read(DETAIL);
    expect(src).toMatch(/useCompareStore/);
    expect(src).not.toMatch(/<PersonalizedRecommendations/);
  });

  it("route — 진짜 근거 생성 로직 보존 (reasons 조립)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/reasons\.push/);
    expect(src).toMatch(/reasons\.join/);
  });
});
