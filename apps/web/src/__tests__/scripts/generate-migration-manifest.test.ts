/**
 * §migration-order-drift-guard Phase 1 — manifest 생성 계약 (RED → Phase 2 GREEN).
 *
 * 계약: prisma/migrations/ 아래 "migration.sql을 가진 디렉토리" 전수·이름 오름차순.
 *   파일(migration_lock.toml)·migration.sql 없는 디렉토리 제외. generatedAt ISO 메타 포함.
 *   ⚠️ 14자리 타임스탬프 패턴으로 거르지 않는다 — 실제 repo에 `0_init`(비패턴,
 *   prod 적용 실재)이 존재. 패턴 필터는 0_init을 영구 unknown으로 만든다 (P2 실측).
 *   DB 무접촉 (ADR-002 §11.13 무저촉 — repo 의도 스냅샷일 뿐).
 *
 * 커버리지 경계: 생성 함수의 파일시스템 계약만. prebuild 체인 연결·번들 포함
 *   여부는 Phase 3 build 게이트(실행 세션) 몫.
 */
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";

const require_ = createRequire(import.meta.url);
// src/__tests__/scripts → apps/web/scripts
const { generateManifest } = require_("../../../scripts/generate-migration-manifest.cjs");

let dir: string;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), "mig-manifest-"));
  // 실제 레포 형태 재현: 타임스탬프 폴더 3 + 비패턴 0_init + lock 파일
  //   + migration.sql 없는 잡 디렉토리 1
  for (const name of [
    "20260801120000_receiving_inspection_decision",
    "20260731120000_receiving_document",
    "20260804110916_pocandidate_quote_binding",
    "0_init",
  ]) {
    mkdirSync(join(dir, name));
    writeFileSync(join(dir, name, "migration.sql"), "-- sql\n");
  }
  mkdirSync(join(dir, "not_a_migration")); // migration.sql 없음 → 제외 대상
  writeFileSync(join(dir, "migration_lock.toml"), 'provider = "postgresql"\n');
});

afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("§migration-order-drift-guard — generateManifest", () => {
  it("migration.sql 보유 디렉토리 전수(0_init 포함)·이름 오름차순, lock 파일·sql 없는 디렉토리 제외", () => {
    const m = generateManifest(dir);
    expect(m.migrations).toEqual([
      "0_init",
      "20260731120000_receiving_document",
      "20260801120000_receiving_inspection_decision",
      "20260804110916_pocandidate_quote_binding",
    ]);
  });

  it("generatedAt ISO 메타 포함 (stale 판별용)", () => {
    const m = generateManifest(dir);
    expect(typeof m.generatedAt).toBe("string");
    expect(new Date(m.generatedAt).toISOString()).toBe(m.generatedAt);
  });
});
