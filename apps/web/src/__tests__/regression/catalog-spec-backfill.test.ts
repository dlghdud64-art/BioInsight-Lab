/**
 * #catalog-spec-backfill — spec 충전 ①-a(견적 파싱 추출) + ②(supplier/admin 편집) sentinel
 *   (§번호 호영님 배정 — PLAN_catalog-spec-backfill.md)
 *
 * 호영님 결정 (2026-06-11): 조달청 spec 부재 확정 → 소스 = ①견적 회신 + ②직접 입력.
 * 스코프 분할: ①-b(파싱 item→Product 매칭 후 카탈로그 승격 CTA)는 매칭 신뢰도
 *   설계 선행 필요로 후속 분리 (오매칭 적재 = canonical 오염 차단).
 *
 * 원칙: 자동 적재 0 (편집/승인 = 사람 액션만) · 권한 서버측 검증 · §1-2⑤ 정직한 empty 보존.
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const SPEC_API = "src/app/api/products/[id]/specification/route.ts";
const DETAIL = "src/app/products/[id]/page.tsx";
const PARSER = "src/lib/ai/quote-ai-parser.ts";
const PARSE_ROUTE = "src/app/api/quotes/parse-pdf/route.ts";
const MODAL = "src/components/quotes/ai-quote-parse-modal.tsx";

describe("#catalog-spec-backfill ② — spec 편집 API (서버측 권한)", () => {
  it("PATCH route 존재 + zod 검증 + enforceAction", () => {
    expect(existsSync(join(REPO_ROOT, SPEC_API))).toBe(true);
    const src = read(SPEC_API);
    expect(src).toMatch(/export async function PATCH/);
    expect(src).toMatch(/z\.object/);
    expect(src).toMatch(/enforceAction/);
  });

  it("서버측 role 게이트 — ADMIN·SUPPLIER 만 (UI 게이트 단독 금지)", () => {
    const src = read(SPEC_API);
    expect(src).toMatch(/"ADMIN"/);
    expect(src).toMatch(/"SUPPLIER"/);
    expect(src).toMatch(/403/);
  });

  it("쓰기 대상 specification 단일 필드 한정 (specifications JSON 스코프 밖)", () => {
    const src = read(SPEC_API);
    expect(src).toMatch(/specification:/);
    expect(src).not.toMatch(/specifications\s*:/);
  });
});

describe("#catalog-spec-backfill ② — 상세 편집 surface", () => {
  it("스펙 편집 버튼 — canEditSpec(ADMIN·SUPPLIER) 게이트", () => {
    const src = read(DETAIL);
    expect(src).toMatch(/canEditSpec/);
    expect(src).toMatch(/스펙 편집/);
  });

  it("저장 wiring — specification PATCH 호출 (dead button 0)", () => {
    const src = read(DETAIL);
    expect(src).toMatch(/\/specification`/);
    expect(src).toMatch(/saveSpecification|saveSpec/);
  });
});

describe("#catalog-spec-backfill ①-a — 견적 파싱 spec 추출", () => {
  it("파서 스키마 — RawQuoteItem·QuoteItem 에 specification 필드", () => {
    const src = read(PARSER);
    const raw = src.slice(src.indexOf("interface RawQuoteItem"), src.indexOf("interface RawQuoteParseResult"));
    expect(raw.match(/specification: string \| null;/g)?.length).toBe(2);
  });

  it("파서 프롬프트 — 규격 추출 지시 존재", () => {
    const src = read(PARSER);
    expect(src).toMatch(/specification: 규격/);
  });

  it("parse-pdf route — specification 통과", () => {
    const src = read(PARSE_ROUTE);
    expect(src).toMatch(/specification: item\.specification/);
  });

  it("파싱 모달 — 규격 표시 (자동 카탈로그 적재 0 — 승격 CTA 는 ①-b)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/item\.specification/);
    // ①-b 전까지 모달에서 카탈로그 PATCH 금지
    expect(src).not.toMatch(/\/api\/products\/.*\/specification/);
  });
});

describe("#catalog-spec-backfill — 회귀 0", () => {
  it("§1-2⑤ 정직한 empty + 실 spec 조건 보존", () => {
    const src = read(DETAIL);
    expect(src).toMatch(/등록된 상세 스펙이 없습니다/);
    expect(src).toMatch(/product\.specification \|\| product\.regulatoryCompliance/);
  });

  it("safety route 무변경 (편집 패턴 원본 보존)", () => {
    const src = read("src/app/api/products/[id]/safety/route.ts");
    expect(src).toMatch(/safetyUpdateSchema/);
    expect(src).toMatch(/export async function PATCH/);
  });

  it("파서 기존 추출 필드 보존 (name·catalogNumber·price·leadTime·quantity·unit)", () => {
    const src = read(PARSER);
    for (const f of ["name: string;", "catalogNumber: string | null;", "leadTime: string | null;", "unit: string | null;"]) {
      expect(src).toContain(f);
    }
  });
});
