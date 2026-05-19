/**
 * §11.264d #quote-bottom-sheet-object-label — 견적 바텀시트에 견적명 표시 (호영님 spec #3-2 P1)
 *
 * 호영님 spec:
 *   "선택한 견적" 라벨 옆에 대상 견적명 표시 (현재는 "선택한 견적"만 있어서
 *   어떤 견적인지 불명확)
 *
 * Root cause: caller (quotes/page.tsx line 3384) 에서 `objectLabel="선택한 견적"`
 * 정적 string 전달. 컴포넌트는 generic — caller 에서 견적명 결합 전달 필요.
 *
 * Fix (minimum diff, caller-side):
 *   objectLabel="선택한 견적" → objectLabel={`선택한 견적 · ${selectedQuote.title}`}
 *   컴포넌트 변경 0 (5 surface 영향 0). selectedQuote.title 은 이미 page 다른
 *   위치에서 사용 (line 2775, 2985, 3482, 3529).
 *
 * canonical truth lock:
 *   - MobileOperationalBriefSheet 컴포넌트 변경 0 (props 시그니처 보존)
 *   - chips override (§11.264a 정합) 보존: 상태 요약 / 회신 현황 / 리스크 / 발주 전환
 *   - selectedQuote / selectedSignals 조건부 보존
 *   - open / onClose / summary / facts / risks / next / primaryCta 전달 보존
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const PAGE_PATH = resolve(__dirname, "../../../app/dashboard/quotes/page.tsx");
const page = readFileSync(PAGE_PATH, "utf8");

describe("§11.264d #1 — objectLabel 견적명 동적 결합", () => {
  it("§11.264d trace marker comment 존재", () => {
    expect(page).toMatch(/§11\.264d/);
  });

  it("objectLabel 동적: `선택한 견적 · ${selectedQuote.title}` 패턴", () => {
    // 기존 정적: objectLabel="선택한 견적"
    // 신규 동적: objectLabel={`선택한 견적 · ${selectedQuote.title}`}
    expect(page).toMatch(
      /objectLabel=\{`선택한 견적\s*·\s*\$\{selectedQuote\.title\}`\}/,
    );
  });

  it("기존 정적 objectLabel=\"선택한 견적\" 제거", () => {
    expect(page).not.toMatch(/objectLabel="선택한 견적"/);
  });
});

describe("§11.264d #2 — invariant 보존 (canonical truth)", () => {
  it("MobileOperationalBriefSheet import 보존", () => {
    expect(page).toMatch(
      /import\s+\{\s*MobileOperationalBriefSheet\s*\}\s+from\s+"@\/components\/operational-brief\/mobile-bottom-sheet"/,
    );
  });

  it("selectedQuote && selectedSignals 조건부 보존", () => {
    expect(page).toMatch(/\{selectedQuote && selectedSignals && \(/);
  });

  it("open={!!selectedQuote} + onClose 보존", () => {
    expect(page).toMatch(/open=\{!!selectedQuote\}/);
    expect(page).toMatch(/onClose=\{\(\) => closeQuoteContextRail\("x_button"\)\}/);
  });

  it("chips override (§11.264a 4 entry) 보존: 상태 요약 / 회신 현황 / 리스크 / 발주 전환", () => {
    expect(page).toMatch(/\{ id: "summary",\s+label: "상태 요약" \}/);
    expect(page).toMatch(/\{ id: "facts",\s+label: "회신 현황" \}/);
    expect(page).toMatch(/\{ id: "risks",\s+label: "리스크" \}/);
    expect(page).toMatch(/\{ id: "next",\s+label: "발주 전환" \}/);
  });

  it("summary / facts / risks / next prop 전달 보존", () => {
    expect(page).toMatch(/summary=\{<p[\s\S]{0,200}selectedSignals\.summary/);
    expect(page).toMatch(/facts=\{/);
    expect(page).toMatch(/risks=\{/);
    expect(page).toMatch(/next=\{/);
  });

  it("selectedQuote.title 사용 패턴 보존 (line 2775, 2985, 3482, 3529 등)", () => {
    expect(page).toMatch(/quoteSummary=\{selectedQuote\.title\}/);
    expect(page).toMatch(/\$\{selectedQuote\.title\}\s*·\s*\$\{selectedSignals\.badge\}/);
  });
});
