/**
 * §scan-registration-category (호영님 2026-09-04) — 분류 fallback + 출처 기록 + **규칙 승격**.
 *
 * 사고:
 *   `const DEFAULT_CATEGORY: ProductCategory = "OTHER" as ProductCategory` —
 *   prod enum 실재는 [REAGENT,TOOL,EQUIPMENT,RAW_MATERIAL,CONSUMABLE] 로 OTHER 가 없다.
 *   `as` 가 타입 검사를 우회했고, 신규 품목 스캔 입고가 100% 실패해 왔다
 *   (Product 314건 중 OTHER 0건 · 마이그레이션 이력에도 OTHER 없음 = 성공 이력 0).
 *   그런데 구 sentinel 이 `DEFAULT_CATEGORY = "OTHER"` 를 **문자열로 계약**해서
 *   그 전패를 GREEN 으로 지켜주고 있었다.
 *
 * 승격된 규칙(호영님 2026-09-04):
 *   enum 값을 담는 상수는 문자열 리터럴로 sentinel 하지 말 것.
 *   Prisma schema(또는 DB information_schema)에서 실제 값 목록을 읽어
 *   `expect(ALLOWED).toContain(값)` 형태로 검증할 것.
 *   `as` 캐스트가 타입 검사를 우회하는 지점은 전부 이 규칙 대상이다.
 *
 * 그래서 이 파일의 단언은 소스 문자열이 아니라 **schema.prisma 를 파싱한 실재 목록**과
 * 런타임 모듈 값을 대조한다. 구현이 명세를 어겨도 앵커를 맞추면 통과하는 형태를 만들지 않는다.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
// 부정 단언은 주석 제거본에 건다 — 안 그러면 결함을 설명한 주석이 스스로를 매칭한다
// (feedback_negative_sentinel_strip_comments · 이 파일에서도 1회 재현됨).
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";
import { join } from "node:path";
import {
  PRODUCT_CATEGORY_LABELS,
  PRODUCT_CATEGORY_VALUES,
  FALLBACK_PRODUCT_CATEGORY,
  CATEGORY_SOURCE,
  isProductCategory,
  resolveProductCategory,
} from "@/lib/inventory/product-category-options";

const REPO_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

/** schema.prisma 에서 enum 멤버를 실제로 파싱한다 — 이게 이 파일의 truth. */
function schemaEnumMembers(name: string): string[] {
  const schema = read("prisma/schema.prisma");
  const m = new RegExp(`^enum\\s+${name}\\s*\\{([^}]*)\\}`, "m").exec(schema);
  if (!m) throw new Error(`enum ${name} 을 schema.prisma 에서 찾지 못했다`);
  return m[1]
    .split("\n")
    .map((l) => l.replace(/\/\/.*$/, "").trim())
    .filter(Boolean);
}

const ROUTE = "src/app/api/inventory/smart-receiving/route.ts";
const MODAL = "src/components/inventory/SmartReceivingScannerModal.tsx";
const OPTIONS = "src/lib/inventory/product-category-options.ts";

