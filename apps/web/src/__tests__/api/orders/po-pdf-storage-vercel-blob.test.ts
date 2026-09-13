/**
 * #post-approval-purchase-order-flow Phase 2.3 step 3 — RED→GREEN test
 *
 * Vercel Blob SDK wiring. step 2 의 abstraction (`STORAGE_PROVIDER` ===
 * "vercel-blob") 안 throw 를 실제 `@vercel/blob` put 호출로 swap.
 *
 * 호영님 환경 = Vercel 배포 (29d21a18 redeploy commit 정합). 가장
 * 자연스러운 provider — env `BLOB_READ_WRITE_TOKEN` 만 추가하면 즉시 작동.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const REPO_ROOT_WEB = join(__dirname, "..", "..", "..", "..");
const HELPER = "src/lib/orders/po-pdf-storage.ts";

function read(rel: string): string {
  return readFileSync(join(REPO_ROOT_WEB, rel), "utf8");
}

describe("#post-approval-purchase-order-flow Phase 2.3 step 3 — Vercel Blob wiring", () => {
  it("`@vercel/blob` import 명시 (dynamic 또는 static)", () => {
    const src = read(HELPER);
    expect(src).toMatch(/@vercel\/blob/);
  });

  it("`put` 함수 호출 — vercel-blob case 안", () => {
    const src = read(HELPER);
    expect(src).toMatch(/put\s*\(/);
  });

  it("access 는 스토어 모드 상수 + contentType: 'application/pdf' 명시", () => {
    const src = read(HELPER);
    /* 🛑 승계 2회 (§quote-scan-public-storage):
     *   09-12 P0-b1  `access: 'public'` 요구 → `'private'` 요구로 뒤집었다.
     *   09-13 B      그 `'private'` 가 **public 스토어에서 거부**돼 업로드가 조용히 스킵되고 있었다
     *                (Vercel: access 는 스토어 단위). 검사가 prod 에서 안 도는 값을 붙잡은 형태다.
     *   명제: 업로드 access 는 **스토어 모드 상수 하나**를 따른다(lib/storage/blob-access) · 리터럴 0.
     *   보호(추측 불가 키 · 프록시 전용 노출)는 regression/po-document-private-access 가 본다. */
    expect(src).toMatch(/access:\s*BLOB_UPLOAD_ACCESS\b/);
    expect(src).not.toMatch(/access:\s*["'](public|private)["']/);
    expect(src).toMatch(/contentType:\s*["']application\/pdf["']/);
  });

  it("vercel-blob case 가 throw 가 아닌 실제 wiring", () => {
    const src = read(HELPER);
    const block = src.match(/case\s+["']vercel-blob["'][\s\S]*?(?=case\s+["']|default\s*:)/);
    expect(block).not.toBeNull();
    if (block) {
      // throw 만 있는 placeholder 가 아니어야 함
      expect(block[0]).toMatch(/return\s+\{[\s\S]*?url[\s\S]*?provider/);
    }
  });
});
