/**
 * §quote-scan-public-storage B (2026-09-13) · Vercel Blob access 단일 출처.
 *
 * ── 왜 ──
 * access 는 파일이 아니라 **스토어 단위**다(Vercel: "Private storage requires a private Blob store").
 * prod 스토어는 public 인데 P0-b1(26a47913)·P0-b2(fed86a6c)가 put 을 "private" 리터럴로 바꿨다 →
 * 업로드가 거부되고 호출부 graceful 경로가 **조용히 스킵**했다(OcrJob·발주서 저장 0 · 화면 오류 0).
 * 리터럴이 파일마다 흩어져 있어서 스토어 모드와 어긋난 줄 몰랐다.
 *
 * ── 이 파일이 보는 것 ──
 *   1. 업로드 access 상수 값 · prod 스토어 모드(public)와 같다
 *   2. 읽기 access 판정 · URL 호스트 → 모드 · 경로만 있으면 업로드 상수
 *   3. **전역** · app·lib 에서 access 리터럴 0 (단일 출처가 우회되지 않는다)
 *
 * ── 이 파일이 안 보는 것 (자기 한계) ──
 *   1. prod 스토어의 **실제** 모드 · 코드로 알 수 없다. 1번 값은 2026-09-13 실측(blob 6건 호스트 `.public.`)이
 *      근거다. private 스토어로 옮기면(런칭 체크리스트 A) 1번을 그 결정과 **같은 커밋**에서 바꾼다.
 *   2. 업로드가 실제로 성공하는가 · 런타임 로그(`[OCR] image upload skipped`)와 OcrJob 행 증가가 판정한다.
 *   3. `access:` 키가 아닌 형태(변수 스프레드 · 옵션 객체 재사용)로 put 에 넘기는 경로.
 */
import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { BLOB_UPLOAD_ACCESS, blobReadAccess } from "@/lib/storage/blob-access";
import { stripComments } from "@/__tests__/_helpers/em-dash-scan";

const SRC = join(__dirname, "..", "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === "__tests__" || name === "node_modules") continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

describe("§quote-scan-public-storage B · 업로드 access 는 스토어 모드와 같다", () => {
  it("🛑 BLOB_UPLOAD_ACCESS = \"public\" (prod 스토어 모드 · 바꾸려면 private 스토어가 먼저)", () => {
    expect(BLOB_UPLOAD_ACCESS).toBe("public");
  });
});

describe("§quote-scan-public-storage B · 읽기 access 는 저장 위치가 말한다", () => {
  it("private 호스트 URL → private", () => {
    expect(blobReadAccess("https://abc123.private.blob.vercel-storage.com/ocr-images/o/label/x.png")).toBe("private");
  });

  it("public 호스트 URL → public", () => {
    expect(blobReadAccess("https://abc123.public.blob.vercel-storage.com/ocr-images/o/label/x.png")).toBe("public");
  });

  it("경로만 있으면(발주서 pathname) → 업로드 access", () => {
    expect(blobReadAccess("po-pdfs/1b2c-ORD-1.pdf")).toBe(BLOB_UPLOAD_ACCESS);
    expect(blobReadAccess("po-pdfs/1b2c-ORD-1.pdf")).toBe("public");
  });

  it("blob 호스트가 아닌 URL → 업로드 access (판정기가 모드를 지어내지 않는다)", () => {
    expect(blobReadAccess("https://example.com/private/x.png")).toBe("public");
  });
});

describe("§quote-scan-public-storage B · 단일 출처가 우회되지 않는다 (전역)", () => {
  it("🛑 app·lib 에서 access 리터럴 0 · blob-access 모듈 자신만 예외", () => {
    const files = [...walk(join(SRC, "app")), ...walk(join(SRC, "lib"))];
    expect(files.length).toBeGreaterThan(500); // 축이 비지 않았다
    const hits: string[] = [];
    for (const f of files) {
      const rel = relative(SRC, f).replace(/\\/g, "/");
      if (rel === "lib/storage/blob-access.ts") continue;
      const code = stripComments(readFileSync(f, "utf8"));
      if (/\baccess:\s*["'](public|private)["']/.test(code)) hits.push(rel);
    }
    expect(hits).toEqual([]);
  });
});
