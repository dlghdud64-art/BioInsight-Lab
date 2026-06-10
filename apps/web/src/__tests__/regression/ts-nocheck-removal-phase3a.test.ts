/**
 * §11.305-phase3a #ts-nocheck-removal — production code @ts-nocheck 제거.
 *   release-prep P1 Phase 3a (호영님 P1, hidden type error 노출 + 정합 처리).
 *
 * 원 Scope (1 file): apps/web/src/app/_workbench/compare/page.tsx
 *   — @ts-nocheck 제거 + hidden type error 7건 + cascade 2건 정합.
 *   상세 단언 이력은 git history (§11.381c 이전) 참조.
 *
 * §11.381c 갱신 (호영님 b2 결정 2026-06-10):
 *   compare 라우트 retire 로 _workbench/compare/page.tsx 소멸 —
 *   해당 파일 단언은 부재 검증으로 전환. lib/analytics.ts 의
 *   AnalyticsEvent enum 정합(본 batch 가 추가한 4 literal)은 enum 이
 *   생존하므로 보존 단언 유지.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const REPO_ROOT = resolve(__dirname, "../../../../..");

const ANALYTICS_SRC = readFileSync(
  resolve(REPO_ROOT, "apps/web/src/lib/analytics.ts"),
  "utf8",
);

describe("§11.305-phase3a — production code @ts-nocheck 제거 + hidden bug fix", () => {
  it("§11.305-phase3a trace marker (self-referential)", () => {
    const selfSrc = readFileSync(__filename, "utf8");
    expect(selfSrc).toMatch(/§11\.305-phase3a/);
  });

  it("compare/page.tsx — §11.381c retire (잔존 @ts-nocheck 표면 0)", () => {
    // §11.381c: 원 scope 파일 소멸 — @ts-nocheck 재유입 표면 자체가 사라짐.
    expect(
      existsSync(resolve(REPO_ROOT, "apps/web/src/app/_workbench/compare/page.tsx")),
    ).toBe(false);
  });

  describe("AnalyticsEvent enum 4 literal 보존 (lib/analytics.ts — enum 생존)", () => {
    it('"compare_export_csv" literal 보존', () => {
      expect(ANALYTICS_SRC).toMatch(/\|\s*"compare_export_csv"/);
    });

    it('"compare_decision_option_committed" literal 보존', () => {
      expect(ANALYTICS_SRC).toMatch(/\|\s*"compare_decision_option_committed"/);
    });

    it('"compare_review_enter" literal 보존', () => {
      expect(ANALYTICS_SRC).toMatch(/\|\s*"compare_review_enter"/);
    });

    it('"compare_review_handoff" literal 보존', () => {
      expect(ANALYTICS_SRC).toMatch(/\|\s*"compare_review_handoff"/);
    });

    it("§11.305-phase3a trace 주석 존재 (analytics.ts)", () => {
      expect(ANALYTICS_SRC).toMatch(/§11\.305-phase3a/);
    });
  });
});
