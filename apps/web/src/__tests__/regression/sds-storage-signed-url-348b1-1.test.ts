/**
 * §11.348-B-1 B1-1 (회귀) — SDS 스토리지 + 서명URL 완성 + 업로드 sentinel
 *
 * signed-url 라우트의 TODO(임시 경로) 제거 → 실제 Supabase createSignedUrl + msdsUrl 폴백.
 * service-role 서버 헬퍼. 업로드 POST(파일→스토리지+SDSDocument). 미설정 시 graceful.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
function read(rel: string): string {
  return readFileSync(join(APP_WEB_ROOT, rel), "utf8");
}
const HELPER = "src/lib/safety/sds-storage.ts";
const SIGNED = "src/app/api/sds/[id]/signed-url/route.ts";
const PRODSDS = "src/app/api/products/[id]/sds/route.ts";

describe("§11.348-B-1 B1-1 — 스토리지 헬퍼", () => {
  it("service-role 클라이언트 + upload + signed-url + 미설정 가드", () => {
    expect(existsSync(join(APP_WEB_ROOT, HELPER))).toBe(true);
    const src = read(HELPER);
    expect(src).toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(src).toContain("export async function uploadSdsFile");
    expect(src).toContain("export async function createSdsSignedUrl");
    expect(src).toContain("createSignedUrl");
    expect(src).toContain("class StorageNotConfiguredError");
  });
});

describe("§11.348-B-1 B1-1 — signed-url 라우트 TODO 제거", () => {
  it("실제 createSdsSignedUrl + msdsUrl 폴백, 임시경로 제거", () => {
    const src = read(SIGNED);
    expect(src).toContain("createSdsSignedUrl({");
    expect(src).toContain("sdsDocument.product?.msdsUrl ?? null");
    // 임시 다운로드 엔드포인트 잔재 제거
    expect(src).not.toContain("`/api/sds/${id}/download`");
  });
});

describe("§11.348-B-1 B1-1 — 업로드 POST", () => {
  it("multipart→스토리지→SDSDocument.create + 미설정 503", () => {
    const src = read(PRODSDS);
    expect(src).toContain("export async function POST");
    expect(src).toContain("request.formData()");
    expect(src).toContain("uploadSdsFile({");
    expect(src).toContain("db.sDSDocument.create");
    expect(src).toContain('code: "STORAGE_NOT_CONFIGURED"');
    expect(src).toContain('source: "upload"');
  });
});
