// #catalog-spec-backfill ①-b Phase 3a — 매칭 라우트 + 모달 배지 (read-only) sentinel
// 계약: canonical write 0 / batch 단일 쿼리(N+1 금지) / select 제한 / auth 게이트 /
//       모달 배지 tier별 / 매칭 실패 graceful / 3a 는 승격 PATCH 미포함(쓰기는 3b).
// 패턴: sentinel(readFileSync). DB/컴포넌트 mount 없음.

import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_WEB = join(__dirname, "..", "..", "..");
const read = (rel: string): string => readFileSync(join(REPO_WEB, rel), "utf8");

const ROUTE = "src/app/api/quotes/match-products/route.ts";
const MODAL = "src/components/quotes/ai-quote-parse-modal.tsx";

// ── 1. 매칭 라우트 — read-only · batch · auth ─────────────────────────
describe("§①-b P3a — match-products 라우트", () => {
  const src = read(ROUTE);

  it("auth 게이트 — 미인증 401", () => {
    expect(src).toMatch(/await auth\(\)/);
    expect(src).toMatch(/status:\s*401/);
  });

  it("canonical write 0 — db.product.(update|create|upsert|delete) 부재", () => {
    expect(src).not.toMatch(/db\.product\.(update|create|upsert|delete)/);
  });

  it("순수 매처 소비 — matchQuoteItemToProduct", () => {
    expect(src).toMatch(/matchQuoteItemToProduct/);
  });

  it("batch 단일 쿼리 — findMany 1회만 (item별 개별 쿼리 0)", () => {
    const calls = src.match(/db\.product\.findMany/g) ?? [];
    expect(calls.length).toBe(1);
  });

  it("overfetch 금지 — select 제한(id·name·catalogNumber·modelNumber)", () => {
    expect(src).toMatch(/select:\s*\{[^}]*id:\s*true/);
    expect(src).toMatch(/catalogNumber:\s*true/);
    expect(src).toMatch(/modelNumber:\s*true/);
    expect(src).not.toMatch(/include:\s*\{/); // 전체 관계 로드 금지
  });

  it("입력 상한 — items .max(100)", () => {
    expect(src).toMatch(/\.max\(100\)/);
  });

  it("spec 미사용 — 매칭 호출에 specification: null", () => {
    expect(src).toMatch(/specification:\s*null/);
  });
});

// ── 2. 모달 배지 — tier별 · graceful · read-only ──────────────────────
describe("§①-b P3a — 모달 매칭 배지", () => {
  const src = read(MODAL);

  it("review 진입 시 match-products 호출 (P3b quote-scoped path 로 supersede)", () => {
    // §catalog-A P3b: 구 /api/quotes/match-products(전 카탈로그) → quote-scoped
    //   /api/quotes/${quoteId}/match-products (quoteItemId 등록축 정합). 의도 동일(매칭 호출).
    expect(src).toMatch(/\/api\/quotes\/\$\{quoteId\}\/match-products/);
  });

  it("매칭 실패 graceful — !res.ok 시 return(등록 흐름 무손상)", () => {
    expect(src).toMatch(/if\s*\(!res\.ok\)\s*return/);
  });

  it("tier 배지 — exact '카탈로그 일치' / candidate '후보'", () => {
    expect(src).toMatch(/카탈로그 일치/);
    expect(src).toMatch(/후보 /);
  });

  it("none → '매칭 없음' 정직 노출 (P3b supersede — 미노출은 silent fail 위장)", () => {
    // §catalog-A P3b: none 미노출(return null) → '매칭 없음' 배지 정직 노출 의도 변경.
    //   등록 가드(matchedCount 0 차단)와 짝 — 사용자가 매칭 부재를 인지하고 picker 로 해소.
    expect(src).toMatch(/매칭 없음/);
  });

  it("§11.302 톤 — exact=emerald / candidate=yellow (amber 금지)", () => {
    expect(src).toMatch(/bg-emerald-100 text-emerald-700/);
    expect(src).toMatch(/bg-yellow-100 text-yellow-700/);
    const badgeRegion = src.split("Phase 3a — 카탈로그 매칭 배지")[1]?.slice(0, 600) ?? "";
    expect(badgeRegion).not.toMatch(/amber|orange/);
  });

  it("3a 는 read-only — 승격 spec PATCH 미포함(쓰기는 3b)", () => {
    expect(src).not.toMatch(/\/specification/);
    expect(src).not.toMatch(/method:\s*"PATCH"/);
  });
});

// ── 3. promote 라우트 — ③ security theater 봉합 (호영님 P3a 락) ─────────
describe("§①-b P3a — promote 라우트 role 게이트", () => {
  const PROMOTE = "src/app/api/catalog/promote/route.ts";
  const src = read(PROMOTE);

  it("auth 401 — 미인증 차단", () => {
    expect(src).toMatch(/status:\s*401/);
  });

  it("role 403 — ADMIN|SUPPLIER 외 차단(RESEARCHER 차단)", () => {
    expect(src).toMatch(/status:\s*403/);
  });

  it("role 검증 — ADMIN 명시", () => {
    expect(src).toMatch(/role\s*!==\s*"ADMIN"/);
  });

  it("role 검증 — SUPPLIER 명시", () => {
    expect(src).toMatch(/role\s*!==\s*"SUPPLIER"/);
  });

  it("canonical product INSERT 단독 경로 — 게이트 통과 후 mutation 진입", () => {
    expect(src).toMatch(/session\.user\.role/);
  });
});
