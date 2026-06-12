import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";

// §11.369-3 (횡단 stale-lock) — concurrency 키 스킴 정정 sentinel.
//   배치: src/__tests__/regression/ (REPO_WEB = 3단계 상승).
//   ⚠️ P1-2(enforceAction wiring)·P1-3(read skip)은 P3 구현 전 RED(의도). P1-1(머신)은 GREEN.

const REPO_WEB = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_WEB, rel), "utf8");

const MACHINE = "src/lib/security/concurrency-key.ts";
const MIDDLEWARE = "src/lib/security/server-enforcement-middleware.ts";

describe("§11.369-3 P1-1 — 키 머신 (P2 GREEN)", () => {
  it("deriveConcurrencyKey export", () => {
    expect(read(MACHINE)).toMatch(/export function deriveConcurrencyKey/);
  });

  it("routePath 가 키에 포함 (cross-route 격리)", () => {
    expect(read(MACHINE)).toMatch(/routePath/);
    expect(read(MACHINE)).toMatch(/\$\{action\}:\$\{routePath\}/);
  });

  it("resource ?? userId fallback (double-submit 보호)", () => {
    const src = read(MACHINE);
    expect(src).toMatch(/targetEntityId\s*&&\s*targetEntityId\s*!==\s*["']unknown["']\s*\?\s*targetEntityId\s*:\s*userId/);
  });

  it("per-call UUID/timestamp 금지 (보호 제거 방지) — 결정적 키", () => {
    const src = read(MACHINE);
    expect(src).not.toMatch(/randomUUID|crypto\.randomUUID|Date\.now\(\)|Math\.random/);
  });
});

describe("§11.369-3 P1-2 — enforceAction wiring (P3 RED)", () => {
  it("server-enforcement-middleware 가 deriveConcurrencyKey 사용", () => {
    expect(read(MIDDLEWARE)).toMatch(/deriveConcurrencyKey/);
  });

  it("전역 'unknown' 키 제거 — beginMutation 에 action 직접 키 사용 안 함", () => {
    const src = read(MIDDLEWARE);
    expect(src).not.toMatch(/beginMutation\(\s*mutationAction\s*,\s*config\.targetEntityId\s*\)/);
  });
});

describe("§11.369-3 P1-3 — read lock-skip (P3 RED)", () => {
  it("read-only(GET) 는 beginMutation skip (동시성 보호 불요, audit 유지)", () => {
    const src = read(MIDDLEWARE);
    expect(src).toMatch(/readOnly|isReadOnly|skipLock|read_only/);
  });
});

describe("§11.369-3 P4 — 에러 메시지 정직화", () => {
  it("'다른 작업 진행 중' 이중거짓 제거 — double-submit 정직 문구", () => {
    const src = read(MIDDLEWARE);
    expect(src).not.toMatch(/같은 항목에 대한 다른 작업이 진행 중입니다/);
    expect(src).toMatch(/처리 중인 동일 요청|중복.*요청|잠시 후 다시/);
  });
});
