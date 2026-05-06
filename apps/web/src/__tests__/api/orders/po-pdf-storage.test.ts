/**
 * #post-approval-purchase-order-flow Phase 2.3 step 2 — RED→GREEN test
 *
 * PDF storage upload + Order.poDocumentUrl 저장 wiring.
 * step 1 (schema) 위에 storage layer 추가.
 *
 * 산출 2 곳:
 *   - lib/orders/po-pdf-storage.ts (NEW) — uploadPoPdf helper
 *   - api/orders/[id]/generate-pdf/route.ts — upload + db update
 *
 * canonical truth = Order (DB), poDocumentUrl = storage URL (snapshot).
 * 호영님 host config (S3 / Vercel Blob / Supabase) 후 helper 분기. 본
 * batch 는 abstraction layer + graceful fallback (upload 실패 시 stream).
 */

import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT_WEB = join(__dirname, "..", "..", "..", "..");
const HELPER = "src/lib/orders/po-pdf-storage.ts";
const ROUTE = "src/app/api/orders/[id]/generate-pdf/route.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT_WEB, rel), "utf8");
}
function exists(rel: string): boolean {
  return existsSync(join(REPO_ROOT_WEB, rel));
}

describe("#post-approval-purchase-order-flow Phase 2.3 step 2 — storage helper", () => {
  it("`lib/orders/po-pdf-storage.ts` 신규 file 존재", () => {
    expect(exists(HELPER)).toBe(true);
  });

  it("`uploadPoPdf` 함수 export — Buffer + filename → Promise<{ url }>", () => {
    const src = read(HELPER);
    expect(src).toMatch(/export\s+(async\s+)?function\s+uploadPoPdf/);
    expect(src).toMatch(/Buffer/);
    expect(src).toMatch(/filename/);
    expect(src).toMatch(/url/);
  });

  it("storage provider 분기 — env var 또는 default fallback 명시", () => {
    const src = read(HELPER);
    expect(src).toMatch(/process\.env|STORAGE_PROVIDER|STORAGE_BLOB|provider/);
  });
});

describe("#post-approval-purchase-order-flow Phase 2.3 step 2 — route wiring", () => {
  it("`uploadPoPdf` import 명시", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/import\s*\{[\s\S]*?uploadPoPdf[\s\S]*?\}\s+from/);
  });

  it("uploadPoPdf 호출 + Order.poDocumentUrl + poDocumentGeneratedAt 업데이트", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/uploadPoPdf\s*\(/);
    expect(src).toMatch(/poDocumentUrl/);
    expect(src).toMatch(/poDocumentGeneratedAt/);
  });

  it("graceful fallback — upload 실패 시 stream 응답 유지 (try/catch)", () => {
    const src = read(ROUTE);
    expect(src).toMatch(/try\s*\{[\s\S]*?uploadPoPdf|catch\s*\([\s\S]*?\)\s*\{/);
  });
});
