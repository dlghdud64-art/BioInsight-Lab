/**
 * §quote-status-toast-honesty — 상태 변경 실패 토스트에 raw 견적 cuid(internal key) 노출 제거
 *   (호영님 2026-06-27: "cmqtqoeb: 현재 역할로는…" 토스트의 cmqtqoeb = 견적 cuid 앞 8자 노출.
 *    CLAUDE.md "raw label / internal key 노출 금지" 위반 + 영문코드+한글 혼재로 미완성 인상.)
 *
 * Fix: 실패 메시지 접두를 raw quoteId.slice(0,8) → 사람이 읽는 견적 제목(없으면 메시지 단독).
 *   reject reason(객체/스택) 노출도 품위 안내로 정리.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = readFileSync(
  resolve(__dirname, "../../../components/quotes/dispatch/batch-status-change-sheet.tsx"),
  "utf8",
);

describe("§quote-status-toast-honesty — internal key 노출 제거", () => {
  it("raw quoteId.slice(0,8) 접두 제거(내부 cuid 비노출)", () => {
    expect(SRC).not.toMatch(/\$\{r\.value\.quoteId\.slice\(0, 8\)\}:/);
  });
  it("실패 접두 = 사람이 읽는 견적 제목(없으면 메시지 단독)", () => {
    expect(SRC).toMatch(/const failTitle = selectedQuotes\.find\(\(q\) => q\.id === r\.value\.quoteId\)\?\.title/);
    expect(SRC).toMatch(/failTitle \? `\$\{failTitle\}: \$\{r\.value\.message\}` : r\.value\.message/);
  });
  it("reject reason(객체/스택) 노출 제거 → 품위 안내", () => {
    expect(SRC).not.toMatch(/`unknown: \$\{r\.reason\}`/);
    expect(SRC).toMatch(/처리 중 오류가 발생했습니다\./);
  });
});

describe("§quote-status-toast-honesty — 회귀 0(토스트 구조 보존)", () => {
  it("성공/실패/부분 토스트 분기 보존", () => {
    expect(SRC).toMatch(/title: "상태 변경 완료"/);
    expect(SRC).toMatch(/title: "상태 변경 실패"/);
    expect(SRC).toMatch(/title: "일부 상태 변경 실패"/);
  });
  it("실패 메시지 canonical(error.error API 메시지) 보존", () => {
    expect(SRC).toMatch(/error\.message \|\| error\.error \|\| "상태 변경 실패"/);
  });
});
