/**
 * §migration-rollout-gate — prod migration rollout 경로의 "모순 유물" 잠금.
 *
 * 배경 (2026-08-08 prod 장애):
 *   push 하면 migration 이 자동 적용된다고 오판 → DDL 미적용 상태로 코드 배포.
 *   실제 빌드 경로는 apps/web (Root Directory) 이며 prebuild 의
 *   scripts/vercel-migrate.js 는 ADR-002 §11.13 이후 완전 NO-OP.
 *   실증: deployment dpl_213TwWpVJPw8RKnHPBMAmyhuwd3q (commit c476c2b,
 *   2026-08-08 02:36) 빌드 로그 — `npm install` → `npm run build` →
 *   `web@0.1.0 prebuild` → `[prebuild] vercel-migrate.js is a NO-OP`.
 *   루트 vercel.json 의 buildCommand 라인은 로그에 출현하지 않음 = 미사용.
 *
 * 이 sentinel 이 잠그는 것 (전부 "오독 유발원 제거"):
 *   A. 루트 vercel.json 에 `prisma migrate deploy` 가 남아있지 않을 것
 *      (미사용 파일이 "빌드가 migrate 한다" 는 false promise 를 재생산)
 *   B. DEV_RUNBOOK 에 폐지된 build-time migrate 의 우회 안내
 *      (`SKIP_PRISMA_MIGRATE=1`, `:6543` 필수) 가 남아있지 않을 것
 *   C. DEV_RUNBOOK 이 `DIRECT_URL` 을 "제거 가능" 으로 안내하지 않을 것 —
 *      §9.10-2 의 smoke:migration 이 DIRECT_URL 을 우선 로드하므로 제거 시
 *      게이트가 :6543 으로 떨어져 상시 exit 2 (STOP) 가 된다.
 *
 * canonical truth: prod DB `_prisma_migrations`.
 *   manifest / health 응답 / smoke 출력은 전부 derived. 이 파일은 문서·설정
 *   계약만 검사하며 DB 에 접촉하지 않는다.
 *
 * 회귀 0: §9.2 (:5432 DDL) / §9.3 (순서 위반 금지) / §9.10 (HEAD 일치 ·
 *   smoke:migration · pendingCount) / apps/web/vercel.json crons 7건 /
 *   vercel-migrate.js NO-OP 앵커 — 전부 보존되어야 한다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

// __dirname = apps/web/src/__tests__/ops
const WEB_ROOT = resolve(__dirname, "../../..");
const REPO_ROOT = resolve(__dirname, "../../../../..");

function readIfExists(p: string): string {
  return existsSync(p) ? readFileSync(p, "utf8") : "";
}

const ROOT_VERCEL_JSON = resolve(REPO_ROOT, "vercel.json");
const RUNBOOK = readFileSync(resolve(REPO_ROOT, "docs/DEV_RUNBOOK.md"), "utf8");
const WEB_VERCEL_JSON = readFileSync(resolve(WEB_ROOT, "vercel.json"), "utf8");
const VERCEL_MIGRATE = readFileSync(
  resolve(WEB_ROOT, "scripts/vercel-migrate.js"),
  "utf8"
);

describe("§migration-rollout-gate — 모순 유물 제거", () => {
  it("A. 루트 vercel.json 이 build-time `prisma migrate deploy` 를 선언하지 않는다", () => {
    // 파일 자체를 삭제하는 것이 정본 해법(JSON 은 주석 불가 → '미사용' 표기 불가).
    // 남겨두는 선택을 하더라도 migrate 구절만은 존재해선 안 된다.
    const src = readIfExists(ROOT_VERCEL_JSON);
    expect(src).not.toMatch(/prisma\s+migrate\s+deploy/);
  });

  it("B. RUNBOOK 이 폐지된 build-time migrate 의 우회/포트 안내를 남기지 않는다", () => {
    // SKIP_PRISMA_MIGRATE=1 임시 설정 안내 (vercel-migrate.js 는 이 env 를 읽지 않음)
    expect(RUNBOOK).not.toMatch(/SKIP_PRISMA_MIGRATE=1/);
    // "DATABASE_URL 포트는 :6543 transaction pooler 필수" — DDL 은 :5432 (§9.2)
    expect(RUNBOOK).not.toMatch(/`:6543`\*\*\s*transaction pooler 필수/);
  });

  it("B2. RUNBOOK 이 'push 하면 migration 이 적용된다' 로 읽히는 안내를 남기지 않는다", () => {
    // 구 §5 행: "Vercel 배포 실패 (migration) | 로컬 migration 파일이 push 되지 않음"
    expect(RUNBOOK).not.toMatch(/migration 파일이 push 되지 않음/);
  });

  it("C. RUNBOOK 이 DIRECT_URL 을 스코프 없이 '제거 가능' 으로 안내하지 않는다", () => {
    // 구 §9.4: "§11.13 lands 후 Vercel 의 다음 env vars 는 **제거 가능** (영향 0)"
    // — Vercel/operator 스코프가 반대이므로 무스코프 진술은 금지.
    expect(RUNBOOK).not.toMatch(/env vars 는 \*\*제거 가능\*\*/);
  });

  it("C2. RUNBOOK 이 DIRECT_URL 을 스코프 분리로 잠근다 (Vercel 재추가 금지 / 로컬 유지 필수)", () => {
    // Vercel 표면: 읽는 주체 0 → 재추가 금지 (재추가 시도가 DATABASE_URL 변형 사고 전례)
    expect(RUNBOOK).toMatch(/Vercel[\s\S]{0,400}재추가 금지/);
    // operator 로컬: smoke:migration 이 우선 로드 → 유지 필수
    expect(RUNBOOK).toMatch(/operator[\s\S]{0,400}유지 필수/);
    // ADR-002 를 뒤집지 않았다는 앵커 — Vercel 부재 실측
    expect(RUNBOOK).toMatch(/hasDirectUrl/);
  });
});

