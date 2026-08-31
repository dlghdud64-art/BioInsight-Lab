import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect } from "vitest";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

/**
 * §scan-recognition-upgrade P4 sentinel — 공급사 템플릿 학습 (초안 · RED 단계).
 * 🛑 GREEN 구현은 prod DDL 적용("진행" → migrate deploy → status up to date) 뒤에만 — §9 순서.
 *
 * 잠그는 계약:
 *   1) migration = additive(CREATE 3문 · 기존 DROP/ALTER 0)
 *   2) 학습 저장(recordVendorTemplates)은 **확정 경로에만** — P1 confirmCoa(inspect 확정) ·
 *      /api/ocr/correct. 인식 응답 라우트(coa-recognize)에는 0(자동 학습 위장 금지).
 *   3) 힌트 주입 = runOcrPipeline 옵션 `templateHints`(기본 on) — off 시 기존 경로 무회귀.
 *   4) 캐시 키에 템플릿 버전(max updatedAt) 포함 — 학습 후 구캐시 오염 방지.
 */

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

const MIGRATION = "prisma/migrations/20260831210000_vendor_parse_template/migration.sql";
const LIB = "src/lib/ocr/vendor-template.ts";
const PIPELINE = "src/lib/ocr/run-ocr-pipeline.ts";
const RECOGNIZE = "src/app/api/receiving-drafts/[id]/coa-recognize/route.ts";
const CORRECT = "src/app/api/ocr/correct/[jobId]/route.ts";
const INSPECT = "src/app/api/receiving-drafts/[id]/inspect/route.ts";

describe("§scan-recognition-upgrade P4 (1) — migration additive", () => {
  it("CREATE 3문뿐 — 기존 테이블 DROP/ALTER 0", () => {
    const sql = read(MIGRATION);
    expect(sql).toMatch(/CREATE TABLE "VendorParseTemplate"/);
    expect((sql.match(/^CREATE /gm) ?? []).length).toBe(3);
    expect(sql).not.toMatch(/^DROP /m);
    expect(sql).not.toMatch(/^ALTER /m);
  });
});

describe("§scan-recognition-upgrade P4 (2) — 학습 저장은 확정 경로에만", () => {
  it("인식 응답 라우트(coa-recognize)에 템플릿 쓰기 0", () => {
    const src = stripComments(read(RECOGNIZE));
    expect(src).not.toMatch(/vendorParseTemplate/);
    expect(src).not.toMatch(/recordVendorTemplates/);
  });

  it("확정 경로(inspect lotSource=coa_ocr)에 학습 저장 배선 — coa_ocr 확정에만", () => {
    const src = stripComments(read(INSPECT));
    expect(src).toMatch(/lotSource !== "coa_ocr"[\s\S]{0,80}?continue/);
    expect(src).toMatch(/recordVendorTemplates\(/);
  });

  it("/ocr/correct 는 저장 placeholder(503) — 활성화 배치에서 학습 동반 배선 (예약 핀)", () => {
    // 실측 정정(2026-08-31): PLAN §0 의 'correct 가 보정을 저장한다'는 기술은 과대 —
    //   실제로는 lookup 후 503 placeholder. 이 핀이 풀리면(활성화) 학습 배선을 함께 한다.
    const src = read(CORRECT);
    expect(src).toMatch(/Phase 5/);
    expect(stripComments(src)).not.toMatch(/vendorParseTemplate|recordVendorTemplates/);
  });
});

describe("§scan-recognition-upgrade P4 (3) — 힌트 주입 플래그 · 무회귀", () => {
  it("runOcrPipeline templateHints 옵션 — 기본 on · off 시 기존 경로", () => {
    const src = stripComments(read(PIPELINE));
    expect(src).toMatch(/templateHints/);
    expect(src).toMatch(/templateHints !== false/);
    expect(src).toMatch(/applyTemplateHints\(/);
  });

  it("주입 결과는 후보(source: template) — 파이프라인이 결과를 자동 확정하지 않는다", () => {
    const src = stripComments(read(LIB));
    expect(src).toMatch(/source: "template"/);
    expect(src).not.toMatch(/canCommit|confirmed: true/);
  });
});

describe("§scan-recognition-upgrade P4 (4) — 캐시 키 템플릿 버전", () => {
  it("캐시 lookup 에 템플릿 버전(max updatedAt) 반영", () => {
    const src = stripComments(read(PIPELINE));
    expect(src).toMatch(/templateVersion/);
  });
});
