/**
 * §quote-userid-fk-honest — 견적 생성 시 userId FK(orphan 세션) 정직 에러
 *   (bug-hunter 진단 2026-06-26: POST /api/quotes 500 "존재하지 않는 제품" = 실제론 Quote_userId_fkey P2003.
 *    세션 user.id 가 User 테이블에 없음(orphan JWT). 오해 메시지 → 재로그인 안내로 정직화.)
 *
 * honesty: 진짜 원인(세션 사용자 부재)을 가리는 "존재하지 않는 제품" 대신 실행 가능한 재로그인 안내.
 *   재로그인 시 auth jwt 콜백이 User 재provision → self-heal.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROUTE = readFileSync(
  resolve(__dirname, "../../../app/api/quotes/route.ts"),
  "utf8",
);

describe("§quote-userid-fk-honest — userId FK 정직 에러", () => {
  it("Quote_userId_fkey P2003 전용 분기(orphan 세션 감지)", () => {
    expect(ROUTE).toMatch(/error\?\.code === "P2003" && \/Quote_userId_fkey\|userId_fkey\/i\.test/);
  });
  it("재로그인 안내 메시지 + SESSION_USER_INVALID + 409", () => {
    expect(ROUTE).toMatch(/세션 사용자 정보가 유효하지 않습니다\. 다시 로그인해 주세요\./);
    expect(ROUTE).toMatch(/code: "SESSION_USER_INVALID"/);
    expect(ROUTE).toMatch(/status: 409/);
  });
  it("userId 분기가 generic P2003('존재하지 않는 제품') 매핑보다 먼저(오해 메시지 회피)", () => {
    const userIdIdx = ROUTE.indexOf("Quote_userId_fkey|userId_fkey");
    const genericIdx = ROUTE.indexOf("존재하지 않는 제품 또는 조직 정보가 포함되어 있습니다.");
    expect(userIdIdx).toBeGreaterThan(0);
    expect(genericIdx).toBeGreaterThan(userIdIdx); // userId 분기가 앞
  });
});

describe("§quote-userid-fk-honest — 회귀 0(기존 분류 보존)", () => {
  it("generic P2003·P2002 분류 보존(다른 FK/중복은 기존 메시지)", () => {
    expect(ROUTE).toMatch(/존재하지 않는 제품 또는 조직 정보가 포함되어 있습니다\./);
    expect(ROUTE).toMatch(/이미 동일한 견적이 존재합니다\./);
  });
});
