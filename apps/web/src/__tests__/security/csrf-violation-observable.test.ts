/**
 * §csrf-violation-observable (2026-09-21) · CSRF 위반이 비휘발 싱크에 남는가.
 *
 * 배경: prod 실측 2026-09-21 — mode=full_enforce, envConfig.recognized=true.
 *   차단이 실제로 일어나고 있다. 그런데 recordSecurityEvent 는 모듈 내 배열
 *   (event-provenance-engine.ts:130 · 2000건 링 버퍼)에만 쌓고 DB·외부 싱크가 0이다.
 *   서버리스라 인스턴스가 바뀌면 그 순간 사라진다 = 누가 무엇에 막혔는지 사후에 모른다.
 *
 * 이 계약은 "저장층을 바꾼다" 가 아니다. 그건 별도 트랙(조항: 가드를 세우기 전에
 *   그 아래 저장층이 무엇인지 확인한다)이고 prod DDL 승인이 필요하다.
 *   여기서 무는 것은 최소한의 것 · 차단 사실이 Vercel 런타임 로그에 남는가.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const MW = join(__dirname, "..", "..", "middleware.ts");
const src = readFileSync(MW, "utf8");
const stripComments = (s: string) =>
  s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/[^\n]*/g, "$1");
const code = stripComments(src);

describe("§csrf-violation-observable · 비휘발 싱크", () => {
  it("🛑 위반 기록 함수가 런타임 로그에도 남긴다", () => {
    const fn = code.slice(code.indexOf("function recordCsrfMiddlewareTelemetry"));
    const body = fn.slice(0, fn.indexOf("function buildCsrfBlockResponse"));
    expect(body).toMatch(/console\.warn\(/);
    expect(body).toMatch(/\[csrf\]/);
  });

  it("🛑 로그가 차단과 기록만을 구분한다 · 둘은 다른 사실이다", () => {
    const fn = code.slice(code.indexOf("function recordCsrfMiddlewareTelemetry"));
    const body = fn.slice(0, fn.indexOf("function buildCsrfBlockResponse"));
    expect(body).toMatch(/blocked\s*\?\s*['"]blocked['"]\s*:\s*['"]observed['"]/);
  });

  it("기록 함수가 blocked 를 인자로 받는다 · 호출부가 알려 줘야 하는 사실이다", () => {
    expect(code).toMatch(/function recordCsrfMiddlewareTelemetry\([\s\S]{0,400}?blocked:\s*boolean/);
  });

  it("위반 지점 전부가 blocked 를 넘긴다", () => {
    const calls = code.match(/recordCsrfMiddlewareTelemetry\(/g) ?? [];
    /* 정의 1 + 호출 3 */
    expect(calls.length).toBe(4);
    const passing = code.match(/actorUserId,\s*blocked,/g) ?? [];
    expect(passing.length).toBe(3);
  });

  it("🛑 차단 판정은 지점당 한 번만 계산한다 · 기록과 분기가 같은 값을 본다", () => {
    const evals = code.match(/shouldBlockOnViolation\(mode/g) ?? [];
    expect(evals.length).toBe(3);
    /* 판정을 다시 부르는 if 가 남아 있으면 기록과 분기가 갈릴 수 있다 */
    expect(code).not.toMatch(/if\s*\(\s*shouldBlockOnViolation\(/);
  });

  it("🛑 토큰과 본문은 로그에 싣지 않는다", () => {
    const fn = code.slice(code.indexOf("function recordCsrfMiddlewareTelemetry"));
    const body = fn.slice(0, fn.indexOf("function buildCsrfBlockResponse"));
    expect(body).not.toMatch(/cookieToken|headerToken|req\.body|CSRF_HEADER_NAME/);
  });

  it("메모리 기록은 그대로 남는다 · 로그는 대체가 아니라 추가다", () => {
    const fn = code.slice(code.indexOf("function recordCsrfMiddlewareTelemetry"));
    const body = fn.slice(0, fn.indexOf("function buildCsrfBlockResponse"));
    expect(body).toMatch(/recordSecurityEvent\(/);
  });
});
