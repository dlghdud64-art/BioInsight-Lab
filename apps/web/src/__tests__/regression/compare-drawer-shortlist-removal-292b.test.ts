/**
 * §11.292b #compare-drawer-shortlist-removal — 호영님 spec 정합 sentinel.
 *
 * 호영님 §11.292 1단계 정합 (2026-05-24):
 *   §11.292 1단계가 소싱 검색 결과 화면의 Shortlist/Hold/Exclude 제거.
 *   비교 drawer 안에도 동일 분류 button 3종 (후보 등록/보류/제외) 잔존.
 *   호영님 spec 의 "이메일 정리" 같은 분류 단계 강제 회피 원리 정합 —
 *   비교 drawer 도 동일 제거.
 *
 * Fix: compare-analysis-drawer.tsx candidate card 의 후보 등록/보류/제외
 *   button 3종 block 제거. CandidateAction type / action / onActionChange
 *   prop 은 backward compat 유지 (다른 사용처 회귀 0). canProceed 는
 *   directCount > 0 만으로 자연 정합.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const DRAWER = readFileSync(
  resolve(
    __dirname,
    "../../app/compare/_components/compare-analysis-drawer.tsx",
  ),
  "utf8",
);

describe("§11.292b — 비교 drawer 후보 등록/보류/제외 button 제거", () => {
  it("§11.292b trace marker + compare-drawer-shortlist-removal comment", () => {
    expect(DRAWER).toMatch(/§11\.292b/);
    expect(DRAWER).toMatch(/후보 등록\/보류\/제외 button 3종 제거/);
  });

  it("candidate card 의 '후보 등록' button onClick=shortlist 제거", () => {
    expect(DRAWER).not.toMatch(
      /onClick=\{\(\)\s*=>\s*onActionChange\(action === "shortlist" \? null : "shortlist"\)\}/,
    );
  });

  it("candidate card 의 '보류' button onClick=hold 제거", () => {
    expect(DRAWER).not.toMatch(
      /onClick=\{\(\)\s*=>\s*onActionChange\(action === "hold" \? null : "hold"\)\}/,
    );
  });

  it("candidate card 의 '제외' button onClick=exclude 제거", () => {
    expect(DRAWER).not.toMatch(
      /onClick=\{\(\)\s*=>\s*onActionChange\(action === "exclude" \? null : "exclude"\)\}/,
    );
  });

  it("Shortlist / Hold / Exclude 영문 주석 (제거 전 comment) 부재 — 새 §11.292b comment 으로 swap", () => {
    expect(DRAWER).not.toMatch(/Shortlist \/ Hold \/ Exclude — blocked 후보에서는 제외/);
  });

  it("CandidateAction type + onActionChange prop backward compat 유지", () => {
    expect(DRAWER).toMatch(
      /type CandidateAction\s*=\s*"shortlist"\s*\|\s*"hold"\s*\|\s*"exclude"\s*\|\s*null/,
    );
    // shortlistCount 사용 보존 (자동 0 또는 다른 source)
    expect(DRAWER).toMatch(/shortlistCount/);
  });

  it("기존 비교 분석 인프라 보존 (회귀 0)", () => {
    expect(DRAWER).toMatch(/substitute_reference/);
    expect(DRAWER).toMatch(/blocked_or_mismatch/);
    expect(DRAWER).toMatch(/CompareInsight/);
    expect(DRAWER).toMatch(/computeDeltaSummary/);
  });

  it("isBlocked 분기 + 비교 불가 메시지 보존", () => {
    expect(DRAWER).toMatch(/isBlocked = candidate\.category === "blocked_or_mismatch"/);
    expect(DRAWER).toMatch(/비교 불가 — \{candidate\.categoryReason\}/);
  });
});
