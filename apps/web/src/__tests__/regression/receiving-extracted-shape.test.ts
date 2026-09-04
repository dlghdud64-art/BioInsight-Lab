/**
 * §receiving-extracted-shape (호영님 2026-09-05) — 네 쓰기 지점이 같은 계약을 쓴다.
 *
 * 왜 sentinel 이 필요한가:
 *   구조 결함은 "한 지점이 다른 형태로 저장한다" 로 재발한다. 이번에도 다품목 경로만
 *   line 을 그대로 넣어서 brand 축이 사라졌다. 네 지점 중 하나라도 원본을 그대로 넣으면
 *   계약이 깨지므로 **각각** 단언한다(OR 로 묶지 않는다).
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string) => readFileSync(join(REPO_ROOT, rel), "utf8");

const ROUTE = "src/app/api/inventory/smart-receiving/route.ts";
const MODAL = "src/components/inventory/SmartReceivingScannerModal.tsx";
const LIB = "src/lib/inventory/receiving-extracted-data.ts";

describe("§receiving-extracted-shape — 네 쓰기 지점 전부 정규화를 거친다", () => {
  it("buildExtractedData 를 import 한다", () => {
    expect(read(ROUTE)).toMatch(
      /import \{ buildExtractedData, EXTRACTED_SHAPE \} from "@\/lib\/inventory\/receiving-extracted-data"/,
    );
  });

  it("네 지점 모두 buildExtractedData 를 쓴다 (개수 계약)", () => {
    const code = stripComments(read(ROUTE));
    // 다품목 기존 라인 · 다품목 신규 라인 · 단품 분기 A · 단품 분기 B.
    const calls = code.match(/extractedData: buildExtractedData\(/g) ?? [];
    expect(calls).toHaveLength(4);
  });

  it("🛑 원본 payload 를 그대로 넣는 형태로 회귀하지 않는다", () => {
    // 이번 결함의 원형 — line/confirmedData 를 캐스트만 해서 저장했다.
    const code = stripComments(read(ROUTE));
    expect(code).not.toMatch(/extractedData:\s*line as unknown as Prisma\.InputJsonValue/);
    expect(code).not.toMatch(/extractedData:\s*confirmedData as unknown as Prisma\.InputJsonValue/);
  });

  it("shape 는 경로별로 다른 값을 쓴다 (둘 다 SINGLE 로 굳는 것도 회귀다)", () => {
    const code = stripComments(read(ROUTE));
    expect((code.match(/EXTRACTED_SHAPE\.MULTI/g) ?? [])).toHaveLength(2);
    expect((code.match(/EXTRACTED_SHAPE\.SINGLE/g) ?? [])).toHaveLength(2);
  });
});

describe("§receiving-extracted-shape — 공통 보장 필드 계약", () => {
  it("공통 키 목록이 타입과 묶여 있다 (목록만 늘고 타입이 안 늘면 build 가 깨진다)", () => {
    const src = read(LIB);
    expect(src).toMatch(
      /EXTRACTED_COMMON_KEYS = \[[\s\S]*?\] as const satisfies readonly \(keyof ReceivingExtractedCommon\)\[\]/,
    );
  });

  it("brand 가 공통 집합에 있다 — C3 가 기대한 축", () => {
    const src = read(LIB);
    const idx = src.indexOf("EXTRACTED_COMMON_KEYS = [");
    expect(idx).toBeGreaterThan(-1);
    const win = src.slice(idx, idx + 400);
    for (const k of ["shape", "productName", "catalogNumber", "brand", "quantity", "unit", "lotNumber", "expirationDate"]) {
      expect(win, `공통 키 누락: ${k}`).toMatch(new RegExp(`"${k}"`));
    }
  });

  it("공급사명은 brand 에서만 파생한다 (대체 매칭 금지)", () => {
    const src = stripComments(read(LIB));
    const idx = src.indexOf("export function vendorNameFromExtracted(");
    expect(idx).toBeGreaterThan(-1);
    const win = src.slice(idx, idx + 400);
    expect(win).toMatch(/\.brand\b/);
    expect(win).not.toMatch(/productName|catalogNumber/);
  });
});

describe("§receiving-extracted-shape — 다품목이 공급사명을 싣는다", () => {
  it("items[] payload 에 brand 가 있다 (문서 단위 vendor 파생)", () => {
    const src = read(MODAL);
    const idx = src.indexOf("items: includedLines.map((l) => ({");
    expect(idx).toBeGreaterThan(-1);
    const win = src.slice(idx, idx + 900);
    expect(win).toMatch(/brand:\s*scanResult\.parsed\.vendor\?\.name\?\.trim\(\) \|\| null/);
  });

  it("회귀 0 — 기존 라인 필드 보존", () => {
    const src = read(MODAL);
    const idx = src.indexOf("items: includedLines.map((l) => ({");
    const win = src.slice(idx, idx + 900);
    for (const f of ["productName:", "catalogNumber:", "quantity:", "unit:", "category:", "categoryTouched:"]) {
      expect(win, `라인 필드 누락: ${f}`).toMatch(new RegExp(f.replace(":", ":")));
    }
  });
});
