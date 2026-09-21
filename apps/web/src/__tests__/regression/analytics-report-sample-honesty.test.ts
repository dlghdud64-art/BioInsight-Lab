/**
 * §analytics-report-sample-honesty (2026-09-21 · 호영님 판정) · **예시 리포트는 자기가 예시라고 말한다.**
 *
 * ── 왜 ──
 * 분석 화면의 「AI 리포트 예시」 모달은 모든 수치가 샘플이다(실 endpoint 없음 · §analytics-ai-report-sian).
 * 2026-09-20 운영 세션이 그중 한 줄(「18% 절감 가능 (예시)」)을 "분석 화면 한가운데 추천 행" 으로
 * **잘못 보고**해 삭제 판정이 내려졌다가, 호영님이 소스를 직접 읽고 철회했다.
 * 판정 기준은 「실데이터 자리에 예시를 두지 않는다」 가 아니라 **「화면이 자기 자신에 대해 거짓말하는가」** 다.
 * 재고·예산은 표기 없이 실데이터인 척했고, 이 모달은 진입 라벨부터 예시라고 말한다 — 같은 항목이 아니다.
 *
 * 그래서 유지하되 **표기가 사라지면 RED** 로 잠근다. 유지의 근거가 표기이기 때문이다.
 *
 * ── 이 파일이 지키는 명제 ──
 *   ① 표기 5겹이 있다 — 진입 라벨 「AI 리포트 예시」 · 배너 「예시 리포트입니다.」 · 섹션 「· 샘플」 ·
 *      항목 「(예시)」 · 풋터 「예시 데이터 기준」.
 *   ② 항목 표기는 **전량**이다 — 절감 Top3 · AI 권고의 모든 항목이 「(예시)」 로 끝난다(하나라도 빠지면 RED).
 *   ③ 예시와 실데이터가 병존하지 않는다 — 모달 블록 안에서 데이터를 가져오지 않는다(fetch · useQuery 0).
 *      실 endpoint 가 생기면 이 모달은 **교체 대상**이다(§analytics-ai-report-sian 만료 조건).
 *   ④ dead button 0 — 모달에 PDF 저장 등 동작 없는 버튼이 없다(닫기만).
 *
 * ── 이 파일이 안 보는 것 (자기 한계) ──
 *   1. 렌더 결과. 소스만 읽는다 — 브라우저 실측은 별도(2026-09-21 prod 세션 만료로 미실시).
 *   2. 표기의 **가시성**(글자 크기·대비). 존재만 본다.
 *   3. 모달 **밖**의 같은 형태. 분석 화면 본문의 「예시 · 실제 수치 아님」 표기(987·1011 부근)는 이 창 밖이다.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";
import { blockFrom } from "@/__tests__/_helpers/block-window";

const SRC = join(__dirname, "..", "..");
const PAGE = stripComments(readFileSync(join(SRC, "app/dashboard/analytics/page.tsx"), "utf8"));

/** 모달 블록 — `{reportModalOpen && (` 의 여는 괄호부터 대응 닫는 괄호까지. */
function modalBlock(): string {
  const at = PAGE.indexOf("{reportModalOpen && (");
  if (at < 0) return "";
  return blockFrom(PAGE, PAGE.indexOf("(", at), "(", ")");
}

/** 배열 리터럴 블록 — 앵커 문자열 뒤 첫 `[` 부터 대응 `]` 까지. */
function arrayAfter(src: string, anchor: string): string {
  const at = src.indexOf(anchor);
  if (at < 0) return "";
  return blockFrom(src, src.indexOf("[", at), "[", "]");
}

describe("§analytics-report-sample-honesty · 예시 리포트는 자기가 예시라고 말한다", () => {
  it("① 표기 5겹 (라벨 · 배너 · 섹션 · 항목 · 풋터)", () => {
    const modal = modalBlock();
    expect(modal.length).toBeGreaterThan(0);
    // 진입 라벨은 모달 밖(여는 버튼)에 있다 — 파일 기준으로 본다
    expect(PAGE).toMatch(/AI 리포트 예시/);
    expect(modal).toMatch(/예시 리포트입니다\./);
    expect(modal).toMatch(/AI 절감 기회 Top 3[\s\S]{0,160}· 샘플/);
    expect(modal).toMatch(/\(예시\)/);
    expect(modal).toMatch(/예시 데이터 기준/);
  });

  it("② 항목 표기는 전량 · 절감 Top3 · AI 권고의 모든 항목이 (예시)", () => {
    const modal = modalBlock();
    const top3 = arrayAfter(modal, "AI 절감 기회 Top 3");
    const descs = [...top3.matchAll(/desc:\s*"([^"]+)"/g)].map((m) => m[1]);
    expect(descs.length).toBeGreaterThan(0);
    for (const d of descs) expect(d, `표기 누락: ${d}`).toMatch(/\(예시\)$/);

    const recs = arrayAfter(modal, "AI 권고");
    const lines = [...recs.matchAll(/"([^"]+)"/g)].map((m) => m[1]);
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(l, `표기 누락: ${l}`).toMatch(/\(예시\)$/);
  });

  it("③ 예시와 실데이터 병존 0 · 모달 안에서 데이터를 가져오지 않는다", () => {
    const modal = modalBlock();
    expect(modal).not.toMatch(/\bfetch\(/);
    expect(modal).not.toMatch(/\buseQuery\(/);
    expect(modal).not.toMatch(/\bcsrfFetch\(/);
  });

  it("④ dead button 0 · 동작 없는 저장·내보내기 버튼이 없다", () => {
    const modal = modalBlock();
    expect(modal).not.toMatch(/PDF 저장|PDF 다운로드|내보내기/);
    // 버튼은 닫기뿐이다. 패널의 전파 차단(e.stopPropagation)은 동작이 아니므로 제외하고,
    //   나머지 onClick 은 전부 setReportModalOpen(false) 여야 한다.
    const handlers = [...modal.matchAll(/onClick=\{([^}]*)\}/g)]
      .map((m) => m[1].trim())
      .filter((h) => !/^\(e\) => e\.stopPropagation\(\)$/.test(h));
    expect(handlers.length).toBeGreaterThan(0);
    for (const h of handlers) expect(h).toMatch(/setReportModalOpen\(false\)/);
  });
});