describe("§scan-registration-category — 규칙 승격: 상수는 schema 실재와 대조한다", () => {
  it("fallback 은 schema 에 실재하는 멤버다 (문자열 계약 아님)", () => {
    const allowed = schemaEnumMembers("ProductCategory");
    expect(allowed).toContain(FALLBACK_PRODUCT_CATEGORY);
  });

  it("fallback = REAGENT (호영님 2026-09-04 결정 · 과분류가 저분류보다 안전)", () => {
    // 값 자체는 결정 사항이라 잠근다. 단, 위 단언이 schema 실재를 먼저 강제한다.
    expect(FALLBACK_PRODUCT_CATEGORY).toBe("REAGENT");
  });

  it("화면 목록 = schema 목록 (전수 · 누락도 잉여도 0)", () => {
    const allowed = schemaEnumMembers("ProductCategory");
    expect([...PRODUCT_CATEGORY_VALUES].sort()).toEqual([...allowed].sort());
    // 라벨도 전수 — Record<ProductCategory, string> 이라 build 에서도 강제되지만
    // 런타임 객체가 실제로 채워졌는지는 여기서 본다.
    for (const c of allowed) {
      expect(PRODUCT_CATEGORY_LABELS[c as keyof typeof PRODUCT_CATEGORY_LABELS]).toBeTruthy();
    }
  });

  it("존재하지 않는 값은 분류로 인정하지 않는다 — 이번 사고값 OTHER 포함", () => {
    expect(isProductCategory("OTHER")).toBe(false);
    expect(isProductCategory("")).toBe(false);
    expect(isProductCategory(null)).toBe(false);
    expect(isProductCategory("REAGENT")).toBe(true);
  });

  it("공용 모듈에 as 캐스트가 없다 (우회 지점 재도입 차단)", () => {
    const src = read(OPTIONS);
    expect(stripComments(src)).not.toMatch(/["'][A-Z_]+["']\s+as\s+ProductCategory/);
    // 런타임 import 0 — 클라이언트 번들에 Prisma 런타임이 끌려오면 안 된다.
    expect(src).toMatch(/import type \{ ProductCategory \} from "@prisma\/client"/);
  });
});

describe("§scan-registration-category — 출처 기록 (호영님 조건 2)", () => {
  // 승계(§scan-category-touched 2026-09-04) — 구 판본은 값만 보고 USER_SELECTED 를 찍었다.
  //   화면이 fallback 을 선채움해 전송하므로 **선채움 통과가 전부 USER_SELECTED 로 기록됐다**
  //   (prod 스모크 실측 3/3). 판정 축은 값이 아니라 "건드렸는가" 다.
  it("건드렸으면 USER_SELECTED, 안 건드렸으면 FALLBACK — 값이 같아도 갈린다", () => {
    // 🔑 이 두 줄이 이 컬럼의 존재 이유다. 같은 REAGENT 인데 출처가 다르다.
    expect(resolveProductCategory("REAGENT", true).categorySource).toBe(
      CATEGORY_SOURCE.USER_SELECTED,
    );
    expect(resolveProductCategory("REAGENT", false).categorySource).toBe(
      CATEGORY_SOURCE.FALLBACK,
    );
    expect(resolveProductCategory("TOOL", true)).toEqual({
      category: "TOOL",
      categorySource: CATEGORY_SOURCE.USER_SELECTED,
    });
  });

  it("판단 근거가 없으면 UNKNOWN — 모른다고 쓰는 건 지어내는 게 아니다", () => {
    // touched 축을 안 보낸 요청(구 클라이언트·직접 호출)은 둘 중 무엇인지 알 수 없다.
    expect(resolveProductCategory("REAGENT")).toEqual({
      category: "REAGENT",
      categorySource: CATEGORY_SOURCE.UNKNOWN,
    });
    expect(resolveProductCategory("TOOL", undefined).categorySource).toBe(
      CATEGORY_SOURCE.UNKNOWN,
    );
  });

  it("무효값은 건드렸는지와 무관하게 fallback + FALLBACK", () => {
    for (const touched of [true, false, undefined]) {
      expect(resolveProductCategory("OTHER", touched)).toEqual({
        category: FALLBACK_PRODUCT_CATEGORY,
        categorySource: CATEGORY_SOURCE.FALLBACK,
      });
      expect(resolveProductCategory(null, touched).categorySource).toBe(
        CATEGORY_SOURCE.FALLBACK,
      );
    }
  });

  it("🛑 기각된 안 — '값이 fallback 과 같으면 FALLBACK' 이 아니다", () => {
    // 그렇게 하면 실제로 시약을 고른 사람도 FALLBACK 으로 찍혀 반대 방향 오염이 생긴다.
    expect(resolveProductCategory(FALLBACK_PRODUCT_CATEGORY, true).categorySource).toBe(
      CATEGORY_SOURCE.USER_SELECTED,
    );
  });

  it("UNKNOWN 은 null 과 다르다 — 세 상태가 각각 존재한다", () => {
    // null       = 컬럼 도입 전(구 314행)
    // UNKNOWN    = 도입 후인데 판단 근거 없음
    // FALLBACK   = 안 건드림이 확인됨
    expect(new Set(Object.values(CATEGORY_SOURCE)).size).toBe(3);
    expect(CATEGORY_SOURCE.UNKNOWN).toBe("UNKNOWN");
  });

  it("Product.categorySource 컬럼이 schema 에 실재한다 (TEXT nullable · enum 아님)", () => {
    const schema = read("prisma/schema.prisma");
    const model = /^model Product \{([\s\S]*?)^\}/m.exec(schema);
    expect(model).not.toBeNull();
    expect(model![1]).toMatch(/categorySource\s+String\?/);
  });

  it("마이그레이션이 additive only 다 (기존 314행 무접촉)", () => {
    const sql = read("prisma/migrations/20260904040000_product_category_source/migration.sql");
    expect(sql).toMatch(/ALTER TABLE "Product" ADD COLUMN "categorySource" TEXT;/);
    expect(sql).not.toMatch(/DROP|NOT NULL|UPDATE |DELETE /);
  });
});

describe("§scan-registration-category — 서버가 두 생성 지점 모두에 기록한다", () => {
  it("단품 신규 경로", () => {
    const src = read(ROUTE);
    const idx = src.indexOf("const resolvedCategory = resolveProductCategory(");
    expect(idx).toBeGreaterThan(-1);
    const win = src.slice(idx, idx + 900);
    expect(win).toMatch(/category:\s*resolvedCategory\.category/);
    expect(win).toMatch(/categorySource:\s*resolvedCategory\.categorySource/);
  });

  it("다품목 신규 라인 경로", () => {
    // ④ 경로는 각각 단언한다 — 하나가 끊기는 것도 회귀다.
    const src = read(ROUTE);
    const idx = src.indexOf("const lineCategory = resolveProductCategory(line.category, line.categoryTouched)");
    expect(idx).toBeGreaterThan(-1);
    const win = src.slice(idx, idx + 900);
    expect(win).toMatch(/category:\s*lineCategory\.category/);
    expect(win).toMatch(/categorySource:\s*lineCategory\.categorySource/);
  });

  it("라우트에 구 DEFAULT_CATEGORY 상수가 남아 있지 않다", () => {
    expect(stripComments(read(ROUTE))).not.toMatch(/const DEFAULT_CATEGORY/);
  });
});

describe("§scan-registration-category — 화면에 값이 보인다 (호영님 조건 1)", () => {
  it("단품 폼에 분류 select 가 있고 공용 목록을 렌더한다", () => {
    const src = read(MODAL);
    const idx = src.indexOf('data-testid="srm-category"');
    expect(idx).toBeGreaterThan(-1);
    expect(src).toMatch(/value=\{form\.category\}/);
    // 승계(§scan-category-touched): 핸들러가 값 설정 **과** 조작 기록을 같이 한다.
    expect(src).toMatch(/setForm\(\{ \.\.\.form, category: v \}\);[\s\S]{0,160}?setCategoryTouched\(true\)/);
    expect(src).toMatch(/PRODUCT_CATEGORY_VALUES\.map/);
    expect(src).toMatch(/PRODUCT_CATEGORY_LABELS\[c\]/);
  });

  it("fallback 이 선채움 되고, fallback 상태임이 화면에 표시된다", () => {
    const src = read(MODAL);
    expect(src).toMatch(/category:\s*FALLBACK_PRODUCT_CATEGORY/);
    expect(src).toMatch(/data-testid="srm-category-fallback-note"/);
    expect(src).toMatch(/기본값입니다 · 다르면 바꿔 주세요/);
  });

  it("다품목 행에도 분류 select 가 있다 (라인마다 다를 수 있다)", () => {
    const src = read(MODAL);
    expect(src).toMatch(/data-testid="srm-multi-category"/);
    expect(src).toMatch(/value=\{l\.category\}/);
    // 승계: 그 행만 값 + 조작 기록.
    expect(src).toMatch(/j === i \? \{ \.\.\.x, category: v, categoryTouched: true \} : x/);
  });

  it("두 전송 경로가 각각 category 를 싣는다", () => {
    const src = read(MODAL);
    // 단품
    const single = src.indexOf("storageCondition: form.storageCondition.trim() || null,");
    expect(single).toBeGreaterThan(-1);
    expect(src.slice(single, single + 300)).toMatch(/category:\s*form\.category/);
    // 다품목
    const multi = src.indexOf("items: includedLines.map((l) => ({");
    expect(multi).toBeGreaterThan(-1);
    expect(src.slice(multi, multi + 400)).toMatch(/category:\s*l\.category/);
  });
});
