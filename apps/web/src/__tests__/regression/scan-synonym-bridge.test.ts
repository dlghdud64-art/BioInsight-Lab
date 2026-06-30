/**
 * §scan-synonym-bridge (호영님 2026-06-30) — PubChem 동의어로 약어↔풀네임 역매칭(Tier 3).
 *
 * route(/api/catalog/enrich): 동의어 있으면 rankSynonymCandidates → synonymCandidates 반환(best-effort).
 * UI(LabelScannerModal): reverse-match 0 + synonymCandidates 있을 때만 "표준명 기준" 후보(승인형).
 *   scan-label 무변경(속도 보존), canonical 무접촉, 자동확정 0.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(resolve(SRC, rel), "utf8");

describe("§scan-synonym-bridge — enrich route", () => {
  const ROUTE = read("app/api/catalog/enrich/route.ts");

  it("db + rankSynonymCandidates import", () => {
    expect(ROUTE).toMatch(/import \{ db \} from "@\/lib\/db"/);
    expect(ROUTE).toMatch(/import \{ rankSynonymCandidates[\s\S]{0,60}from "@\/lib\/inventory\/reverse-match"/);
  });

  it("동의어 있을 때만 매칭 + synonymCandidates 반환", () => {
    expect(ROUTE).toMatch(/enrichment && enrichment\.synonyms\.length > 0/);
    expect(ROUTE).toMatch(/rankSynonymCandidates\(\s*\{ synonyms: enrichment\.synonyms, canonicalName: enrichment\.canonicalName \}/);
    expect(ROUTE).toMatch(/NextResponse\.json\(\{ enrichment, synonymCandidates \}\)/);
  });

  it("auth 401 가드 보존", () => {
    expect(ROUTE).toMatch(/await auth\(\)/);
    expect(ROUTE).toMatch(/status:\s*401/);
  });
});

describe("§scan-synonym-bridge — UI fallback 후보(LabelScannerModal)", () => {
  const MODAL = read("components/inventory/LabelScannerModal.tsx");

  it("synonymCandidates 상태 + enrich 응답 캡처", () => {
    expect(MODAL).toMatch(/const \[synonymCandidates, setSynonymCandidates\]/);
    expect(MODAL).toMatch(/setSynonymCandidates\(d\?\.synonymCandidates \?\? \[\]\)/);
  });

  it("표준명 기준 후보는 reverse-match 0일 때만(중복 방지) + synonymCandidates 있을 때만", () => {
    expect(MODAL).toMatch(/!\(scanResult\.matchType === "fuzzy_name" && scanResult\.productCandidates && scanResult\.productCandidates\.length > 0\) && synonymCandidates\.length > 0 && \(/);
    expect(MODAL).toMatch(/표준명 기준/);
  });

  it("[이 품목 선택] 재사용(updateField 3필드) + 신뢰도 배지", () => {
    expect(MODAL).toMatch(/synonymCandidates\.slice\(0, 3\)/);
    expect(MODAL).toMatch(/c\.level === "high" \? "높음"/);
  });

  it("신규 품목 배너 게이트에 synonym 양보(토큰 보존)", () => {
    expect(MODAL).toMatch(/!scanResult\.matchedProduct && \(/);
    expect(MODAL).toMatch(/synonymCandidates\.length === 0/);
  });
});
