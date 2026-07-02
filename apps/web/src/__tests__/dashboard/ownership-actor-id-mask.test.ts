/**
 * §ownership-actor-id-mask (호영님 2026-07-02) — raw 내부 유저키 UI 노출 차단.
 *
 * 문제: currentOwnerName 에 "user-inv-001" 등 raw 내부 id 가 들어가 "담당/실행 주체" 에 그대로 노출
 *       (실기기 입고 상세). 제품원칙 "raw label / internal key 금지" 위반.
 * 수정: ownership-adapter 에 maskInternalActor 가드 — user-/actor-/usr- 패턴이면 undefined 반환
 *       → 소비 컴포넌트(ownership-display)가 currentOwnerRole 로 폴백.
 * 회귀 0: currentOwnerRole 라벨(입고 검수 담당자·구매 실행 담당자) 보존, 정상 이름(예: 팀명)은 통과.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const ADAPTER = readFileSync(
  join(REPO_ROOT, "src/lib/ops-console/ownership-adapter.ts"),
  "utf8",
);

describe("§ownership-actor-id-mask — 가드 정의·적용", () => {
  it("maskInternalActor + INTERNAL_ACTOR_ID 패턴 정의", () => {
    expect(ADAPTER).toMatch(/function maskInternalActor\(/);
    expect(ADAPTER).toMatch(/INTERNAL_ACTOR_ID\s*=\s*\/\^\(user\|actor\|usr\)\[-_\]\/i/);
  });
  it("raw id 3 소스 모두 마스킹 래핑(po.ownerId · rb.receivedBy · item.owner)", () => {
    expect(ADAPTER).toMatch(/currentOwnerName:\s*maskInternalActor\(po\.ownerId/);
    expect(ADAPTER).toMatch(/currentOwnerName:\s*maskInternalActor\(rb\.receivedBy/);
    expect(ADAPTER).toMatch(/currentOwnerName:\s*maskInternalActor\(item\.owner\)/);
  });
  it("raw id 를 currentOwnerName 으로 직접 전달하지 않음(회귀 방지)", () => {
    expect(ADAPTER).not.toMatch(/currentOwnerName:\s*po\.ownerId\s*\?\?/);
    expect(ADAPTER).not.toMatch(/currentOwnerName:\s*rb\.receivedBy\s*\?\?/);
    expect(ADAPTER).not.toMatch(/currentOwnerName:\s*item\.owner,/);
  });
});

describe("§ownership-actor-id-mask — 회귀 0(역할 라벨 보존)", () => {
  it("currentOwnerRole 폴백 라벨 보존", () => {
    expect(ADAPTER).toMatch(/currentOwnerRole:\s*'입고 검수 담당자'/);
    expect(ADAPTER).toMatch(/currentOwnerRole:\s*'구매 실행 담당자'/);
  });
});
