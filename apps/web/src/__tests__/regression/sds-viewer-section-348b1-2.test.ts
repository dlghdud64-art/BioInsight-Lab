/**
 * §11.348-B-1 B1-2 (회귀) — SDS 문서 뷰어 섹션 sentinel
 *
 * 제품 상세 안전 섹션에 same-canvas SDS 섹션(목록 + 업로드 csrfFetch + 열람 서명URL).
 * canonical 안전필드 승격 아님(보관/열람만). page-per-feature 금지(기존 섹션 통합).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const COMP = "src/components/safety/sds-documents-section.tsx";
const PAGE = "src/app/products/[id]/page.tsx";

describe("§11.348-B-1 B1-2 — SDS 섹션 컴포넌트", () => {
  it("목록 fetch + 업로드(csrfFetch multipart) + 열람(서명URL)", () => {
    expect(existsSync(join(APP_WEB_ROOT, COMP))).toBe(true);
    const src = read(COMP);
    expect(src).toContain("/api/products/${productId}/sds");
    expect(src).toContain("csrfFetch");
    expect(src).toContain('append("file"');
    expect(src).toContain("/api/sds/${docId}/signed-url");
    expect(src).toContain("data.signedUrl");
    // 스토리지 미설정 graceful 안내
    expect(src).toContain("STORAGE_NOT_CONFIGURED");
  });
});

describe("§11.348-B-1 B1-2 — same-canvas 마운트", () => {
  it("products/[id] 안전 섹션에 SdsDocumentsSection", () => {
    const src = read(PAGE);
    expect(src).toContain('from "@/components/safety/sds-documents-section"');
    expect(src).toContain("<SdsDocumentsSection productId={product.id}"); // B1-4: docType prop 추가 허용
  });
});