describe("§migration-rollout-gate — 회귀 0", () => {
  it("§9.2 — DDL 은 session pooler :5432 로 실행한다는 지침 보존", () => {
    expect(RUNBOOK).toMatch(/session pooler\s*`:5432`/);
    expect(RUNBOOK).toMatch(/prisma migrate deploy/);
  });

  it("§9.3 — 순서 위반 금지(migrate → verify → push) 보존", () => {
    expect(RUNBOOK).toMatch(/순서 위반 금지/);
    expect(RUNBOOK).toMatch(/migrate\s*→\s*verify\s*→\s*push/);
  });

  it("§9.10 — HEAD 일치 확인 · smoke:migration · health drift 필드 보존", () => {
    expect(RUNBOOK).toMatch(/deploy 전 HEAD 일치 확인/);
    expect(RUNBOOK).toMatch(/npm run smoke:migration --prefix apps\/web/);
    expect(RUNBOOK).toMatch(/pendingCount/);
    expect(RUNBOOK).toMatch(/clean:true/);
  });

  it("apps/web/vercel.json — crons 7건 무손상", () => {
    const parsed = JSON.parse(WEB_VERCEL_JSON) as {
      crons?: Array<{ path: string; schedule: string }>;
      buildCommand?: string;
    };
    expect(parsed.crons).toBeDefined();
    expect(parsed.crons).toHaveLength(7);
    // 빌드 경로는 apps/web — 여기에도 migrate 가 들어가선 안 된다.
    expect(parsed.buildCommand ?? "").not.toMatch(/prisma\s+migrate\s+deploy/);
  });

  it("vercel-migrate.js — NO-OP 로그 앵커 유지 (삭제 금지)", () => {
    expect(VERCEL_MIGRATE).toMatch(/NO-OP/);
    expect(VERCEL_MIGRATE).toMatch(/ADR-002 §11\.13/);
    // 실제 실행 경로가 없어야 한다 — child_process / prisma client 로드 0.
    // (주석 본문의 "no spawn, no execSync" 서술은 앵커이므로 매칭 대상에서 제외:
    //  require/import 구문 자체만 검사)
    expect(VERCEL_MIGRATE).not.toMatch(
      /(require\(|from\s*)["']child_process["']|@prisma\/client/
    );
  });
});
