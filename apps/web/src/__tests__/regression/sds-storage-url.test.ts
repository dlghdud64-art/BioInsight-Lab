/**
 * #sds-storage-url (regression) — SDS/COA storage URL env fallback guard.
 *
 * prod env는 NEXT_PUBLIC_SUPABASE_URL 명으로만 존재(SUPABASE_URL 미설정).
 * sds-storage.ts가 SUPABASE_URL만 읽으면 service client=null → StorageNotConfiguredError(503)
 * → COA/SDS 파일 업로드 전면 차단. fallback으로 NEXT_PUBLIC_SUPABASE_URL 수용해야 함.
 * (service-role 클라는 프로젝트 URL(공개값) + service key(시크릿)면 충분.)
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const APP_WEB_ROOT = join(__dirname, "..", "..", "..");
const read = (rel: string): string => readFileSync(join(APP_WEB_ROOT, rel), "utf8");
const STORAGE = "src/lib/safety/sds-storage.ts";

describe("#sds-storage-url — prod URL env fallback", () => {
  it("NEXT_PUBLIC_SUPABASE_URL fallback 수용", () => {
    expect(read(STORAGE)).toContain("process.env.NEXT_PUBLIC_SUPABASE_URL");
  });
  it("service-role key 의존 유지(보안 불변)", () => {
    expect(read(STORAGE)).toContain("process.env.SUPABASE_SERVICE_ROLE_KEY");
  });
});
