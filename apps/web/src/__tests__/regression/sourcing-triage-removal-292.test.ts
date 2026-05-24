/**
 * §11.292 #sourcing-triage-removal — 호영님 P1 1단계 단순화 sentinel.
 *
 * 호영님 P1 1단계 (2026-05-24):
 *   /app/search 검색 결과 화면에서 SOURCING RESULT TRIAGE 블록 +
 *   카드 분류 배지 (Exact Match/Cross-Vendor/Substitute/Blocked) +
 *   Shortlist/Hold/Exclude 버튼 전면 제거.
 *
 *   근거: (1) 검색이 이미 필터 역할 (2) 모든 카드 동일 분류 = 정보가치 0
 *   (3) Shortlist/Hold/Exclude 는 불필요 중간 단계 (4) AI 차별화는
 *   비교 단계 (2단계 별도 batch) 에 이미 인프라 있음.
 *
 * 변경: page.tsx 4 location + sourcing-result-row.tsx 1 block. dead
 *   state/handler (sourcingCandidateTriage / openSourcingTriageReview /
 *   openSourcingTriageRequest) 는 P2 cleanup batch.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE = readFileSync(
  resolve(__dirname, "../../app/_workbench/search/page.tsx"),
  "utf8",
);
const ROW = readFileSync(
  resolve(__dirname, "../../app/_workbench/_components/sourcing-result-row.tsx"),
  "utf8",
);

describe("§11.292 — 소싱 TRIAGE 제거 + 카드 단순화", () => {
  it("§11.292 trace marker (page.tsx + sourcing-result-row.tsx)", () => {
    expect(PAGE).toMatch(/§11\.292/);
    expect(ROW).toMatch(/§11\.292/);
  });

  describe("page.tsx — TRIAGE block 제거", () => {
    it("desktop TRIAGE section 제거 — sourcing-result-triage testid 잔존 0", () => {
      expect(PAGE).not.toMatch(/data-testid="sourcing-result-triage"/);
      expect(PAGE).not.toMatch(/data-testid="sourcing-triage-compare-cta"/);
      expect(PAGE).not.toMatch(/data-testid="sourcing-triage-request-cta"/);
      expect(PAGE).not.toMatch(/data-testid="sourcing-triage-candidate-list"/);
    });

    it("Sourcing Result Triage 영문 헤더 + Exact/Equivalent/Substitute/Blocked 안내 제거", () => {
      expect(PAGE).not.toMatch(/Sourcing Result Triage/);
      expect(PAGE).not.toMatch(
        /Exact \/ Equivalent \/ Substitute \/ Blocked 후보를 먼저/,
      );
    });

    it("mobile sheet TRIAGE block 제거 (소싱 결과 분류 (모바일) section)", () => {
      expect(PAGE).not.toMatch(/aria-label="소싱 결과 분류 \(모바일\)"/);
    });

    it("SourcingResultRow 의 triage props 4종 전달 제거", () => {
      expect(PAGE).not.toMatch(/triageSections=\{sourcingTriage\?/);
      expect(PAGE).not.toMatch(/triageClassification=\{sourcingTriage\?/);
      expect(PAGE).not.toMatch(/triageActionState=\{sourcingCandidateTriage/);
      expect(PAGE).not.toMatch(/onSetTriageAction=\{\(state\)/);
    });

    it("AI 분석 sheet 헤더 'SOURCING RESULT TRIAGE' 텍스트 제거 (AI 제안 · 차단 사유만)", () => {
      expect(PAGE).not.toMatch(/SOURCING RESULT TRIAGE/);
      expect(PAGE).toMatch(/AI 제안 · 차단 사유/);
    });
  });

  describe("sourcing-result-row.tsx — 카드 내부 배지 + Shortlist/Hold/Exclude 제거", () => {
    it("triage-badges block + classification + blocked-reason testid 제거", () => {
      expect(ROW).not.toMatch(/data-testid="sourcing-candidate-triage-badges"/);
      expect(ROW).not.toMatch(/data-testid="sourcing-candidate-classification"/);
      expect(ROW).not.toMatch(/data-testid="sourcing-candidate-blocked-reason"/);
    });

    it("Shortlist/Hold/Exclude 3 button testid + label 제거", () => {
      expect(ROW).not.toMatch(/data-testid=`sourcing-candidate-\$\{state\}-action`/);
      // 카드 내부 "Shortlist" / "Hold" / "Exclude" string 부재 (comment 안의 문구는 허용)
      expect(ROW).not.toMatch(/state === "shortlist" \? "Shortlist"/);
    });
  });

  describe("회귀 0 — 핵심 surface 보존", () => {
    it("SourcingResultRow component import + render 보존", () => {
      expect(PAGE).toMatch(/import \{ SourcingResultRow \} from/);
      expect(PAGE).toMatch(/<SourcingResultRow/);
    });

    it("비교 추가 (toggleCompare) + 견적 담기 (addProductToQuote) prop 보존", () => {
      expect(PAGE).toMatch(/onToggleCompare=\{/);
      expect(PAGE).toMatch(/onToggleRequest=\{/);
      expect(PAGE).toMatch(/toggleCompare\(product\.id/);
      expect(PAGE).toMatch(/addProductToQuote\(product\)/);
    });

    it("카드 component 의 제품명/staticMeta 표시 보존", () => {
      expect(ROW).toMatch(/{product\.name}/);
      expect(ROW).toMatch(/staticMeta/);
    });

    it("§11.283b 햄버거 plain button + §11.280-2 Menu pointer-events-none 보존", () => {
      expect(PAGE).toMatch(/§11\.283b/);
      expect(PAGE).toMatch(/sourcing-hamburger-plain-button/);
      expect(PAGE).toMatch(/<Menu[\s\S]{0,100}pointer-events-none/);
    });
  });
});
