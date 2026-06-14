/**
 * §O1 #transition-canonical — quote 전이 canonical 단일화 회귀 가드.
 *
 * audit O1 HIGH: quotes status route 가 canonical validateTransition 을 import 만 하고
 *   로컬 ALLOWED_STATUS_TRANSITIONS 로 검증(내용 drift) → canonical SoT 일원화.
 *
 * 호영님 확정 규칙(canonical QUOTE):
 *   a) CANCELLED→[PENDING] 허용(재활성화) — canonical 유일 변경
 *   b) COMPLETED→CANCELLED 금지 (canonical COMPLETED→[PURCHASED] 유지)
 *   c) 단계 skip(PENDING/PARSED→COMPLETED, RESPONDED→PURCHASED) 금지
 *
 * 방법: readFileSync + regex (격리 node → operator 실 vitest).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const SM_PATH = "src/lib/operations/state-machine.ts";
const ROUTE_PATH = "src/app/api/quotes/[id]/status/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§O1 — canonical state-machine QUOTE 규칙", () => {
  it("a) CANCELLED→[PENDING] 재활성화 허용(canonical 반영)", () => {
    const src = read(SM_PATH);
    expect(src).toMatch(/CANCELLED: \["PENDING"\]/);
  });
  it("b) COMPLETED→[PURCHASED] 유지(완료후취소 금지)", () => {
    const src = read(SM_PATH);
    expect(src).toMatch(/COMPLETED: \["PURCHASED"\]/);
    // COMPLETED 분기에 CANCELLED 가 들어가면 안 됨
    expect(src).not.toMatch(/COMPLETED: \[[^\]]*CANCELLED[^\]]*\]/);
  });
});

describe("§O1 — quotes status route canonical 일원화", () => {
  it("validateTransition(\"QUOTE\") 로 검증", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/validateTransition\("QUOTE",\s*currentStatus,\s*status\)/);
  });
  it("canonical ALLOWED_QUOTE_TRANSITIONS import 사용(에러 응답 재구성)", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/import \{ validateTransition, ALLOWED_QUOTE_TRANSITIONS \}/);
    expect(src).toMatch(/ALLOWED_QUOTE_TRANSITIONS\[currentStatus\]/);
  });
  it("로컬 ALLOWED_STATUS_TRANSITIONS 재정의 제거(drift 차단)", () => {
    const src = read(ROUTE_PATH);
    expect(src).not.toMatch(/const ALLOWED_STATUS_TRANSITIONS/);
  });
  it("S1 stale 주석('인증된 사용자면 허용') 정정", () => {
    const src = read(ROUTE_PATH);
    expect(src).not.toMatch(/현재는 인증된 사용자면 허용/);
    expect(src).toMatch(/enforceAction\(quote_status_change\)/);
  });
  it("회귀 0 — enforceAction 권한 강제 + STATUS_LABELS 에러 UX 보존", () => {
    const src = read(ROUTE_PATH);
    expect(src).toMatch(/action: 'quote_status_change'/);
    expect(src).toMatch(/STATUS_LABELS\[currentStatus\]/);
  });
});
