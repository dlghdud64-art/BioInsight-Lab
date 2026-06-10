/**
 * §11.292b #compare-drawer-shortlist-removal — 호영님 spec 정합 sentinel.
 *
 * 호영님 §11.292 1단계 정합 (2026-05-24):
 *   §11.292 1단계가 소싱 검색 결과 화면의 Shortlist/Hold/Exclude 제거.
 *   비교 drawer 안에도 동일 분류 button 3종 (후보 등록/보류/제외) 잔존.
 *   호영님 spec 의 "이메일 정리" 같은 분류 단계 강제 회피 원리 정합 —
 *   비교 drawer 도 동일 제거.
 *
 * §11.381c 갱신 (호영님 b2 결정 2026-06-10):
 *   compare 라우트 retire 로 compare-analysis-drawer.tsx 자체 소멸 —
 *   본 sentinel 의 제거 단언은 전부 자연 충족. 부재 검증 + 분류 단계
 *   부활 금지(소싱 비교 검토 surface 기준)로 의도 반영 축소.
 *   원본 단언 이력은 git history (e5d5c9d2 이전) 참조.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const DRAWER_PATH = resolve(
  __dirname,
  "../../app/compare/_components/compare-analysis-drawer.tsx",
);

const REVIEW_WORKBENCH = readFileSync(
  resolve(
    __dirname,
    "../../app/_workbench/_components/sourcing-result-review-workbench.tsx",
  ),
  "utf8",
);

describe("§11.292b — 비교 drawer 분류 단계 (§11.381c retire 후)", () => {
  it("compare-analysis-drawer 소멸 (§11.381c retire — 제거 단언 자연 충족)", () => {
    expect(existsSync(DRAWER_PATH)).toBe(false);
  });

  it("후속 canonical surface (소싱 비교 검토) 에 Shortlist/Hold/Exclude 분류 버튼 부활 0", () => {
    // §11.292/292b 본질 보존: 분류 단계 강제 회피 원리는 소싱 비교 검토에도 적용.
    expect(REVIEW_WORKBENCH).not.toMatch(/Shortlist|shortlistCount/);
    expect(REVIEW_WORKBENCH).not.toMatch(/onActionChange\(.*"shortlist"/);
  });
});
