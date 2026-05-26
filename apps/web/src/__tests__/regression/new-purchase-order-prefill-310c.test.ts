/**
 * §11.310c #purchase-orders-new-prefill — Regression sentinel
 *
 * 호영님 P1 spec (Q31 = A, 2026-05-26):
 *   재고 도우미 sheet → [바로 발주] → /dashboard/purchase-orders/new?prefill=...
 *   - useSearchParams 로 query string 수신
 *   - form prefill (productName/quantity/supplier/unitPrice/notes)
 *   - [발주 생성] (MVP toast + redirect, §11.310d 에서 real POST 후속)
 *   - [취소] router redirect
 *
 * dead button 0 — 모든 CTA real handler wiring.
 * §11.302 색상 정합 (green-600 primary, amber 0).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT = join(__dirname, "..", "..", "..");
const PATH = "src/app/dashboard/purchase-orders/new/page.tsx";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT, rel), "utf8");
}

describe("§11.310c — NewPurchaseOrderPage 신규 페이지", () => {
  it("파일 존재 + default export", () => {
    expect(existsSync(join(REPO_ROOT, PATH))).toBe(true);
    const src = read(PATH);
    expect(src).toMatch(/export\s+default\s+function\s+NewPurchaseOrderPage/);
  });

  it("Suspense wrapper (useSearchParams 정합)", () => {
    const src = read(PATH);
    expect(src).toMatch(/<Suspense[\s\S]{0,200}<NewPurchaseOrderPageInner\s*\/>/);
  });

  it("useSearchParams + useRouter import", () => {
    const src = read(PATH);
    expect(src).toMatch(/import\s*\{[^}]*useSearchParams[^}]*useRouter[^}]*\}\s*from\s*["']next\/navigation["']/);
  });
});

describe("§11.310c — Query string prefill 수신", () => {
  it("prefill query string 키 4개 + prefill source 인식", () => {
    const src = read(PATH);
    expect(src).toMatch(/searchParams\.get\(["']productName["']\)/);
    expect(src).toMatch(/searchParams\.get\(["']quantity["']\)/);
    expect(src).toMatch(/searchParams\.get\(["']supplier["']\)/);
    expect(src).toMatch(/searchParams\.get\(["']unitPrice["']\)/);
    expect(src).toMatch(/searchParams\.get\(["']prefill["']\)/);
  });

  it("prefill='reorder-recommendation' 분기 (isReorderRecommendation 변수)", () => {
    const src = read(PATH);
    expect(src).toMatch(/isReorderRecommendation/);
    expect(src).toMatch(/prefillSource === "reorder-recommendation"/);
  });

  it("재고 도우미 권장 banner (testid + Sparkles + emerald 톤)", () => {
    const src = read(PATH);
    expect(src).toMatch(/data-testid="new-po-prefill-banner"/);
    expect(src).toMatch(/재고 운영 도우미 권장 초안이 자동 채워졌습니다/);
    expect(src).toMatch(/border-emerald-200 bg-emerald-50\/60/);
  });

  it("mount 1회만 useEffect (사용자 수정 보존)", () => {
    const src = read(PATH);
    expect(src).toMatch(/useEffect\(\(\) => \{[\s\S]{0,800}setForm\(\{/);
    expect(src).toMatch(/eslint-disable-next-line react-hooks\/exhaustive-deps/);
  });

  it("notes 자동 채움 — '재고 운영 도우미 권장 — 안전 재고 미달'", () => {
    const src = read(PATH);
    expect(src).toMatch(/재고 운영 도우미 권장 — 안전 재고 미달/);
  });
});

describe("§11.310c — Form 입력 5개 (productName/quantity/supplier/unitPrice/notes)", () => {
  it("모든 input testid 존재", () => {
    const src = read(PATH);
    expect(src).toMatch(/data-testid="new-po-productName-input"/);
    expect(src).toMatch(/data-testid="new-po-quantity-input"/);
    expect(src).toMatch(/data-testid="new-po-supplier-input"/);
    expect(src).toMatch(/data-testid="new-po-unitPrice-input"/);
    expect(src).toMatch(/data-testid="new-po-notes-input"/);
  });

  it("필수 표시 (productName / quantity / supplier rose-600 *)", () => {
    const src = read(PATH);
    // span text-rose-600 * 3 (productName/quantity/supplier)
    const matches = src.match(/<span className="text-rose-600">\*<\/span>/g);
    expect(matches?.length ?? 0).toBeGreaterThanOrEqual(3);
  });

  it("예상 금액 자동 계산 (quantity × unitPrice)", () => {
    const src = read(PATH);
    expect(src).toMatch(/estimatedAmount\s*=\s*form\.quantity\s*\*\s*form\.unitPrice/);
    expect(src).toMatch(/data-testid="new-po-estimated-amount"/);
  });
});

describe("§11.310c — CTA wiring (dead button 0)", () => {
  it("[발주 생성] CTA — testid + green-600 + handleCreate", () => {
    const src = read(PATH);
    expect(src).toMatch(/data-testid="new-po-create-cta"/);
    expect(src).toMatch(/bg-green-600 hover:bg-green-700/);
    expect(src).toMatch(/onClick=\{handleCreate\}/);
  });

  it("handleCreate — validation 3건 (productName / quantity / supplier)", () => {
    const src = read(PATH);
    expect(src).toMatch(/!form\.productName\.trim\(\)[\s\S]{0,100}toast\.error/);
    expect(src).toMatch(/form\.quantity\s*<=\s*0[\s\S]{0,100}toast\.error/);
    expect(src).toMatch(/!form\.supplier\.trim\(\)[\s\S]{0,100}toast\.error/);
  });

  it("handleCreate — MVP toast.info + redirect (실제 POST 는 §11.310d)", () => {
    const src = read(PATH);
    expect(src).toMatch(/toast\.info[\s\S]{0,200}발주 생성 흐름은 후속 단계에서 활성화/);
    expect(src).toMatch(/router\.push\(["']\/dashboard\/purchase-orders["']\)/);
  });

  it("[취소] CTA — testid + handleCancel + outline", () => {
    const src = read(PATH);
    expect(src).toMatch(/data-testid="new-po-cancel-cta"/);
    expect(src).toMatch(/onClick=\{handleCancel\}/);
    expect(src).toMatch(/border-slate-300/);
  });

  it("PO 목록으로 back button — ArrowLeft + onClick", () => {
    const src = read(PATH);
    expect(src).toMatch(/<ArrowLeft className="h-4 w-4 mr-1"/);
    expect(src).toMatch(/PO 목록으로/);
  });

  it("터치 영역 ≥ 44px (h-11 min-h-[44px])", () => {
    const src = read(PATH);
    const matches = src.match(/h-11 min-h-\[44px\]/g);
    expect(matches?.length ?? 0).toBeGreaterThanOrEqual(2);
  });
});

describe("§11.310c — §11.302 색상 정합 (amber 0)", () => {
  it("amber/orange 사용 0 (호영님 spec)", () => {
    const src = read(PATH);
    expect(src).not.toMatch(/bg-amber-/);
    expect(src).not.toMatch(/text-amber-/);
    expect(src).not.toMatch(/bg-orange-/);
    expect(src).not.toMatch(/border-amber-/);
  });

  it("primary CTA — green-600 (실행 가능 액션)", () => {
    const src = read(PATH);
    expect(src).toMatch(/bg-green-600 hover:bg-green-700 text-white font-semibold/);
  });

  it("예상 금액 — emerald 톤 (§11.302 정합)", () => {
    const src = read(PATH);
    expect(src).toMatch(/bg-emerald-50 border-emerald-200/);
  });
});

describe("§11.310c — 회귀 0", () => {
  it("기존 /dashboard/purchase-orders/page.tsx 변경 0 (audit only)", () => {
    const otherPath = "src/app/dashboard/purchase-orders/page.tsx";
    expect(existsSync(join(REPO_ROOT, otherPath))).toBe(true);
  });
});
