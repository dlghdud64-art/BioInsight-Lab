/**
 * §09 sian(호영님 라이브 대조) — 발송 검토 모달 ready 상태 시안 정합 보완.
 *   ① 헤더: 케이스 ref(quoteRef·cuid 미노출) + 담당자 칩(시안 헤더 정합, 4b 과제거분 복원).
 *   ② 받는 공급사 "다시 선택" = 후보 리스트 펼치기(§4c-rebloat candidatesExpanded 토글 재사용).
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const src = readFileSync(
  resolve(__dirname, "../../../components/quotes/dispatch/vendor-dispatch-workbench.tsx"),
  "utf8",
);

describe("§09 sian — 헤더 칩 + 받는 공급사 다시 선택", () => {
  it("헤더 케이스 ref(quoteRef) + 담당자 칩 (cuid 미노출)", () => {
    expect(src).toContain("케이스 {quoteRef ");
    expect(src).toContain("담당 발송 운영자");
    // cuid 원본 미노출 — quoteRef 파생만
    expect(src).not.toMatch(/케이스 \{quoteId\}/);
  });

  it("받는 공급사 '다시 선택' = 후보 펼치기(접기 토글 재사용)", () => {
    expect(src).toContain("다시 선택");
    expect(src).toContain("setCandidatesExpanded(true)");
  });
});
